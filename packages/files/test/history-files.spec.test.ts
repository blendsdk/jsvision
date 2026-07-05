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
import { FileDialog } from '../src/dialog/file-dialog.js';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const rectOf = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x,
  y: b.y,
  width: b.width,
  height: b.height,
});

function mountAt<T extends FileDialog | ChDirDialog>(dlg: T, w: number, h: number): T {
  dlg.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.execView(dlg);
  return dlg;
}

// ST-18 — the FileDialog hosts a History over the filename input at (31,3,34,4).
test('ST-18: FileDialog composes a History over the filename input at (31,3,34,4)', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ 'a.txt': file({}) }) }) }));
  const dlg = mountAt(new FileDialog({ fs, directory: signal('/home/user') }), 49, 19);
  expect(dlg.history).toBeInstanceOf(History);
  expect(rectOf(dlg.history.bounds)).toEqual({ x: 31, y: 3, width: 3, height: 1 });
});

// ST-18 — the ChDirDialog hosts a History over the path input at (42,3,45,4).
test('ST-18: ChDirDialog composes a History over the path input at (42,3,45,4)', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir() }) }));
  const dlg = mountAt(new ChDirDialog({ fs, directory: signal('/home/user') }), 48, 18);
  expect(dlg.history).toBeInstanceOf(History);
  expect(rectOf(dlg.history.bounds)).toEqual({ x: 42, y: 3, width: 3, height: 1 });
});
