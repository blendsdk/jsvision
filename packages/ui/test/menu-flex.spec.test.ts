/**
 * Specification tests (immutable oracles) — the flexible menu bar.
 *
 * A `menuSpacer()` right-aligns the following titles; submenu popups anchor under a title's
 * flex-moved column; `titleIndexAt` maps a click on a moved title back to its index and a click in
 * the flexible gap to `null`. The default (spacer-free) layout stays byte-identical to the classic
 * left-pack. Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { menuBar, subMenu, item, menuSpacer, layoutTitles, titleIndexAt, MenuPopup } from '../src/menu/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}
function popups(overlay: Group): MenuPopup[] {
  return overlay.children.filter((c): c is MenuPopup => c instanceof MenuPopup);
}
function overlayOf(app: DesktopApplication): Group {
  const root = app.desktop.parent as Group;
  return root.children.find((c) => c.layout.position === 'absolute') as Group;
}

const W = 40;
/** A File — spacer — Help bar: "File" left, "Help" pushed to the right edge. */
function flexTops() {
  return [subMenu('~F~ile', [item('~O~k', 'ok')]), menuSpacer(), subMenu('~H~elp', [item('~A~bout', 'about')])];
}

// ST-08 — menuSpacer right-aligns the trailing titles; the spacer-free default is unchanged.
test('ST-08: menuSpacer right-aligns titles; the default (no spacer) stays a byte-identical left-pack', () => {
  const laid = layoutTitles(flexTops(), W);
  // "File" packs from the classic left column; "Help" is flush right, its ` Help ` button ending at W.
  expect(laid.find((t) => t.index === 0)).toMatchObject({ x: 1, width: 6 });
  const help = laid.find((t) => t.index === 2);
  expect(help).toMatchObject({ x: 34, width: 6 });
  expect((help?.x ?? 0) + (help?.width ?? 0)).toBe(W);
  // The spacer carries no title (never emitted as a TitleLayout).
  expect(laid.some((t) => t.index === 1)).toBe(false);

  // Regression: with no spacer and no width, the layout is the classic left-pack.
  expect(layoutTitles([subMenu('~F~ile', []), subMenu('~H~elp', [])])).toMatchObject([
    { index: 0, x: 1, width: 6 },
    { index: 1, x: 7, width: 6 },
  ]);

  // Rendered: the menu bar draws "Help" at its flex-moved column.
  const app = createApplication({ caps, menuBar: menuBar(flexTops()), viewport: { width: W, height: 12 } });
  app.loop.renderRoot.flush();
  const buf = app.loop.renderRoot.buffer();
  expect(buf.get(2, 0)?.char).toBe('F'); // "File" text at col 2 (button x=1)
  expect(buf.get(35, 0)?.char).toBe('H'); // "Help" text at col 35 (button x=34)
});

// ST-09 — a submenu popup anchors under its flex-moved title.
test('ST-09: the Help popup anchors one column left of its flex-moved title', () => {
  const app = createApplication({ caps, menuBar: menuBar(flexTops()), viewport: { width: W, height: 12 } });
  const overlay = overlayOf(app);
  app.loop.renderRoot.flush();

  app.loop.dispatch(key('h', { alt: true })); // Alt+H opens Help
  const open = popups(overlay);
  expect(open.length).toBe(1);
  const rect = open[0].layout.rect;
  // Help is flush right, so its popup anchors under the flex-moved title and clamps to the right edge —
  // proving the anchor followed Help's flex x (34), not the old left-pack column (which would sit at ~6).
  expect(rect?.x ?? 0).toBeGreaterThan(20); // right half, not the far-left left-pack position
  expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(W); // fully on-screen
  expect(rect?.x).toBe(W - (rect?.width ?? 0)); // clamped flush against the right edge
});

// ST-10 — titleIndexAt maps a flex-moved title back to its index; a click in the gap maps to null.
test('ST-10: titleIndexAt maps a flex title to its index; the flexible gap maps to null', () => {
  const tops = flexTops();
  expect(titleIndexAt(tops, 35, W)).toBe(2); // inside the right-aligned "Help"
  expect(titleIndexAt(tops, 2, W)).toBe(0); // inside "File"
  expect(titleIndexAt(tops, 20, W)).toBeNull(); // the middle of the flexible gap
});
