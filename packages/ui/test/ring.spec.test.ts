/**
 * Specification tests (immutable oracles) — RD-08 Phase-8 `LineRing` (ST-28).
 *
 * Source: RD-08 AC-14 / AR-257 / PF-007 → ST-28 (codeops/features/jsvision-ui/plans/
 * editor-family/07-testing-strategy.md; 03-05 §ring.ts). TV decode (`textview.cpp`): `bufSize =
 * min(32000, n)` (`:66`); whole oldest LINES evict until a write fits (`while(!canInsert)
 * queBack = nextLine(queBack)` `:212-217` — never a partial line at the head); an oversized
 * write keeps only its LAST `bufSize−1` units (the `do_sputn` tail-trim, `:202-206` — PF-009
 * anchor); capacity measured in UTF-16 CODE UNITS (PF-007). Expectations derive from RD-08 +
 * the decode, never the implementation.
 *
 * Trace: RD-08 03-05 · AR-257 / PF-007 · ST-28.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { LineRing } from '../src/terminal/ring.js';

// ST-28 / AC-14 — whole-line eviction, the oversized tail-trim, writeLine, the empty ring.
test('ST-28: oldest WHOLE lines evict to fit — never a partial line at the head', () => {
  const ring = new LineRing(32);
  for (let i = 0; i < 5; i++) ring.writeLine(`line-${i}xx`); // 10 units each (9 chars + \n)
  // 5×10 = 50 > 32 → the oldest lines dropped whole; the newest fit.
  expect(ring.lineCount()).toBeLessThanOrEqual(3);
  expect(ring.line(0).startsWith('line-')).toBe(true); // a complete line, not a tail fragment
  expect(ring.line(ring.lineCount() - 1)).toBe('line-4xx'); // newest survives
});

test('ST-28: a single write longer than the capacity keeps only its LAST capacity−1 units', () => {
  const ring = new LineRing(32);
  const big = 'A'.repeat(100);
  ring.write(big);
  const kept = ring.line(0);
  expect(kept.length).toBe(31); // bufSize − 1 (decode :202-206)
  expect(kept).toBe('A'.repeat(31));
});

test('ST-28: writeLine adds exactly one line; the empty ring is safe', () => {
  const ring = new LineRing(32);
  expect(ring.lineCount()).toBe(0);
  expect(ring.line(0)).toBe(''); // ''-safe out of range
  ring.writeLine('a');
  expect(ring.lineCount()).toBe(1);
  expect(ring.line(0)).toBe('a');
  ring.clear();
  expect(ring.lineCount()).toBe(0);
});

test('ST-28: capacity counts UTF-16 code units (PF-007) — emoji cost 2 each', () => {
  const ring = new LineRing(8);
  ring.write('👍👍👍👍👍'); // 10 units > 8 → tail-kept 7 units (may split a pair — unit-based, not cluster)
  expect(ring.line(ring.lineCount() - 1).length).toBeLessThanOrEqual(7);
});
