/**
 * Implementation tests — `Desktop.removeWindow` repaints on every path.
 *
 * ST-2 is the tight guard on the fixed method. The bug only bites when the removed active window is
 * NOT the desktop's focus child: `Group.remove` heals focus (and the loop incidentally repaints) only
 * when the removed child held focus, so a directly-removed *focused* window repaints anyway. This test
 * synthesizes the load-bearing state — an active window that is not the focus child (the same
 * condition a closed modal leaves, where focus was restored elsewhere) via a non-focusable window —
 * so only the new else-branch can repaint the emptied desktop.
 *
 * ST-2b guards the sibling branch: removing the active of two windows still repaints via the
 * pre-existing `focusInto(active)` path, so the fix did not disturb that behavior.
 *
 * Presence/absence is asserted by glyph position (a window frame draws a corner where the desktop
 * would otherwise show its fill pattern), not by title text — narrow frame chrome truncates titles.
 * Both assert against the PAINTED frame (`loop.onFrame`), never a manual `renderRoot.flush()`.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { ScreenBuffer } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const PATTERN = defaultTheme.desktop.pattern; // the desktop fill glyph (░)

/** The glyph painted at a cell of the last frame. */
function charAt(buf: ScreenBuffer, x: number, y: number): string {
  return buf.get(x, y)?.char ?? ' ';
}

// ST-2 — the sole window is active but not the focus child (the state a closed modal leaves), then
// removed directly. Only the else-branch can repaint here: pre-fix this painted nothing (stale frame);
// post-fix the else-branch runs one tick and paints the emptied desktop.
test('ST-2: removeWindow of the sole active-but-unfocused window repaints via the else-branch', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const w = new Window('SOLO');
  // A window that never takes focus reproduces the code-level precondition of the bug — the desktop
  // holds it as active but not as its focus child — so removing it does NOT trigger the incidental
  // focus-heal repaint; the else-branch is the only thing that can paint.
  w.focusable = false;
  w.setLayout({ rect: { x: 2, y: 2, width: 20, height: 6 } });
  app.desktop.addWindow(w);
  expect(app.desktop.activeWindow()).toBe(w); // active, though never focused

  // Wire onFrame AFTER the add, so we count only the frames the direct removeWindow triggers.
  let paints = 0;
  let last: ScreenBuffer | null = null;
  app.loop.onFrame = (buf) => {
    paints++;
    last = buf.clone(); // snapshot — the live buffer is reused on the next flush
  };

  app.desktop.removeWindow(w); // direct, synchronous — the else-branch is the only thing that can paint

  expect(paints).toBe(1); // exactly the else-branch tick
  expect(last).not.toBeNull();
  const buf = last as unknown as ScreenBuffer;
  expect(charAt(buf, 2, 2)).toBe(PATTERN); // the window's old top-left corner now shows the desktop fill
  expect(charAt(buf, 10, 5)).toBe(PATTERN); // a cell that was inside the window is now desktop fill
  expect(app.desktop.activeWindow()).toBeNull(); // no window remains
});

// ST-2b — removing the active of two windows still repaints via the pre-existing focusInto(active)
// branch; the remaining window becomes active. Passes both before and after the fix — the guard that
// the new else-branch did not change this path. (The exact paint count is an implementation detail:
// remove() heals focus AND the sibling branch focuses the survivor, so assert a repaint happened, not
// a precise count.)
test('ST-2b: removeWindow with another window remaining still repaints (sibling branch intact)', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const a = new Window('AAA');
  a.setLayout({ rect: { x: 0, y: 0, width: 18, height: 5 } });
  const b = new Window('BBB');
  b.setLayout({ rect: { x: 20, y: 0, width: 18, height: 5 } });
  app.desktop.addWindow(a);
  app.desktop.addWindow(b); // b added last ⇒ active

  let paints = 0;
  let last: ScreenBuffer | null = null;
  app.loop.onFrame = (buf) => {
    paints++;
    last = buf.clone();
  };

  app.desktop.removeWindow(b); // active removed; a remains ⇒ repaint via focusInto(a)

  expect(paints).toBeGreaterThanOrEqual(1);
  expect(app.desktop.activeWindow()).toBe(a);
  expect(last).not.toBeNull();
  const buf = last as unknown as ScreenBuffer;
  expect(charAt(buf, 0, 0)).not.toBe(PATTERN); // a's frame corner is still painted (a present)
  expect(charAt(buf, 20, 0)).toBe(PATTERN); // b's old corner now shows the desktop fill (b gone)
});
