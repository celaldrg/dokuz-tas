/**
 * Tiny localStorage helper. Every access sits in try/catch because storage
 * may be missing or throw (private mode, blocked site data, full quota);
 * the game then simply forgets its settings.
 */
const PREFIX = 'dokuz-tas:';

const browserStorage = () => globalThis.localStorage;

/**
 * Reads a value saved with `save`.
 * @template T
 * @param {string} key
 * @param {T} fallback returned when nothing readable is stored
 * @param {() => Storage} [getStorage] storage provider, replaceable in tests
 * @returns {T|unknown} the parsed value, or `fallback`
 */
export function load(key, fallback, getStorage = browserStorage) {
  try {
    const raw = getStorage().getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Saves a value as JSON; does nothing when storage is unavailable.
 * @param {string} key
 * @param {unknown} value
 * @param {() => Storage} [getStorage] storage provider, replaceable in tests
 * @returns {boolean} whether the value was stored
 */
export function save(key, value, getStorage = browserStorage) {
  try {
    getStorage().setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
