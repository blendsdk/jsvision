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
import type { MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createApplication } from '../src/app/index.js';
import { signal } from '../src/reactive/index.js';
import { Editor } from '../src/editor/editor.js';
import { EditWindow } from '../src/editor/edit-window.js';
import { Indicator } from '../src/editor/indicator.js';
import { Commands } from '../src/status/index.js';
import { Memo } from '../src/editor/memo.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

test('zoom re-pins the gadget rects to the maximized size and back', () => {
  const app = createApplication({ caps, viewport: { width: 70, height: 24 } });
  const win = new EditWindow({});
  win.setLayout({ rect: { x: 2, y: 1, width: 40, height: 10 } });
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
  ind.setLayout({ size: { kind: 'fr', weight: 1 } });
  const root = new Group();
  root.setLayout({ direction: 'col' });
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
  root.setLayout({ direction: 'col' });
  memo.setLayout({ size: { kind: 'fr', weight: 1 } });
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

test('the hardware caret stays visible after a drag-resize (re-fit tracks the cursor)', () => {
  // Regression: on resize the editor never re-tracked its scroll, so a caret below the new fold
  // vanished (desiredCaret → null) and only returned on the next caret motion. onResized now
  // re-fits the editor (TV TEditor::changeBounds + trackCursor).
  const app = createApplication({ caps, viewport: { width: 80, height: 40 } });
  const win = new EditWindow({ rect: { x: 2, y: 1, width: 40, height: 20 } });
  app.desktop.addWindow(win);
  app.loop.renderRoot.flush();

  let caret: { x: number; y: number } | null = null;
  app.loop.onCaret = (c) => (caret = c);
  app.loop.focusView(win.editor);
  win.editor.setText(Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n'));
  for (let i = 0; i < 25; i++) win.editor.execute('lineDown'); // caret near the bottom
  app.loop.refreshCaret();
  expect(caret).not.toBeNull(); // visible before the resize

  // Shrink the window so the caret would fall below the new (smaller) interior.
  win.setLayout({ rect: { x: 2, y: 1, width: 40, height: 8 } });
  win.onResized();
  app.loop.renderRoot.flush();
  app.loop.refreshCaret();
  expect(win.editor.state.focused).toBe(true); // focus intact (not the cause)
  expect(caret).not.toBeNull(); // the caret survives the shrink
});

test('the caret survives a real drag-resize gesture (grab the grip, drag smaller, release)', () => {
  // Regression: grabbing the frame grip focus-on-click focused the WINDOW group, leaving the inner
  // editor as the current-chain leaf but with state.focused=false (raise → focusInto short-circuited
  // as "already focused" by chain), so desiredCaret() returned null. focus-on-click now focuses INTO
  // the window (to the editor leaf); the resize re-fit keeps the caret in the smaller viewport.
  const mouse = (kind: MouseEvent['kind'], x: number, y: number): MouseEvent => ({
    type: 'mouse',
    kind,
    button: 0,
    x: x + 1,
    y: y + 1,
  });
  const app = createApplication({ caps, viewport: { width: 80, height: 40 } });
  const win = new EditWindow({ rect: { x: 2, y: 1, width: 40, height: 20 } });
  app.desktop.addWindow(win);
  app.loop.renderRoot.flush();

  let caret: { x: number; y: number } | null = null;
  app.loop.onCaret = (c) => (caret = c);
  win.editor.setText(Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n'));
  app.loop.dispatch(mouse('down', 5, 5)); // click into the editor interior → focus it
  app.loop.dispatch(mouse('up', 5, 5));
  for (let i = 0; i < 25; i++) win.editor.execute('lineDown'); // caret near the bottom
  app.loop.refreshCaret();
  expect(caret).not.toBeNull();

  const r = win.layout.rect!;
  const grip = { x: r.x + r.width - 1, y: r.y + r.height - 1 }; // SE resize grip
  app.loop.dispatch(mouse('down', grip.x, grip.y));
  app.loop.dispatch(mouse('drag', grip.x - 2, grip.y - 12)); // shrink well past the caret's row
  app.loop.dispatch(mouse('up', grip.x - 2, grip.y - 12));
  app.loop.refreshCaret();

  expect(win.editor.state.focused).toBe(true); // the editor keeps its focus flag through the gesture
  expect(app.loop.getFocused()).toBe(win.editor);
  expect(caret).not.toBeNull(); // the caret is still shown after the resize
});

test('switching windows (next) keeps the hardware caret — focus descends to the editor', () => {
  // Regression: raise() focused the Window GROUP (focusView), leaving the inner editor's
  // state.focused = false, so desiredCaret() returned null and the caret vanished on F6. raise()
  // now focuses INTO the window (descends to the editor leaf).
  const app = createApplication({ caps, viewport: { width: 80, height: 30 } });
  const winA = new EditWindow({ rect: { x: 1, y: 1, width: 40, height: 12 } });
  const winB = new EditWindow({ rect: { x: 20, y: 3, width: 40, height: 12 } });
  app.desktop.addWindow(winA);
  app.desktop.addWindow(winB);
  app.loop.renderRoot.flush();

  let caret: { x: number; y: number } | null = null;
  app.loop.onCaret = (c) => (caret = c);
  app.loop.focusView(winB.editor); // as if the user clicked into B's editor
  winB.editor.setText('hello\nworld');
  app.loop.refreshCaret();
  expect(caret).not.toBeNull();

  app.loop.emitCommand(Commands.next); // F6 → raise the other window
  app.loop.refreshCaret();
  expect(app.desktop.activeWindow()).toBe(winA);
  expect(winA.editor.state.focused).toBe(true); // the inner editor is focused, not just the window
  expect(app.loop.getFocused()).toBe(winA.editor);
  expect(caret).not.toBeNull(); // the caret survives the window switch
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
