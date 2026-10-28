import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGame, createGame } from '../src/game.js';
import { BLACK, WHITE, createPosition, positionKey } from '../src/rules.js';

/** Opening that lets white close 0-1-2 on its third placement; black holds 9 and 10. */
function gameBeforeFirstMill() {
  const game = createGame();
  for (const to of [0, 9, 1, 10]) assert.ok(game.step(null, to));
  return game;
}

// Moving phase, four quiet pieces each: white can travel round the inner
// square from 6, black round the outer-middle face 0-1-4-3-10-9, and no
// line can ever be completed by either side.
const QUIET_START = createPosition({ white: [6, 2, 21, 20], black: [0, 23, 13, 18] });
const WHITE_LOOP = [6, 7, 8, 12, 17, 16, 15, 11];
const BLACK_LOOP = [0, 1, 4, 3, 10, 9];

test('a new game starts on the empty board with white to place', () => {
  const game = createGame();
  const state = game.getState();
  assert.equal(state.board.length, 24);
  assert.ok(state.board.every((cell) => cell === null));
  assert.equal(state.turn, WHITE);
  assert.equal(state.phase, 'placing');
  assert.deepEqual(state.inHand, { white: 9, black: 9 });
  assert.deepEqual(state.onBoard, { white: 0, black: 0 });
  assert.equal(state.pending, null);
  assert.deepEqual(state.removable, []);
  assert.equal(state.lastMove, null);
  assert.equal(state.moveCount, 0);
  assert.equal(state.noMillMoves, 0);
  assert.equal(state.result, null);
  assert.equal(game.canUndo(), false);
  assert.equal(game.undo(), false);
});

test('a step that closes a mill waits for a removal before the turn passes', () => {
  const game = gameBeforeFirstMill();
  assert.ok(game.step(null, 2));
  let state = game.getState();
  assert.deepEqual(state.pending, { from: null, to: 2 });
  assert.equal(state.turn, WHITE);
  assert.equal(state.board[2], WHITE);
  assert.deepEqual(state.inHand, { white: 6, black: 7 });
  assert.deepEqual(state.onBoard, { white: 3, black: 2 });
  assert.deepEqual(state.removable, [9, 10]);
  assert.equal(state.moveCount, 4);

  assert.equal(game.step(null, 5), false, 'no other step while a removal is pending');
  assert.equal(game.play({ from: null, to: 5 }), false);
  assert.equal(game.remove(0), false, 'own piece');
  assert.equal(game.remove(5), false, 'empty point');

  assert.ok(game.remove(9));
  state = game.getState();
  assert.equal(state.pending, null);
  assert.deepEqual(state.removable, []);
  assert.equal(state.turn, BLACK);
  assert.equal(state.board[9], null);
  assert.deepEqual(state.lastMove, { from: null, to: 2, remove: 9 });
  assert.deepEqual(state.onBoard, { white: 3, black: 1 });
  assert.equal(state.moveCount, 5);
});

test('undo cancels a pending step, then takes back whole moves', () => {
  const game = gameBeforeFirstMill();
  const beforeMill = game.getState();
  game.step(null, 2);
  assert.equal(game.canUndo(), true);
  assert.ok(game.undo());
  assert.deepEqual(game.getState(), beforeMill);

  game.step(null, 2);
  game.remove(10);
  assert.ok(game.undo());
  assert.deepEqual(game.getState(), beforeMill, 'the removal goes back together with its step');

  for (let i = 0; i < 4; i += 1) assert.ok(game.undo());
  assert.deepEqual(game.getState(), createGame().getState());
  assert.equal(game.canUndo(), false);
  assert.equal(game.undo(), false);
});

test('illegal actions are rejected and change nothing', () => {
  const game = createGame();
  game.step(null, 0);
  const before = game.getState();
  assert.equal(game.step(null, 0), false, 'occupied point');
  assert.equal(game.step(0, 1), false, "moving the opponent's piece while placing");
  assert.equal(game.step(null, 30), false, 'off the board');
  assert.equal(game.remove(0), false, 'no mill was closed');
  assert.equal(game.play({ from: null, to: 0, remove: null }), false);
  assert.deepEqual(game.getState(), before);
});

test('play applies a whole move, for example one chosen by the AI', () => {
  const game = createGame({ position: createPosition({ white: [0, 1, 14, 4], black: [21, 22, 23, 10, 5] }) });
  assert.equal(game.play({ from: 14, to: 2 }), false, 'the removal is missing');
  assert.equal(game.play({ from: 14, to: 2, remove: 22 }), false, 'protected by a mill');
  assert.ok(game.play({ from: 14, to: 2, remove: 10 }));
  const state = game.getState();
  assert.deepEqual(state.lastMove, { from: 14, to: 2, remove: 10 });
  assert.equal(state.turn, BLACK);

  const fresh = createGame();
  assert.ok(fresh.play({ to: 4 }), 'missing fields count as null');
  assert.deepEqual(fresh.getState().lastMove, { from: null, to: 4, remove: null });
});

