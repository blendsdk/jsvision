/**
 * Implementation tests — RD-08 Phase-7 composition edges (after green).
 *
 * The growMode re-pin on zoom, the manager-less indicator (no drag bind), the memo feedback
 * guard under rapid alternating writes, and a supplied editor winning over clipboard/dialog
 * options (the PF-001 precedence rule).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createApplication } from '../src/app/index.js';
import { signal } from '../src/reactive/index.js';
import { Editor } from '../src/editor/editor.js';
import { EditWindow } from '../src/editor/edit-window.js';
import { Indicator } from '../src/editor/indicator.js';
import { Memo } from '../src/editor/memo.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

test('zoom re-pins the gadget rects to the maximized size and back', () => {
  const app = createApplication({ caps, viewport: { width: 70, height: 24 } });
  const win = new EditWindow({});
  win.layout.rect = { x: 2, y: 1, width: 40, height: 10 };
  app.desktop.addWindow(win);
  app.loop.renderRoot.flush();

  win.zoom(); // maximize to the desktop
  app.loop.renderRoot.flush();
  const desk = app.desktop.bounds;
  const kids = (win as unknown as { children: { layout: { rect?: { x: number; y: number } } }[] }).children;
  const bottomRow = kids.filter((k) => k.layout.rect?.y === desk.height - 1);
  expect(bottomRow.length).toBeGreaterThanOrEqual(2); // hBar + indicator re-pinned to the new bottom

  win.zoom(); // restore
  app.loop.renderRoot.flush();
  expect(win.layout.rect).toEqual({ x: 2, y: 1, width: 40, height: 10 });
  const restoredBottom = kids.filter((k) => k.layout.rect?.y === 9);
  expect(restoredBottom.length).toBeGreaterThanOrEqual(2);
});

test('an indicator with no Window ancestor renders the resting state and never throws', () => {
  const ind = new Indicator();
  ind.layout = { size: { kind: 'fr', weight: 1 } };
  const root = new Group();
  root.layout = { direction: 'col' };
  root.add(ind);
  const loop = createEventLoop({ width: 14, height: 1 }, { caps });
  loop.mount(root);
  ind.setValue({ line: 2, col: 3 }, false);
  loop.renderRoot.flush();
  expect(loop.renderRoot.buffer().get(0, 0)?.char).toBe('═'); // resting, no drag bind (PA-3 edge)
});

test('memo: rapid alternating external/internal writes never feedback-loop', () => {
  const value = signal('a');
  const memo = new Memo({ value });
  const root = new Group();
  root.layout = { direction: 'col' };
  memo.layout = { size: { kind: 'fr', weight: 1 } };
  root.add(memo);
  const loop = createEventLoop({ width: 10, height: 3 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(memo);

  for (let i = 0; i < 20; i++) {
    value.set(`ext${i}`);
    expect(memo.getText()).toBe(`ext${i}`);
    memo.execute('textEnd');
    memo.insertText('!');
    expect(value()).toBe(`ext${i}!`);
  }
});

test('PF-001 precedence: a supplied editor wins; clipboard/editorDialog serve only the default', () => {
  const supplied = new Editor();
  const clipboard = new Editor();
  const win = new EditWindow({ editor: supplied, clipboard });
  expect(win.editor).toBe(supplied);
  expect(supplied.options.clipboard).toBeUndefined(); // NOT re-wired into the supplied editor

  const defaulted = new EditWindow({ clipboard });
  expect(defaulted.editor.options.clipboard).toBe(clipboard); // configures the default-constructed one
});

// Regression (2026-07-07 bug report): opening a file in tvedit composed the gadgets ONCE at the
// constructor-fallback geometry (vBar/indicator mid-window) until the first click's tick reflowed.
// The rect must ride the CONSTRUCTOR so the very first pin — and therefore the mount-time
// compose, which can run before the onMount re-pin — uses the real geometry.
test('a constructor rect composes the gadgets at the TV rows immediately (no tick)', () => {
  const app = createApplication({ caps, viewport: { width: 70, height: 24 } });
  app.loop.renderRoot.flush();
  const win = new EditWindow({ rect: { x: 5, y: 3, width: 48, height: 14 } });
  app.desktop.addWindow(win); // mounted OUTSIDE any tick (the FileDialog .then() situation)

  // Read the buffer WITHOUT dispatching anything — the state the live screen shows.
  const buf = app.loop.renderRoot.buffer();
  let found: { x: number; y: number } | null = null;
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 68; x++) if (buf.get(x, y)?.char === '1' && buf.get(x + 1, y)?.char === ':') found = { x, y };
  expect(found?.y).toBe(3 + 13); // the indicator sits ON the bottom border, not mid-window
});

test('cascade/tile re-pin the gadget rects (arrange fires onResized)', () => {
  const app = createApplication({ caps, viewport: { width: 70, height: 24 } });
  const win = new EditWindow({ rect: { x: 2, y: 1, width: 40, height: 10 } });
  app.desktop.addWindow(win);
  app.loop.renderRoot.flush();

  app.desktop.cascade(); // resizes the window to the cascade rect
  app.loop.renderRoot.flush();
  const h = win.layout.rect?.height ?? 0;
  expect(h).not.toBe(10); // cascade actually resized it
  const kids = (win as unknown as { children: { layout: { rect?: { y: number } } }[] }).children;
  expect(kids.filter((k) => k.layout.rect?.y === h - 1).length).toBeGreaterThanOrEqual(2); // hBar + ind
});

test('a zoomed window re-pins its gadgets when the desktop resizes', () => {
  const app = createApplication({ caps, viewport: { width: 70, height: 24 } });
  const win = new EditWindow({ rect: { x: 2, y: 1, width: 40, height: 10 } });
  app.desktop.addWindow(win);
  app.loop.renderRoot.flush();
  win.zoom();
  app.loop.renderRoot.flush();

  app.loop.resize({ width: 60, height: 30 }); // HR-41: the zoomed window re-maximizes
  const h = win.layout.rect?.height ?? 0;
  expect(h).toBe(app.desktop.bounds.height); // re-maximized to the new desktop
  const kids = (win as unknown as { children: { layout: { rect?: { y: number } } }[] }).children;
  expect(kids.filter((k) => k.layout.rect?.y === h - 1).length).toBeGreaterThanOrEqual(2);
});
