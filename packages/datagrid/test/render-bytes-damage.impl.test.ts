/**
 * Implementation/edge tests for grid-level damage proportionality (hardening around ST-5). These
 * exercise the boundaries of the "bytes ∝ damage" property on the same 60×22 fixture: an unchanged
 * frame emits nothing, and a larger change emits proportionally more bytes than a single-cell change
 * (yet a whole-row edit is still far below a full repaint).
 */
import { test, expect } from 'vitest';
import { serialize, resolveCapabilities } from '@jsvision/core';
import type { RenderOptions } from '@jsvision/core';
import { buildPerfGrid } from './fixtures/perf-grid.js';

const OPTS: RenderOptions = {
  caps: resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile,
};

test('an unchanged frame emits zero diff bytes', () => {
  const g = buildPerfGrid();
  g.rr.flush();
  const base = g.rr.buffer().clone();
  g.rr.flush(); // no state change between the two frames
  expect(serialize(g.rr.buffer(), base, OPTS).length).toBe(0);
});

test('a whole-row change emits more than a single-cell change, yet stays well below a full repaint', () => {
  const g = buildPerfGrid();
  g.rr.flush();
  const base = g.rr.buffer().clone();
  const full = serialize(base, null, OPTS).length;

  // Single-cell change (row 0, name).
  g.rows.set(g.rows().map((r, i) => (i === 0 ? { ...r, name: `${r.name}!` } : r)));
  g.rr.flush();
  const oneCell = serialize(g.rr.buffer(), base, OPTS).length;

  // Whole-row change (row 1: every field differs).
  const base2 = g.rr.buffer().clone();
  g.rows.set(
    g
      .rows()
      .map((r, i) => (i === 1 ? { ...r, name: 'ZZZ', city: 'Nowhere', balance: r.balance + 5, status: 'frozen' } : r)),
  );
  g.rr.flush();
  const oneRow = serialize(g.rr.buffer(), base2, OPTS).length;

  expect(oneCell, 'single-cell change emits bytes').toBeGreaterThan(0);
  expect(oneRow, 'a whole-row change touches more cells than one cell').toBeGreaterThan(oneCell);
  expect(oneRow < full / 2, `even a whole-row diff (${oneRow}) stays below full/2 (${full / 2})`).toBeTruthy();
});
