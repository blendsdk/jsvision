/**
 * Implementation tests — the resizable-dialog core seam (`Window.commitPlacement`/`onResized`/
 * `minWidth`/`minHeight`, the `desktop.begin*` commit-on-grab, and the `gestures.ts` per-window
 * minimum). These underpin the resizable `@jsvision/files` dialogs.
 *
 * The blocker they fix: a `centered` dialog's origin lives in `bounds` (written by the reflow pass),
 * NOT in `layout.rect` (which stays `{0,0,…}`). A resize/move gesture reads `layout.rect`, so without
 * a commit-on-grab it would snap the window to the top-left and the SE-grip resize would "explode"
 * (width = pointer − 0 + 1). TV centers once at insert (`ofCentered`); we center-until-touched, then
 * the window becomes a normal manually-placed window. Real app shell + gestures. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { Dialog } from '../src/dialog/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A resizable gray dialog (the base `Dialog` is `resizable=false`; the file dialogs flip it). */
class ResizableDialog extends Dialog {
  constructor(opts: ConstructorParameters<typeof Dialog>[0]) {
    super(opts);
    this.resizable = true;
    this.minWidth = 16;
    this.minHeight = 6;
  }
}

function shellApp(width: number, height: number) {
  return createApplication({ caps, viewport: { width, height } });
}
/** 1-based screen mouse event (the hit-test normalizes −1 to view-local). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

test('a centered dialog is committed on grab and resizes from the correct origin (not (0,0))', () => {
  const app = shellApp(60, 20);
  const dlg = new ResizableDialog({ title: 'R', width: 20, height: 8 }); // sized ⇒ centered by default
  app.desktop.addWindow(dlg);
  app.loop.renderRoot.flush();

  // Centered in 60×20: x=(60−20)/2=20, y=(20−8)/2=6. Origin lives in bounds, NOT layout.rect.
  expect(dlg.bounds).toMatchObject({ x: 20, y: 6, width: 20, height: 8 });
  expect(dlg.layout.rect).toEqual({ x: 0, y: 0, width: 20, height: 8 });
  expect(dlg.centered).toBe(true);

  // Mouse-down on the SE grip (bounds (20,6), size 20×8 ⇒ corner at screen (39,13)) begins a resize.
  app.loop.dispatch(mouse('down', 39, 13));
  // commit-on-grab froze the centered rect into layout.rect and cleared the flag.
  expect(dlg.layout.rect).toEqual({ x: 20, y: 6, width: 20, height: 8 });
  expect(dlg.centered).toBe(false);

  // Drag the grip out to screen (49,17): width = 49−20+1 = 30, height = 17−6+1 = 12 — the origin is
  // the COMMITTED (20,6), not (0,0). A regression (origin 0) would give width 50 / height 18.
  app.loop.dispatch(mouse('drag', 49, 17));
  expect(dlg.layout.rect).toEqual({ x: 20, y: 6, width: 30, height: 12 });
});

test('the per-window minimum floors the resize (a file-dialog-style min)', () => {
  const app = shellApp(60, 20);
  const dlg = new ResizableDialog({ title: 'R', width: 20, height: 8 });
  dlg.minWidth = 18;
  dlg.minHeight = 7;
  app.desktop.addWindow(dlg);
  app.loop.renderRoot.flush();

  app.loop.dispatch(mouse('down', 39, 13)); // grab SE grip, origin committed to (20,6)
  // Drag the grip well inside the origin: raw width/height go below the minimum ⇒ floored.
  app.loop.dispatch(mouse('drag', 22, 8)); // raw w = 22−20+1 = 3, h = 8−6+1 = 3
  expect(dlg.layout.rect).toMatchObject({ x: 20, y: 6, width: 18, height: 7 });
});

test('a centered dialog moved by the title stays put (no re-center on the next reflow)', () => {
  const app = shellApp(60, 20);
  const dlg = new ResizableDialog({ title: 'R', width: 20, height: 8 });
  app.desktop.addWindow(dlg);
  app.loop.renderRoot.flush();
  expect(dlg.bounds).toMatchObject({ x: 20, y: 6 }); // centered

  // Grab the title (local (10,0) ⇒ screen (30,6)) and drag right+down to screen (35,10).
  app.loop.dispatch(mouse('down', 30, 6));
  app.loop.dispatch(mouse('drag', 35, 10)); // x = 35−10 = 25, y = 10−0 = 10
  app.loop.renderRoot.flush(); // a reflow that WOULD re-center if `centered` were still set

  expect(dlg.centered).toBe(false);
  expect(dlg.layout.rect).toMatchObject({ x: 25, y: 10 });
  expect(dlg.bounds).toMatchObject({ x: 25, y: 10 }); // stayed where dropped, not re-centered to (20,6)
});
