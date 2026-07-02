/**
 * Specification tests (immutable oracles) — RD-14 History MRU store.
 *
 * Source: jsvision-ui RD-14 AC-3 → ST-12…ST-16 (input-dropdowns/07-testing-strategy.md), the GATE-1
 * decode of `histlist.cpp` §6 (03-01-history.md), and PA-2/PA-6 (per-id entry-count cap, default 16;
 * oldest→newest order, index 0 = oldest). The observable `historyAdd` semantics are preserved
 * verbatim from TV: skip-empty, dedup (remove an existing equal entry), append-most-recent,
 * evict-oldest-when-full; reads are bounds-checked.
 *
 * Expectations derive from the AC + the C++ decode, never the implementation. Pure module functions
 * over a module-singleton `Map<number,string[]>` — cleared between tests.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, beforeEach } from 'vitest';
import { historyAdd, historyStr, historyCount, clearHistory, HISTORY_MAX_ENTRIES } from '../src/dropdown/index.js';

beforeEach(() => {
  clearHistory();
});

// ── ST-12: skip empty ────────────────────────────────────────────────────────────────────────────

test('ST-12: historyAdd(id, "") is a no-op (skip empty, histlist.cpp:163)', () => {
  historyAdd(1, '');
  expect(historyCount(1)).toBe(0);
  expect(historyStr(1, 0)).toBeUndefined();
});

// ── ST-13: dedup + re-append most-recent ─────────────────────────────────────────────────────────

test('ST-13: adding a, b, a dedups the earlier a and re-appends it most-recent → [b, a]', () => {
  historyAdd(1, 'a');
  historyAdd(1, 'b');
  historyAdd(1, 'a');
  expect(historyCount(1)).toBe(2);
  expect(historyStr(1, 0)).toBe('b'); // oldest = front
  expect(historyStr(1, 1)).toBe('a'); // newest = tail (the re-appended a)
});

// ── ST-14: cap + evict oldest ────────────────────────────────────────────────────────────────────

test('ST-14: adding more than the cap (16) keeps 16 entries and evicts the oldest (front) first', () => {
  for (let i = 0; i < HISTORY_MAX_ENTRIES + 3; i += 1) historyAdd(1, `e${i}`); // e0..e18 (19 distinct)
  expect(historyCount(1)).toBe(HISTORY_MAX_ENTRIES); // capped at 16
  expect(historyStr(1, 0)).toBe('e3'); // e0,e1,e2 evicted from the front (oldest-first)
  expect(historyStr(1, HISTORY_MAX_ENTRIES - 1)).toBe('e18'); // newest at the tail
});

test('ST-14: the default cap is 16 (PA-2)', () => {
  expect(HISTORY_MAX_ENTRIES).toBe(16);
});

// ── ST-15: bounds-checked reads; index 0 = oldest ───────────────────────────────────────────────

test('ST-15: historyStr(id, 0) is the oldest entry; an out-of-range index returns undefined', () => {
  historyAdd(1, 'first');
  historyAdd(1, 'second');
  expect(historyStr(1, 0)).toBe('first'); // index 0 = front = oldest (PA-6)
  expect(historyStr(1, 1)).toBe('second');
  expect(historyStr(1, 2)).toBeUndefined(); // out of range → undefined (bounds-checked, no throw)
  expect(historyStr(1, -1)).toBeUndefined();
});

// ── ST-16: shared per id ─────────────────────────────────────────────────────────────────────────

test('ST-16: entries under the same id share one list; distinct ids are independent', () => {
  historyAdd(7, 'x');
  historyAdd(7, 'y');
  historyAdd(9, 'z');
  expect(historyCount(7)).toBe(2);
  expect(historyStr(7, 0)).toBe('x');
  expect(historyStr(7, 1)).toBe('y');
  expect(historyCount(9)).toBe(1); // a different id is a separate list
  expect(historyStr(9, 0)).toBe('z');
});
