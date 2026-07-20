/**
 * Implementation test (edge/internal + cross-platform + sanitize) — `DirList`
 * (`src/list/dir-list.js`).
 *
 * Covers `focusedNode` tracking, the `onChangeDir` activation emitting the node's absolute path, the
 * reactive re-root on a `directory` change, the win32 drive-root seam, and draw-time sanitize of a
 * control-byte directory name. Derived from the bound `buildDirTree` derivation + the `onSelect`
 * wiring in the source. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import { DirList } from '../src/list/dir-list.js';
import { createMemoryFs, dir } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const key = (k: string): KeyEvent => ({ type: 'key', key: k, ctrl: false, alt: false, shift: false });

function nestedFs(flavor: 'posix' | 'win32' = 'posix') {
  return createMemoryFs(dir({ home: dir({ user: dir({ proj: dir({ bin: dir(), src: dir() }) }) }) }), { flavor });
}

function hosted(list: DirList, w: number, h: number) {
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  return loop;
}

test('impl: focusedNode tracks the focused row', () => {
  const list = new DirList({ fs: nestedFs(), directory: signal('/home/user/proj') });
  hosted(list, 30, 12);
  expect(list.focusedNode()?.label).toBe('/'); // default focus = row 0 (the root)
  const binIdx = list.nodes().findIndex((n) => n.label === 'bin');
  list.focused.set(binIdx);
  expect(list.focusedNode()?.label).toBe('bin');
});

test("impl: onChangeDir on Enter emits the focused node's absolute path", () => {
  const changed: string[] = [];
  const list = new DirList({
    fs: nestedFs(),
    directory: signal('/home/user/proj'),
    onChangeDir: (p) => changed.push(p),
  });
  const loop = hosted(list, 30, 12);
  const srcIdx = list.nodes().findIndex((n) => n.label === 'src');
  list.focused.set(srcIdx);
  loop.dispatch(key('enter'));
  expect(changed).toEqual(['/home/user/proj/src']);
});

test('impl: reactive re-root on a directory change', () => {
  const directory = signal('/home/user/proj');
  const list = new DirList({ fs: nestedFs(), directory });
  hosted(list, 30, 12);
  expect(list.nodes().some((n) => n.label === 'bin')).toBe(true); // proj's subdirs shown
  directory.set('/home/user'); // re-root one level up
  const labels = list.nodes().map((n) => n.label);
  expect(labels).toContain('proj'); // now proj is the (only) subdir
  expect(list.nodes().some((n) => n.label === 'bin')).toBe(false); // bin no longer visible
  expect(list.nodes().find((n) => n.isCurrent)?.label).toBe('user');
});

// —— CROSS-PLATFORM (task 7.2) ——

test('impl: win32 seam — the root node is the drive, paths use backslashes', () => {
  const changed: string[] = [];
  const list = new DirList({
    fs: nestedFs('win32'),
    directory: signal('C:\\home\\user\\proj'),
    onChangeDir: (p) => changed.push(p),
  });
  const loop = hosted(list, 32, 12);
  expect(list.nodes()[0].label).toBe('C:\\'); // drive root
  const binIdx = list.nodes().findIndex((n) => n.label === 'bin');
  expect(list.nodes()[binIdx].path).toBe('C:\\home\\user\\proj\\bin');
  list.focused.set(binIdx);
  loop.dispatch(key('enter'));
  expect(changed).toEqual(['C:\\home\\user\\proj\\bin']);
});

// —— SANITIZE (task 7.4) ——

test('impl: a control-byte directory name renders sanitize-clean', () => {
  const fs = createMemoryFs(dir({ home: dir({ '\x1b[2J\x07evil': dir() }) }));
  const list = new DirList({ fs, directory: signal('/home') });
  const loop = hosted(list, 30, 10);
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 30; x += 1) {
      expect(buf.get(x, y)?.char).not.toBe('\x1b');
      expect(buf.get(x, y)?.char).not.toBe('\x07');
    }
  }
});
