/**
 * Implementation tests — menu-bar flexible layout internals: a spacer is invisible to the label /
 * hotkey helpers, `layoutTitles` distributes slack across 0/1/2 (and weighted) spacers, a click on a
 * right-aligned title opens its popup anchored on the right, and ←→ navigation steps over a spacer.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { menuBar, subMenu, item, menuSpacer, layoutTitles, MenuPopup } from '../src/menu/index.js';
import { menuItemHotkey, menuItemLabel } from '../src/menu/builders.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x: x + 1, y: y + 1 };
}
function popups(overlay: Group): MenuPopup[] {
  return overlay.children.filter((c): c is MenuPopup => c instanceof MenuPopup);
}
function overlayOf(app: DesktopApplication): Group {
  const root = app.desktop.parent as Group;
  return root.children.find((c) => c.layout.position === 'absolute') as Group;
}

test('a spacer is invisible to the hotkey / label helpers (never a nav or accelerator target)', () => {
  expect(menuItemHotkey(menuSpacer())).toBe('');
  expect(menuItemLabel(menuSpacer())).toBe('');
});

test('layoutTitles distributes slack across 0, 1, and 2 spacers, and honours weights', () => {
  // 0 spacers → the classic left-pack.
  expect(layoutTitles([subMenu('~F~ile', []), subMenu('~E~dit', [])], 40)).toMatchObject([
    { index: 0, x: 1, width: 6 },
    { index: 1, x: 7, width: 6 },
  ]);

  // 1 spacer → the trailing title is flush right; the spacer (index 1) is not emitted.
  const one = layoutTitles([subMenu('~F~ile', []), menuSpacer(), subMenu('~H~elp', [])], 40);
  expect(one.map((t) => t.index)).toEqual([0, 2]);
  expect(one[1]).toMatchObject({ index: 2, x: 34, width: 6 });
  expect(one[1].x + one[1].width).toBe(40);

  // 2 equal spacers → the 30 slack cells split evenly (A|15|B|15|C).
  const two = layoutTitles(
    [subMenu('~A~', []), menuSpacer(), subMenu('~B~', []), menuSpacer(), subMenu('~C~', [])],
    40,
  );
  expect(two.map((t) => ({ index: t.index, x: t.x }))).toEqual([
    { index: 0, x: 1 },
    { index: 2, x: 19 },
    { index: 4, x: 37 },
  ]);
  expect(two[2].x + two[2].width).toBe(40); // "C" flush right

  // Weighted: a weight-2 spacer takes twice the slack of a weight-1 spacer (10 vs 20).
  const weighted = layoutTitles(
    [subMenu('~A~', []), menuSpacer(1), subMenu('~B~', []), menuSpacer(2), subMenu('~C~', [])],
    40,
  );
  expect(weighted.map((t) => t.x)).toEqual([1, 14, 37]);
});

test('clicking a right-aligned title opens its popup anchored on the right', () => {
  const app = createApplication({
    caps,
    menuBar: menuBar([
      subMenu('~F~ile', [item('~O~k', 'ok')]),
      menuSpacer(),
      subMenu('~H~elp', [item('~A~bout', 'about')]),
    ]),
    viewport: { width: 40, height: 12 },
  });
  const overlay = overlayOf(app);
  app.loop.renderRoot.flush();

  app.loop.dispatch(mouseDown(35, 0)); // click "Help" at its flex-moved column
  const open = popups(overlay);
  expect(open.length).toBe(1);
  expect(open[0].layout.rect?.x ?? 0).toBeGreaterThan(20); // anchored on the right, not the far left
});

test('←→ navigation steps over a spacer to the next real title', () => {
  const bar = menuBar([
    subMenu('~F~ile', [item('~O~k', 'ok')]),
    menuSpacer(),
    subMenu('~H~elp', [item('~A~bout', 'about')]),
  ]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  app.loop.dispatch(key('f', { alt: true })); // open File (index 0)
  expect(bar.controller?.openIndex()).toBe(0);
  app.loop.dispatch(key('right')); // → skips the spacer (index 1), lands on Help (index 2)
  expect(bar.controller?.openIndex()).toBe(2);
  app.loop.dispatch(key('left')); // ← back over the spacer to File
  expect(bar.controller?.openIndex()).toBe(0);
});
