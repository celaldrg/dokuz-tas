import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLACK,
  NO_MILL_LIMIT,
  REPETITION_LIMIT,
  WHITE,
  advanceDrawState,
  applyMove,
  applyStep,
  closesMill,
  createPosition,
  decisiveResult,
  drawReason,
  hasLegalStep,
  initialPosition,
  isInMill,
  isLegalMove,
  legalMoves,
  legalSteps,
  opponent,
  phaseOf,
  piecesLeft,
  positionKey,
  removablePieces,
} from '../src/rules.js';

const place = (to, remove = null) => ({ from: null, to, remove });
const slide = (from, to, remove = null) => ({ from, to, remove });
const stepKeys = (steps) => steps.map(({ from, to }) => `${from}>${to}`).sort();

/** Plays placements alternately (white first) from the starting position. */
function placeAll(points) {
  return points.reduce((position, to) => applyMove(position, place(to)), initialPosition());
}

// 18 placements that never close a mill. White ends on 0 2 4 6 10 12 16 20 22,
// black on 1 3 5 7 9 11 13 15 17.
const QUIET_PLACEMENTS = [0, 1, 2, 3, 4, 5, 6, 7, 10, 9, 12, 11, 16, 13, 20, 15, 22, 17];

test('a new game: empty board, nine pieces in each hand, white places first', () => {
  const position = initialPosition();
  assert.equal(position.board.length, 24);
  assert.ok(position.board.every((cell) => cell === null));
  assert.deepEqual(position.inHand, { white: 9, black: 9 });
  assert.equal(position.turn, WHITE);
  assert.equal(phaseOf(position, WHITE), 'placing');
  assert.equal(phaseOf(position, BLACK), 'placing');
  assert.equal(legalSteps(position).length, 24);
  assert.ok(legalMoves(position).every((move) => move.from === null && move.remove === null));
  assert.equal(decisiveResult(position), null);
  assert.equal(opponent(WHITE), BLACK);
  assert.equal(opponent(BLACK), WHITE);
});

test('placing: a piece goes from the hand to any empty point and the turn passes', () => {
  const afterWhite = applyMove(initialPosition(), place(0));
  assert.equal(afterWhite.board[0], WHITE);
  assert.deepEqual(afterWhite.inHand, { white: 8, black: 9 });
  assert.equal(afterWhite.turn, BLACK);
  assert.equal(legalSteps(afterWhite).length, 23);
  assert.equal(isLegalMove(afterWhite, place(0)), false, 'occupied point');
  assert.equal(isLegalMove(afterWhite, place(1)), true);
  assert.equal(isLegalMove(afterWhite, place(24)), false, 'off the board');

  const afterBlack = applyMove(afterWhite, place(1));
  assert.equal(afterBlack.turn, WHITE);
  assert.equal(isLegalMove(afterBlack, slide(0, 9)), false, 'no moving while pieces remain in hand');
});

test('placing never mutates the position it starts from', () => {
  const position = initialPosition();
  const before = JSON.stringify(position);
  applyMove(position, place(5));
  applyStep(position, null, 6);
  assert.equal(JSON.stringify(position), before);
});

test('after all 18 placements both players move pieces to adjacent empty points only', () => {
  const position = placeAll(QUIET_PLACEMENTS);
  assert.deepEqual(position.inHand, { white: 0, black: 0 });
  assert.equal(position.turn, WHITE);
  assert.equal(phaseOf(position, WHITE), 'moving');
  assert.equal(phaseOf(position, BLACK), 'moving');
  assert.ok(QUIET_PLACEMENTS.every((point) => !isInMill(position.board, point)));
  assert.deepEqual(
    stepKeys(legalSteps(position)),
    stepKeys([
      { from: 2, to: 14 }, { from: 10, to: 18 }, { from: 12, to: 8 }, { from: 16, to: 19 },
      { from: 20, to: 19 }, { from: 22, to: 19 }, { from: 22, to: 21 }, { from: 22, to: 23 },
    ]),
  );
  assert.equal(isLegalMove(position, slide(22, 19)), true);
  assert.equal(isLegalMove(position, place(8)), false, 'nothing left to place');
  assert.equal(isLegalMove(position, slide(22, 8)), false, 'not adjacent');
  assert.equal(isLegalMove(position, slide(2, 1)), false, 'occupied');
  assert.equal(isLegalMove(position, slide(1, 8)), false, "opponent's piece");
});

