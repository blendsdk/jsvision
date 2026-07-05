/**
 * Specification tests (immutable oracles) — jsvision-ui RD-19 `Surface` buffer (ST-1/ST-2/ST-7/ST-14).
 *
 * Source: RD-19 AC-1/AC-2/AC-6/AC-7/AC-13/AC-14 (plans/surface-family/03-01-surface.md;
 * 07-testing-strategy.md). `Surface` **wraps** core's `ScreenBuffer` (PA-10) — it is buffer management,
 * not `TSurfaceView::draw()` geometry, so these oracles come from the RD, not a `.cpp` diff. The one TV
 * decode fact they honour: `TDrawSurface::resize` `memset 0`s the whole buffer (`tsurface.cpp:60`) —
 * jsvision's overlap-preserving `resize` (AC-1) is a deliberate documented extension (PA-2).
 *
 * SECURITY (AC-14, the PF-001 collision): no mutation path may store an unsanitized control byte.
 * `at()` is READ-ONLY (returns a frozen copy, never the live `ScreenBuffer.get` handle, PA-1); every
 * write (`set`/facade `text`/`fillRect`/`from`) routes through `ScreenBuffer` which sanitizes C0/DEL →
 * space at write time. A failing oracle means the CODE is wrong. `.js` specifiers required by NodeNext.
 */
import { test, expect } from 'vitest';
import { defaultTheme } from '@jsvision/core';
import type { Style, Theme } from '@jsvision/core';
import { Surface } from '../src/surface/surface.js';

const S: Style = { fg: 'white', bg: 'blue' };

// ── ST-1 (AC-1) — faithful API + overlap-preserving resize + wide-glyph backing ──────────────────

test('ST-1: Surface exposes the TDrawSurface API (resize/grow/clear/at/set)', () => {
  const s = new Surface({ size: { x: 5, y: 3 } });
  expect(typeof s.resize).toBe('function');
  expect(typeof s.grow).toBe('function');
  expect(typeof s.clear).toBe('function');
  expect(typeof s.at).toBe('function');
  expect(typeof s.set).toBe('function');
  expect(s.size).toEqual({ x: 5, y: 3 });
});

test('ST-1: grow({x:2,y:0}) ≡ resize to {x:7,y:3} (surface.h:39-42)', () => {
  const s = new Surface({ size: { x: 5, y: 3 } });
  s.grow({ x: 2, y: 0 });
  expect(s.size).toEqual({ x: 7, y: 3 });
});

test('ST-1: clear() blanks every cell to a space', () => {
  const s = new Surface({ size: { x: 3, y: 2 } });
  s.set(0, 0, 'X', S);
  s.set(2, 1, 'Y', S);
  s.clear();
  for (let y = 0; y < 2; y += 1) for (let x = 0; x < 3; x += 1) expect(s.at(x, y)?.char).toBe(' ');
});

test('ST-1: resize preserves the overlapping region; the new region is blank (AC-1, PA-2 extension)', () => {
  const s = new Surface({ size: { x: 3, y: 2 } });
  s.set(0, 0, 'A', S);
  s.set(2, 1, 'B', S);
  s.resize({ x: 5, y: 4 });
  expect(s.size).toEqual({ x: 5, y: 4 });
  // overlap preserved:
  expect(s.at(0, 0)?.char).toBe('A');
  expect(s.at(2, 1)?.char).toBe('B');
  // newly-exposed region blank:
  expect(s.at(4, 0)?.char).toBe(' ');
  expect(s.at(0, 3)?.char).toBe(' ');
});

test('ST-1: a wide glyph drawn via the facade occupies 2 cells (lead width 2 + continuation width 0)', () => {
  const s = new Surface({ size: { x: 4, y: 1 } });
  s.getDrawContext().text(0, 0, '中', S); // East-Asian Wide, display width 2
  expect(s.at(0, 0)?.char).toBe('中');
  expect(s.at(0, 0)?.width).toBe(2);
  expect(s.at(1, 0)?.width).toBe(0); // continuation — proves the ScreenBuffer wide-cell backing
});

// ── ST-2 (AC-2) — bounds-safe read-only at / no-op OOB set ────────────────────────────────────────

test('ST-2: at() out of bounds → undefined (no throw)', () => {
  const s = new Surface({ size: { x: 4, y: 3 } });
  expect(s.at(-1, 0)).toBeUndefined();
  expect(s.at(4, 0)).toBeUndefined();
  expect(s.at(0, 3)).toBeUndefined();
  expect(s.at(0, -1)).toBeUndefined();
});

