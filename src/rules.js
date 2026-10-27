/**
 * Rules of Dokuz Taş (nine men's morris) as pure functions. A position is a
 * plain, structured-clone friendly object; nothing here mutates its inputs or
 * touches the DOM, so the same code serves the UI, the AI worker and the tests.
 */
import { MILLS_AT, NEIGHBORS, POINT_COUNT } from './board.js';

/** @typedef {'white'|'black'} Player */
/** @typedef {'placing'|'moving'|'flying'} Phase */
/**
 * @typedef {Object} Position
 * @property {(Player|null)[]} board 24 cells, null when empty
 * @property {Player} turn player to act
 * @property {{white: number, black: number}} inHand pieces still to be placed
 */
/**
 * A step places a piece (`from` null) or moves one; a move is a step plus the
 * opponent piece taken after closing a mill (`remove` null when none).
 * @typedef {{from: number|null, to: number}} Step
 */
/** @typedef {{from: number|null, to: number, remove: number|null}} Move */
/**
 * Draw bookkeeping: position keys since the last irreversible move (a
 * placement or a removal) and moving-phase moves since the last mill.
 * @typedef {{history: string[], noMillMoves: number}} DrawState
 */
/** @typedef {{winner: Player|null, reason: 'pieces'|'blocked'|'repetition'|'fifty-moves'}} Result */

/** The player who places first. */
export const WHITE = 'white';
/** The player who places second. */
export const BLACK = 'black';
/** Pieces each player starts with. */
export const PIECES_PER_PLAYER = 9;
/** Moves in a row without a mill in the moving phase (both players' moves count) that draw the game. */
export const NO_MILL_LIMIT = 50;
/** Occurrences of the same position that draw the game. */
export const REPETITION_LIMIT = 3;

/**
 * @param {Player} player
 * @returns {Player} the other player
 */
export function opponent(player) {
  return player === WHITE ? BLACK : WHITE;
}

/**
 * The starting position: empty board, nine pieces in each hand, white to play.
 * @returns {Position}
 */
export function initialPosition() {
  return createPosition({ inHand: { white: PIECES_PER_PLAYER, black: PIECES_PER_PLAYER } });
}

/**
 * Builds a position from the points each player occupies.
 * @param {{white?: number[], black?: number[], turn?: Player, inHand?: {white?: number, black?: number}}} [spec]
 * @returns {Position}
 */
export function createPosition({ white = [], black = [], turn = WHITE, inHand = {} } = {}) {
  const board = new Array(POINT_COUNT).fill(null);
  const occupy = (player) => (point) => {
    if (!Number.isInteger(point) || point < 0 || point >= POINT_COUNT || board[point] !== null) {
      throw new RangeError(`Point ${point} is invalid or already occupied`);
    }
    board[point] = player;
  };
  white.forEach(occupy(WHITE));
  black.forEach(occupy(BLACK));
  return { board, turn, inHand: { white: inHand.white ?? 0, black: inHand.black ?? 0 } };
}

/**
 * @param {(Player|null)[]} board
 * @param {Player} player
 * @returns {number} pieces of `player` on the board
 */
export function countPieces(board, player) {
  let count = 0;
  for (const cell of board) if (cell === player) count += 1;
  return count;
}

/**
 * @param {Position} position
 * @param {Player} player
 * @returns {number} pieces `player` still owns: on the board plus in hand
 */
export function piecesLeft(position, player) {
  return countPieces(position.board, player) + position.inHand[player];
}

/**
 * Phase of a player: placing while pieces remain in hand, flying with exactly
 * three pieces left, moving otherwise.
 * @param {Position} position
 * @param {Player} [player] defaults to the player to act
 * @returns {Phase}
 */
export function phaseOf(position, player = position.turn) {
  if (position.inHand[player] > 0) return 'placing';
  return countPieces(position.board, player) === 3 ? 'flying' : 'moving';
}

/**
 * @param {(Player|null)[]} board
 * @param {number} point
 * @returns {boolean} true when the piece on `point` belongs to a complete mill
 */
export function isInMill(board, point) {
  const player = board[point];
  if (player === null) return false;
  for (const [a, b, c] of MILLS_AT[point]) {
    if (board[a] === player && board[b] === player && board[c] === player) return true;
  }
  return false;
}

/**
 * Whether `player` closes a mill by bringing a piece to the empty point `to`,
 * either from the hand (`from` null) or from the point `from`.
 * @param {(Player|null)[]} board board before the step
 * @param {Player} player
 * @param {number|null} from
 * @param {number} to
 * @returns {boolean}
 */
export function closesMill(board, player, from, to) {
  for (const mill of MILLS_AT[to]) {
    let own = 0;
    for (const point of mill) {
      if (point !== to && point !== from && board[point] === player) own += 1;
    }
    if (own === 2) return true;
  }
  return false;
}

/**
 * Pieces of `player` that may be taken after the opponent closes a mill: those
 * outside mills, or any of them when every piece stands in a mill.
 * @param {(Player|null)[]} board
 * @param {Player} player owner of the pieces
 * @returns {number[]} points, ascending
 */
