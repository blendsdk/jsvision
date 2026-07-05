/**
 * Implementation test (edge/internal + cross-platform) — `ChDirDialog` (`src/dialog/chdir-dialog.js`).
 *
 * Covers the path field reflecting `directory` after `chdir()` / `revert()` (the reactive bind), the
 * `valid(cmOK)` rejection of a path that is a file rather than a directory ("Invalid directory"), and
 * the win32 seam. Derived from the source `chdir`/`revert`/`valid` + the directory→path bind. `.js`
 * per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal, Commands } from '@jsvision/ui';
import { ChDirDialog } from '../src/dialog/chdir-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function nestedFs(flavor: 'posix' | 'win32' = 'posix') {
  return createMemoryFs(
    dir({ home: dir({ user: dir({ proj: dir({ bin: dir(), src: dir() }), 'note.txt': file() }) }) }),
    { flavor },
  );
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

test('impl: the path field reflects the directory after chdir() and revert()', () => {
  const directory = signal('/home/user/proj');
  const dlg = new ChDirDialog({ fs: nestedFs(), directory });
  openChDir(dlg);
  expect(dlg.path()).toBe('/home/user/proj'); // initial reflect on mount

  const binIdx = dlg.dirList.nodes().findIndex((n) => n.label === 'bin');
  dlg.dirList.focused.set(binIdx);
  dlg.chdir();
  expect(directory()).toBe('/home/user/proj/bin');
  expect(dlg.path()).toBe('/home/user/proj/bin'); // path field reflects the descend

  dlg.revert();
  expect(directory()).toBe('/home/user/proj');
  expect(dlg.path()).toBe('/home/user/proj'); // and the revert
});

test('impl: valid(OK) on a path that is a file (not a directory) raises "Invalid directory"', async () => {
  const errors: string[] = [];
  const dlg = new ChDirDialog({
    fs: nestedFs(),
    directory: signal('/home/user/proj'),
    showError: (m) => errors.push(m),
  });
  const { loop, promise } = openChDir(dlg);
  let settled = false;
  void promise.then(() => (settled = true));

  dlg.path.set('/home/user/note.txt'); // a file, not a directory
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(errors).toContain('Invalid directory');
});

// —— CROSS-PLATFORM (task 7.2) ——

test('impl: win32 seam — chdir descends with backslash paths and the field reflects it', () => {
  const directory = signal('C:\\home\\user\\proj');
  const dlg = new ChDirDialog({ fs: nestedFs('win32'), directory });
  openChDir(dlg);
  const binIdx = dlg.dirList.nodes().findIndex((n) => n.label === 'bin');
  dlg.dirList.focused.set(binIdx);
  dlg.chdir();
  expect(directory()).toBe('C:\\home\\user\\proj\\bin');
  expect(dlg.path()).toBe('C:\\home\\user\\proj\\bin');
});