test('ST-2: set() out of bounds is a no-op (no throw, buffer unchanged)', () => {
  const s = new Surface({ size: { x: 2, y: 2 } });
  s.set(0, 0, 'A', S);
  expect(() => s.set(-1, 0, 'Z', S)).not.toThrow();
  expect(() => s.set(5, 5, 'Z', S)).not.toThrow();
  expect(s.at(0, 0)?.char).toBe('A'); // untouched
});

test('ST-2: a zero/degenerate size clamps to at least 1×1 (never indexes out of range)', () => {
  const s = new Surface({ size: { x: 0, y: 0 } });
  expect(s.size.x).toBeGreaterThanOrEqual(1);
  expect(s.size.y).toBeGreaterThanOrEqual(1);
  expect(() => s.at(0, 0)).not.toThrow();
});

test('ST-2: at() returns a READ-ONLY cell — mutating it never changes the surface (PA-1)', () => {
  const s = new Surface({ size: { x: 2, y: 1 } });
  s.set(0, 0, 'A', S);
  const cell = s.at(0, 0);
  expect(cell).toBeDefined();
  // The returned cell is a frozen copy: mutation must not reach the surface (attempt silently ignored/throws).
  try {
    (cell as { char: string }).char = 'Z';
  } catch {
    /* frozen — a TypeError in strict mode is acceptable */
  }
  expect(s.at(0, 0)?.char).toBe('A');
});

// ── ST-7 (AC-7) — the paint facade ≡ raw buffer writes + per-call theme override (PA-4) ──────────

test('ST-7: getDrawContext() writes produce the same cells as equivalent raw buffer writes', () => {
  const viaFacade = new Surface({ size: { x: 6, y: 2 } });
  viaFacade.getDrawContext().text(0, 0, 'Hi', S);
  viaFacade.getDrawContext().fillRect(0, 1, 6, 1, '.', S);

  const viaRaw = new Surface({ size: { x: 6, y: 2 } });
  viaRaw.buffer.text(0, 0, 'Hi', S);
  viaRaw.buffer.fillRect(0, 1, 6, 1, '.', S);

  for (let y = 0; y < 2; y += 1)
    for (let x = 0; x < 6; x += 1) {
      const a = viaFacade.at(x, y);
      const b = viaRaw.at(x, y);
      expect({ char: a?.char, fg: a?.fg, bg: a?.bg }).toEqual({ char: b?.char, fg: b?.fg, bg: b?.bg });
    }
});

test('ST-7: surface.buffer is accessible (the raw escape hatch, AR-227)', () => {
  const s = new Surface({ size: { x: 3, y: 3 } });
  expect(s.buffer).toBeDefined();
  expect(s.buffer.width).toBe(3);
  expect(s.buffer.height).toBe(3);
});

test('ST-7: getDrawContext({theme}) resolves ctx.color(role) against the override (PA-4)', () => {
  const altTheme: Theme = { ...defaultTheme, window: { ...defaultTheme.window, fg: 'red', bg: 'green' } };
  const s = new Surface({ size: { x: 3, y: 1 } });
  const overridden = s.getDrawContext({ theme: altTheme }).color('window');
  expect({ fg: overridden.fg, bg: overridden.bg }).toEqual({ fg: 'red', bg: 'green' });
  // the construction-default facade still resolves against the default theme:
  const base = s.getDrawContext().color('window');
  expect({ fg: base.fg, bg: base.bg }).toEqual({ fg: defaultTheme.window.fg, bg: defaultTheme.window.bg });
});

// ── ST-14 (AC-14) — SECURITY: no mutation path stores an unsanitized control byte ───────────────

test('ST-14: surface.set() with an escape sequence stores a space, never the ESC byte', () => {
  const s = new Surface({ size: { x: 4, y: 1 } });
  s.set(0, 0, '\x1b[2J', S); // set takes the leading code point (ESC, 0x1b) — must sanitize to space
  expect(s.at(0, 0)?.char).toBe(' ');
  expect(s.at(0, 0)?.char).not.toBe('\x1b');
});

test('ST-14: facade ctx.text() sanitizes control bytes — no ESC reaches any cell', () => {
  const s = new Surface({ size: { x: 8, y: 1 } });
  s.getDrawContext().text(0, 0, '\x1b[31mred\x07', S);
  for (let x = 0; x < 8; x += 1) {
    const c = s.at(x, 0);
    if (c) expect(c.char.includes('\x1b')).toBe(false);
  }
});

test('ST-14: Surface.from() sanitizes each row (no control byte becomes a cell)', () => {
  const s = Surface.from(['ok', '\x1bevil']);
  for (let y = 0; y < s.size.y; y += 1)
    for (let x = 0; x < s.size.x; x += 1) {
      const c = s.at(x, y);
      if (c) expect(c.char.includes('\x1b')).toBe(false);
    }
});
