/**
 * Specification tests (immutable oracles) — DrawContext (clipped paint) & theming.
 *
 * Source: RD-03 AC-4, AC-13, AC-16 → ST-04, ST-13, ST-16
 * (codeops/features/jsvision-ui/plans/view-group-spine/07-testing-strategy.md).
 * Real ScreenBuffer + serialize (no mocks). Expectations derive from the acceptance criteria
 * and the PA-6 role→Style adapter contract, never from the implementation.
 */
import { test, expect } from 'vitest';
import { ScreenBuffer, serialize, resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { Rect } from '../src/layout/index.js';
import { makeDrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A buffer pre-filled with '.' so any painted cell is visible against the fill. */
function dotted(w: number, h: number): ScreenBuffer {
  return new ScreenBuffer(w, h, { fg: 'default', bg: 'default', char: '.' });
}

// ST-04 / AC-4 — view-local, clipped paint: local (0,0) lands at the view's absolute origin;
// writes past the view's far edge or outside an ancestor's clip are dropped, not painted into a
// neighbor.
test('ST-04: draw() is view-local and clipped to the view rect ∩ ancestor clip', () => {
  const buf = dotted(12, 6);
  const viewRect: Rect = { x: 5, y: 2, width: 4, height: 3 };
  const ctx = makeDrawContext(buf, viewRect, viewRect, defaultTheme, caps); // clip == view rect

  ctx.text(0, 0, 'X'); // local (0,0) → absolute (5,2)
  ctx.text(-1, 0, 'A'); // local x=-1 → absolute 4, before the left edge → dropped
  ctx.text(4, 0, 'B'); // local x=4 → absolute 9, at/after the far edge (width 4) → dropped

  expect(buf.get(5, 2)?.char).toBe('X'); // landed at the absolute origin
  expect(buf.get(4, 2)?.char).toBe('.'); // 'A' did not paint into the left neighbor
  expect(buf.get(9, 2)?.char).toBe('.'); // 'B' did not paint past the far edge

  // Ancestor clip narrower than the view (clip width 2): a write past the clip is dropped.
  const buf2 = dotted(12, 6);
  const clipped = makeDrawContext(buf2, viewRect, { x: 5, y: 2, width: 2, height: 3 }, defaultTheme, caps);
  clipped.text(0, 0, 'Y'); // absolute 5, inside the clip → painted
  clipped.text(3, 0, 'C'); // absolute 8, past clip right (7) → dropped
  expect(buf2.get(5, 2)?.char).toBe('Y');
  expect(buf2.get(8, 2)?.char).toBe('.');
});

// ST-13 / AC-13 — ctx.color(role) resolves named theme roles to a Style (fg/bg per the PA-6
// adapter); a widget picks the role from its focused state.
test('ST-13: ctx.color(role) resolves defaultTheme roles to their {fg,bg} style', () => {
  const buf = dotted(4, 1);
  const rect: Rect = { x: 0, y: 0, width: 4, height: 1 };
  const ctx = makeDrawContext(buf, rect, rect, defaultTheme, caps);

  expect(ctx.color('button')).toEqual({ fg: defaultTheme.button.fg, bg: defaultTheme.button.bg });
  expect(ctx.color('buttonFocused')).toEqual({
    fg: defaultTheme.buttonFocused.fg,
    bg: defaultTheme.buttonFocused.bg,
  });

  // The widget owns role selection from state — RD-03 only resolves names.
  const focused = true;
  expect(ctx.color(focused ? 'buttonFocused' : 'button')).toEqual({
    fg: defaultTheme.buttonFocused.fg,
    bg: defaultTheme.buttonFocused.bg,
  });
});

// ST-16 / AC-16 — all glyph output flows through ScreenBuffer + serialize; RD-03 emits no raw
// escape, and text routes through core's sanitize (control bytes never become cells).
test('ST-16: text routes through sanitize — control bytes never become cells', () => {
  const buf = new ScreenBuffer(10, 1, { fg: 'default', bg: 'default' });
  const rect: Rect = { x: 0, y: 0, width: 10, height: 1 };
  const ctx = makeDrawContext(buf, rect, rect, defaultTheme, caps);

  ctx.text(0, 0, 'a\x1b[31mb'); // an embedded ANSI escape; sanitize must strip the ESC control byte

  const painted = buf
    .rows()[0]
    .map((c) => c.char)
    .join('');
  expect(painted).not.toContain('\x1b'); // the ESC never became a cell
  expect(painted.startsWith('a[31mb')).toBe(true); // printable bytes kept, ESC removed

  // The frame is producible purely from buffer cells (no raw stream writes from RD-03).
  const frame = serialize(buf, null, { caps });
  expect(typeof frame).toBe('string');
});
