/**
 * Specification tests (immutable oracle) — what a drag-resize of the file dialogs must guarantee.
 *
 * These dialogs are `wfGrow` windows: the user can drag them larger, and the content is expected to
 * make use of the extra room. The layout that delivers that is a flex tree rather than a table of
 * per-child grow flags, so this oracle states the guarantee as **properties** instead of coordinates
 * — the exact cells a child lands on are a layout detail, and pinning them here would only re-encode
 * the implementation.
 *
 * Five things must hold after a resize, and they are what a user would actually notice:
 *   1. nothing bleeds outside the frame — no child may sit on or past the border ring;
 *   2. the listing genuinely absorbs the new space, in both directions;
 *   3. the read-out band still spans the whole frame interior rather than shrinking to the content
 *      column, so the file details stay readable at any size;
 *   4. the button strip stays pinned to the right edge and travels with it;
 *   5. the size floor holds — dragging smaller than the design size does not shrink the dialog.
 *
 * Points 3 and 4 are stated as edge relationships rather than cell coordinates, so they survive any
 * future layout refactor while still failing loudly if a child stops tracking the edge it belongs to.
 *
 * The resize is driven through the real window-manager gesture (grab the south-east grip and drag),
 * not by calling a reflow hook, so this exercises the path a user takes. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication, signal } from '@jsvision/ui';
import type { EventLoop, View } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const mouse = (kind: MouseEvent['kind'], x: number, y: number): MouseEvent => ({
  type: 'mouse',
  kind,
  button: 0,
  x: x + 1,
  y: y + 1,
});

function fileFs() {
  return createMemoryFs(dir({ home: dir({ user: dir({ 'a.txt': file({ size: 1 }), sub: dir() }) }) }));
}

/**
 * A child's solved rectangle relative to the dialog's top-left. `View.bounds` is parent-relative, so
 * a child nested inside layout groups measures from that group; the composed origins give the real
 * dialog-local position, and `bounds` still gives the size.
 */
function rectIn(loop: EventLoop, dialog: View, child: View) {
  const root = loop.renderRoot;
  const origin = root.originOf(child)!;
  const base = root.originOf(dialog)!;
  return { x: origin.x - base.x, y: origin.y - base.y, width: child.bounds.width, height: child.bounds.height };
}

/** Assert every listed child sits strictly inside a `w × h` frame — never on the border ring. */
function expectInsideFrame(loop: EventLoop, dlg: View, children: View[], w: number, h: number): void {
  for (const c of children) {
    const b = rectIn(loop, dlg, c);
    expect(b.x, `${c.constructor.name}.x`).toBeGreaterThanOrEqual(1);
    expect(b.y, `${c.constructor.name}.y`).toBeGreaterThanOrEqual(1);
    expect(b.x + b.width, `${c.constructor.name} right edge`).toBeLessThanOrEqual(w - 1);
    expect(b.y + b.height, `${c.constructor.name} bottom edge`).toBeLessThanOrEqual(h - 1);
  }
}

/** Assert a child spans the full frame interior — flush to the left border, flush to the right. */
function expectSpansInterior(loop: EventLoop, dlg: View, child: View, w: number): void {
  const b = rectIn(loop, dlg, child);
  expect(b.x, 'spans from the left border').toBe(1);
  expect(b.x + b.width, 'spans to the right border').toBe(w - 1);
}

/** The distance from a child's right edge to the frame's right border, at the given frame width. */
function gapToRightBorder(loop: EventLoop, dlg: View, child: View, w: number): number {
  const b = rectIn(loop, dlg, child);
  return w - (b.x + b.width);
}

/** Open a dialog centred in an 80×40 desktop and return the app plus its starting bounds. */
function openCentred(dlg: FileDialog | ChDirDialog) {
  const app = createApplication({ caps, viewport: { width: 80, height: 40 } });
  void app.desktop.addWindow(dlg);
  void app.loop.execView(dlg);
  app.loop.renderRoot.flush();
  return app;
}

