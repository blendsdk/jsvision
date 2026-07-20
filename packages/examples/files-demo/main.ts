/**
 * Files-family walkthrough (RD-09, `@jsvision/files`) — a narrated, headless console demo of the TV
 * file-dialog family over an **in-memory `FileSystem`** (no real disk / TTY): a `FileDialog` rendered
 * through a real `RenderRoot`, then driven by its public `valid()` state machine — typing a wildcard
 * re-filters the 2-col listing, a directory name descends, a filename resolves; finally a `ChDirDialog`
 * shows the `DirList` tree. Prints a composed ASCII frame per step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:files
 *
 * Dev-only example — not part of the published package. Imports `@jsvision/files`/`@jsvision/ui` by
 * name, exactly as a consumer would. `.js` per NodeNext.
 */
import { posix } from 'node:path';
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop, createRoot, signal, Commands, cover } from '@jsvision/ui';
import { FileDialog, ChDirDialog } from '@jsvision/files';
import type { DirEntry, FileStat, FileSystem } from '@jsvision/files';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A node in the demo's in-memory tree: a directory (with children) or a file (with size). */
interface FNode {
  readonly dir?: Record<string, FNode>;
  readonly size?: number;
}
const dir = (children: Record<string, FNode>): FNode => ({ dir: children });
const file = (size = 0): FNode => ({ size });
const MTIME = new Date(2026, 6, 4, 9, 5, 0); // fixed → deterministic info-pane output

/** The demo tree, rooted at `/`. */
const TREE: FNode = dir({
  home: dir({
    user: dir({
      'App.ts': file(1024),
      'main.ts': file(512),
      'readme.txt': file(48),
      src: dir({ 'deep.ts': file(256), 'util.ts': file(128), nested: dir({}) }),
    }),
  }),
});

/** Walk the tree to the node at an absolute POSIX path, or `undefined` if absent. */
function nodeAt(path: string): FNode | undefined {
  const parts = posix.resolve(path).split('/').filter(Boolean);
  let node: FNode | undefined = TREE;
  for (const part of parts) node = node?.dir?.[part];
  return node;
}

/** A minimal in-memory `FileSystem` over {@link TREE} (path ops delegate to `node:path.posix`). */
const memFs: FileSystem = {
  readDir(path) {
    const node = nodeAt(path);
    if (node?.dir === undefined) throw new Error(`ENOTDIR: ${path}`);
    return Object.entries(node.dir).map(([name, child]): DirEntry => ({
      name,
      kind: child.dir !== undefined ? 'dir' : 'file',
      size: child.size ?? 0,
      mtime: MTIME,
      hidden: name.startsWith('.'),
    }));
  },
  stat(path): FileStat {
    const node = nodeAt(path);
    if (node === undefined) throw new Error(`ENOENT: ${path}`);
    return { kind: node.dir !== undefined ? 'dir' : 'file', size: node.size ?? 0, mtime: MTIME };
  },
  lstat(path) {
    return this.stat(path);
  },
  resolve: (...s) => posix.resolve(...s),
  isAbsolute: (p) => posix.isAbsolute(p),
  join: (...s) => posix.join(...s),
  dirname: (p) => posix.dirname(p),
  basename: (p) => posix.basename(p),
  sep: '/',
  homedir: () => '/home/user',
  roots: () => ['/'],
  // The tree models directory structure only — names, kinds and sizes, which is all the dialog
  // family reads. Rejecting the content methods keeps that boundary visible: a walkthrough that
  // silently returned empty text would look like a working editor seam that it is not.
  readFile: (path) => {
    throw new Error(`this walkthrough's tree holds no file content: ${path}`);
  },
  writeFile: (path) => {
    throw new Error(`this walkthrough's tree is read-only: ${path}`);
  },
  rename: (from) => {
    throw new Error(`this walkthrough's tree is read-only: ${from}`);
  },
  unlink: (path) => {
    throw new Error(`this walkthrough's tree is read-only: ${path}`);
  },
};

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => (cell.char === '' ? ' ' : cell.char)).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

function main(): void {
  console.log('Files family (RD-09) — the TV file-dialog family over an in-memory FileSystem.\n');
  // A standalone script owns its reactive graph — an app gets this owner from `createApplication`; a
  // bare demo wraps its mounts so the components' reactive scopes have a root to bind to.
  createRoot(() => runWalkthrough());
}

function runWalkthrough(): void {
  // —— FileDialog: render, then drive valid() (wildcard → directory → file) ——
  const directory = signal('/home/user');
  const dlg = new FileDialog({ fs: memFs, directory });
  cover(dlg);
  const fdLoop = createEventLoop({ width: 49, height: 19 }, { caps });
  const fdRoot = new Group();
  fdRoot.add(dlg);
  fdLoop.mount(fdRoot);
  fdLoop.renderRoot.flush();
  const fdFrame = (t: string): void => printFrame(t, fdLoop.renderRoot.buffer().rows());

  fdFrame('Step 1 — the open file dialog: 2-col listing, filename input + History, info pane, buttons');

  dlg.filename.set('*.ts');
  dlg.valid(Commands.ok); // isWild ⇒ re-filter, stay open
  fdLoop.renderRoot.flush();
  fdFrame('Step 2 — typed *.ts + OK: the listing re-filters to the .ts files (dirs always shown)');

  dlg.filename.set('src');
  dlg.valid(Commands.ok); // a directory ⇒ descend, stay open
  fdLoop.renderRoot.flush();
  fdFrame(`Step 3 — typed src + OK: descended into ${directory()} — its contents`);

  dlg.filename.set('deep.ts');
  const resolved = dlg.valid(Commands.ok); // a valid file ⇒ resolve + close
  console.log(`\nStep 4 — typed deep.ts + OK ⇒ valid=${resolved}, resolved path: ${dlg.result()}`);

  // —— ChDirDialog: render the DirList tree ——
  const chdir = new ChDirDialog({ fs: memFs, directory: signal('/home/user/src') });
  cover(chdir);
  const cdLoop = createEventLoop({ width: 48, height: 18 }, { caps });
  const cdRoot = new Group();
  cdRoot.add(chdir);
  cdLoop.mount(cdRoot);
  cdLoop.renderRoot.flush();
  printFrame(
    'Step 5 — the change-directory dialog: the DirList tree (ancestor chain + subdirs)',
    cdLoop.renderRoot.buffer().rows(),
  );

  console.log('\nDone — the file-dialog family runs headless over the injectable FileSystem seam.');
}

main();
