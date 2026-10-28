/**
 * Game controller: drives one match the way a UI needs it (place or move a
 * piece, then pick a piece to remove after a mill), applies the draw rules,
 * keeps the result and an undo history. Pure: no DOM, timers or storage.
 */
import {
  BLACK,
  WHITE,
  advanceDrawState,
  applyMove,
  applyStep,
  closesMill,
  countPieces,
  createPosition,
  decisiveResult,
  drawReason,
  initialPosition,
  isLegalMove,
  legalSteps,
  opponent,
  phaseOf,
  positionKey,
  removablePieces,
} from './rules.js';

/** @typedef {import('./rules.js').Player} Player */
/** @typedef {import('./rules.js').Position} Position */
/** @typedef {import('./rules.js').Move} Move */

/**
 * Snapshot returned by `getState()`. It is also a valid Position (board, turn,
 * inHand), so the rules functions accept it, and so does the AI while
 * `pending` is null.
 * @typedef {Object} GameState
 * @property {(Player|null)[]} board pieces on the board, pending step included
 * @property {Player} turn player to act
 * @property {{white: number, black: number}} inHand pieces still to be placed
 * @property {{white: number, black: number}} onBoard pieces on the board
 * @property {import('./rules.js').Phase} phase phase of the player to act
 * @property {import('./rules.js').Step|null} pending step that closed a mill and waits for a removal
 * @property {number[]} removable points that may be removed now (empty unless pending)
 * @property {Move|null} lastMove last completed move
 * @property {number} moveCount completed moves
 * @property {number} noMillMoves moving-phase moves since the last mill
 * @property {string[]} history position keys since the last irreversible move
 * @property {import('./rules.js').Result|null} result null while the game goes on
 */

/**
 * Creates a game. Every action returns true when it was applied, or false when
 * it is not allowed right now (illegal, game over, removal pending...), in
 * which case nothing changes.
 * @param {{position?: Position}} [options] start position; the empty board by default
 */
export function createGame({ position = initialPosition() } = {}) {
  let state = startState(position);
  const undoStack = [];

  function commit(move) {
    undoStack.push({ ...state, pending: null });
    state = stateAfter(state, move);
  }

  return {
    /** @returns {GameState} a fresh snapshot */
    getState: () => snapshot(state),

    /**
     * Places (`from` null) or moves a piece of the player to act. A step that
     * closes a mill waits for remove(); any other step completes the move.
     * @param {number|null} from
     * @param {number} to
     * @returns {boolean}
     */
    step(from, to) {
      const source = from ?? null;
      if (state.result || state.pending) return false;
      if (!legalSteps(state.position).some((s) => s.from === source && s.to === to)) return false;
      const { board, turn } = state.position;
      const mustRemove =
        removablePieces(board, opponent(turn)).length > 0 && closesMill(board, turn, source, to);
      if (mustRemove) state = { ...state, pending: { from: source, to } };
      else commit({ from: source, to, remove: null });
      return true;
    },

    /**
     * Removes an opponent piece, completing a step that closed a mill.
     * @param {number} point
     * @returns {boolean}
     */
    remove(point) {
      const { pending, position } = state;
      if (!pending) return false;
      if (!removablePieces(position.board, opponent(position.turn)).includes(point)) return false;
      commit({ ...pending, remove: point });
      return true;
    },

    /**
     * Plays a whole move at once, e.g. one chosen by the AI.
     * @param {{from?: number|null, to: number, remove?: number|null}} move
     * @returns {boolean}
     */
    play(move) {
      if (state.result || state.pending || !isLegalMove(state.position, move)) return false;
      commit({ from: move.from ?? null, to: move.to, remove: move.remove ?? null });
      return true;
    },

    /**
     * Takes back the pending step, or else the last completed move.
     * @returns {boolean}
     */
    undo() {
      if (state.pending) state = { ...state, pending: null };
      else if (undoStack.length > 0) state = undoStack.pop();
      else return false;
      return true;
    },

    /** @returns {boolean} whether undo() would change anything */
    canUndo: () => state.pending !== null || undoStack.length > 0,
  };
}

/**
 * The `?demo` showcase: a moving-phase position in which white has just closed
 * a mill (d5 to d6) and must choose one of the black pieces outside the black
 * mill to remove.
 * @returns {ReturnType<typeof createGame>}
 */
export function createDemoGame() {
  const game = createGame({
    position: createPosition({
      white: [3, 5, 7, 9, 11, 17, 20],
      black: [1, 8, 12, 16, 21, 22, 23],
    }),
  });
  game.step(7, 4);
  return game;
}

function startState(position) {
  const start = { board: position.board.slice(), turn: position.turn, inHand: { ...position.inHand } };
  const draw = { history: [positionKey(start)], noMillMoves: 0 };
  return { position: start, pending: null, lastMove: null, moveCount: 0, ...draw, result: resultOf(start, draw) };
}

function stateAfter(state, move) {
  const position = applyMove(state.position, move);
  const draw = advanceDrawState(state, move, position);
  return {
    position,
    pending: null,
    lastMove: move,
    moveCount: state.moveCount + 1,
    ...draw,
    result: resultOf(position, draw),
  };
}

function resultOf(position, draw) {
  const decisive = decisiveResult(position);
  if (decisive) return decisive;
  const reason = drawReason(draw);
  return reason ? { winner: null, reason } : null;
}

function snapshot(state) {
  const { position, pending } = state;
  const shown = pending ? applyStep(position, pending.from, pending.to) : position;
  return {
    board: shown.board.slice(),
    turn: position.turn,
    inHand: { ...shown.inHand },
    onBoard: { white: countPieces(shown.board, WHITE), black: countPieces(shown.board, BLACK) },
    phase: phaseOf(shown, position.turn),
    pending: pending && { ...pending },
    removable: pending ? removablePieces(position.board, opponent(position.turn)) : [],
    lastMove: state.lastMove && { ...state.lastMove },
    moveCount: state.moveCount,
    noMillMoves: state.noMillMoves,
    history: state.history.slice(),
    result: state.result && { ...state.result },
  };
}
