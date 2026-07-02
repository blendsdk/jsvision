/**
 * Specification tests (immutable oracles) — app-shell hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-14 + PA-13, plan docs 03-07-app-shell.md and
 * 07-testing-strategy.md (ST-3.e). A drag gesture whose pointer capture is lost externally (a modal
 * opened/closed mid-drag) must not teleport the window on the next desktop mouse-move. Real
 * `createApplication` desktop + window; expectations derive from the RD/PA, never the implementation.
 *
 * Later hardening phases append ST-4.a–b, ST-7.a–c,f–g to this file.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { Group } from '../src/view/index.js';
import { Commands } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A 1-based SGR mouse event of the given kind at 0-based absolute (x, y). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

// ST-3.e — a gesture whose capture was cleared by a modal open/close does not move the window on the
// next desktop mouse-move; the stale gesture is cleared (HR-14/PA-13).
test('ST-3.e: a stale gesture (capture lost via a modal) never teleports the window', async () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 20 } });
  const w = new Window('W');
  w.layout.rect = { x: 2, y: 2, width: 12, height: 6 };
  app.desktop.addWindow(w);

  // Begin a drag-move gesture (captures the pointer to the desktop).
  app.desktop.beginMove(w, { x: 0, y: 0 });
  const rectBefore = { ...w.layout.rect };

  // Open + close a modal WITHOUT a mouse-up — this clears the pointer capture (PA-5) but leaves the
  // desktop's `gesture` set.
  const dialog = new Group();
  app.desktop.add(dialog);
  const modal = app.loop.execView(dialog);
  app.loop.endModal('closed');
  await modal;

  // A desktop mouse-move over empty background (far from the window) must NOT move it.
  app.loop.dispatch(mouse('move', 30, 15));
  expect(w.layout.rect).toEqual(rectBefore); // no teleport — stale gesture cleared

  // The gesture is cleared, so a second move is also inert.
  app.loop.dispatch(mouse('move', 5, 5));
  expect(w.layout.rect).toEqual(rectBefore);
});

// ST-4.a — a `close` command removes the active window and re-focuses the next (HR-08).
test('ST-4.a: Commands.close removes the active window and focuses the next', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const a = new Window('A');
  a.layout.rect = { x: 0, y: 0, width: 18, height: 6 };
  app.desktop.addWindow(a);
  const b = new Window('B');
  b.layout.rect = { x: 20, y: 0, width: 18, height: 6 };
  app.desktop.addWindow(b); // added last → active
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(b);

  app.loop.emitCommand(Commands.close); // was dead before HR-08
  expect(app.desktop.children.includes(b)).toBe(false); // active window removed
  expect(app.desktop.activeWindow()).toBe(a); // next window focused
});

// ST-4.b — an inactive window's affordance columns are inert on the first click (raise+activate
// only); the second (now-active) click performs the action (HR-09 / tframe.cpp:150-193).
test('ST-4.b: an inactive window close box is inert on the first click, acts on the second', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const a = new Window('A');
  a.layout.rect = { x: 0, y: 0, width: 14, height: 6 };
  app.desktop.addWindow(a);
  const b = new Window('B');
  b.layout.rect = { x: 16, y: 0, width: 14, height: 6 };
  app.desktop.addWindow(b);
  app.desktop.raise(a); // A active, B inactive
  app.loop.renderRoot.flush();
  expect(app.desktop.activeWindow()).toBe(a);

  // B's close box: window-local (2,0) → abs (16+2, 0) = (18,0) → 1-based (19,1).
  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 19, y: 1 });
  expect(app.desktop.children.includes(b)).toBe(true); // first click did NOT close
  expect(app.desktop.activeWindow()).toBe(b); // it raised+activated B

  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 19, y: 1 });
  expect(app.desktop.children.includes(b)).toBe(false); // second click (active) closes
});

// ST-4.b — the inactive zoom column is likewise inert on the first click (raise only, no zoom).
test('ST-4.b: an inactive window zoom box is inert on the first click', () => {
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const a = new Window('A');
  a.layout.rect = { x: 0, y: 0, width: 14, height: 6 };
  app.desktop.addWindow(a);
  const b = new Window('B');
  const bRect = { x: 16, y: 0, width: 14, height: 6 };
  b.layout.rect = { ...bRect };
  app.desktop.addWindow(b);
  app.desktop.raise(a); // A active, B inactive
  app.loop.renderRoot.flush();

  // B's zoom box: window-local (w-3, 0) = (11,0) → abs (16+11, 0) = (27,0) → 1-based (28,1).
  app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 28, y: 1 });
  expect(b.layout.rect).toEqual(bRect); // not zoomed
  expect(app.desktop.activeWindow()).toBe(b); // only raised+activated
});