// ST-FE08 — a grown FileDialog keeps every child inside the frame and gives the space to the listing.
test('ST-FE08: growing a FileDialog enlarges the listing and keeps every child inside the frame', () => {
  const dlg = new FileDialog({ fs: fileFs(), directory: signal('/home/user') });
  const app = openCentred(dlg);

  // Centred in 80×40: x = (80−49)/2 = 15, y = (40−19)/2 = 10. The SE grip is the frame's last cell.
  expect(dlg.bounds).toMatchObject({ x: 15, y: 10, width: 49, height: 19 });
  const before = rectIn(app.loop, dlg, dlg.fileList);
  const buttonBefore = rectIn(app.loop, dlg, dlg.buttons[0]!);
  const buttonGapBefore = gapToRightBorder(app.loop, dlg, dlg.buttons[0]!, 49);

  app.loop.dispatch(mouse('down', 63, 28)); // grab the SE grip at local (48,18)
  app.loop.dispatch(mouse('drag', 75, 36)); // ⇒ 61×27, a growth of (12, 8)
  app.loop.renderRoot.flush();

  expect(dlg.bounds).toMatchObject({ x: 15, y: 10, width: 61, height: 27 });

  // The listing takes the new room in both directions — the point of a resizable file dialog.
  const after = rectIn(app.loop, dlg, dlg.fileList);
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.height).toBeGreaterThan(before.height);

  // The read-out band keeps spanning the whole interior; shrinking it to the content column would
  // still sit inside the frame, so containment alone would not catch that.
  expectSpansInterior(app.loop, dlg, dlg.fileInfoPane, 61);
  // The button strip travels with the right edge rather than staying put or drifting left: its
  // distance to the border is unchanged, and it has moved. Comparing the gap rather than a computed
  // column keeps this true whatever side padding the body chooses.
  expect(gapToRightBorder(app.loop, dlg, dlg.buttons[0]!, 61), 'gap to the right border').toBe(buttonGapBefore);
  expect(rectIn(app.loop, dlg, dlg.buttons[0]!).x).toBeGreaterThan(buttonBefore.x);

  expectInsideFrame(
    app.loop,
    dlg,
    [dlg.fileInput, dlg.history, dlg.fileList, dlg.listBar, dlg.fileInfoPane, ...dlg.buttons],
    61,
    27,
  );
});

// ST-FE08 — the design size is a floor: dragging smaller must not shrink the dialog past it.
test('ST-FE08: a FileDialog cannot be dragged below its 49×19 design size', () => {
  const dlg = new FileDialog({ fs: fileFs(), directory: signal('/home/user') });
  const app = openCentred(dlg);

  app.loop.dispatch(mouse('down', 63, 28)); // grab the SE grip
  // Dragging to (40,20) asks for 26×11, well under the floor — so a dialog still at its design size
  // proves the floor clamped, rather than proving the grip was never grabbed.
  app.loop.dispatch(mouse('drag', 40, 20));
  app.loop.renderRoot.flush();

  expect(dlg.bounds).toMatchObject({ width: 49, height: 19 });
  expectInsideFrame(
    app.loop,
    dlg,
    [dlg.fileInput, dlg.history, dlg.fileList, dlg.listBar, dlg.fileInfoPane, ...dlg.buttons],
    49,
    19,
  );
});

// ST-FE08 — the same guarantees for the change-directory dialog and its tree.
test('ST-FE08: growing a ChDirDialog enlarges the tree and keeps every child inside the frame', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ sub: dir() }) }) }));
  const dlg = new ChDirDialog({ fs, directory: signal('/home/user') });
  const app = openCentred(dlg);

  // Centred in 80×40: x = (80−48)/2 = 16, y = (40−18)/2 = 11; the SE grip is at local (47,17).
  expect(dlg.bounds).toMatchObject({ x: 16, y: 11, width: 48, height: 18 });
  const before = rectIn(app.loop, dlg, dlg.dirList);
  const buttonBefore = rectIn(app.loop, dlg, dlg.buttons[0]!);
  const buttonGapBefore = gapToRightBorder(app.loop, dlg, dlg.buttons[0]!, 48);

  app.loop.dispatch(mouse('down', 63, 28)); // grab the SE grip
  app.loop.dispatch(mouse('drag', 73, 34)); // ⇒ 58×24, a growth of (10, 6)
  app.loop.renderRoot.flush();

  expect(dlg.bounds).toMatchObject({ x: 16, y: 11, width: 58, height: 24 });

  const after = rectIn(app.loop, dlg, dlg.dirList);
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.height).toBeGreaterThan(before.height);

  // The button strip tracks the right edge here too.
  expect(gapToRightBorder(app.loop, dlg, dlg.buttons[0]!, 58), 'gap to the right border').toBe(buttonGapBefore);
  expect(rectIn(app.loop, dlg, dlg.buttons[0]!).x).toBeGreaterThan(buttonBefore.x);

  expectInsideFrame(app.loop, dlg, [dlg.pathInput, dlg.history, dlg.dirList, ...dlg.buttons], 58, 24);
});

// ST-FE08 — the ChDirDialog floor holds too.
test('ST-FE08: a ChDirDialog cannot be dragged below its 48×18 design size', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ sub: dir() }) }) }));
  const dlg = new ChDirDialog({ fs, directory: signal('/home/user') });
  const app = openCentred(dlg);

  app.loop.dispatch(mouse('down', 63, 28));
  // Dragging to (40,20) asks for 25×10, well under the floor — so a dialog still at its design size
  // proves the floor clamped, rather than proving the grip was never grabbed.
  app.loop.dispatch(mouse('drag', 40, 20));
  app.loop.renderRoot.flush();

  expect(dlg.bounds).toMatchObject({ width: 48, height: 18 });
  expectInsideFrame(app.loop, dlg, [dlg.pathInput, dlg.history, dlg.dirList, ...dlg.buttons], 48, 18);
});
