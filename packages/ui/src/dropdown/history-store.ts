/**
 * RD-14 History MRU store — a modernized per-id entry-count cap (PA-2/PA-6), faithful to Turbo
 * Vision's OBSERVABLE `historyAdd`/`historyStr` semantics (`source/tvision/histlist.cpp`, GATE-1
 * verified + GATE-2 diffed).
 *
 * TV packs every id in one flat 1024-byte block, evicting the oldest record **by bytes across all
 * ids** (`historySize`, `insertString` `:123-140`). That cross-id byte budget is a 1990-era memory
 * artifact; the directive permits modernizing non-visual internals, so this keeps a
 * `Map<id, string[]>` with an independent per-id `maxEntries` cap (default 16). Every **observable**
 * `historyAdd` rule is preserved verbatim:
 *   • skip-empty — `historyAdd` returns on `str.empty()` (`histlist.cpp:161-163`); whitespace is NOT
 *     skipped (only the truly empty string).
 *   • dedup — delete an existing equal entry before inserting (`:164-172`).
 *   • append-most-recent — `insertString` appends at the tail (`:173`).
 *   • evict-oldest-when-full — the front (oldest) record drops first (`:123-140`).
 *   • order — `historyStr(id, 0)` is the front = **OLDEST** (`startId` then advance once,
 *     `:176-185`); the index grows toward newest (PA-6). Reads are bounds-checked.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */

/** The default per-id entry cap (PA-2; modernized replacement for TV's shared byte budget). */
export const HISTORY_MAX_ENTRIES = 16;

/**
 * Apply the TV `historyAdd` rules to `list` **in place**: skip-empty, dedup, append-most-recent,
 * evict-oldest. Shared by the global store and the injectable-signal path so the semantics never drift.
 *
 * @param list       The oldest→newest entry list to mutate.
 * @param str        The value to record.
 * @param maxEntries The per-id cap (default {@link HISTORY_MAX_ENTRIES}).
 */
export function addEntry(list: string[], str: string, maxEntries: number = HISTORY_MAX_ENTRIES): void {
  if (str === '') return; // skip empty (histlist.cpp:161-163) — whitespace is NOT skipped
  const existing = list.indexOf(str);
  if (existing !== -1) list.splice(existing, 1); // dedup: remove the earlier equal entry (:164-172)
  list.push(str); // append most-recent at the tail (:173)
  while (list.length > maxEntries) list.shift(); // evict the oldest (front) first (:123-140)
}

/** The module-singleton store, keyed by `historyId`; each array is ordered oldest→newest (PA-6). */
const store = new Map<number, string[]>();

/**
 * Append `str` as the most-recent entry for `id` (skip-empty/dedup/append/evict-oldest per
 * {@link addEntry}). Faithful to TV `historyAdd` (`histlist.cpp:161-173`).
 *
 * @param id         The numeric history id.
 * @param str        The value to record.
 * @param maxEntries The per-id cap (default {@link HISTORY_MAX_ENTRIES}).
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
 * Faithful to TV `historyStr` (`histlist.cpp:176-185`).
 *
 * @param id    The numeric history id.
 * @param index The 0-based index (0 = oldest).
 * @returns The entry text, or `undefined`.
 */
export function historyStr(id: number, index: number): string | undefined {
  const list = store.get(id);
  if (list === undefined || index < 0 || index >= list.length) return undefined;
  return list[index];
}

/** The count of entries for `id` (TV `historyCount`). */
export function historyCount(id: number): number {
  return store.get(id)?.length ?? 0;
}

/** A snapshot copy of the entries for `id` (oldest→newest); empty when the id is unknown. */
export function historyEntries(id: number): string[] {
  return [...(store.get(id) ?? [])];
}

/** Clear all stored history (TV `clearHistory`; test/reset use). */
export function clearHistory(): void {
  store.clear();
}
