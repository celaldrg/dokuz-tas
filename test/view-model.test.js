import test from 'node:test';
import assert from 'node:assert/strict';
import { MILLS, NEIGHBORS, POINTS, POINT_COUNT } from '../src/board.js';
import { createDemoGame, createGame } from '../src/game.js';
import { STRINGS } from '../src/i18n.js';
import { BLACK, WHITE, createPosition } from '../src/rules.js';
import {
  canUndo,
  describePoint,
  describeResult,
  describeStatus,
  dropAction,
  highlights,
  millHighlights,
  releaseAction,
  stepInDirection,
  tapAction,
} from '../src/view-model.js';

// Moving phase, white to act: 0 is boxed in by black on 1 and 9, 4 can go
// to 3, 5 or 7, 13 to 5, 12 or 20, and 22 to 21 or 23.
const MOVING = createPosition({ white: [0, 4, 13, 22], black: [1, 9, 14, 19] });
// The same without white's piece on 22: white is down to three and flies.
const FLYING = createPosition({ white: [0, 4, 13], black: [1, 9, 14, 19] });

const stateOf = (position) => createGame({ position }).getState();
const sorted = (points) => [...points].sort((a, b) => a - b);

function assertKnownKey(key) {
  assert.equal(typeof STRINGS.en[key], 'string', `missing message key "${key}"`);
}

test('placing highlights every empty point and nothing else', () => {
  const game = createGame();
  game.step(null, 0);
  const marks = highlights(game.getState(), null);
  assert.equal(marks.targets.length, POINT_COUNT - 1);
  assert.ok(!marks.targets.includes(0));
  assert.deepEqual(marks.movable, []);
  assert.deepEqual(marks.removable, []);
});

test('moving highlights the pieces that can move and the targets of the selected one', () => {
  const state = stateOf(MOVING);
  assert.deepEqual(sorted(highlights(state, null).movable), [4, 13, 22]);
  assert.deepEqual(highlights(state, null).targets, []);
  assert.deepEqual(sorted(highlights(state, 4).targets), [3, 5, 7]);
  assert.deepEqual(sorted(highlights(state, 22).targets), [21, 23]);
});

test('flying lets every piece reach every empty point', () => {
  const state = stateOf(FLYING);
  const marks = highlights(state, 0);
  assert.deepEqual(sorted(marks.movable), [0, 4, 13]);
  assert.equal(marks.targets.length, POINT_COUNT - 7);
  assert.ok(marks.targets.every((point) => state.board[point] === null));
});

test('after a mill only the removable opponent pieces are highlighted', () => {
  const state = createDemoGame().getState();
  const marks = highlights(state, null);
  assert.deepEqual(sorted(marks.removable), [1, 8, 12, 16]);
  assert.deepEqual(marks.targets, []);
  assert.deepEqual(marks.movable, []);
});

test('a finished game highlights nothing and ignores taps', () => {
  const state = stateOf(createPosition({ white: [0, 1, 4], black: [9, 21], turn: BLACK }));
  assert.deepEqual(state.result, { winner: WHITE, reason: 'pieces' });
  assert.deepEqual(highlights(state, null), { targets: [], movable: [], removable: [] });
  assert.deepEqual(tapAction(state, null, 5), { type: 'none' });
});

test('tapping while placing puts a piece on an empty point', () => {
  const game = createGame();
  assert.deepEqual(tapAction(game.getState(), null, 7), { type: 'place', point: 7 });
  game.step(null, 7);
  assert.deepEqual(tapAction(game.getState(), null, 7), { type: 'hint', hint: 'hintOccupied' });
});

test('tapping while moving selects, switches, moves and deselects', () => {
  const state = stateOf(MOVING);
  assert.deepEqual(tapAction(state, null, 4), { type: 'select', point: 4 });
  assert.deepEqual(tapAction(state, 4, 13), { type: 'select', point: 13 });
  assert.deepEqual(tapAction(state, 4, 4), { type: 'deselect' });
  assert.deepEqual(tapAction(state, 4, 7), { type: 'move', from: 4, to: 7 });
  assert.deepEqual(tapAction(state, 4, 20), { type: 'deselect' });
  assert.deepEqual(tapAction(state, 4, 1), { type: 'deselect' });
});

