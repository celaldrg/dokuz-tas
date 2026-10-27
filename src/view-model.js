/**
 * Pure glue between the game state and the screen: what the board
 * highlights, what a tap or a drag means, what the status line says and
 * how the keyboard cursor moves. No DOM here, so the tests can check all
 * of it. Texts are returned as message keys of src/i18n.js.
 */
import { MILLS, POINTS, pointName } from './board.js';
import { WHITE, legalSteps, opponent } from './rules.js';

/** @typedef {import('./rules.js').Player} Player */
/** @typedef {import('./game.js').GameState} GameState */
/** @typedef {'up'|'down'|'left'|'right'} Direction */
/** @typedef {{targets: number[], movable: number[], removable: number[]}} Highlights */
/**
 * What a tap on a point means. A `hint` action changes nothing and names
 * the message that explains why.
 * @typedef {{type: 'place'|'select'|'remove', point: number}
 *   | {type: 'move', from: number, to: number}
 *   | {type: 'deselect'}
 *   | {type: 'none'}
 *   | {type: 'hint', hint: string}} TapAction
 */

const PHASE_KEYS = Object.freeze({ placing: 'phasePlacing', moving: 'phaseMoving', flying: 'phaseFlying' });
const REASON_KEYS = Object.freeze({
  pieces: 'reasonPieces',
  blocked: 'reasonBlocked',
  repetition: 'reasonRepetition',
  'fifty-moves': 'reasonFifty',
});
const DIRECTIONS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });

/**
 * Points to highlight for the player to act: empty points to place on,
 * pieces that can move and the destinations of the selected one, or the
 * opponent pieces that may be removed after a mill.
 * @param {GameState} state
 * @param {number|null} selected point of the selected piece
 * @returns {Highlights}
 */
export function highlights(state, selected) {
  const result = { targets: [], movable: [], removable: [] };
  if (state.result) return result;
  if (state.pending) {
    result.removable = state.removable.slice();
    return result;
  }
  const steps = legalSteps(state);
  if (state.phase === 'placing') {
    result.targets = steps.map((step) => step.to);
    return result;
  }
  result.movable = [...new Set(steps.map((step) => step.from))];
  result.targets = steps.filter((step) => step.from === selected).map((step) => step.to);
  return result;
}

/**
 * Works out what tapping (or pressing Enter on) a point means for the player to act.
 * @param {GameState} state
 * @param {number|null} selected point of the selected piece
 * @param {number} point
 * @returns {TapAction}
 */
export function tapAction(state, selected, point) {
  if (state.result) return { type: 'none' };
  const { board, turn } = state;
  if (state.pending) {
    if (state.removable.includes(point)) return { type: 'remove', point };
    return { type: 'hint', hint: board[point] === opponent(turn) ? 'hintProtected' : 'hintRemove' };
  }
  const steps = legalSteps(state);
  if (state.phase === 'placing') {
    return steps.some((step) => step.to === point) ? { type: 'place', point } : { type: 'hint', hint: 'hintOccupied' };
  }
  if (board[point] === turn) {
    if (point === selected) return { type: 'deselect' };
    return steps.some((step) => step.from === point) ? { type: 'select', point } : { type: 'hint', hint: 'hintStuck' };
  }
  if (selected === null) return { type: 'hint', hint: 'hintPickOwn' };
  const legal = steps.some((step) => step.from === selected && step.to === point);
  return legal ? { type: 'move', from: selected, to: point } : { type: 'deselect' };
}

/**
 * What letting go of a press on the board means. A dragged piece is dropped
 * where it is let go. Any other press is a tap on the point where it began
 * when the pointer barely moved or is let go on that same point (a slightly
 * sloppy finger), and nothing when it slid off elsewhere.
 * @param {{from: number, moved: boolean, dragging: boolean}} press where the
 *   press began, whether it travelled far enough to count as a drag, and
 *   whether a piece follows it
 * @param {number|null} over point under the pointer when it is let go
 * @returns {{type: 'drop', from: number, to: number|null} | {type: 'tap', point: number} | {type: 'none'}}
 */
export function releaseAction({ from, moved, dragging }, over) {
  if (dragging) return { type: 'drop', from, to: over };
  if (!moved || over === from) return { type: 'tap', point: from };
  return { type: 'none' };
}

/**
 * What letting go of a dragged piece means. A drop on a legal target moves
 * it. A drop back on its own point counts as a tap, so it clears a piece
 * that was already selected and keeps a new one; any other drop (an illegal
 * point, another piece, off the board) clears the selection.
 * @param {GameState} state
 * @param {number} from point the piece was dragged from
 * @param {number|null} to point it was let go over, null when off the board
 * @param {boolean} wasSelected whether the piece was selected before the drag
 * @returns {TapAction}
 */