test('snapshots and start positions are copies', () => {
  const start = createPosition({ white: [0, 7, 13, 18], black: [1, 9, 14, 22] });
  const game = createGame({ position: start });
  start.board[5] = BLACK;
  game.step(7, 4);
  const state = game.getState();
  state.board[4] = BLACK;
  state.inHand.white = 5;
  state.history.push('x');
  state.lastMove.to = 8;
  const fresh = game.getState();
  assert.equal(fresh.board[5], null);
  assert.equal(fresh.board[4], WHITE);
  assert.equal(fresh.inHand.white, 0);
  assert.equal(fresh.history.length, 2);
  assert.equal(fresh.lastMove.to, 4);
});

test('reducing the opponent to two pieces wins and ends the game', () => {
  const game = createGame({ position: createPosition({ white: [0, 1, 14, 10], black: [5, 18, 20] }) });
  assert.ok(game.step(14, 2));
  assert.ok(game.remove(18));
  assert.deepEqual(game.getState().result, { winner: WHITE, reason: 'pieces' });
  assert.equal(game.step(5, 4), false, 'the game is over');
  assert.equal(game.play({ from: 5, to: 13 }), false);
  assert.ok(game.undo());
  assert.equal(game.getState().result, null);
});

test('leaving the opponent without a legal move wins', () => {
  const game = createGame({ position: createPosition({ white: [1, 9, 14, 19], black: [0, 2, 21, 23] }) });
  assert.ok(game.step(19, 22));
  assert.deepEqual(game.getState().result, { winner: WHITE, reason: 'blocked' });

  const alreadyBlocked = createPosition({ white: [1, 9, 14, 22], black: [0, 2, 21, 23], turn: BLACK });
  assert.deepEqual(createGame({ position: alreadyBlocked }).getState().result, { winner: WHITE, reason: 'blocked' });
});

test('the third occurrence of the same position is a draw', () => {
  const game = createGame({ position: QUIET_START });
  const moves = [[6, 7], [0, 1], [7, 6], [1, 0]];
  for (let ply = 0; ply < 8; ply += 1) {
    assert.equal(game.getState().result, null, `ply ${ply}`);
    assert.ok(game.step(...moves[ply % 4]));
  }
  const state = game.getState();
  assert.deepEqual(state.result, { winner: null, reason: 'repetition' });
  assert.equal(state.history.filter((key) => key === positionKey(QUIET_START)).length, 3);
});

test('fifty moves in a row without a mill are a draw', () => {
  const game = createGame({ position: QUIET_START });
  for (let ply = 0; ply < 50; ply += 1) {
    const state = game.getState();
    assert.equal(state.result, null, `ply ${ply}`);
    assert.equal(state.noMillMoves, ply);
    const loop = ply % 2 === 0 ? WHITE_LOOP : BLACK_LOOP;
    const lap = Math.floor(ply / 2);
    assert.ok(game.step(loop[lap % loop.length], loop[(lap + 1) % loop.length]), `ply ${ply}`);
  }
  const state = game.getState();
  assert.equal(state.noMillMoves, 50);
  assert.deepEqual(state.result, { winner: null, reason: 'fifty-moves' });
});

test('a mill restarts the no-mill count and the repetition history', () => {
  const game = createGame({ position: createPosition({ white: [0, 1, 14, 10], black: [3, 18, 19, 20, 22] }) });
  assert.ok(game.step(10, 9));
  assert.ok(game.step(3, 4));
  assert.equal(game.getState().noMillMoves, 2);
  assert.equal(game.getState().history.length, 3);
  assert.ok(game.step(14, 2));
  assert.deepEqual(game.getState().removable, [4, 22]);
  assert.ok(game.remove(4));
  const state = game.getState();
  assert.equal(state.noMillMoves, 0);
  assert.equal(state.history.length, 1);
});

test('the demo shows a freshly closed mill waiting for a removal', () => {
  const state = createDemoGame().getState();
  assert.equal(state.phase, 'moving');
  assert.deepEqual(state.inHand, { white: 0, black: 0 });
  assert.deepEqual(state.onBoard, { white: 7, black: 7 });
  assert.equal(state.turn, WHITE);
  assert.deepEqual(state.pending, { from: 7, to: 4 });
  assert.equal(state.board[4], WHITE);
  assert.equal(state.board[7], null);
  assert.deepEqual(state.removable, [1, 8, 12, 16], 'the black mill 21-22-23 is protected');
  assert.equal(state.result, null);
  assert.deepEqual(createDemoGame().getState(), state, 'the demo is deterministic');

  const game = createDemoGame();
  assert.ok(game.remove(12));
  const after = game.getState();
  assert.equal(after.turn, BLACK);
  assert.deepEqual(after.onBoard, { white: 7, black: 6 });
  assert.equal(after.result, null);
});

test('the phase follows the shown board while a removal is pending after the last placement', () => {
  const game = createGame({
    position: createPosition({ white: [0, 1, 5, 9, 13], black: [3, 4, 14, 20, 23], inHand: { white: 1 } }),
  });
  assert.equal(game.getState().phase, 'placing');
  assert.ok(game.step(null, 2));
  const state = game.getState();
  assert.ok(state.pending);
  assert.deepEqual(state.inHand, { white: 0, black: 0 });
  assert.equal(state.phase, 'moving');
  assert.ok(game.undo());
  assert.equal(game.getState().phase, 'placing');
});