test('tapping while moving explains taps that do nothing', () => {
  const state = stateOf(MOVING);
  assert.deepEqual(tapAction(state, null, 0), { type: 'hint', hint: 'hintStuck' });
  assert.deepEqual(tapAction(state, null, 3), { type: 'hint', hint: 'hintPickOwn' });
  assert.deepEqual(tapAction(state, null, 1), { type: 'hint', hint: 'hintPickOwn' });
});

test('flying moves a selected piece to any empty point', () => {
  const state = stateOf(FLYING);
  assert.deepEqual(tapAction(state, 0, 23), { type: 'move', from: 0, to: 23 });
});

test('tapping after a mill removes a removable piece or explains why not', () => {
  const state = createDemoGame().getState();
  assert.deepEqual(tapAction(state, null, 8), { type: 'remove', point: 8 });
  assert.deepEqual(tapAction(state, null, 22), { type: 'hint', hint: 'hintProtected' });
  assert.deepEqual(tapAction(state, null, 10), { type: 'hint', hint: 'hintRemove' });
  assert.deepEqual(tapAction(state, null, 3), { type: 'hint', hint: 'hintRemove' });
});

test('every tap and its result follow the game rules', () => {
  const game = createGame({ position: MOVING });
  const action = tapAction(game.getState(), 4, 7);
  assert.ok(game.step(action.from, action.to));
  assert.equal(game.getState().board[7], WHITE);

  const demo = createDemoGame();
  const removal = tapAction(demo.getState(), null, 16);
  assert.ok(demo.remove(removal.point));
  assert.equal(demo.getState().board[16], null);
  assert.equal(demo.getState().turn, BLACK);
});

test('letting go of a press taps, drops a dragged piece or does nothing', () => {
  const still = { from: 4, moved: false, dragging: false };
  assert.deepEqual(releaseAction(still, 4), { type: 'tap', point: 4 });
  assert.deepEqual(releaseAction(still, 5), { type: 'tap', point: 4 }, 'a short press counts where it began');
  assert.deepEqual(releaseAction(still, null), { type: 'tap', point: 4 });
  const dragged = { from: 4, moved: true, dragging: true };
  assert.deepEqual(releaseAction(dragged, 7), { type: 'drop', from: 4, to: 7 });
  assert.deepEqual(releaseAction(dragged, 4), { type: 'drop', from: 4, to: 4 });
  assert.deepEqual(releaseAction(dragged, null), { type: 'drop', from: 4, to: null });
  const slid = { from: 4, moved: true, dragging: false };
  assert.deepEqual(releaseAction(slid, 7), { type: 'none' }, 'a swipe to another point is not a tap');
  assert.deepEqual(releaseAction(slid, null), { type: 'none' });
});

test('a sloppy tap that wobbles but ends on its point still places or removes', () => {
  const wobble = (point) => releaseAction({ from: point, moved: true, dragging: false }, point);
  const placing = createGame().getState();
  const onEmpty = wobble(7);
  assert.deepEqual(onEmpty, { type: 'tap', point: 7 });
  assert.deepEqual(tapAction(placing, null, onEmpty.point), { type: 'place', point: 7 });
  const removal = createDemoGame().getState();
  const onOpponent = wobble(8);
  assert.deepEqual(onOpponent, { type: 'tap', point: 8 });
  assert.deepEqual(tapAction(removal, null, onOpponent.point), { type: 'remove', point: 8 });
});

