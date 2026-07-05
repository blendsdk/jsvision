/**
 * Implementation tests — jsvision-ui RD-19 `Surface` internals: resize overlap (grow + shrink +
 * non-positive clamp), `from(rows)` sizing (ragged + display-width), `snapshot` independence, the
 * `version` bump on every mutator, and the read-only-`at` immutability. Complements the ST oracles in
 * `surface.spec`. `.js` specifiers required by NodeNext.
 */
import { test, expect } from 'vitest';
import type { Style } from '@jsvision/core';
import { Surface } from '../src/surface/surface.js';

const S: Style = { fg: 'white', bg: 'black' };

test('resize grow — all four corner cells of the overlap are preserved', () => {
  const s = new Surface({ size: { x: 3, y: 3 } });
  s.set(0, 0, 'A', S);
  s.set(2, 0, 'B', S);
  s.set(0, 2, 'C', S);
  s.set(2, 2, 'D', S);
  s.resize({ x: 6, y: 5 });
  expect(s.at(0, 0)?.char).toBe('A');
  expect(s.at(2, 0)?.char).toBe('B');
  expect(s.at(0, 2)?.char).toBe('C');
  expect(s.at(2, 2)?.char).toBe('D');
  expect(s.at(5, 4)?.char).toBe(' '); // new far corner blank
});

test('resize shrink — the surviving region is preserved, the cut region is gone', () => {
  const s = new Surface({ size: { x: 5, y: 4 } });
  s.set(1, 1, 'X', S);
  s.set(4, 3, 'Y', S); // outside the shrink target
  s.resize({ x: 3, y: 2 });
  expect(s.size).toEqual({ x: 3, y: 2 });
  expect(s.at(1, 1)?.char).toBe('X'); // survives
  expect(s.at(4, 3)).toBeUndefined(); // cut away (now OOB)
});

test('resize — a non-positive dimension clamps to 1 (never an unusable buffer)', () => {
  const s = new Surface({ size: { x: 4, y: 4 } });
  s.resize({ x: 0, y: 3 });
  expect(s.size.x).toBeGreaterThanOrEqual(1);
  expect(s.size.y).toBe(3);
  expect(() => s.at(0, 0)).not.toThrow();
});

test('resize preserves a wide glyph in the overlap (lead + continuation)', () => {
  const s = new Surface({ size: { x: 4, y: 1 } });
  s.getDrawContext().text(0, 0, '中', S);
  s.resize({ x: 6, y: 2 });
  expect(s.at(0, 0)?.char).toBe('中');
  expect(s.at(0, 0)?.width).toBe(2);
  expect(s.at(1, 0)?.width).toBe(0);
});

test('grow(delta) ≡ resize(size + delta)', () => {
  const s = new Surface({ size: { x: 3, y: 3 } });
  s.set(0, 0, 'A', S);
  s.grow({ x: -1, y: 2 });
  expect(s.size).toEqual({ x: 2, y: 5 });
  expect(s.at(0, 0)?.char).toBe('A');
});

test('from(rows) — ragged rows size to the widest row × the row count', () => {
  const s = Surface.from(['a', 'bbbb', 'cc']);
  expect(s.size).toEqual({ x: 4, y: 3 });
  expect(s.at(0, 0)?.char).toBe('a');
  expect(s.at(1, 0)?.char).toBe(' '); // short row padded
  expect(s.at(3, 1)?.char).toBe('b'); // widest row fills
});

test('from(rows) — display-width aware (a wide glyph counts as 2 columns)', () => {
  const s = Surface.from(['中x']);
  expect(s.size).toEqual({ x: 3, y: 1 }); // 2 (wide) + 1
  expect(s.at(0, 0)?.char).toBe('中');
  expect(s.at(2, 0)?.char).toBe('x');
});

test('from([]) — an empty row list clamps to a 1×1 surface', () => {
  const s = Surface.from([]);
  expect(s.size.x).toBeGreaterThanOrEqual(1);
  expect(s.size.y).toBeGreaterThanOrEqual(1);
});

test('snapshot() is independent — mutating the surface never changes an earlier snapshot', () => {
  const s = new Surface({ size: { x: 2, y: 1 } });
  s.set(0, 0, 'A', S);
  const snap = s.snapshot();
  s.set(0, 0, 'Z', S);
  expect(snap.get(0, 0)?.char).toBe('A'); // snapshot frozen at the time of capture
  expect(s.at(0, 0)?.char).toBe('Z');
});

test('version() bumps on every mutator (set/clear/resize/grow/facade/invalidate/from)', () => {
  const s = new Surface({ size: { x: 3, y: 3 } });
  let v = s.version();
  const bumped = (label: string): void => {
    const nv = s.version();
    expect(nv, label).toBeGreaterThan(v);
    v = nv;
  };
  s.set(0, 0, 'A', S);
  bumped('set');
  s.clear();
  bumped('clear');
  s.getDrawContext().text(0, 0, 'Hi', S);
  bumped('facade text');
  s.invalidate();
  bumped('invalidate');
  s.resize({ x: 4, y: 4 });
  bumped('resize');
  s.grow({ x: 1, y: 0 });
  bumped('grow');

  const fromV = Surface.from(['x']).version();
  expect(fromV).toBeGreaterThan(0); // from() bumps once
});

test('at() returns a frozen copy — the surface is immutable through it', () => {
  const s = new Surface({ size: { x: 2, y: 1 } });
  s.set(0, 0, 'A', S);
  const c = s.at(0, 0)!;
  expect(Object.isFrozen(c)).toBe(true);
  expect(s.at(0, 0)?.char).toBe('A'); // unchanged
});
