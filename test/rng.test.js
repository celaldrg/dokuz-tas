import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, shuffle } from '../src/rng.js';

const take = (rng, count) => Array.from({ length: count }, () => rng());

test('the same seed always yields the same sequence', () => {
  assert.deepEqual(take(createRng(123), 20), take(createRng(123), 20));
  assert.notDeepEqual(take(createRng(123), 20), take(createRng(124), 20));
});

test('values are spread over [0, 1)', () => {
  const values = take(createRng(9), 10000);
  assert.ok(values.every((value) => value >= 0 && value < 1));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.02, `mean ${mean}`);
  const buckets = new Array(10).fill(0);
  for (const value of values) buckets[Math.floor(value * 10)] += 1;
  assert.ok(buckets.every((count) => count > 850 && count < 1150), buckets.join(','));
});

test('shuffle permutes in place and is reproducible', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  const shuffled = shuffle(items.slice(), createRng(5));
  assert.deepEqual([...shuffled].sort((a, b) => a - b), items);
  assert.notDeepEqual(shuffled, items);
  assert.deepEqual(shuffle(items.slice(), createRng(5)), shuffled);
  const target = [1, 2, 3];
  assert.equal(shuffle(target, createRng(1)), target);
});
