import test from 'node:test';
import assert from 'node:assert/strict';
import { load, save } from '../src/storage.js';

/** A Map-backed stand-in for window.localStorage. */
function memoryStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

test('values round-trip as JSON under a prefixed key', () => {
  const store = memoryStorage();
  const provider = () => store;
  assert.equal(save('settings', { mode: 'two', level: 'hard' }, provider), true);
  assert.deepEqual(load('settings', null, provider), { mode: 'two', level: 'hard' });
  assert.deepEqual([...store.items.keys()], ['dokuz-tas:settings']);
});

test('missing or unreadable values give the fallback', () => {
  const store = memoryStorage();
  assert.equal(load('lang', 'en', () => store), 'en');
  store.items.set('dokuz-tas:lang', '{not json');
  assert.equal(load('lang', 'en', () => store), 'en');
});

test('storage that throws or does not exist never breaks the game', () => {
  const blocked = () => {
    throw new Error('SecurityError: storage is disabled');
  };
  const full = () => ({
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  });
  assert.equal(load('lang', 'en', blocked), 'en');
  assert.equal(save('lang', 'tr', blocked), false);
  assert.equal(save('lang', 'tr', full), false);
  assert.equal(load('lang', 'en', () => undefined), 'en');
  assert.equal(save('lang', 'tr', () => undefined), false);
});

const noBrowserStorage = { skip: typeof globalThis.localStorage !== 'undefined' && 'this runtime has localStorage' };

test('without localStorage the default provider falls back quietly', noBrowserStorage, () => {
  assert.equal(load('lang', 'en'), 'en');
  assert.equal(save('lang', 'tr'), false);
});
