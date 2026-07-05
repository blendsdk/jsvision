/**
 * Implementation test (edge/internal + cross-platform) — `buildDirTree` (`src/fs/tree.js`).
 *
 * Covers the last-row connector fixup across shapes (single-child `└──`, a leaf directory, a
 * files-only directory), single-child ancestor chains, the depth/path/isCurrent flags, the
 * dirs-only filter (files never appear as nodes), and the win32 cross-platform seam (drive root +
 * backslash paths). All expectations are transcribed from the pure geometry in the source. `.js`
 * per NodeNext.
 */
import { test, expect } from 'vitest';
import { buildDirTree } from '../src/fs/tree.js';
import type { DirNode } from '../src/fs/tree.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const rowText = (n: DirNode) => n.connector + n.label;

test('impl: a single ancestor-chain link + single subdir gets the "└──" fixup', () => {
  const fs = createMemoryFs(dir({ home: dir({ only: dir() }) }));
  const nodes = buildDirTree(fs, '/home');
  // chain: / , home ; current /home has one subdir 'only' (single ⇒ "└┬─" → "└──").
  expect(nodes.map(rowText)).toEqual(['└─┬/', '  └─┬home', '    └──only']);
});

test('impl: a leaf directory (no subdirs) fixes up its own current row to "└──"', () => {
  const fs = createMemoryFs(dir({ home: dir({ empty: dir() }) }));
  const nodes = buildDirTree(fs, '/home/empty');
  expect(nodes.map(rowText)).toEqual(['└─┬/', '  └─┬home', '    └──empty']);
  expect(nodes[nodes.length - 1].isCurrent).toBe(true); // the leaf current node
});

test('impl: a files-only directory produces no file nodes; the current row is fixed up', () => {
  const fs = createMemoryFs(dir({ home: dir({ docs: dir({ 'a.txt': file(), 'b.txt': file() }) }) }));
  const nodes = buildDirTree(fs, '/home/docs');
  // No subdirectories ⇒ chain only; 'docs' current row fixed up "└─┬" → "└──".
  expect(nodes.map(rowText)).toEqual(['└─┬/', '  └─┬home', '    └──docs']);
  expect(nodes.some((n) => n.label === 'a.txt' || n.label === 'b.txt')).toBe(false);
});

test('impl: a mix of a subdir + files shows only the subdir (single ⇒ "└──")', () => {
  const fs = createMemoryFs(dir({ home: dir({ docs: dir({ sub: dir(), 'a.txt': file() }) }) }));
  const nodes = buildDirTree(fs, '/home/docs');
  expect(nodes.map(rowText)).toEqual(['└─┬/', '  └─┬home', '    └─┬docs', '      └──sub']);
});

test('impl: depth / path / isCurrent flags along the chain and subdirs', () => {
  const fs = createMemoryFs(dir({ home: dir({ user: dir({ proj: dir({ bin: dir(), src: dir() }) }) }) }));
  const nodes = buildDirTree(fs, '/home/user/proj');
  const root = nodes[0];
  expect(root.depth).toBe(0);
  expect(root.path).toBe('/');
  expect(root.label).toBe('/');
  const proj = nodes.find((n) => n.label === 'proj');
  expect(proj?.depth).toBe(3);
  expect(proj?.isCurrent).toBe(true);
  const bin = nodes.find((n) => n.label === 'bin');
  expect(bin?.path).toBe('/home/user/proj/bin');
  expect(bin?.depth).toBe(4);
  expect(bin?.isCurrent).toBe(false);
  // Exactly one node is flagged current (the deepest ancestor).
  expect(nodes.filter((n) => n.isCurrent).length).toBe(1);
});

// —— CROSS-PLATFORM (task 7.2) ——

test('impl: win32 seam — drive root, backslash paths, connector geometry preserved', () => {
  const fs = createMemoryFs(dir({ Users: dir({ user: dir({ proj: dir({ bin: dir(), src: dir() }) }) }) }), {
    flavor: 'win32',
  });
  const nodes = buildDirTree(fs, 'C:\\Users\\user\\proj');
  expect(nodes.map(rowText)).toEqual([
    '└─┬C:\\',
    '  └─┬Users',
    '    └─┬user',
    '      └─┬proj',
    '        └┬─bin',
    '         └─src', // last subdir fixup " ├─" → " └─"
  ]);
  expect(nodes[0].path).toBe('C:\\');
  expect(nodes.find((n) => n.label === 'bin')?.path).toBe('C:\\Users\\user\\proj\\bin');
});