test('dropping a dragged piece moves it, or keeps or clears the selection', () => {
  const state = stateOf(MOVING);
  assert.deepEqual(dropAction(state, 4, 7, false), { type: 'move', from: 4, to: 7 });
  assert.deepEqual(dropAction(state, 4, 7, true), { type: 'move', from: 4, to: 7 });
  assert.deepEqual(dropAction(state, 4, 4, false), { type: 'select', point: 4 }, 'a wobbly press on a new piece selects it');
  assert.deepEqual(dropAction(state, 4, 4, true), { type: 'deselect' }, 'a wobbly press on the selected piece clears it');
  assert.deepEqual(dropAction(state, 4, 20, true), { type: 'deselect' }, 'an illegal point');
  assert.deepEqual(dropAction(state, 4, 13, false), { type: 'deselect' }, 'another own piece');
  assert.deepEqual(dropAction(state, 4, 1, false), { type: 'deselect' }, 'an opponent piece');
  assert.deepEqual(dropAction(state, 4, null, true), { type: 'deselect' }, 'off the board');
});

test('the status names the actor, the action and the phase', () => {
  const fresh = createGame().getState();
  assert.deepEqual(describeStatus(fresh, BLACK, null), {
    actor: 'you',
    action: 'actPlace',
    piece: null,
    phase: 'phasePlacing',
    tone: 'turn',
  });
  assert.equal(describeStatus(fresh, null, null).actor, WHITE);
  const moving = stateOf(MOVING);
  assert.equal(describeStatus(moving, null, null).action, 'actMove');
  assert.equal(describeStatus(moving, null, 4).action, 'actChoose');
  assert.equal(describeStatus(moving, null, null).phase, 'phaseMoving');
  const flying = describeStatus(stateOf(FLYING), BLACK, null);
  assert.equal(flying.action, 'actFly');
  assert.equal(flying.phase, 'phaseFlying');
});

test('the status shows the computer thinking on its turn', () => {
  const status = describeStatus(createGame().getState(), WHITE, null);
  assert.equal(status.actor, 'computer');
  assert.equal(status.action, 'actThinking');
  assert.equal(status.tone, 'thinking');
});

test('the status asks for a removal after a mill and names the colour', () => {
  const status = describeStatus(createDemoGame().getState(), BLACK, null);
  assert.deepEqual(status, {
    actor: 'you',
    action: 'actRemove',
    piece: 'pieceBlack',
    phase: 'phaseMoving',
    tone: 'mill',
  });
});

test('results read from the point of view of the human', () => {
  assert.deepEqual(describeResult({ winner: WHITE, reason: 'pieces' }, BLACK), {
    title: 'winYou',
    reason: 'reasonPieces',
    loser: BLACK,
  });
  assert.equal(describeResult({ winner: WHITE, reason: 'blocked' }, WHITE).title, 'winComputer');
  assert.equal(describeResult({ winner: WHITE, reason: 'blocked' }, null).title, 'winWhite');
  assert.equal(describeResult({ winner: BLACK, reason: 'blocked' }, null).title, 'winBlack');
  assert.deepEqual(describeResult({ winner: null, reason: 'repetition' }, BLACK), {
    title: 'draw',
    reason: 'reasonRepetition',
    loser: null,
  });
  assert.equal(describeResult({ winner: null, reason: 'fifty-moves' }, null).reason, 'reasonFifty');
});

test('point labels name the square, the piece and what can be done with it', () => {
  const moving = stateOf(MOVING);
  const marks = highlights(moving, 4);
  assert.deepEqual(describePoint(moving.board, marks, 4, 4), [
    { key: 'pointWhite', params: { name: 'd6' } },
    { key: 'labelMovable' },
    { key: 'labelSelected' },
  ]);
  assert.deepEqual(describePoint(moving.board, marks, 4, 7), [
    { key: 'pointEmpty', params: { name: 'd5' } },
    { key: 'labelTarget' },
  ]);
  const demo = createDemoGame().getState();
  assert.deepEqual(describePoint(demo.board, highlights(demo, null), null, 8), [
    { key: 'pointBlack', params: { name: 'e5' } },
    { key: 'labelRemovable' },
  ]);
});

