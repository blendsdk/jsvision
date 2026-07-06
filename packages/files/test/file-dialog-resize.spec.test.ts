/**
 * Specification tests (immutable oracle) — `FileDialog`/`ChDirDialog` `growMode` reflow (TV `wfGrow`).
 *
 * Derived from the Turbo Vision decode, NOT the implementation. When a `TFileDialog`/`TChDirDialog`
 * grows, each child is repositioned by `TView::calcBounds` from its per-child `growMode`
 * (`tfildlg.cpp:68-137` / `tchdrdlg.cpp:48-78`; the min size pins the baseline to the design size, so
 * the delta is grow-only). The expected rects below are computed by hand from the design rect + the
 * decoded flags, so they hold the implementation accountable to the source. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import type { Rect } from '@jsvision/ui';
import { signal } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const rectOf = (b: Rect): Rect => ({ x: b.x, y: b.y, width: b.width, height: b.height });

function fileFs() {
  return createMemoryFs(dir({ home: dir({ user: dir({ 'a.txt': file({ size: 1 }), sub: dir() }) }) }));
}

// —— FileDialog grown by (12, 8): 49×19 ⇒ 61×27. ——
test('FileDialog growMode reflow repositions every child per the tfildlg.cpp decode', () => {
  const dlg = new FileDialog({ fs: fileFs(), directory: signal('/home/user') });
  // Grow the dialog outer rect by (12, 8) and run the growMode pass (what the resize gesture calls).
  dlg.layout = { ...dlg.layout, rect: { x: 0, y: 0, width: 61, height: 27 } };
  dlg.onResized();

  // fileName gfGrowHiX — widens: (3,3,28,1) ⇒ right edge +12.
  expect(rectOf(dlg.fileInput.layout.rect as Rect)).toEqual({ x: 3, y: 3, width: 40, height: 1 });
  // History gfGrowLoX|gfGrowHiX — translates right, keeps width 3: (31,3) ⇒ (43,3).
  expect(rectOf(dlg.history.layout.rect as Rect)).toEqual({ x: 43, y: 3, width: 3, height: 1 });
  // fileList gfGrowHiX|gfGrowHiY — grows both: (3,6,31,8) ⇒ (3,6,43,16).
  expect(rectOf(dlg.fileList.layout.rect as Rect)).toEqual({ x: 3, y: 6, width: 43, height: 16 });
  // listBar (horizontal) gfGrowLoY|gfGrowHiX|gfGrowHiY — tracks the list bottom + widens.
  expect(rectOf(dlg.listBar.layout.rect as Rect)).toEqual({ x: 3, y: 22, width: 43, height: 1 });
  // infoPane gfGrowAll & ~gfGrowLoX — pinned left, flush bottom, full width: (1,16,47,2) ⇒ (1,24,59,2).
  expect(rectOf(dlg.fileInfoPane.layout.rect as Rect)).toEqual({ x: 1, y: 24, width: 59, height: 2 });
  // buttons gfGrowLoX|gfGrowHiX — pinned to the right edge, width 11 kept, y unchanged.
  expect(rectOf(dlg.buttons[0].layout.rect as Rect)).toEqual({ x: 47, y: 3, width: 11, height: 2 });
  expect(rectOf(dlg.buttons[1].layout.rect as Rect)).toEqual({ x: 47, y: 6, width: 11, height: 2 });
});

// —— A grow-and-shrink-back returns to the exact design rects (idempotent, grow-only baseline). ——
test('FileDialog growMode reflow is exact at the design size (delta 0 restores base rects)', () => {
  const dlg = new FileDialog({ fs: fileFs(), directory: signal('/home/user') });
  dlg.layout = { ...dlg.layout, rect: { x: 0, y: 0, width: 61, height: 27 } };
  dlg.onResized();
  dlg.layout = { ...dlg.layout, rect: { x: 0, y: 0, width: 49, height: 19 } }; // back to design
  dlg.onResized();

  expect(rectOf(dlg.fileInput.layout.rect as Rect)).toEqual({ x: 3, y: 3, width: 28, height: 1 });
  expect(rectOf(dlg.history.layout.rect as Rect)).toEqual({ x: 31, y: 3, width: 3, height: 1 });
  expect(rectOf(dlg.fileList.layout.rect as Rect)).toEqual({ x: 3, y: 6, width: 31, height: 8 });
  expect(rectOf(dlg.fileInfoPane.layout.rect as Rect)).toEqual({ x: 1, y: 16, width: 47, height: 2 });
});

// —— ChDirDialog grown by (10, 6): 48×18 ⇒ 58×24. ——
test('ChDirDialog growMode reflow repositions every child per the tchdrdlg.cpp decode', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ sub: dir() }) }) }));
  const dlg = new ChDirDialog({ fs, directory: signal('/home/user') });
  dlg.layout = { ...dlg.layout, rect: { x: 0, y: 0, width: 58, height: 24 } };
  dlg.onResized();

  // pathInput gfGrowHiX — widens: (3,3,39,1) ⇒ width +10.
  expect(rectOf(dlg.pathInput.layout.rect as Rect)).toEqual({ x: 3, y: 3, width: 49, height: 1 });
  // History gfGrowLoX|gfGrowHiX — translates right, keeps width 3: (42,3) ⇒ (52,3).
  expect(rectOf(dlg.history.layout.rect as Rect)).toEqual({ x: 52, y: 3, width: 3, height: 1 });
  // dirList gfGrowHiX|gfGrowHiY — grows both. TV splits list (29w) + vertical bar (1w); jsvision's
  // DirList owns its bar in one (3,6,30,10) container, so the merged footprint grows to (3,6,40,16).
  expect(rectOf(dlg.dirList.layout.rect as Rect)).toEqual({ x: 3, y: 6, width: 40, height: 16 });
  // buttons gfGrowLoX|gfGrowHiX — pinned right: (35,6,10,2) ⇒ (45,6,10,2).
  expect(rectOf(dlg.buttons[0].layout.rect as Rect)).toEqual({ x: 45, y: 6, width: 10, height: 2 });
});
