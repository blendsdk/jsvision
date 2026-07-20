/**
 * Specification test (immutable oracle) — `DirList` (ST-7/ST-14), a decode of `TDirListBox`
 * (`tdirlist.cpp`, extends the `TListViewer` spine).
 *
 * TV decode: the tree rows = `buildDirTree` (proven cell-by-cell in `tree.spec`) — the ancestor chain
 * + current subdirs with `└─┬`/`└┬─`/` ├─`/` └─` connectors, a platform root (AR-237). `getText(node)
 * = connectorPrefix + label`; the rows draw at `curCol+1` (col 1, TV `TListViewer::draw`). Selecting a
 * node emits `cmChangeDir` with its path. Glyphs sanitized at the draw boundary (AC-14). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, createEventLoop, signal } from '@jsvision/ui';
import { DirList } from '../src/list/dir-list.js';
import { buildDirTree } from '../src/fs/tree.js';
import { createMemoryFs, dir } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const key = (k: string): KeyEvent => ({ type: 'key', key: k, ctrl: false, alt: false, shift: false });

function nestedFs() {
  return createMemoryFs(dir({ home: dir({ user: dir({ proj: dir({ bin: dir(), src: dir(), test: dir() }) }) }) }));
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

const rowAt = (
  buf: ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>,
  y: number,
  from: number,
  n: number,
) => Array.from({ length: n }, (_, i) => buf.get(from + i, y)?.char ?? ' ').join('');

// ST-7 — the DirList renders the buildDirTree rows (connector + label) at col 1, incl. the platform root.
test('ST-7: DirList renders the ancestor chain + subdirs with connectors (col 1)', () => {
  const fs = nestedFs();
  const directory = signal('/home/user/proj');
  const list = new DirList({ fs, directory });
  const loop = hosted(list, 30, 10);
  const buf = loop.renderRoot.buffer();

  const expected = buildDirTree(fs, '/home/user/proj').map((n) => n.connector + n.label);
  expect(list.nodes().map((n) => n.connector + n.label)).toEqual(expected);
  // Rendered at col 1 (TV curCol+1): each row's drawn text matches buildDirTree (the tree.spec SoT).
  for (let i = 0; i < expected.length; i += 1) {
    expect(rowAt(buf, i, 1, expected[i].length)).toBe(expected[i]);
  }
});

// ST-7 — selecting a node emits cmChangeDir with its path; the root node is the platform root.
test('ST-7: selecting a node changes to its path; the root node is the platform root', () => {
  const fs = nestedFs();
  const directory = signal('/home/user/proj');
  const changed: string[] = [];
  const list = new DirList({ fs, directory, onChangeDir: (p) => changed.push(p) });
  const loop = hosted(list, 30, 10);

  expect(list.nodes()[0].label).toBe('/'); // POSIX platform root
  // Focus the first subdir (bin, index 4) and select it (Enter).
  list.focused.set(4);
  loop.dispatch(key('enter'));
  expect(changed).toEqual(['/home/user/proj/bin']);
});

// ST-14 — a directory name carrying a control sequence renders sanitize-clean.
test('ST-14: DirList renders a control-byte directory name sanitize-clean', () => {
  const fs = createMemoryFs(dir({ home: dir({ '\x1b[2Jevil': dir() }) }));
  const list = new DirList({ fs, directory: signal('/home') });
  const loop = hosted(list, 30, 10);
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 10; y += 1) for (let x = 0; x < 30; x += 1) expect(buf.get(x, y)?.char).not.toBe('\x1b');
});
