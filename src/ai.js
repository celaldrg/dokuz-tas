/**
 * Computer opponent: negamax search with alpha-beta pruning and iterative
 * deepening under a node budget, scored by a phase-aware evaluation. Pure and
 * deterministic for a given seed, so it runs unchanged in a module Web Worker:
 * post `{ state: game.getState(), level, seed }` and call chooseMove there.
 */
import { MILLS, NEIGHBORS } from './board.js';
import {
  BLACK,
  WHITE,
  advanceDrawState,
  applyMove,
  closesMill,
  decisiveResult,
  drawReason,
  hasLegalStep,
  isInMill,
  legalMoves,
  opponent,
  phaseOf,
  piecesLeft,
} from './rules.js';
import { createRng, shuffle } from './rng.js';

/** @typedef {import('./rules.js').Position} Position */
/** @typedef {import('./rules.js').Move} Move */
/** @typedef {'easy'|'medium'|'hard'} Level */

/**
 * Search settings per level: depth in plies, random spread added to the root
 * scores (higher = more mistakes) and node budget for depths beyond the first.
 */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ depth: 1, noise: 150, nodeLimit: Infinity }),
  medium: Object.freeze({ depth: 3, noise: 15, nodeLimit: 60000 }),
  hard: Object.freeze({ depth: 6, noise: 0, nodeLimit: 150000 }),
});

const WIN_SCORE = 1000000;
/** Scores this close to WIN_SCORE mean a forced win was found. */
const FORCED_WIN = WIN_SCORE - 100;

/**
 * Evaluation weights per game phase, tuned in self-play. `blocked` counts a
 * player's own pieces that cannot move, hence its negative weight; `tempo`
 * rewards the player to act for having a mill it can close right away.
 * Mobility already matters while placing: pieces dropped on corners and
 * other dead ends lose the moving phase.
 */
const WEIGHTS = Object.freeze({
  placing: { pieces: 100, mills: 25, threats: 30, doubleMills: 0, blocked: -20, mobility: 10, tempo: 60 },
  moving: { pieces: 100, mills: 20, threats: 30, doubleMills: 80, blocked: -10, mobility: 4, tempo: 70 },
  flying: { pieces: 100, mills: 10, threats: 45, doubleMills: 40, blocked: -10, mobility: 0, tempo: 90 },
});
const FEATURES = ['pieces', 'mills', 'threats', 'doubleMills', 'blocked', 'mobility'];

/**
 * Chooses a move for the player to act.
 * @param {Position & {history?: string[], noMillMoves?: number, pending?: object|null, result?: object|null}} state
 *   usually `game.getState()`; its draw bookkeeping lets the AI avoid or seek draws
 * @param {{level?: Level, seed?: number, rng?: () => number}} [options] `rng` takes precedence
 *   over `seed`; the same state and seed always give the same move
 * @returns {Move|null} null when the game is over or a removal is pending
 */
export function chooseMove(state, { level = 'medium', seed = 0, rng = createRng(seed) } = {}) {
  const settings = LEVELS[level];
  if (!settings) throw new RangeError(`Unknown level: ${level}`);
  if (state.result || state.pending || decisiveResult(state)) return null;
  const draw = { history: state.history ?? [], noMillMoves: state.noMillMoves ?? 0 };
  const budget = { nodes: 0, limit: Infinity, exhausted: false };
  let ranked = shuffle(legalMoves(state), rng).map((move) => ({ move, score: 0 }));
  for (let depth = 1; depth <= settings.depth && ranked.length > 1; depth += 1) {
    const scored = scoreRootMoves(state, draw, ranked, depth, settings.noise, budget);
    if (budget.exhausted) break;
    ranked = scored.sort((a, b) => b.score - a.score);
    if (ranked[0].score >= FORCED_WIN) break;
    budget.limit = settings.nodeLimit;
  }
  return pickMove(ranked, settings.noise, rng);
}

/**
 * Static evaluation from the point of view of the player to act (positive is
 * good for them): pieces, closed mills, open mills they can close, double
 * mills, blocked pieces and mobility, weighted by the phase of the game.
 * @param {Position} position
 * @returns {number}
 */
export function evaluate(position) {
  const weights = WEIGHTS[gamePhase(position)];
  const mine = features(position, position.turn);
  const theirs = features(position, opponent(position.turn));
  let score = mine.threats > 0 ? weights.tempo : 0;
  for (const name of FEATURES) score += weights[name] * (mine[name] - theirs[name]);
  return score;
}

