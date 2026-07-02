/**
 * Implementation tests (edge cases / internals) — RD-14 History MRU store.
 *
 * Companion to `history-store.spec.test.ts`: whitespace is NOT skipped (only empty), the cap boundary
 * (exactly 16 → 17), the shared pure `addEntry` used by the injectable-signal path preserves ordering,
 * and `clearHistory` / `historyEntries` snapshot behaviour.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, beforeEach } from 'vitest';
import {
  historyAdd,
  historyStr,
  historyCount,
  historyEntries,
  clearHistory,
  addEntry,
  HISTORY_MAX_ENTRIES,
} from '../src/dropdown/index.js';

beforeEach(() => {
  clearHistory();
});

test('whitespace is added (only the truly empty string is skipped, histlist.cpp:161-163)', () => {
  historyAdd(1, '   ');
  historyAdd(1, '');
  expect(historyCount(1)).toBe(1); // the spaces entry stays; the empty one is skipped
  expect(historyStr(1, 0)).toBe('   ');
});

test('the cap boundary: exactly 16 stays 16; the 17th evicts the oldest (front)', () => {
  for (let i = 0; i < HISTORY_MAX_ENTRIES; i += 1) historyAdd(1, `e${i}`); // e0..e15
  expect(historyCount(1)).toBe(16);
  expect(historyStr(1, 0)).toBe('e0'); // oldest still present at exactly the cap

  historyAdd(1, 'e16'); // the 17th
  expect(historyCount(1)).toBe(16);
  expect(historyStr(1, 0)).toBe('e1'); // e0 (oldest) evicted from the front
  expect(historyStr(1, 15)).toBe('e16'); // newest at the tail
});

test('addEntry preserves ordering on an app-owned array (the injectable-signal path)', () => {
  const arr: string[] = [];
  addEntry(arr, 'a');
  addEntry(arr, 'b');
  addEntry(arr, 'a'); // dedup + re-append most-recent
  expect(arr).toStrictEqual(['b', 'a']);

  addEntry(arr, '', 16); // skip-empty
  expect(arr).toStrictEqual(['b', 'a']);
});

test('addEntry honours a custom maxEntries cap', () => {
  const arr: string[] = [];
  for (let i = 0; i < 5; i += 1) addEntry(arr, `x${i}`, 3);
  expect(arr).toStrictEqual(['x2', 'x3', 'x4']); // cap 3, oldest evicted
});

test('historyEntries returns an independent snapshot (mutating it does not affect the store)', () => {
  historyAdd(1, 'a');
  historyAdd(1, 'b');
  const snap = historyEntries(1);
  expect(snap).toStrictEqual(['a', 'b']);
  snap.push('c'); // mutate the copy
  expect(historyCount(1)).toBe(2); // store unaffected
  expect(historyEntries(99)).toStrictEqual([]); // unknown id → empty
});

test('clearHistory empties every id', () => {
  historyAdd(1, 'a');
  historyAdd(2, 'b');
  clearHistory();
  expect(historyCount(1)).toBe(0);
  expect(historyCount(2)).toBe(0);
});
