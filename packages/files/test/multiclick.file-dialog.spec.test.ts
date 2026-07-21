/**
 * Specification test (immutable oracle) — FileDialog double-click activation (double-click-activation
 * ST-8 / FR-6, AR-9). NOTE: the "ST-8" here is the double-click-activation plan's ST-8, distinct from
 * the file-dialog feature's own ST-8 in `file-dialog.spec.test.ts`.
 *
 * `FileList extends ListView<DirEntry>` with `onSelect → onOpenEntry → openEntry` (`file-dialog.ts:
 * 242-256`): a directory enters it, a file resolves + closes like OK. Once `ListRows` activates on a
 * double-click (loop-stamped `clickCount === 2`), the mouse path reaches `openEntry` with NO new
 * dialog code (AR-9). Per AR-14 a bare widget test sets `clickCount` directly on the envelope. The
 * target row is display index = `local.y` (single populated column: the small fixture fits in col 0,
 * `topItem = 0`). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, signal, Commands } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function fsFixture() {
  return createMemoryFs(
    dir({
      home: dir({
        user: dir({
          'readme.txt': file({ size: 12 }),
          'App.ts': file({ size: 30 }),
          src: dir({ inner: dir() }),
        }),
      }),
    }),
    { flavor: 'posix' },
  );
}

/** Mount a FileDialog at 49×19 and open it modally; returns the loop + the execView promise. */
function openFileDialog(dlg: FileDialog) {
  dlg.setLayout({ rect: { x: 0, y: 0, width: 49, height: 19 } });
  const root = new Group();
  root.add(dlg);
  const loop = createEventLoop({ width: 49, height: 19 }, { caps });
  loop.mount(root);
  const promise = loop.execView<string>(dlg);
  return { loop, promise };
}

/** A double-click envelope on the file list's row at display index `y` (col 0). */
function doubleClickRow(y: number): DispatchEvent {
  return {
    event: { type: 'mouse', kind: 'down', button: 0, x: 1, y: 1 },
    handled: false,
    local: { x: 0, y },
    clickCount: 2,
    emit: () => {},
  };
}

// ST-8 (double-click-activation) — a double-click on a DIRECTORY entry enters it (no new dialog code).
test('ST-8: double-click a directory entry enters it', () => {
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user') });
  openFileDialog(dlg);

  const dirIdx = dlg.fileList.entries().findIndex((e) => e.name === 'src');
  expect(dirIdx).toBeGreaterThanOrEqual(0);

  dlg.fileList.rows.onEvent(doubleClickRow(dirIdx));
  expect(dlg.directory()).toBe('/home/user/src'); // entered the directory
});

// ST-8 (double-click-activation) — a double-click on a FILE entry resolves + closes like OK: the
// execView promise settles with the terminating command and `result()` holds the absolute path
// (the same contract as OK, per the file-dialog ST-9 oracle).
test('ST-8: double-click a file entry resolves + closes like OK', async () => {
  const dlg = new FileDialog({ fs: fsFixture(), directory: signal('/home/user') });
  const { promise } = openFileDialog(dlg);

  const fileIdx = dlg.fileList.entries().findIndex((e) => e.name === 'readme.txt');
  expect(fileIdx).toBeGreaterThanOrEqual(0);

  dlg.fileList.rows.onEvent(doubleClickRow(fileIdx));
  await expect(promise).resolves.toBe(Commands.ok); // closed like OK
  expect(dlg.result()).toBe('/home/user/readme.txt'); // resolved to the absolute path
});
