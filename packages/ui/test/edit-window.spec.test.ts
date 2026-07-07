/**
 * Specification tests (immutable oracles) — RD-08 Phase-7 `EditWindow` (ST-26 + ST-27 gadget half).
 *
 * Source: RD-08 AC-12 / PF-006 / PF-013 / PA-10 / PA-19 + plan-preflight PF-001 → ST-26/ST-27
 * (codeops/features/jsvision-ui/plans/editor-family/07-testing-strategy.md; 03-04
 * §edit-window.ts). TV decode (`teditwnd.cpp:29-95`): min **24×6** (`minEditWinSize` `:29`,
 * `sizeLimits` `:91-95`); the gadget rects (end-exclusive): hScrollBar `TRect(18, y−1, x−2, y)`,
 * vScrollBar `TRect(x−1, 1, x, y−1)`, indicator `TRect(2, y−1, 16, y)` (`:40-52`); the editor =
 * the framed interior (`grow(−1,−1)`); titles via `getTitle` (`:70-78`) — `"Clipboard"` when the
 * hosted editor IS the clipboard (the identity check), else `"Untitled"`; a `title` signal write
 * re-renders (PF-013 — the files factory / `saveAs` writes it). Gadget visibility rides the
 * PA-19 `Window.active` signal (`TEditor::setState(sfActive)` → `sfVisible`,
 * `teditor2.cpp:546-554`). Expectations derive from RD-08 + the decodes, never the implementation.
 *
 * Trace: RD-08 03-04 · PF-001/PF-006/PF-013 · PA-10/PA-19 · ST-26/ST-27.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Editor } from '../src/editor/editor.js';
import { EditWindow } from '../src/editor/edit-window.js';
import { Indicator } from '../src/editor/indicator.js';
import { ScrollBar } from '../src/scroll/index.js';
import type { View } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

function makeApp(width = 70, height = 24) {
  return createApplication({ caps, viewport: { width, height } });
}

function gadgetsOf(win: EditWindow): { h: ScrollBar; v: ScrollBar; ind: Indicator } {
  const kids = (win as unknown as { children: View[] }).children;
  const bars = kids.filter((k): k is ScrollBar => k instanceof ScrollBar);
  const ind = kids.find((k): k is Indicator => k instanceof Indicator)!;
  // The horizontal bar sits on the bottom row; the vertical on the right column.
  const h = bars.find((b) => b.layout.rect!.height === 1)!;
  const v = bars.find((b) => b.layout.rect!.width === 1)!;
  return { h, v, ind };
}

// ST-26 / AC-12 / PF-006 — the decoded gadget rects at 60×20 (end-exclusive → width/height).
test('ST-26: gadgets sit at the TV rects for a 60×20 window', () => {
  const app = makeApp();
  const win = new EditWindow({});
  win.layout.rect = { x: 2, y: 1, width: 60, height: 20 };
  app.desktop.addWindow(win);
  app.loop.renderRoot.flush();

  const { h, v, ind } = gadgetsOf(win);
  expect(h.layout.rect).toEqual({ x: 18, y: 19, width: 40, height: 1 }); // cols 18..57, row 19
  expect(v.layout.rect).toEqual({ x: 59, y: 1, width: 1, height: 18 }); // rows 1..18, col 59
  expect(ind.layout.rect).toEqual({ x: 2, y: 19, width: 14, height: 1 }); // cols 2..15
  expect(win.editor.bounds.width).toBe(58); // the framed interior grow(−1,−1)
  expect(win.editor.bounds.height).toBe(18);
});

test('ST-26: a drag-resize below the TV minimum clamps to 24×6', () => {
  const app = makeApp();
  const win = new EditWindow({});
  win.layout.rect = { x: 0, y: 0, width: 40, height: 12 };
  app.desktop.addWindow(win);
  app.loop.renderRoot.flush();

  app.loop.dispatch(mouse('down', 39, 11)); // SE grip
  app.loop.dispatch(mouse('drag', 5, 2)); // far inward
  app.loop.dispatch(mouse('up', 5, 2));
  expect(win.layout.rect.width).toBe(24); // minEditWinSize (teditwnd.cpp:29)
  expect(win.layout.rect.height).toBe(6);
});

test('ST-26: titles — "Untitled" default, "Clipboard" via the identity check, signal write re-renders', () => {
  const clipboard = new Editor();
  expect(new EditWindow({}).title()).toBe('Untitled');
  expect(new EditWindow({ editor: clipboard, clipboard }).title()).toBe('Clipboard'); // teditwnd.cpp:70-78
  const named = new EditWindow({});
  named.title.set('README.md'); // the files factory / saveAs writes the signal (PF-013)
  expect(named.title()).toBe('README.md');
});

// ST-27 (gadget half) / PA-10 / PA-19 — gadgets hidden while the window is inactive.
test('ST-27: both bars + the indicator hide while inactive and re-show when active', () => {
  const app = makeApp();
  const w1 = new EditWindow({});
  w1.layout.rect = { x: 0, y: 0, width: 30, height: 8 };
  app.desktop.addWindow(w1);
  const w2 = new EditWindow({});
  w2.layout.rect = { x: 32, y: 0, width: 30, height: 8 };
  app.desktop.addWindow(w2); // raised last → active
  app.loop.renderRoot.flush();

  const g1 = gadgetsOf(w1);
  const g2 = gadgetsOf(w2);
  expect(g1.h.state.visible).toBe(false); // inactive → plain frame border (decode)
  expect(g1.v.state.visible).toBe(false);
  expect(g1.ind.state.visible).toBe(false);
  expect(g2.h.state.visible).toBe(true);
  expect(g2.v.state.visible).toBe(true);
  expect(g2.ind.state.visible).toBe(true);

  app.desktop.raise(w1); // activate w1
  expect(g1.h.state.visible).toBe(true);
  expect(g1.ind.state.visible).toBe(true);
  expect(g2.h.state.visible).toBe(false);
  expect(g2.ind.state.visible).toBe(false);
});