export function removablePieces(board, player) {
  const all = [];
  const outsideMills = [];
  board.forEach((cell, point) => {
    if (cell !== player) return;
    all.push(point);
    if (!isInMill(board, point)) outsideMills.push(point);
  });
  return outsideMills.length > 0 ? outsideMills : all;
}

/**
 * Legal steps of the player to act: placements while pieces remain in hand,
 * otherwise a move to an adjacent empty point, or to any empty point when flying.
 * @param {Position} position
 * @returns {Step[]}
 */
export function legalSteps(position) {
  const { board, turn } = position;
  const phase = phaseOf(position);
  const empty = emptyPoints(board);
  if (phase === 'placing') return empty.map((to) => ({ from: null, to }));
  const steps = [];
  board.forEach((cell, from) => {
    if (cell !== turn) return;
    for (const to of phase === 'flying' ? empty : NEIGHBORS[from]) {
      if (board[to] === null) steps.push({ from, to });
    }
  });
  return steps;
}

/**
 * @param {Position} position
 * @returns {boolean} true when the player to act has at least one legal step
 */
export function hasLegalStep(position) {
  const { board, turn } = position;
  if (phaseOf(position) !== 'moving') return board.includes(null);
  for (let point = 0; point < board.length; point += 1) {
    if (board[point] !== turn) continue;
    for (const next of NEIGHBORS[point]) if (board[next] === null) return true;
  }
  return false;
}

/**
 * Every legal move of the player to act. A step that closes a mill appears
 * once per removable opponent piece, or once with `remove: null` when the
 * opponent has no piece on the board.
 * @param {Position} position
 * @returns {Move[]}
 */
export function legalMoves(position) {
  const { board, turn } = position;
  const victims = removablePieces(board, opponent(turn));
  const moves = [];
  for (const { from, to } of legalSteps(position)) {
    if (victims.length > 0 && closesMill(board, turn, from, to)) {
      for (const remove of victims) moves.push({ from, to, remove });
    } else {
      moves.push({ from, to, remove: null });
    }
  }
  return moves;
}

/**
 * @param {Position} position
 * @param {{from?: number|null, to: number, remove?: number|null}} move missing fields count as null
 * @returns {boolean}
 */
export function isLegalMove(position, move) {
  const { from = null, to, remove = null } = move;
  return legalMoves(position).some((m) => m.from === from && m.to === to && m.remove === remove);
}

/**
 * Places or moves one piece of the player to act, who keeps the turn. Used to
 * show a step while the removal that follows it is still being chosen.
 * @param {Position} position
 * @param {number|null} from null for a placement
 * @param {number} to
 * @returns {Position}
 */
export function applyStep(position, from, to) {
  const board = position.board.slice();
  const inHand = { ...position.inHand };
  const player = position.turn;
  if (from === null) inHand[player] -= 1;
  else board[from] = null;
  board[to] = player;
  return { board, turn: player, inHand };
}

/**
 * Plays a whole move (step, then the optional removal) and passes the turn.
 * The move is not validated: take it from legalMoves or check it with isLegalMove.
 * @param {Position} position
 * @param {Move} move
 * @returns {Position}
 */
export function applyMove(position, { from, to, remove }) {
  const next = applyStep(position, from, to);
  if (remove !== null) next.board[remove] = null;
  next.turn = opponent(position.turn);
  return next;
}

/**
 * Detects a lost position for the player to act: fewer than three pieces
 * left, or no legal step.
 * @param {Position} position
 * @returns {Result|null}
 */
export function decisiveResult(position) {
  const loser = position.turn;
  if (piecesLeft(position, loser) < 3) return { winner: opponent(loser), reason: 'pieces' };
  if (!hasLegalStep(position)) return { winner: opponent(loser), reason: 'blocked' };
  return null;
}

/**
 * Compact text key of a position (board, turn, pieces in hand) for repetition checks.
 * @param {Position} position
 * @returns {string}
 */
export function positionKey({ board, turn, inHand }) {
  const cells = board.map((cell) => (cell === null ? '.' : cell[0])).join('');
  return `${cells}|${turn[0]}|${inHand.white},${inHand.black}`;
}

/**
 * Draw bookkeeping after `move` led to `next`. Placements and removals are
 * irreversible, so they restart both the repetition history and the counter.
 * @param {DrawState} draw
 * @param {Move} move
 * @param {Position} next
 * @returns {DrawState}
 */
export function advanceDrawState(draw, move, next) {
  const key = positionKey(next);
  if (move.from === null || move.remove !== null) return { history: [key], noMillMoves: 0 };
  return { history: [...draw.history, key], noMillMoves: draw.noMillMoves + 1 };
}

/**
 * @param {DrawState} draw
 * @returns {'repetition'|'fifty-moves'|null} why the game is drawn, or null
 */
export function drawReason({ history, noMillMoves }) {
  const current = history[history.length - 1];
  if (history.filter((key) => key === current).length >= REPETITION_LIMIT) return 'repetition';
  if (noMillMoves >= NO_MILL_LIMIT) return 'fifty-moves';
  return null;
}

function emptyPoints(board) {
  const empty = [];
  board.forEach((cell, point) => {
    if (cell === null) empty.push(point);
  });
  return empty;
}
