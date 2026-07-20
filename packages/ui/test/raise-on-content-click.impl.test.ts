/**
 * Implementation tests — raise-on-content-click edge cases (fix #38, T-02.8).
 *
 * Companion to `raise-on-content-click.spec.test.ts` (the ST oracle). These exercise the corners of
 * the pre-delivery select pass: a manager-less window is a safe no-op; an interior click on the
 * already-active front window stays active (idempotent re-raise); the climb is clamped to the modal
 * scope (a click inside a modal dialog never disturbs the window behind it); and a frame click still
 * routes to `Window.onEvent` after the raise moved to `selectByClick`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DispatchEvent } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { Dialog } from '../src/dialog/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function shellApp(width: number, height: number) {
  return createApplication({ caps, viewport: { width, height } });
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** The `Editor`-shaped interior leaf: focusable, fills the window interior, consumes the down. */
class ConsumingLeaf extends View {
  override focusable = true;
  override layout = { position: 'absolute' as const, rect: { x: 0, y: 0, width: 38, height: 12 } };
  draw(): void {
    /* no-op */
  }
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'mouse' && ev.event.kind === 'down') {
      ev.setCapture?.(this);
      ev.handled = true;
    }
  }
}

function windowWithLeaf(
  app: ReturnType<typeof shellApp>,
  title: string,
  rect: { x: number; y: number; width: number; height: number },
): { win: Window; leaf: ConsumingLeaf } {
  const win = new Window(title);
  win.setLayout({ rect: rect });
  const leaf = new ConsumingLeaf();
  win.add(leaf);
  app.desktop.addWindow(win);
  return { win, leaf };
}

// (a) A manager-less (standalone) window's selectByClick() is a safe no-op — no manager to raise.
test('impl: a manager-less Window.selectByClick() is a safe no-op (no throw)', () => {
  const w = new Window('Standalone'); // never added to a desktop → manager === null
  expect(() => w.selectByClick?.()).not.toThrow();
});

// (b) An interior click on the ALREADY-active front window keeps it active (idempotent re-raise) and
// focuses its leaf — the select pass re-raising the top window is a no-op splice, never a close/zoom.
test('impl: an interior click on the active front window stays active (idempotent), focuses the leaf', () => {
  const app = shellApp(80, 24);
  const { win: a, leaf: leafA } = windowWithLeaf(app, 'Front', { x: 0, y: 0, width: 40, height: 14 });
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(a);

  app.loop.dispatch(mouse('down', 20, 7)); // A's interior (leaf covers abs 1..38, 1..12)
  expect(app.desktop.activeWindow()).toBe(a); // still active
  expect(app.desktop.children.includes(a)).toBe(true); // not closed
  expect(a.isZoomed()).toBe(false); // not zoomed
  expect(leafA.state.focused).toBe(true); // caret focused
});

// (c) The climb is clamped to the modal scope: a click inside a modal Dialog keeps the dialog the
// active top-select and never raises the window behind the modal (mirrors the bubble's scope clamp).
test('impl: a click inside a modal dialog does not raise the window behind it', () => {
  const app = shellApp(60, 20);
  const { win: back } = windowWithLeaf(app, 'Back', { x: 0, y: 0, width: 30, height: 12 });
  const dlg = new Dialog({ title: 'Modal', width: 20, height: 8 }); // centers → cols 20..39, rows 6..13
  app.desktop.addWindow(dlg); // added last → active + on top
  app.loop.renderRoot.flush();
  void app.loop.execView(dlg); // modal → scopeRoot = the dialog subtree
  expect(app.desktop.activeWindow()).toBe(dlg);

  // Click the dialog interior at (30,9): inside the dialog, outside `back` (back max x = 29).
  app.loop.dispatch(mouse('down', 30, 9));
  expect(app.desktop.activeWindow()).toBe(dlg); // dialog stays active
  expect(app.desktop.activeWindow()).not.toBe(back); // the window behind was never raised
});

// (d) A frame click still routes to Window.onEvent after the raise moved to selectByClick: clicking
// an active window's title bar begins a move (dragging set) — proving onEvent runs post-select-pass.
test('impl: a frame (title) click still reaches Window.onEvent — begins a move on the active window', () => {
  const app = shellApp(40, 12);
  const w = new Window('W'); // no interior leaf → frame + interior both hit the window group
  w.setLayout({ rect: { x: 5, y: 5, width: 12, height: 5 } });
  app.desktop.addWindow(w); // sole window → active (wasActiveOnPress will be true)
  app.loop.renderRoot.flush();

  // Title row, away from the close/zoom boxes: window-local (5,0) → abs (10,5).
  app.loop.dispatch(mouse('down', 10, 5));
  expect(w.dragging()).toBe(true); // beginMove ran → onEvent executed after the select pass
});
