/**
 * Implementation tests — DrawContext clipping & the theme adapter (internals & edges; 07 §impl).
 *
 * Four-edge clip-drop, wide-glyph straddle dropped whole, exact `fill`, box/shadow per-cell
 * clipping, and the role→Style adapter ignoring role-only extras.
 */
import { test, expect } from 'vitest';
import { ScreenBuffer, defaultTheme } from '@jsvision/core';
import type { Rect } from '../src/layout/index.js';
import { makeDrawContext, themeRoleToStyle } from '../src/view/index.js';

/** Buffer pre-filled with '.' so any painted/cleared cell is visible. */
function dotted(w: number, h: number): ScreenBuffer {
  return new ScreenBuffer(w, h, { fg: 'default', bg: 'default', char: '.' });
}

test('clip drops writes past each of the four edges; an in-clip write lands', () => {
  const buf = dotted(8, 6);
  const rect: Rect = { x: 2, y: 2, width: 3, height: 2 }; // valid local x 0..2, y 0..1
  const ctx = makeDrawContext(buf, rect, rect, defaultTheme);

  ctx.text(0, 0, 'I'); // inside → abs (2,2)
  ctx.text(0, -1, 'T'); // above top → abs (2,1)
  ctx.text(0, 2, 'B'); // below bottom → abs (2,4)
  ctx.text(-1, 0, 'L'); // left of edge → abs (1,2)
  ctx.text(3, 0, 'R'); // past right edge → abs (5,2)

  expect(buf.get(2, 2)?.char).toBe('I'); // landed
  expect(buf.get(2, 1)?.char).toBe('.'); // top dropped
  expect(buf.get(2, 4)?.char).toBe('.'); // bottom dropped
  expect(buf.get(1, 2)?.char).toBe('.'); // left dropped
  expect(buf.get(5, 2)?.char).toBe('.'); // right dropped
});

test('a wide glyph straddling the clip right edge is dropped whole (no half-cell)', () => {
  const buf = dotted(8, 1);
  const rect: Rect = { x: 0, y: 0, width: 8, height: 1 };
  const clip: Rect = { x: 0, y: 0, width: 3, height: 1 }; // valid x 0..2

  const ctx = makeDrawContext(buf, rect, clip, defaultTheme);
  ctx.text(2, 0, '世'); // wide: abs 2..3; 3 ≥ clip right (3) → dropped whole
  expect(buf.get(2, 0)?.char).toBe('.'); // not half-painted
  expect(buf.get(3, 0)?.char).toBe('.');

  ctx.text(0, 0, '界'); // wide fully inside → abs 0..1
  expect(buf.get(0, 0)?.char).toBe('界');
  expect(buf.get(1, 0)?.width).toBe(0); // continuation cell
});

test('fill() covers exactly the view rect, not the whole buffer', () => {
  const buf = dotted(6, 4);
  const rect: Rect = { x: 1, y: 1, width: 3, height: 2 };
  const ctx = makeDrawContext(buf, rect, rect, defaultTheme);

  ctx.fill('#');
  expect(buf.get(1, 1)?.char).toBe('#'); // inside
  expect(buf.get(3, 2)?.char).toBe('#'); // inside far corner
  expect(buf.get(0, 0)?.char).toBe('.'); // outside (top-left)
  expect(buf.get(4, 1)?.char).toBe('.'); // outside (right of view)
  expect(buf.get(1, 3)?.char).toBe('.'); // outside (below view)
});

test('box() clips its border to the clip rect', () => {
  const buf = dotted(8, 6);
  const viewRect: Rect = { x: 0, y: 0, width: 8, height: 6 };
  const clip: Rect = { x: 0, y: 0, width: 4, height: 6 }; // valid x 0..3
  const ctx = makeDrawContext(buf, viewRect, clip, defaultTheme);

  ctx.box(0, 0, 8, 4, { fg: 'white', bg: 'blue' }); // box wider than the clip
  expect(buf.get(0, 0)?.char).toBe('┌'); // left corner inside clip
  expect(buf.get(2, 0)?.char).toBe('─'); // top edge inside clip
  expect(buf.get(5, 0)?.char).toBe('.'); // top edge past clip → dropped
  expect(buf.get(7, 0)?.char).toBe('.'); // right corner past clip → dropped
});

test('shadow() darkens only in-clip cells', () => {
  const buf = dotted(8, 4);
  const viewRect: Rect = { x: 0, y: 0, width: 8, height: 4 };
  const clip: Rect = { x: 0, y: 0, width: 4, height: 4 }; // valid x 0..3
  const ctx = makeDrawContext(buf, viewRect, clip, defaultTheme);

  ctx.shadow(0, 0, 5, 1, { fg: 'white', bg: 'black' });
  // bottom row (y=1) col x=1..? within clip is darkened; the right-column cell at x=5 is past the clip.
  expect(buf.get(1, 1)?.bg).toBe('black'); // in-clip shadow cell darkened (glyph kept)
  expect(buf.get(1, 1)?.char).toBe('.');
  expect(buf.get(5, 1)?.bg).toBe('default'); // past clip → not darkened
});

test('themeRoleToStyle maps only fg/bg, ignoring role-only extras', () => {
  const window = defaultTheme.window; // ThemeRole & { border, title }
  expect(themeRoleToStyle(window)).toEqual({ fg: window.fg, bg: window.bg });
  expect('border' in themeRoleToStyle(window)).toBe(false);
  expect('title' in themeRoleToStyle(window)).toBe(false);
  expect('hotkey' in themeRoleToStyle(defaultTheme.menuBar)).toBe(false); // menuBar carries a hotkey
});
