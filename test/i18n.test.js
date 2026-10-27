import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LANGUAGES,
  STRINGS,
  normalizeLanguage,
  otherLanguage,
  translate,
  translateList,
} from '../src/i18n.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('English and Turkish have the same message keys', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
});

test('no message is empty and both languages use the same placeholders', () => {
  for (const [key, english] of Object.entries(STRINGS.en)) {
    const turkish = STRINGS.tr[key];
    if (Array.isArray(english)) {
      assert.ok(Array.isArray(turkish), key);
      assert.equal(turkish.length, english.length, `${key} has as many items in both languages`);
      for (const item of [...english, ...turkish]) assert.ok(item.trim().length > 0, key);
    } else {
      assert.ok(english.trim().length > 0 && turkish.trim().length > 0, key);
      assert.deepEqual(placeholders(turkish), placeholders(english), key);
    }
  }
});

test('the language toggle shows the language it switches to', () => {
  assert.equal(translate('en', 'langToggle'), 'TR');
  assert.equal(translate('tr', 'langToggle'), 'EN');
});

test('translate fills placeholders and keeps unknown ones', () => {
  assert.equal(translate('en', 'actRemove', { piece: 'black' }), 'Mill! Remove a black piece');
  assert.equal(translate('tr', 'actRemove', { piece: 'siyah' }), 'Değirmen! Bir siyah taş al');
  assert.equal(translate('en', 'pointWhite', { name: 'a7' }), 'a7, white piece');
  assert.equal(translate('en', 'actRemove'), 'Mill! Remove a {piece} piece');
});

test('translate falls back to English and to the key itself', () => {
  assert.equal(translate('de', 'newGame'), 'New game');
  assert.equal(translate(undefined, 'newGame'), 'New game');
  assert.equal(translate('tr', 'newGame'), 'Yeni oyun');
  assert.equal(translate('en', 'noSuchKey'), 'noSuchKey');
  assert.equal(translate('en', 'rulesList'), 'rulesList', 'a list is not a string');
});

test('translateList returns a copy of a list, or an empty one', () => {
  const rules = translateList('tr', 'rulesList');
  assert.deepEqual(rules, STRINGS.tr.rulesList);
  rules.push('changed');
  assert.notEqual(STRINGS.tr.rulesList.at(-1), 'changed');
  assert.deepEqual(translateList('en', 'newGame'), []);
  assert.deepEqual(translateList('en', 'noSuchKey'), []);
});

test('languages are normalised and toggled', () => {
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('TR'), 'en');
  assert.equal(normalizeLanguage(null), 'en');
  assert.equal(normalizeLanguage({}), 'en');
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
  assert.equal(otherLanguage('xx'), 'tr');
});

test('every key the page and the UI code ask for exists', () => {
  const html = read('../index.html');
  const fromHtml = [...html.matchAll(/data-i18n(?:-label)?="(\w+)"/g)].map((match) => match[1]);
  assert.ok(fromHtml.length > 20, 'index.html marks its texts with data-i18n');

  const main = read('../src/main.js');
  const calls = [...main.matchAll(/\b(?:t|showHint)\(([^()]*)/g)].map((match) => match[1]);
  const fromCalls = calls.flatMap((args) => [...args.matchAll(/'(\w+)'/g)].map((match) => match[1]));
  const fromLists = [...main.matchAll(/translateList\([^,]+,\s*'(\w+)'\)/g)].map((match) => match[1]);
  assert.ok(fromCalls.length > 3 && fromLists.length === 2);

  for (const key of [...fromHtml, ...fromCalls, ...fromLists]) {
    for (const lang of LANGUAGES) assert.ok(key in STRINGS[lang], `${lang} lacks "${key}"`);
  }
});
