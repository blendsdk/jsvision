/**
 * Implementation tests — app-shell hardening (RD-13, HR-14).
 *
 * Edge coverage beyond ST-3.e: a stale gesture survives TWO successive modal open/close cycles and
 * still never teleports the window.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent, KeyEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { Group } from '../src/view/index.js';
import { Commands } from '../src/status/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

test('a stale gesture across two successive modals never moves the window', async () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } });
  const w = new Window('W');
  w.setLayout({ rect: { x: 2, y: 2, width: 12, height: 6 } });
  app.desktop.addWindow(w);

  app.desktop.beginMove(w, { x: 0, y: 0 });
  const rectBefore = { ...w.layout.rect };

  for (let i = 0; i < 2; i += 1) {
    const dialog = new Group();
    app.desktop.add(dialog);
    const modal = app.loop.execView(dialog);
    app.loop.endModal('closed');
    await modal;
    app.loop.dispatch(mouse('move', 25 + i, 12));
    expect(w.layout.rect).toEqual(rectBefore); // never teleports across either cycle
  }
});

// HR-08 — closing works with a single window on the desktop (removes it; no next to focus).
test('Commands.close removes the sole window', () => {
  const app = createApplication({ caps, viewport: { width: 30, height: 10 } });
  const w = new Window('Only');
  w.setLayout({ rect: { x: 0, y: 0, width: 20, height: 6 } });
  app.desktop.addWindow(w);
  app.loop.renderRoot.flush();

  app.loop.emitCommand(Commands.close);
  expect(app.desktop.children.includes(w)).toBe(false);
  expect(app.desktop.activeWindow()).toBeNull();
});

// HR-09 — control: an ACTIVE window's affordances DO act on the first click (only inactive is gated).
test('an active window close box acts on the first click', () => {
  const app = createApplication({ caps, viewport: { width: 30, height: 10 } });
  const w = new Window('A');
  w.setLayout({ rect: { x: 0, y: 0, width: 20, height: 6 } });
  app.desktop.addWindow(w); // sole window → active
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(w);

  // Close box window-local (2,0) → abs (2,0) → 1-based (3,1). Active ⇒ closes on the first click.
  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 3, y: 1 });
  expect(app.desktop.children.includes(w)).toBe(false);
});

// ---------------------------------------------------------------------------
// Phase-7 impl — zoom/resize roundtrip, three-menu switch, single-window close, two-modal gesture
// ---------------------------------------------------------------------------

function key(name: string): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false };
}

// HR-41 — growing the desktop above the restore rect leaves the restore rect intact (no over-clamp);
// the zoomed window re-maximizes to the larger desktop and unzoom returns to the original rect.
test('HR-41 impl: zoom → grow → unzoom returns the original restore rect', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } });
  const w = new Window('W');
  const original = { x: 6, y: 4, width: 18, height: 9 };
  w.setLayout({ rect: { ...original } });
  app.desktop.addWindow(w);

  w.zoom(); // maximize
  app.loop.resize({ width: 80, height: 40 }); // grow well above the restore rect
  expect(w.layout.rect).toEqual({ x: 0, y: 0, width: 80, height: 40 }); // re-maximized

  w.zoom(); // unzoom → the (still-fitting) original rect
  expect(w.layout.rect).toEqual(original);
});

// HR-40 — a three-menu bar switches directly between titles on single clicks.
test('HR-40 impl: three-menu bar switches title→title on single clicks', () => {
  const bar = menuBar([
    subMenu('~F~ile', [item('~O~k', 'ok')]),
    subMenu('~E~dit', [item('~C~opy', 'copy')]),
    subMenu('~V~iew', [item('~Z~oom', 'zoomcmd')]),
  ]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width: 40, height: 20 } });

  app.loop.dispatch(key('f10')); // File (0)
  expect(bar.controller?.openIndex()).toBe(0);
  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 9, y: 1 }); // Edit title (col ~8)
  expect(bar.controller?.openIndex()).toBe(1);
  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 15, y: 1 }); // View title (col ~14)
  expect(bar.controller?.openIndex()).toBe(2);
});

// HR-08 — closing the only window empties the desktop (no next to focus).
test('HR-08 impl: closing the sole window empties the desktop', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const only = new Window('Only');
  only.setLayout({ rect: { x: 0, y: 0, width: 20, height: 6 } });
  app.desktop.addWindow(only);

  app.loop.emitCommand(Commands.close);
  expect(app.desktop.children.includes(only)).toBe(false);
  expect(app.desktop.activeWindow()).toBe(null);
});

// HR-14 — a gesture surviving TWO successive modal open/close cycles still never teleports.
test('HR-14 impl: a stale gesture across two successive modals never teleports', async () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } });
  const w = new Window('W');
  w.setLayout({ rect: { x: 3, y: 3, width: 12, height: 6 } });
  app.desktop.addWindow(w);
  const before = { ...w.layout.rect };

  app.desktop.beginMove(w, { x: 0, y: 0 });

  const m1 = new Group();
  app.desktop.add(m1);
  const p1 = app.loop.execView(m1);
  app.loop.endModal('a');
  await p1;

  const m2 = new Group();
  app.desktop.add(m2);
  const p2 = app.loop.execView(m2);
  app.loop.endModal('b');
  await p2;

  app.loop.dispatch(mouse('move', 25, 12));
  expect(w.layout.rect).toEqual(before); // no teleport after two capture-loss cycles
});
