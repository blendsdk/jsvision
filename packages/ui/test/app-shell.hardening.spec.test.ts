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
