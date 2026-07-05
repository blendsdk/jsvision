/**
 * Specification test (immutable oracle) — `buildDirTree` connectors + geometry (ST-7, AC-7).
 *
 * TV decode: `TDirListBox::showDirs` (`tdirlist.cpp:104-186`) + glyphs `tvtext1.cpp:119-124`. The tree =
 * the **ancestor path chain** (root → … → current), each `└─┬` at `indentSize=2` per depth, then the
 * **current directory's subdirs** (`indent = (curDepth+1)*2`): the first `└┬─` (`firstDir`), the rest
 * ` ├─` (`middleDir`). The **last row** is fixed up by `graphics="└├─"` (`:178-186`): a trailing `└─┬`
 * / `└┬─` → `└──`, a ` ├─` → ` └─` (`lastDir`). A platform root replaces TV's `"Drives"` node (AR-237).
 * CP437 → unambiguous-narrow Unicode, pinned at GATE-1. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { buildDirTree } from '../src/fs/tree.js';
import type { DirNode } from '../src/fs/tree.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

/** The drawn row text for a node = its connector prefix + label (03-04 `getText`). */
const rowText = (n: DirNode) => n.connector + n.label;

function nestedFs() {
  return createMemoryFs(
    dir({
      home: dir({
        user: dir({
          proj: dir({
            bin: dir(),
            src: dir(),
            test: dir(),
            'notes.txt': file(), // a file — the tree shows directories only
          }),
        }),
      }),
    }),
  );
}

// ST-7 — ancestor chain (root → current) + current subdirs, indent 2/depth, faithful connectors.
test('ST-7: buildDirTree renders the ancestor chain + subdirs with faithful connectors', () => {
  const nodes = buildDirTree(nestedFs(), '/home/user/proj');
  expect(nodes.map(rowText)).toEqual([
    '└─┬/', // root (platform root, depth 0)
    '  └─┬home', // depth 1
    '    └─┬user', // depth 2
    '      └─┬proj', // depth 3 — the current directory
    '        └┬─bin', // first subdir (firstDir), depth 4 indent 8
    '         ├─src', // middle subdir (middleDir " ├─")
    '         └─test', // last subdir (graphics fixup ├ → └)
  ]);
});

// ST-7 — the current node is flagged; selecting a node changes to its path.
test('ST-7: nodes carry depth/path/isCurrent; the current directory is flagged', () => {
  const nodes = buildDirTree(nestedFs(), '/home/user/proj');
  const proj = nodes.find((n) => n.label === 'proj');
  expect(proj?.isCurrent).toBe(true);
  expect(proj?.depth).toBe(3);
  const bin = nodes.find((n) => n.label === 'bin');
  expect(bin?.path).toBe('/home/user/proj/bin');
  expect(bin?.isCurrent).toBe(false);
  // Only directories appear (notes.txt is a file).
  expect(nodes.some((n) => n.label === 'notes.txt')).toBe(false);
});

// ST-7 — a single subdir gets the "└──" fixup; a directory with no subdirs fixes up its own row.
test('ST-7: the last-row graphics fixup — single subdir "└──"; no subdirs fixes the current row', () => {
  const single = buildDirTree(createMemoryFs(dir({ home: dir({ only: dir() }) })), '/home');
  // chain: /, home; subdir: only (single ⇒ "└┬─" → "└──").
  expect(single.map(rowText)).toEqual(['└─┬/', '  └─┬home', '    └──only']);

  const leaf = buildDirTree(createMemoryFs(dir({ home: dir({ empty: dir() }) })), '/home/empty');
  // chain: /, home, empty (current, no subdirs) ⇒ its "└─┬" → "└──".
  expect(leaf.map(rowText)).toEqual(['└─┬/', '  └─┬home', '    └──empty']);
});
