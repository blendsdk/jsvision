/**
 * A single-column list that renders a directory tree — the ancestor chain from the filesystem root
 * down to the current directory, plus that directory's immediate subdirectories, drawn with box
 * connectors. Activating a node (Enter or double-click) reports its absolute path so the caller can
 * change directory. The tree re-roots reactively whenever its `directory` signal changes.
 *
 * This is the tree embedded in {@link ChDirDialog}; use it directly only when composing a custom
 * directory picker.
 */
import { ListView, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { FileSystem } from '../fs/types.js';
import { buildDirTree } from '../fs/tree.js';
import type { DirNode } from '../fs/tree.js';

/** Construction options for {@link DirList}. */
export interface DirListOptions {
  /** The filesystem to read through. */
  fs: FileSystem;
  /** The current directory; the tree re-roots whenever it changes. */
  directory: Signal<string>;
  /** The focused display index (default an internal signal at 0). */
  focused?: Signal<number>;
  /** The selected display index (default an internal signal at -1). */
  selected?: Signal<number>;
  /** Fired on Enter/double-click with the activated node's absolute path. */
  onChangeDir?: (path: string) => void;
  /** A command name emitted on activation, handled elsewhere (like {@link Button}). */
  command?: string;
}

/**
 * The directory-tree list, driven reactively by the current directory.
 *
 * @example
 * import { at, Group, signal } from '@jsvision/ui';
 * import { DirList, nodeFileSystem } from '@jsvision/files';
 *
 * const directory = signal('/home/user');
 * const tree = at(
 *   new DirList({
 *     fs: nodeFileSystem,
 *     directory,
 *     onChangeDir: (path) => directory.set(path), // navigate on activation
 *   }),
 *   0,
 *   0,
 *   30,
 *   10,
 * );
 * new Group().add(tree);
 */
export class DirList extends ListView<DirNode> {
  /** The current directory; changing it re-roots the tree. */
  readonly directory: Signal<string>;
  /** The tree rows currently displayed. */
  readonly nodes: Signal<DirNode[]>;
  /** The node under the focus cursor, or `undefined` when the tree is empty. Reactive. */
  readonly focusedNode: () => DirNode | undefined;
  private readonly fsSeam: FileSystem;

  constructor(opts: DirListOptions) {
    const nodes = signal<DirNode[]>([]);
    const onChange = opts.onChangeDir; // capture before super() — `this` isn't available yet
    super({
      items: nodes,
      getText: (n) => n.connector + n.label,
      focused: opts.focused,
      selected: opts.selected,
      typeAhead: true,
      sorted: false, // buildDirTree already emits rows in tree order
      command: opts.command,
      onSelect: (_index, node) => onChange?.(node.path),
    });
    this.fsSeam = opts.fs;
    this.directory = opts.directory;
    this.nodes = nodes;
    // Plain reactive accessor, mirroring FileList.focusedEntry.
    this.focusedNode = () => this.nodes()[this.focused()];

    // Re-root reactively: a directory change re-derives the tree. Bound on mount, it runs once
    // immediately and on every change; an unreadable directory yields an empty tree.
    this.onMount(() => {
      this.bind(
        () => {
          try {
            return buildDirTree(this.fsSeam, this.directory());
          } catch {
            return [] as DirNode[];
          }
        },
        (list) => this.nodes.set(list),
      );
    });
  }
}