test('moving: a step slides along one segment of a line', () => {
  const position = createPosition({ white: [7, 0, 13, 18], black: [1, 9, 14, 22] });
  assert.deepEqual(
    stepKeys(legalSteps(position)),
    stepKeys([
      { from: 7, to: 4 }, { from: 7, to: 6 }, { from: 7, to: 8 },
      { from: 13, to: 5 }, { from: 13, to: 12 }, { from: 13, to: 20 },
      { from: 18, to: 10 }, { from: 18, to: 19 },
    ]),
  );
  const moved = applyMove(position, slide(7, 4));
  assert.equal(moved.board[7], null);
  assert.equal(moved.board[4], WHITE);
  assert.equal(moved.turn, BLACK);
  assert.deepEqual(moved.inHand, { white: 0, black: 0 });
});

test('flying: a player with exactly three pieces may jump to any empty point', () => {
  const position = createPosition({ white: [0, 7, 13], black: [1, 9, 14, 22, 18] });
  assert.equal(phaseOf(position, WHITE), 'flying');
  assert.equal(phaseOf(position, BLACK), 'moving');
  const empty = position.board.filter((cell) => cell === null).length;
  assert.equal(legalSteps(position).length, 3 * empty);
  assert.equal(isLegalMove(position, slide(0, 23)), true);
  assert.equal(isLegalMove(position, slide(0, 1)), false, 'still not onto a piece');

  const blackToMove = { ...position, turn: BLACK };
  assert.equal(isLegalMove(blackToMove, slide(22, 6)), false, 'four pieces: no flying');
  assert.equal(isLegalMove(blackToMove, slide(22, 23)), true);
});

test('three pieces with some still in hand means placing, not flying', () => {
  const position = createPosition({ white: [0, 7, 13], black: [1], inHand: { white: 2, black: 4 } });
  assert.equal(phaseOf(position, WHITE), 'placing');
  assert.ok(legalSteps(position).every((step) => step.from === null));
});

test('closing a mill requires removing an opponent piece', () => {
  const position = createPosition({ white: [0, 1], black: [9, 10], inHand: { white: 7, black: 7 } });
  assert.equal(closesMill(position.board, WHITE, null, 2), true);
  const closing = legalMoves(position).filter((move) => move.to === 2);
  assert.deepEqual(closing, [place(2, 9), place(2, 10)]);
  assert.equal(isLegalMove(position, place(2)), false, 'a removal is mandatory');
  assert.equal(isLegalMove(position, place(2, 0)), false, 'own piece');
  assert.equal(isLegalMove(position, place(2, 5)), false, 'empty point');

  const next = applyMove(position, place(2, 9));
  assert.equal(next.board[9], null);
  assert.ok(isInMill(next.board, 2));
  assert.equal(next.turn, BLACK);
  assert.equal(piecesLeft(next, BLACK), 8);
});

test('pieces standing in a mill are protected while the opponent has others', () => {
  const position = createPosition({ white: [0, 1, 14, 4], black: [21, 22, 23, 10, 5] });
  assert.deepEqual(removablePieces(position.board, BLACK), [5, 10]);
  const closing = legalMoves(position).filter((move) => move.from === 14 && move.to === 2);
  assert.deepEqual(closing, [slide(14, 2, 5), slide(14, 2, 10)]);
  assert.equal(isLegalMove(position, slide(14, 2, 22)), false);
});

test('when every opponent piece stands in a mill, any of them may be removed', () => {
  // Black owns two mills sharing the corner 23 and nothing else.
  const position = createPosition({ white: [3, 4], black: [21, 22, 23, 2, 14], inHand: { white: 5, black: 4 } });
  assert.deepEqual(removablePieces(position.board, BLACK), [2, 14, 21, 22, 23]);
  const closing = legalMoves(position).filter((move) => move.to === 5);
  assert.deepEqual(closing.map((move) => move.remove), [2, 14, 21, 22, 23]);
  assert.equal(isLegalMove(position, place(5, 23)), true);
});

test('moving into line closes a mill; moving out and back in closes it again', () => {
  const position = createPosition({ white: [0, 1, 14, 10], black: [3, 18, 19, 20, 22] });
  assert.equal(closesMill(position.board, WHITE, 14, 2), true);
  const closed = applyMove(position, slide(14, 2, 3));
  assert.ok(isInMill(closed.board, 2));

  const opened = applyMove({ ...closed, turn: WHITE }, slide(2, 14));
  assert.ok(!isInMill(opened.board, 0));
  assert.equal(closesMill(opened.board, WHITE, 14, 2), true, 'reforming the same mill counts');
  assert.equal(closesMill(position.board, WHITE, 1, 2), false, 'a piece cannot complete its own line by sliding along it');
});

