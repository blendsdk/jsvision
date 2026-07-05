/**
 * Implementation test (edge/internal + lifecycle) — `openFile` / `changeDir` (`src/openers.js`).
 *
 * Covers the default `nodeFileSystem` fallback, the add→execView→remove-in-`finally` cleanup on BOTH
 * resolve and cancel (the dialog is removed from the desktop either way), and the forwarding of
 * `save` / `wildcard` / `title` / `inputName` into the constructed dialog (captured via the fake
 * host's `addWindow`). Derived from the source opener bodies. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { View } from '@jsvision/ui';
import { Group, createEventLoop, Commands } from '@jsvision/ui';
import { openFile, changeDir } from '../src/openers.js';
import { FileDialog } from '../src/dialog/file-dialog.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function fsFixture() {
  return createMemoryFs(dir({ home: dir({ user: dir({ 'readme.txt': file({ size: 5 }), proj: dir() }) }) }));
}

/** A fake execView-capable host that captures added/removed windows into a mounted root Group. */
function makeHost(w: number, h: number) {
  const root = new Group();
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const added: View[] = [];
  const removed: View[] = [];
  const host = {
    loop,
    desktop: {
      addWindow: (v: View) => {
        added.push(v);
        root.add(v);
      },
      removeWindow: (v: View) => {
        removed.push(v);
        root.remove(v);
      },
    },
  };
  return { loop, host, root, added, removed };
}

function type(loop: ReturnType<typeof createEventLoop>, s: string): void {
  for (const ch of s) loop.dispatch({ type: 'key', key: ch, ctrl: false, alt: false, shift: false });
}

test('impl: the dialog is removed from the desktop after resolve (OK)', async () => {
  const fs = fsFixture();
  const { loop, host, root, added, removed } = makeHost(49, 19);
  const p = openFile(host, { fs, directory: '/home/user' });
  type(loop, 'readme.txt');
  loop.emitCommand(Commands.ok);
  await expect(p).resolves.toBe('/home/user/readme.txt');
  expect(added.length).toBe(1);
  expect(removed).toEqual(added); // removeWindow ran on the same dialog
  expect(root.children.length).toBe(0); // nothing left mounted
});

test('impl: the dialog is removed from the desktop after cancel', async () => {
  const fs = fsFixture();
  const { loop, host, root, added, removed } = makeHost(49, 19);
  const p = openFile(host, { fs, directory: '/home/user' });
  loop.emitCommand(Commands.cancel);
  await expect(p).resolves.toBeNull();
  expect(removed).toEqual(added);
  expect(root.children.length).toBe(0);
});

test('impl: changeDir cleans up the dialog on cancel too', async () => {
  const fs = fsFixture();
  const { loop, host, root, added, removed } = makeHost(48, 18);
  const p = changeDir(host, { fs, directory: '/home/user/proj' });
  loop.emitCommand(Commands.cancel);
  await expect(p).resolves.toBeNull();
  expect(removed).toEqual(added);
  expect(root.children.length).toBe(0);
});

test('impl: defaults to nodeFileSystem when no fs is given (changeDir)', async () => {
  const { loop, host } = makeHost(48, 18);
  const p = changeDir(host, { directory: process.cwd() }); // no fs ⇒ nodeFileSystem
  loop.emitCommand(Commands.cancel);
  await expect(p).resolves.toBeNull();
});

test('impl: save / wildcard / title are forwarded into the constructed FileDialog', async () => {
  const fs = fsFixture();
  const { loop, host, added } = makeHost(49, 19);
  const p = openFile(host, { fs, directory: '/home/user', save: true, wildcard: '*.md', title: 'Pick One' });
  // The dialog is added synchronously (before execView awaits), so it is inspectable now.
  const dlg = added[0] as FileDialog;
  expect(dlg.wildcard()).toBe('*.md');
  expect(dlg.title()).toBe('Pick One');
  expect(dlg.buttonLabels).toEqual(['~O~K', '~R~eplace', '~C~lear', '~C~ancel', '~H~elp']); // save-mode set
  loop.emitCommand(Commands.cancel);
  await expect(p).resolves.toBeNull();
});

test('impl: the inputName label text is forwarded and rendered', async () => {
  const fs = fsFixture();
  const { loop, host } = makeHost(49, 19);
  const p = openFile(host, { fs, directory: '/home/user', inputName: '~P~ath' });
  // execView flushes a frame on open; the input label draws in the input-label row (tilde stripped
  // ⇒ "Path", shifted by the 1-cell window frame). Scan the row so the assertion is offset-robust.
  const buf = loop.renderRoot.buffer();
  const row = Array.from({ length: 49 }, (_, x) => buf.get(x, 3)?.char ?? ' ').join('');
  expect(row).toContain('Path');
  loop.emitCommand(Commands.cancel);
  await expect(p).resolves.toBeNull();
});
