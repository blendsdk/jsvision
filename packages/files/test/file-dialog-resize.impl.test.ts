/**
 * Implementation tests — end-to-end drag-resize of a `FileDialog` through the real window-manager
 * gesture (`createApplication` → `desktop.addWindow` → grab the SE grip and drag).
 *
 * The specification oracle beside this file states the *guarantees* a resize must keep (nothing
 * bleeds, the listing absorbs the space, the floor holds). This file is the complement: it pins the
 * concrete cells the layout actually resolves to at one grown size, so an accidental change to the
 * body's structure — a lost padding, a `grow` that became `fixed` — shows up as a specific,
 * readable diff rather than as a vague property still technically holding.
 *
 * Positions are read via the composed origins, because `View.bounds` is parent-relative and these
 * children sit inside layout groups. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication, signal } from '@jsvision/ui';
import type { EventLoop, View } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const mouse = (kind: MouseEvent['kind'], x: number, y: number): MouseEvent => ({
  type: 'mouse',
  kind,
  button: 0,
  x: x + 1,
  y: y + 1,
});
const fs = () => createMemoryFs(dir({ home: dir({ user: dir({ 'a.txt': file({ size: 1 }), sub: dir() }) }) }));

/** A child's solved rectangle relative to the dialog's top-left. */
function rectIn(loop: EventLoop, dialog: View, child: View) {
  const root = loop.renderRoot;
  const origin = root.originOf(child)!;
  const base = root.originOf(dialog)!;
  return { x: origin.x - base.x, y: origin.y - base.y, width: child.bounds.width, height: child.bounds.height };
}

test('impl: drag-resizing a FileDialog re-solves every child from the new frame', () => {
  const app = createApplication({ caps, viewport: { width: 80, height: 40 } });
  const dlg = new FileDialog({ fs: fs(), directory: signal('/home/user') });
  void app.desktop.addWindow(dlg);
  void app.loop.execView(dlg);
  app.loop.renderRoot.flush();

  // Centered in 80×40: x=(80−49)/2=15, y=(40−19)/2=10 ⇒ bounds {15,10,49,19}. SE grip at local
  // (48,18) ⇒ screen (63,28).
  expect(dlg.bounds).toMatchObject({ x: 15, y: 10, width: 49, height: 19 });

  app.loop.dispatch(mouse('down', 63, 28)); // grab SE grip (commits the centered rect into layout.rect)
  app.loop.dispatch(mouse('drag', 75, 36)); // width = 75−15+1 = 61, height = 36−10+1 = 27 ⇒ Δ(12,8)
  app.loop.renderRoot.flush();

  expect(dlg.bounds).toMatchObject({ x: 15, y: 10, width: 61, height: 27 });

  // The filename field takes the extra width and the history icon rides its right edge.
  expect(rectIn(app.loop, dlg, dlg.fileInput)).toMatchObject({ x: 3, y: 3, width: 40, height: 1 });
  expect(rectIn(app.loop, dlg, dlg.history)).toMatchObject({ x: 43, y: 3, width: 3, height: 1 });
  // The listing takes both the extra width and the extra height; its bar stays directly beneath.
  expect(rectIn(app.loop, dlg, dlg.fileList)).toMatchObject({ x: 3, y: 6, width: 43, height: 17 });
  expect(rectIn(app.loop, dlg, dlg.listBar)).toMatchObject({ x: 3, y: 23, width: 43, height: 1 });
  // The info pane stays pinned to the full frame interior, flush above the bottom border.
  expect(rectIn(app.loop, dlg, dlg.fileInfoPane)).toMatchObject({ x: 1, y: 24, width: 59, height: 2 });
  // The button strip stays pinned to the right edge at its fixed width.
  expect(rectIn(app.loop, dlg, dlg.buttons[0]!)).toMatchObject({ x: 47, y: 3, width: 11, height: 2 });
});
