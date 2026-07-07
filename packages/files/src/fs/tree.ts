/**
 * Builds the indented directory-tree rows that {@link DirList} (the change-directory dialog's tree)
 * displays. Pure and view-free, so the geometry can be unit-tested on its own.
 *
 * The tree is the ancestor chain from the filesystem root down to the current directory (each node
 * drawn as `└─┬`, indented two columns per level), followed by the current directory's immediate
 * subdirectories (the first drawn `└┬─`, the rest ` ├─`). The very last row is blunted to `└──`/`└─`
 * so the branch closes cleanly. On Windows the root node shows the drive; on POSIX it shows `/`.
 */
import type { FileSystem } from './types.js';

/** Box-drawing connectors for each kind of tree row. */
const PATH_DIR = '└─┬'; // an ancestor-chain node
const FIRST_DIR = '└┬─'; // the first subdirectory
const MIDDLE_DIR = ' ├─'; // a middle subdirectory (leading space aligns ├ under the ┬)
const INDENT_SIZE = 2;

/** One row of the directory tree: what to draw, where it points, and how deep it sits. */
export interface DirNode {
  /** The directory basename (the root node shows the root path itself, e.g. `/` or `C:\`). */
  label: string;
  /** The absolute path this node navigates to when activated. */
  path: string;
  /** Depth from the root (the root is `0`). */
  depth: number;
  /** The connector prefix (indent spaces + box glyphs); the drawn row is `connector + label`. */
  connector: string;
  /** `true` for the current directory (the deepest node in the ancestor chain). */
  isCurrent: boolean;
}

/** `depth`-proportional leading spaces followed by the connector glyphs. */
function prefix(depth: number, glyphs: string): string {
  return ' '.repeat(depth * INDENT_SIZE) + glyphs;
}

/**
 * Blunt the final row so the branch terminates: if it contains a `└`, replace the two glyphs after it
 * with `─` (`└─┬`/`└┬─` → `└──`); otherwise turn its `├` into `└` (` ├─` → ` └─`).
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
 * Build the directory-tree rows for a current path: the ancestor chain from the root down to it,
 * followed by its immediate subdirectories.
 *
 * @param fs          The filesystem to read through.
 * @param currentPath The directory the tree is centred on (its subdirectories are listed).
 * @returns The ordered tree rows, top to bottom.
 * @example
 * import { buildDirTree, nodeFileSystem } from '@jsvision/files';
 *
 * const rows = buildDirTree(nodeFileSystem, '/home/user/project');
 * for (const r of rows) console.log(r.connector + r.label);
 * // → /
 * //   └─┬home
 * //     └─┬user
 * //       └─┬project
 * //         └──src
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
  const nodes: DirNode[] = [
    { label: root, path: root, depth: 0, connector: prefix(0, PATH_DIR), isCurrent: parts.length === 0 },
  ];
  let acc = root;
  parts.forEach((part, i) => {
    acc = fs.join(acc, part);
    const depth = i + 1;
    nodes.push({
      label: part,
      path: acc,
      depth,
      connector: prefix(depth, PATH_DIR),
      isCurrent: i === parts.length - 1,
    });
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
