/**
 * The most-recently-used (MRU) history store behind the {@link History} dropdown — a process-global
 * map of numeric history id → an oldest→newest list of past field values. Each id keeps an independent
 * list capped at {@link HISTORY_MAX_ENTRIES} entries.
 *
 * Recording a value follows four rules: an empty string is skipped (whitespace is NOT), an existing
 * equal entry is removed first so it moves to the front of recency, the value is appended as the
 * newest, and the oldest entry is evicted once the cap is exceeded. Reads are indexed oldest-first
 * (index 0 = oldest) and are bounds-checked.
 */

/** The default per-id entry cap. */
export const HISTORY_MAX_ENTRIES = 16;

/**
 * Apply the history rules to `list` **in place**: skip empty, dedup, append as newest, evict oldest.
 * Shared by the global store and the injectable-signal path so the two never diverge.
 *
 * @param list       The oldest→newest entry list to mutate.
 * @param str        The value to record.
 * @param maxEntries The per-id cap (default {@link HISTORY_MAX_ENTRIES}).
 * @example
 * const list: string[] = ['a', 'b'];
 * addEntry(list, 'a'); // ['b', 'a'] — moved to newest
 * addEntry(list, '');  // ['b', 'a'] — empty is skipped
 */
export function addEntry(list: string[], str: string, maxEntries: number = HISTORY_MAX_ENTRIES): void {
  if (str === '') return; // skip empty — whitespace is NOT skipped, only the empty string
  const existing = list.indexOf(str);
  if (existing !== -1) list.splice(existing, 1); // dedup: remove the earlier equal entry
  list.push(str); // append as the newest entry
  while (list.length > maxEntries) list.shift(); // evict the oldest (front) entry once over the cap
}

/** The process-global store, keyed by history id; each array is ordered oldest→newest. */
const store = new Map<number, string[]>();

/**
 * Append `str` as the most-recent entry for `id` (skip-empty / dedup / append / evict-oldest, per
 * {@link addEntry}).
 *
 * @param id         The numeric history id.
 * @param str        The value to record.
 * @param maxEntries The per-id cap (default {@link HISTORY_MAX_ENTRIES}).
 * @example
 * import { historyAdd, historyEntries } from '@jsvision/ui';
 * historyAdd(1, '/usr/bin');
 * historyAdd(1, '/etc/hosts');
 * historyEntries(1); // ['/usr/bin', '/etc/hosts'] (oldest → newest)
 */
export function historyAdd(id: number, str: string, maxEntries?: number): void {
  let list = store.get(id);
  if (list === undefined) {
    list = [];
    store.set(id, list);
  }
  addEntry(list, str, maxEntries);
}

/**
 * The `index`-th entry for `id` (0 = oldest), or `undefined` if out of range (bounds-checked).
 *
 * @param id    The numeric history id.
 * @param index The 0-based index (0 = oldest).
 * @returns The entry text, or `undefined`.
 * @example
 * import { historyAdd, historyStr } from '@jsvision/ui';
 * historyAdd(2, 'first');
 * historyAdd(2, 'second');
 * historyStr(2, 0); // 'first' (oldest)
 * historyStr(2, 9); // undefined (out of range)
 */
export function historyStr(id: number, index: number): string | undefined {
  const list = store.get(id);
  if (list === undefined || index < 0 || index >= list.length) return undefined;
  return list[index];
}

/**
 * The number of stored entries for `id` (0 when the id is unknown).
 *
 * @param id The numeric history id.
 * @returns The entry count.
 * @example
 * import { historyAdd, historyCount } from '@jsvision/ui';
 * historyAdd(3, 'x');
 * historyCount(3); // 1
 */
export function historyCount(id: number): number {
  return store.get(id)?.length ?? 0;
}

/**
 * A snapshot copy of the entries for `id`, oldest→newest; empty when the id is unknown. The copy is
 * safe to mutate without affecting the store.
 *
 * @param id The numeric history id.
 * @returns A new array of the stored entries.
 * @example
 * import { historyAdd, historyEntries } from '@jsvision/ui';
 * historyAdd(4, 'a');
 * historyAdd(4, 'b');
 * historyEntries(4); // ['a', 'b']
 */
export function historyEntries(id: number): string[] {
  return [...(store.get(id) ?? [])];
}

/**
 * Clear all stored history for every id (useful to reset between runs or in tests).
 *
 * @example
 * import { clearHistory, historyCount } from '@jsvision/ui';
 * clearHistory();
 * historyCount(1); // 0
 */
export function clearHistory(): void {
  store.clear();
}
