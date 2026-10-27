import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove } from '../src/ai.js';
import { createGame } from '../src/game.js';
import { createRng } from '../src/rng.js';
import { isLegalMove } from '../src/rules.js';

const GAMES = 200;
// 18 placements, then at most 50 moves before each of the at most 13
// removals and 50 more after the last one: no game can pass 718 plies.
const MAX_PLIES = 1000;

/** Plays one easy-vs-easy game and returns its result. */
function playEasyGame(seed) {
  const rng = createRng(seed);
  const game = createGame();
  for (let ply = 0; ply < MAX_PLIES; ply += 1) {
    const state = game.getState();
    if (state.result) return state.result;
    const move = chooseMove(state, { level: 'easy', rng });
    assert.ok(move && isLegalMove(state, move), `game ${seed}, ply ${ply}: illegal move ${JSON.stringify(move)}`);
    assert.ok(game.play(move));
  }
  return assert.fail(`game ${seed} did not end within ${MAX_PLIES} plies`);
}

test(`${GAMES} seeded easy AI-vs-AI games all end in a win or a draw`, () => {
  const started = performance.now();
  const tally = { white: 0, black: 0, draw: 0 };
  for (let seed = 1; seed <= GAMES; seed += 1) {
    const { winner, reason } = playEasyGame(seed);
    const expected = winner === null ? ['repetition', 'fifty-moves'] : ['pieces', 'blocked'];
    assert.ok(expected.includes(reason), `game ${seed}: ${winner} by ${reason}`);
    tally[winner ?? 'draw'] += 1;
  }
  assert.equal(tally.white + tally.black + tally.draw, GAMES);
  assert.ok(tally.white > 0 && tally.black > 0 && tally.draw > 0, JSON.stringify(tally));
  assert.ok(performance.now() - started < 30_000, 'the games must fit in the 30 s suite budget');
});
