/**
 * Specification test (immutable oracle) — the convenience openers `openFile`/`changeDir` (ST-20).
 *
 * They construct the dialog over a default `nodeFileSystem` (overridable), run the
 * add-to-desktop → `execView` → remove-in-`finally` lifecycle against an `execView`-capable host
 * (NOT a bare `ModalHost`, PF-002), and resolve to the absolute path (OK) or `null` (cancel). `save`
 * picks the save-mode button set. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { View } from '@jsvision/ui';
import { Group, createEventLoop, Commands } from '@jsvision/ui';
import { openFile, changeDir } from '../src/openers.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function fsFixture() {
  return createMemoryFs(dir({ home: dir({ user: dir({ 'readme.txt': file({ size: 5 }), proj: dir() }) }) }));
}

/** A minimal execView-capable host: a mounted root the desktop seam adds/removes windows into. */
function makeHost(w: number, h: number) {
  const root = new Group();
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const host = {
    loop,
    desktop: { addWindow: (v: View) => root.add(v), removeWindow: (v: View) => root.remove(v) },
  };
  return { loop, host };
}

function type(loop: ReturnType<typeof createEventLoop>, s: string): void {
  for (const ch of s) loop.dispatch({ type: 'key', key: ch, ctrl: false, alt: false, shift: false });
}

// ST-20 — openFile: type a name + OK resolves the absolute path; Cancel resolves null.
test('ST-20: openFile resolves the typed file on OK, null on Cancel', async () => {
  const fs = fsFixture();
  const { loop, host } = makeHost(49, 19);
  const p = openFile(host, { fs, directory: '/home/user' });
  type(loop, 'readme.txt'); // execView focuses the filename input (first focusable)
  loop.emitCommand(Commands.ok);
  await expect(p).resolves.toBe('/home/user/readme.txt');

  const c = openFile(host, { fs, directory: '/home/user' });
  loop.emitCommand(Commands.cancel);
  await expect(c).resolves.toBeNull();
});

// ST-20 — changeDir: the path field reflects the directory ⇒ OK resolves it; Cancel resolves null.
test('ST-20: changeDir resolves the directory on OK, null on Cancel', async () => {
  const fs = fsFixture();
  const { loop, host } = makeHost(48, 18);
  const p = changeDir(host, { fs, directory: '/home/user/proj' });
  loop.emitCommand(Commands.ok);
  await expect(p).resolves.toBe('/home/user/proj');

  const c = changeDir(host, { fs, directory: '/home/user/proj' });
  loop.emitCommand(Commands.cancel);
  await expect(c).resolves.toBeNull();
});

// ST-20 — the default filesystem is nodeFileSystem (no fs option): constructs + cancels cleanly.
test('ST-20: openFile defaults to nodeFileSystem when no fs is given', async () => {
  const { loop, host } = makeHost(49, 19);
  const p = openFile(host, { directory: process.cwd() });
  loop.emitCommand(Commands.cancel);
  await expect(p).resolves.toBeNull();
});

// ST-20 — save mode: the flag is forwarded; a typed new name still resolves.
test('ST-20: openFile save-mode resolves a typed new filename', async () => {
  const fs = fsFixture();
  const { loop, host } = makeHost(49, 19);
  const p = openFile(host, { fs, directory: '/home/user', save: true });
  type(loop, 'newfile.txt');
  loop.emitCommand(Commands.ok);
  await expect(p).resolves.toBe('/home/user/newfile.txt');
});