test('one step that closes two mills still removes a single piece', () => {
  const position = createPosition({ white: [1, 2, 9, 21], black: [4, 13, 18], inHand: { white: 5, black: 6 } });
  const closing = legalMoves(position).filter((move) => move.to === 0);
  assert.deepEqual(closing, [place(0, 4), place(0, 13), place(0, 18)]);
  const next = applyMove(position, closing[0]);
  assert.equal(next.board.filter((cell) => cell === BLACK).length, 2);
});

test('a mill closed while the opponent has no piece on the board removes nothing', () => {
  const position = createPosition({ white: [0, 1], black: [], inHand: { white: 5, black: 5 } });
  const closing = legalMoves(position).filter((move) => move.to === 2);
  assert.deepEqual(closing, [place(2)]);
});

test('a player left with fewer than three pieces loses', () => {
  const position = createPosition({ white: [0, 1, 14, 10], black: [5, 18, 20] });
  const next = applyMove(position, slide(14, 2, 18));
  assert.equal(piecesLeft(next, BLACK), 2);
  assert.deepEqual(decisiveResult(next), { winner: WHITE, reason: 'pieces' });
});

test('pieces still in hand count towards the three', () => {
  const position = createPosition({ white: [0, 4], black: [2], turn: BLACK, inHand: { white: 1, black: 1 } });
  assert.deepEqual(decisiveResult(position), { winner: WHITE, reason: 'pieces' });
  const enough = createPosition({ white: [0, 4], black: [2], turn: BLACK, inHand: { white: 1, black: 2 } });
  assert.equal(decisiveResult(enough), null);
});

test('a player with no legal move loses', () => {
  // Black holds the four outer corners; white closes the last exit on 22.
  const position = createPosition({ white: [1, 9, 14, 19], black: [0, 2, 21, 23] });
  assert.equal(decisiveResult(position), null);
  const next = applyMove(position, slide(19, 22));
  assert.equal(hasLegalStep(next), false);
  assert.deepEqual(legalMoves(next), []);
  assert.deepEqual(decisiveResult(next), { winner: WHITE, reason: 'blocked' });
});

test('a flying player is never blocked', () => {
  const position = createPosition({ white: [1, 9, 14, 22], black: [0, 2, 21], turn: BLACK });
  assert.equal(phaseOf(position), 'flying');
  assert.equal(hasLegalStep(position), true);
  assert.equal(decisiveResult(position), null);
});

test('createPosition rejects invalid or doubly used points', () => {
  assert.throws(() => createPosition({ white: [3], black: [3] }), RangeError);
  assert.throws(() => createPosition({ white: [24] }), RangeError);
  assert.throws(() => createPosition({ black: [1.5] }), RangeError);
});

test('position keys tell apart the board, the player to act and the pieces in hand', () => {
  const position = createPosition({ white: [0], black: [5], inHand: { white: 3, black: 4 } });
  const key = positionKey(position);
  assert.equal(key, positionKey(createPosition({ white: [0], black: [5], inHand: { white: 3, black: 4 } })));
  assert.notEqual(key, positionKey({ ...position, turn: BLACK }));
  assert.notEqual(key, positionKey({ ...position, inHand: { white: 2, black: 4 } }));
  assert.notEqual(key, positionKey(createPosition({ white: [1], black: [5], inHand: { white: 3, black: 4 } })));
});

test('draw bookkeeping: repetitions and moves without a mill', () => {
  const start = createPosition({ white: [0, 4, 13, 19], black: [6, 8, 15, 17] });
  let draw = { history: [positionKey(start)], noMillMoves: 0 };
  let position = start;
  const cycle = [slide(0, 1), slide(6, 7), slide(1, 0), slide(7, 6)];
  for (let i = 0; i < 8; i += 1) {
    assert.equal(drawReason(draw), null, `ply ${i}`);
    const move = cycle[i % 4];
    position = applyMove(position, move);
    draw = advanceDrawState(draw, move, position);
  }
  assert.equal(REPETITION_LIMIT, 3);
  assert.equal(draw.noMillMoves, 8);
  assert.equal(drawReason(draw), 'repetition');

  assert.equal(NO_MILL_LIMIT, 50);
  assert.equal(drawReason({ history: ['a', 'b'], noMillMoves: 49 }), null);
  assert.equal(drawReason({ history: ['a', 'b'], noMillMoves: 50 }), 'fifty-moves');

  const afterPlacement = advanceDrawState(draw, place(5), position);
  assert.deepEqual(afterPlacement, { history: [positionKey(position)], noMillMoves: 0 });
  const afterMill = advanceDrawState(draw, slide(1, 2, 6), position);
  assert.deepEqual(afterMill, { history: [positionKey(position)], noMillMoves: 0 });
});
