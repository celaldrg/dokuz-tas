import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, chooseMove, evaluate } from '../src/ai.js';
import { createDemoGame, createGame } from '../src/game.js';
import { createRng } from '../src/rng.js';
import {
  BLACK,
  WHITE,
  applyMove,
  createPosition,
  initialPosition,
  isLegalMove,
  positionKey,
} from '../src/rules.js';

const ALL_LEVELS = Object.keys(LEVELS);
const STRONG_LEVELS = ['medium', 'hard'];

function swapColours(position) {
  const other = { [WHITE]: BLACK, [BLACK]: WHITE };
  return {
    board: position.board.map((cell) => (cell === null ? null : other[cell])),
    turn: other[position.turn],
    inHand: { white: position.inHand.black, black: position.inHand.white },
  };
}

const POSITIONS = {
  opening: initialPosition(),
  placingWithMill: createPosition({ white: [0, 1, 4], black: [9, 10, 13], inHand: { white: 6, black: 6 } }),
  moving: createPosition({
    white: [0, 2, 4, 6, 10, 12, 16, 20, 22],
    black: [1, 3, 5, 7, 9, 11, 13, 15, 17],
  }),
  blackMoving: createPosition({ white: [7, 0, 13, 18], black: [1, 9, 14, 22], turn: BLACK }),
  flying: createPosition({ white: [0, 7, 13], black: [1, 9, 14, 22, 18] }),
  singleMove: createPosition({ white: [0, 2, 21, 20], black: [1, 9, 14, 13, 19] }),
};

test('every level returns a legal move in every phase', () => {
  for (const [name, position] of Object.entries(POSITIONS)) {
    for (const level of ALL_LEVELS) {
      const move = chooseMove(position, { level, seed: 5 });
      assert.ok(move && isLegalMove(position, move), `${level} on ${name}: ${JSON.stringify(move)}`);
    }
  }
  assert.deepEqual(chooseMove(POSITIONS.singleMove, { level: 'hard' }), { from: 21, to: 22, remove: null });
});

test('closes a mill and removes a piece of the opponent threat', () => {
  // White can close 0-1-2; black threatens 9-10-11.
  const position = createPosition({ white: [0, 1], black: [9, 10], inHand: { white: 7, black: 7 } });
  for (const level of STRONG_LEVELS) {
    const move = chooseMove(position, { level, seed: 1 });
    assert.equal(move.to, 2, level);
    assert.ok([9, 10].includes(move.remove), level);
  }
});

test("blocks the opponent's open mill", () => {
  const position = createPosition({ white: [4, 10], black: [21, 22], inHand: { white: 7, black: 7 } });
  for (const level of STRONG_LEVELS) {
    assert.equal(chooseMove(position, { level, seed: 1 }).to, 23, level);
  }
});

test('flies into a mill when it has three pieces left', () => {
  const position = createPosition({ white: [0, 1, 20], black: [6, 8, 15, 17, 18] });
  for (const level of STRONG_LEVELS) {
    const move = chooseMove(position, { level, seed: 1 });
    assert.deepEqual([move.from, move.to], [20, 2], level);
    assert.notEqual(move.remove, null);
  }
});

test('never misses a win by blockade', () => {
  const position = createPosition({ white: [1, 9, 14, 19], black: [0, 2, 21, 23] });
  for (const level of ALL_LEVELS) {
    for (let seed = 1; seed <= 5; seed += 1) {
      assert.deepEqual(chooseMove(position, { level, seed }), { from: 19, to: 22, remove: null }, level);
    }
  }
});

test('avoids a repetition draw when ahead and seeks it when behind', () => {
  // White is two pieces up and has no mill to close, so every move is quiet.
  const ahead = { ...createPosition({ white: [0, 4, 10, 13, 19, 23], black: [6, 8, 15, 17] }), history: [], noMillMoves: 0 };
  const behind = { ...swapColours(ahead), turn: WHITE, history: [], noMillMoves: 0 };
  const repeating = (state, move) => {
    const key = positionKey(applyMove(state, move));
    return { ...state, history: [key, key, positionKey(state)] };
  };
  for (const level of ALL_LEVELS) {
    const favourite = chooseMove(ahead, { level, seed: 3 });
    assert.equal(favourite.remove, null);
    assert.notDeepEqual(chooseMove(repeating(ahead, favourite), { level, seed: 3 }), favourite, level);

    const drawingMove = { from: 6, to: 7, remove: null };
    assert.deepEqual(chooseMove(repeating(behind, drawingMove), { level, seed: 3 }), drawingMove, level);
  }
});

test('the same seed gives the same move and different seeds vary the play', () => {
  const start = initialPosition();
  for (const level of ALL_LEVELS) {
    assert.deepEqual(chooseMove(start, { level, seed: 42 }), chooseMove(start, { level, seed: 42 }), level);
  }
  assert.deepEqual(chooseMove(start, { level: 'medium', rng: createRng(7) }), chooseMove(start, { level: 'medium', seed: 7 }));
  const openings = new Set();
  for (let seed = 1; seed <= 20; seed += 1) openings.add(chooseMove(start, { level: 'easy', seed }).to);
  assert.ok(openings.size > 3, `only ${openings.size} different openings`);
});

test('works on structured-cloned game snapshots, as inside a Web Worker', () => {
  const game = createGame();
  for (const to of [4, 10, 19]) game.step(null, to);
  const state = game.getState();
  const options = { level: 'medium', seed: 11 };
  const move = chooseMove(structuredClone(state), options);
  assert.deepEqual(move, chooseMove(state, options));
  assert.deepEqual(structuredClone(move), move);
  assert.ok(game.play(move));
});

test('offers no move when the game is over or a removal is pending', () => {
  assert.equal(chooseMove(createDemoGame().getState()), null);
  const blocked = createPosition({ white: [1, 9, 14, 22], black: [0, 2, 21, 23], turn: BLACK });
  assert.equal(chooseMove(blocked), null);
  const game = createGame({ position: createPosition({ white: [0, 1, 14, 10], black: [5, 18, 20] }) });
  game.play({ from: 14, to: 2, remove: 5 });
  assert.notEqual(game.getState().result, null);
  assert.equal(chooseMove(game.getState()), null);
});

test('rejects an unknown level', () => {
  assert.throws(() => chooseMove(initialPosition(), { level: 'impossible' }), RangeError);
});

test('evaluation is colour-blind and rewards material', () => {
  for (const position of Object.values(POSITIONS)) {
    assert.equal(evaluate(position), evaluate(swapColours(position)));
  }
  const ahead = createPosition({ white: [0, 4, 10, 13, 19, 23], black: [6, 8, 15, 17] });
  assert.ok(evaluate(ahead) > 0);
  assert.ok(evaluate({ ...ahead, turn: BLACK }) < 0);
});
