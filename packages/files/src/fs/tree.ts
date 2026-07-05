/**
 * Directory-tree geometry for `DirList` (AC-7) — pure, view-free, golden-testable against the decode.
 *
 * TV decode (GATE-1) — `TDirListBox::showDirs` (`tdirlist.cpp:104-186`), glyphs `tvtext1.cpp:119-124`.
 * The tree = the **ancestor path chain** (root → … → current), each `└─┬` (`pathDir`) indented
 * `indentSize=2` per depth, then the current directory's **subdirs** (`indent = (curDepth+1)*2`): the
 * first `└┬─` (`firstDir`), the rest ` ├─` (`middleDir`). The **last row** is fixed up by
 * `graphics="└├─"` (`:178-186`): a trailing `└─┬`/`└┬─` → `└──`, a ` ├─` → ` └─` (`lastDir`). A platform
 * root (`roots()`) replaces TV's non-Unix `"Drives"` node (AR-237). CP437 → unambiguous-narrow Unicode,
 * pinned at GATE-1. `.js` specifiers per NodeNext.
 */
import type { FileSystem } from './types.js';

/** Connector glyphs (CP437 `\xC0\xC4\xC2` … → Unicode, `tvtext1.cpp:119-124`). */
const PATH_DIR = '└─┬'; // an ancestor-chain node
const FIRST_DIR = '└┬─'; // the first subdirectory
const MIDDLE_DIR = ' ├─'; // a middle subdirectory (leading space aligns ├ under the ┬)
const INDENT_SIZE = 2;

/** A tree row: the connector prefix (indent + glyphs) + label, its path, depth, and current flag. */
export interface DirNode {
  /** The directory basename (root shows the root path, e.g. `/` or `C:\`). */
  label: string;
  /** The absolute path this node changes to when selected (`cmChangeDir`). */
  path: string;
  /** Depth from the root (root = 0). */
  depth: number;
  /** The full connector prefix (indent spaces + tree glyphs); the drawn row = `connector + label`. */
  connector: string;
  /** True for the current directory (the deepest ancestor node). */
  isCurrent: boolean;
}

/** `indent` leading spaces + the connector glyphs. */
function prefix(depth: number, glyphs: string): string {
  return ' '.repeat(depth * INDENT_SIZE) + glyphs;
}

/**
 * The last-row graphics fixup (`tdirlist.cpp:178-186`): if the row's glyphs contain `└`, blunt the two
 * glyphs after it to `─` (`└─┬`/`└┬─` → `└──`); else turn a `├` into `└` (` ├─` → ` └─`).
 */
function fixupLast(connector: string): string {
  const chars = [...connector];
  const li = chars.indexOf('└');
  if (li !== -1) {
    if (li + 1 < chars.length) chars[li + 1] = '─';
    if (li + 2 < chars.length) chars[li + 2] = '─';
  } else {
    const ti = chars.indexOf('├');
    if (ti !== -1) chars[ti] = '└';
  }
  return chars.join('');
}

/**
 * Build the `DirList` tree for `currentPath`: the ancestor chain + the current directory's subdirs.
 *
 * @param fs          The filesystem seam.
 * @param currentPath The directory the tree is rooted at (its subdirs are shown).
 * @returns The ordered tree rows (top to bottom).
 */
export function buildDirTree(fs: FileSystem, currentPath: string): DirNode[] {
  const abs = fs.resolve(currentPath);

  // Walk up to the filesystem root, collecting the intermediate basenames.
  const parts: string[] = [];
  let p = abs;
  while (fs.dirname(p) !== p) {
    parts.unshift(fs.basename(p));
    p = fs.dirname(p);
  }
  const root = p; // '/' or 'C:\'

  // The ancestor chain: root (depth 0) → … → current (deepest), all `└─┬`.
  const nodes: DirNode[] = [{ label: root, path: root, depth: 0, connector: prefix(0, PATH_DIR), isCurrent: parts.length === 0 }];
  let acc = root;
  parts.forEach((part, i) => {
    acc = fs.join(acc, part);
    const depth = i + 1;
    nodes.push({ label: part, path: acc, depth, connector: prefix(depth, PATH_DIR), isCurrent: i === parts.length - 1 });
  });

  // The current directory's subdirectories (non-dot-prefixed dirs, sorted case-sensitive).
  const curDepth = nodes.length - 1;
  let subdirs: string[] = [];
  try {
    subdirs = fs
      .readDir(abs)
      .filter((e) => e.kind === 'dir' && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  } catch {
    subdirs = []; // an unreadable current directory just shows the chain
  }
  subdirs.forEach((name, i) => {
    const depth = curDepth + 1;
    nodes.push({
      label: name,
      path: fs.join(abs, name),
      depth,
      connector: prefix(depth, i === 0 ? FIRST_DIR : MIDDLE_DIR),
      isCurrent: false,
    });
  });

  // The last row's connector is blunted (TV `graphics` fixup).
  const last = nodes[nodes.length - 1];
  last.connector = fixupLast(last.connector);
  return nodes;
}
