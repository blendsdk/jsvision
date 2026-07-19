/**
 * Specification test (immutable oracle) — the `History` dropdowns on the file dialogs (ST-18), a
 * decode of `TFileDialog`/`TChDirDialog` composition (`tfildlg.cpp:73`, `tchdrdlg.cpp:55`).
 *
 * TV decode: `TFileDialog` places a `THistory` over the filename `TInputLine` at `(31,3,34,4)`;
 * `TChDirDialog` places one over the path input at `(42,3,45,4)`. Each is the `▐↓▌` icon linked to its
 * input, with a per-dialog recent-path history id (PA-9; no `dropdown/` edit — the RD-14 `History`
 * suites stay green). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal, History } from '@jsvision/ui';
import type { EventLoop, View } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
/**
 * A child's solved rectangle relative to the dialog's top-left — the coordinates this decode is
 * written in. `View.bounds` is parent-relative, so a child nested inside layout groups measures from
 * that group rather than from the dialog; the composed origins give the real dialog-local position,
 * and `bounds` still gives the size.
 */
function rectIn(loop: EventLoop, dialog: View, child: View) {
  const root = loop.renderRoot;
  const origin = root.originOf(child)!;
  const base = root.originOf(dialog)!;
  return { x: origin.x - base.x, y: origin.y - base.y, width: child.bounds.width, height: child.bounds.height };
}

function mountAt<T extends FileDialog | ChDirDialog>(dlg: T, w: number, h: number): { dlg: T; loop: EventLoop } {
  // Preserve the dialog's own layout (esp. `padding`) so the History's resolved bounds reflect the
  // real production geometry — a wholesale replace drops `padding` and masks the frame-inset bug.
  dlg.layout = { ...dlg.layout, rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.execView(dlg);
  return { dlg, loop };
}

// ST-18 — the FileDialog hosts a History over the filename input at (31,3,34,4).
test('ST-18: FileDialog composes a History over the filename input at (31,3,34,4)', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ 'a.txt': file({}) }) }) }));
  const { dlg, loop } = mountAt(new FileDialog({ fs, directory: signal('/home/user') }), 49, 19);
  expect(dlg.history).toBeInstanceOf(History);
  expect(rectIn(loop, dlg, dlg.history)).toEqual({ x: 31, y: 3, width: 3, height: 1 });
});

// ST-18 — the ChDirDialog hosts a History over the path input at (42,3,45,4).
test('ST-18: ChDirDialog composes a History over the path input at (42,3,45,4)', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir() }) }));
  const { dlg, loop } = mountAt(new ChDirDialog({ fs, directory: signal('/home/user') }), 48, 18);
  expect(dlg.history).toBeInstanceOf(History);
  expect(rectIn(loop, dlg, dlg.history)).toEqual({ x: 42, y: 3, width: 3, height: 1 });
});