test('every message key the view model returns exists', () => {
  const statuses = [
    describeStatus(createGame().getState(), BLACK, null),
    describeStatus(createGame().getState(), WHITE, null),
    describeStatus(stateOf(MOVING), null, null),
    describeStatus(stateOf(MOVING), null, 4),
    describeStatus(stateOf(FLYING), null, null),
    describeStatus(createDemoGame().getState(), null, null),
  ];
  for (const status of statuses) {
    [status.action, status.phase, status.piece ?? 'pieceWhite'].forEach(assertKnownKey);
    if (status.actor !== WHITE && status.actor !== BLACK) assertKnownKey(status.actor);
  }
  for (const winner of [WHITE, BLACK, null]) {
    for (const ai of [WHITE, BLACK, null]) {
      for (const reason of ['pieces', 'blocked', 'repetition', 'fifty-moves']) {
        const result = describeResult({ winner, reason }, ai);
        assertKnownKey(result.title);
        assertKnownKey(result.reason);
      }
    }
  }
  const hints = [
    tapAction(stateOf(MOVING), null, 0),
    tapAction(stateOf(MOVING), null, 3),
    tapAction(createDemoGame().getState(), null, 22),
    tapAction(createDemoGame().getState(), null, 10),
  ];
  hints.forEach((action) => assertKnownKey(action.hint));
  [WHITE, BLACK].forEach(assertKnownKey);
  const all = { targets: [0, 1], movable: [0, 9], removable: [1, 9] };
  const board = stateOf(MOVING).board;
  for (const point of [0, 1, 3, 9]) {
    describePoint(board, all, 0, point).forEach(({ key }) => assertKnownKey(key));
  }
});

test('the mill just closed is fresh and older mills are closed', () => {
  const demo = createDemoGame();
  assert.deepEqual(millHighlights(demo.getState()), {
    closed: [MILLS.findIndex((mill) => mill.join() === '21,22,23')],
    fresh: [MILLS.findIndex((mill) => mill.join() === '3,4,5')],
  });
  demo.remove(16);
  const after = millHighlights(demo.getState());
  assert.deepEqual(after.fresh, [MILLS.findIndex((mill) => mill.join() === '3,4,5')]);
  assert.deepEqual(millHighlights(createGame().getState()), { closed: [], fresh: [] });
});

test('undo is offered once the human has something to take back', () => {
  const game = createGame();
  assert.equal(canUndo(game.getState(), BLACK), false);
  assert.equal(canUndo(game.getState(), null), false);
  game.step(null, 0);
  assert.equal(canUndo(game.getState(), BLACK), true);
  assert.equal(canUndo(game.getState(), null), true);
  assert.equal(canUndo(game.getState(), WHITE), false, 'only the computer has moved');
  game.step(null, 9);
  assert.equal(canUndo(game.getState(), WHITE), true);
  assert.equal(canUndo(createDemoGame().getState(), BLACK), true, 'a pending removal can be taken back');
});

test('arrow keys walk along the lines of the board', () => {
  assert.equal(stepInDirection(0, 'right'), 1);
  assert.equal(stepInDirection(1, 'right'), 2);
  assert.equal(stepInDirection(2, 'right'), 2);
  assert.equal(stepInDirection(0, 'down'), 9);
  assert.equal(stepInDirection(0, 'up'), 0);
  assert.equal(stepInDirection(4, 'down'), 7);
  assert.equal(stepInDirection(7, 'down'), 16, 'jumps over the empty centre');
  assert.equal(stepInDirection(11, 'right'), 12, 'jumps over the empty centre');
  assert.equal(stepInDirection(12, 'left'), 11);
  assert.equal(stepInDirection(22, 'up'), 19);
});

test('arrow keys reach every point and the neighbours on each line', () => {
  const reached = new Set([4]);
  const queue = [4];
  while (queue.length > 0) {
    const point = queue.shift();
    for (const direction of ['up', 'down', 'left', 'right']) {
      const next = stepInDirection(point, direction);
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(reached.size, POINT_COUNT);
  for (let point = 0; point < POINT_COUNT; point += 1) {
    for (const neighbor of NEIGHBORS[point]) {
      const [x, y] = POINTS[point];
      const [nx, ny] = POINTS[neighbor];
      const direction = nx > x ? 'right' : nx < x ? 'left' : ny > y ? 'down' : 'up';
      assert.equal(stepInDirection(point, direction), neighbor, `${point} ${direction}`);
    }
  }
});
