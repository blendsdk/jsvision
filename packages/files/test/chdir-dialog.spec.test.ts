/**
 * Specification test (immutable oracle) — `ChDirDialog` (ST-10/11/12), a decode of `TChDirDialog`
 * (`tchdrdlg.cpp:37-140`).
 *
 * TV decode (GATE-1): `TDialog(TRect(16,2,64,20))` = **48×18**, gray, `wfGrow`. Composition
 * (dialog-local): path `Input (3,3,42,4)` + a `~D~irectory name` label `(2,2,…)`; `DirList
 * (3,6,33,16)` (owns its vertical bar) + a `~D~irectory tree` label `(2,5,…)`; buttons OK(`bfDefault`)
 * `(35,6,45,8)`, Chdir `(35,9,45,11)`, Revert `(35,12,45,14)`, Help `(35,15,45,17)`. Chdir descends the
 * focused tree node; Revert restores the starting directory; `valid(cmOK)` validates the path (a
 * readable directory) — else the error box; Cancel/Esc bypass. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal, Commands } from '@jsvision/ui';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { createMemoryFs, dir } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function nestedFs(flavor: 'posix' | 'win32' = 'posix') {
  return createMemoryFs(dir({ home: dir({ user: dir({ proj: dir({ bin: dir(), src: dir() }) }) }) }), { flavor });
}

function openChDir(dlg: ChDirDialog) {
  dlg.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 48, height: 18 } };
  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: 48, height: 18 }, { caps });
  loop.mount(root);
  const promise = loop.execView<string>(dlg);
  return { loop, promise };
}

const rectOf = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x,
  y: b.y,
  width: b.width,
  height: b.height,
});

// ST-10 — 48×18 composition at the decoded rects + the OK/Chdir/Revert/Help strip.
test('ST-10: ChDirDialog composes the decoded child rects + button strip', () => {
  const dlg = new ChDirDialog({ fs: nestedFs(), directory: signal('/home/user/proj') });
  openChDir(dlg);
  expect(rectOf(dlg.pathInput.bounds)).toEqual({ x: 3, y: 3, width: 39, height: 1 });
  expect(rectOf(dlg.dirList.bounds)).toEqual({ x: 3, y: 6, width: 30, height: 10 });
  expect(dlg.buttonLabels).toEqual(['~O~K', '~C~hdir', '~R~evert', '~H~elp']);
  expect(rectOf(dlg.buttons[0].bounds)).toEqual({ x: 35, y: 6, width: 10, height: 2 });
  expect(rectOf(dlg.buttons[1].bounds)).toEqual({ x: 35, y: 9, width: 10, height: 2 });
  expect(rectOf(dlg.buttons[3].bounds)).toEqual({ x: 35, y: 15, width: 10, height: 2 });
});

// ST-10 — Chdir descends the focused tree node; Revert restores the starting directory.
test('ST-10: Chdir descends the focused node; Revert restores the start directory', () => {
  const directory = signal('/home/user/proj');
  const dlg = new ChDirDialog({ fs: nestedFs(), directory });
  openChDir(dlg);
  // Focus the first subdir node (bin at index 4 — root/home/user/proj then bin) and Chdir.
  const binIdx = dlg.dirList.nodes().findIndex((n) => n.label === 'bin');
  dlg.dirList.focused.set(binIdx);
  dlg.chdir();
  expect(directory()).toBe('/home/user/proj/bin');
  dlg.revert();
  expect(directory()).toBe('/home/user/proj');
});

// ST-10 — valid(cmOK) on a real directory resolves it + closes; Cancel resolves null.
test('ST-10: OK on a valid directory resolves it; Cancel resolves null', async () => {
  const dlg = new ChDirDialog({ fs: nestedFs(), directory: signal('/home/user/proj') });
  const { loop, promise } = openChDir(dlg);
  dlg.path.set('/home/user'); // the path field's value at OK time
  loop.emitCommand(Commands.ok);
  await expect(promise).resolves.toBe(Commands.ok);
  expect(dlg.result()).toBe('/home/user');

  const dlg2 = new ChDirDialog({ fs: nestedFs(), directory: signal('/home/user/proj') });
  const r2 = openChDir(dlg2);
  r2.loop.emitCommand(Commands.cancel);
  await expect(r2.promise).resolves.toBe(Commands.cancel);
  expect(dlg2.result()).toBeNull();
});

// ST-11 — a Windows-style seam: descend + validate with backslash paths.
test('ST-11: ChDirDialog descends + validates under a Windows-style seam', async () => {
  const dlg = new ChDirDialog({ fs: nestedFs('win32'), directory: signal('C:\\home\\user\\proj') });
  const { loop, promise } = openChDir(dlg);
  dlg.path.set('C:\\home\\user');
  loop.emitCommand(Commands.ok);
  await expect(promise).resolves.toBe(Commands.ok);
  expect(dlg.result()).toBe('C:\\home\\user');
});

// ST-12 — OK on a non-existent directory raises the error box + stays open.
test('ST-12: OK on an invalid directory raises the error box and stays open', async () => {
  const errors: string[] = [];
  const dlg = new ChDirDialog({
    fs: nestedFs(),
    directory: signal('/home/user/proj'),
    showError: (m) => errors.push(m),
  });
  const { loop, promise } = openChDir(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  dlg.path.set('/no/such/place');
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(errors).toContain('Invalid directory');
});