export function dropAction(state, from, to, wasSelected) {
  if (to === from) return wasSelected ? { type: 'deselect' } : { type: 'select', point: from };
  const action = to === null ? null : tapAction(state, from, to);
  return action?.type === 'move' ? action : { type: 'deselect' };
}

/**
 * Status line of a game in progress: who acts, what they should do and the
 * phase they are in.
 * @param {GameState} state a game that is not over
 * @param {Player|null} ai colour of the computer, null for two players
 * @param {number|null} selected point of the selected piece
 * @returns {{actor: string, action: string, piece: string|null, phase: string, tone: 'turn'|'mill'|'thinking'}}
 */
export function describeStatus(state, ai, selected) {
  const actor = ai === null ? state.turn : state.turn === ai ? 'computer' : 'you';
  const base = { actor, piece: null, phase: PHASE_KEYS[state.phase], tone: 'turn' };
  if (state.turn === ai) return { ...base, action: 'actThinking', tone: 'thinking' };
  if (state.pending) {
    const piece = opponent(state.turn) === WHITE ? 'pieceWhite' : 'pieceBlack';
    return { ...base, action: 'actRemove', piece, tone: 'mill' };
  }
  if (state.phase === 'placing') return { ...base, action: 'actPlace' };
  if (selected !== null) return { ...base, action: 'actChoose' };
  return { ...base, action: state.phase === 'flying' ? 'actFly' : 'actMove' };
}

/**
 * Headline and explanation of a finished game.
 * @param {import('./rules.js').Result} result
 * @param {Player|null} ai colour of the computer, null for two players
 * @returns {{title: string, reason: string, loser: Player|null}}
 */
export function describeResult({ winner, reason }, ai) {
  let title = 'draw';
  if (winner !== null && ai !== null) title = winner === ai ? 'winComputer' : 'winYou';
  else if (winner !== null) title = winner === WHITE ? 'winWhite' : 'winBlack';
  return { title, reason: REASON_KEYS[reason], loser: winner === null ? null : opponent(winner) };
}

/**
 * Accessible name of a point: its square, what stands on it and what the
 * player to act can do with it.
 * @param {(Player|null)[]} board
 * @param {Highlights} marks highlights of the player to act
 * @param {number|null} selected point of the selected piece
 * @param {number} point
 * @returns {{key: string, params?: {name: string}}[]} messages to join, in order
 */
export function describePoint(board, marks, selected, point) {
  const cell = board[point];
  const key = cell === null ? 'pointEmpty' : cell === WHITE ? 'pointWhite' : 'pointBlack';
  const parts = [{ key, params: { name: pointName(point) } }];
  if (marks.targets.includes(point)) parts.push({ key: 'labelTarget' });
  if (marks.movable.includes(point)) parts.push({ key: 'labelMovable' });
  if (selected === point) parts.push({ key: 'labelSelected' });
  if (marks.removable.includes(point)) parts.push({ key: 'labelRemovable' });
  return parts;
}

/**
 * Closed mills on the board, split into those formed by the latest step
 * (the pending one, or else the last move) and the older ones.
 * @param {GameState} state
 * @returns {{closed: number[], fresh: number[]}} indices into MILLS
 */
export function millHighlights(state) {
  const { board } = state;
  const latest = state.pending ? state.pending.to : (state.lastMove?.to ?? null);
  const mills = { closed: [], fresh: [] };
  MILLS.forEach((mill, index) => {
    const owner = board[mill[0]];
    if (owner === null || !mill.every((point) => board[point] === owner)) return;
    (mill.includes(latest) ? mills.fresh : mills.closed).push(index);
  });
  return mills;
}

/**
 * Whether Undo has something to take back. Against the computer it only
 * counts once the human has moved, since undoing goes back to their turn.
 * @param {GameState} state
 * @param {Player|null} ai colour of the computer, null for two players
 * @returns {boolean}
 */
export function canUndo(state, ai) {
  if (state.pending) return true;
  return state.moveCount >= (ai === WHITE ? 2 : 1);
}

/**
 * Keyboard navigation: the nearest point in a direction along the same row
 * or column of the 7 x 7 grid.
 * @param {number} point
 * @param {Direction} direction
 * @returns {number} that point, or `point` itself at the edge
 */
export function stepInDirection(point, direction) {
  const [dx, dy] = DIRECTIONS[direction];
  const [x, y] = POINTS[point];
  let best = point;
  let bestDistance = Infinity;
  POINTS.forEach(([px, py], candidate) => {
    const along = (px - x) * dx + (py - y) * dy;
    const aside = (px - x) * dy + (py - y) * dx;
    if (along > 0 && aside === 0 && along < bestDistance) {
      best = candidate;
      bestDistance = along;
    }
  });
  return best;
}
