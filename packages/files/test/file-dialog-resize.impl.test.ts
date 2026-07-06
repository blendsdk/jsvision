/**
 * Implementation tests — end-to-end drag-resize of a `FileDialog` through the real WM gesture
 * (`createApplication` → `desktop.addWindow` → SE-grip down + drag), the GATE-2 AFTER-diff for the
 * `growMode` reflow: after the drag, every child's laid-out `bounds` matches the `tfildlg.cpp`
 * decode, and every child still sits strictly inside the grown frame. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { createApplication, signal } from '@jsvision/ui';
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

test('drag-resizing a FileDialog reflows every child per the growMode decode (GATE-2 end-to-end)', () => {
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
  // Children reflowed to the grown, growMode-computed rects (bounds are dialog-relative, padding 0).
  expect(dlg.fileInput.bounds).toMatchObject({ x: 3, y: 3, width: 40, height: 1 });
  expect(dlg.history.bounds).toMatchObject({ x: 43, y: 3, width: 3, height: 1 });
  expect(dlg.fileList.bounds).toMatchObject({ x: 3, y: 6, width: 43, height: 16 });
  expect(dlg.listBar.bounds).toMatchObject({ x: 3, y: 22, width: 43, height: 1 });
  expect(dlg.fileInfoPane.bounds).toMatchObject({ x: 1, y: 24, width: 59, height: 2 });
  expect(dlg.buttons[0].bounds).toMatchObject({ x: 47, y: 3, width: 11, height: 2 });

  // Every child stays strictly inside the grown 61×27 frame (no bleed past the border ring).
  const W = 61;
  const H = 27;
  const children = [dlg.fileInput, dlg.history, dlg.fileList, dlg.listBar, dlg.fileInfoPane, ...dlg.buttons];
  for (const c of children) {
    const b = c.bounds;
    expect(b.x, `${c.constructor.name}.x`).toBeGreaterThanOrEqual(1);
    expect(b.y, `${c.constructor.name}.y`).toBeGreaterThanOrEqual(1);
    expect(b.x + b.width, `${c.constructor.name} right`).toBeLessThanOrEqual(W - 1);
    expect(b.y + b.height, `${c.constructor.name} bottom`).toBeLessThanOrEqual(H - 1);
  }
});
