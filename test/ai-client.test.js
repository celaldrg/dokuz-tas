import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiClient } from '../src/ai-client.js';
import { createGame } from '../src/game.js';
import { isLegalMove } from '../src/rules.js';

// Node has no module workers here, so these exercise the main-thread fallback.

test('the client answers with a legal move', async () => {
  const game = createGame();
  game.step(null, 4);
  const state = game.getState();
  const move = await createAiClient().choose(state, { level: 'easy', seed: 7 });
  assert.ok(move && isLegalMove(state, move));
});

test('the same seed gives the same move', async () => {
  const client = createAiClient();
  const state = createGame().getState();
  const first = await client.choose(state, { level: 'medium', seed: 11 });
  const second = await client.choose(state, { level: 'medium', seed: 11 });
  assert.deepEqual(first, second);
});

test('cancel resolves the open request with null', async () => {
  const client = createAiClient();
  const pending = client.choose(createGame().getState(), { level: 'hard', seed: 1 });
  client.cancel();
  assert.equal(await pending, null);
});

test('a new request replaces the open one', async () => {
  const client = createAiClient();
  const state = createGame().getState();
  const first = client.choose(state, { level: 'easy', seed: 2 });
  const second = client.choose(state, { level: 'easy', seed: 3 });
  assert.equal(await first, null);
  assert.ok(isLegalMove(state, await second));
});