/**
 * Scores the root moves at `depth`. The window is lowered by `noise`, so every
 * move the random spread could still pick gets an exact score. A move that
 * draws by repetition or by the no-mill rule scores 0.
 */
function scoreRootMoves(position, draw, ranked, depth, noise, budget) {
  const scored = [];
  let best = -Infinity;
  for (const { move } of ranked) {
    const child = applyMove(position, move);
    const drawn = !decisiveResult(child) && drawReason(advanceDrawState(draw, move, child)) !== null;
    const score = drawn ? 0 : -negamax(child, depth - 1, -Infinity, noise - best, 1, budget);
    if (budget.exhausted) break;
    scored.push({ move, score });
    best = Math.max(best, score);
  }
  return scored;
}

/** Fail-soft negamax with alpha-beta pruning; scores are for the player to act. */
function negamax(position, depth, alpha, beta, ply, budget) {
  budget.nodes += 1;
  if (budget.nodes > budget.limit) {
    budget.exhausted = true;
    return 0;
  }
  if (piecesLeft(position, position.turn) < 3 || !hasLegalStep(position)) return ply - WIN_SCORE;
  if (depth === 0) return evaluate(position);
  let best = -Infinity;
  for (const move of orderedMoves(position)) {
    const score = -negamax(applyMove(position, move), depth - 1, -beta, -alpha, ply + 1, budget);
    if (budget.exhausted) return 0;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** Legal moves, most promising first: mills, then steps into a gap the opponent needs. */
function orderedMoves(position) {
  const { board, turn } = position;
  const them = opponent(turn);
  return legalMoves(position)
    .map((move) => ({
      move,
      rank: (move.remove !== null ? 2 : 0) + (closesMill(board, them, null, move.to) ? 1 : 0),
    }))
    .sort((a, b) => b.rank - a.rank)
    .map(({ move }) => move);
}

/** Highest score after adding up to `noise` of random spread to each move. */
function pickMove(ranked, noise, rng) {
  let choice = ranked[0];
  let bestValue = -Infinity;
  for (const entry of ranked) {
    const value = entry.score + noise * rng();
    if (value > bestValue) {
      choice = entry;
      bestValue = value;
    }
  }
  return choice.move;
}

function gamePhase(position) {
  if (position.inHand.white > 0 || position.inHand.black > 0) return 'placing';
  const flying = phaseOf(position, WHITE) === 'flying' || phaseOf(position, BLACK) === 'flying';
  return flying ? 'flying' : 'moving';
}

function features(position, player) {
  const { board } = position;
  const phase = phaseOf(position, player);
  const result = {
    pieces: piecesLeft(position, player),
    mills: 0,
    threats: 0,
    doubleMills: 0,
    blocked: 0,
    mobility: 0,
  };
  for (const mill of MILLS) {
    let own = 0;
    let gap = -1;
    for (const point of mill) {
      if (board[point] === player) own += 1;
      else if (board[point] === null) gap = point;
    }
    if (own === 3) result.mills += 1;
    else if (own === 2 && gap >= 0 && canReach(board, player, phase, gap, mill)) result.threats += 1;
  }
  if (phase !== 'flying') addMobility(board, player, result);
  return result;
}

/** Whether `player` can bring a piece from outside `mill` to its empty point `gap` in one step. */
function canReach(board, player, phase, gap, mill) {
  if (phase === 'placing') return true;
  for (const point of phase === 'flying' ? board.keys() : NEIGHBORS[gap]) {
    if (board[point] === player && !mill.includes(point)) return true;
  }
  return false;
}

/**
 * Mobility features of `player` (meaningless once flying): blocked pieces,
 * free neighbouring points, and double mills (a piece of a closed mill that
 * can step into another mill, so the player closes a mill every second move).
 */
function addMobility(board, player, result) {
  board.forEach((cell, point) => {
    if (cell !== player) return;
    const inMill = isInMill(board, point);
    let free = 0;
    for (const to of NEIGHBORS[point]) {
      if (board[to] !== null) continue;
      free += 1;
      if (inMill && closesMill(board, player, point, to)) result.doubleMills += 1;
    }
    if (free === 0) result.blocked += 1;
    result.mobility += free;
  });
}
