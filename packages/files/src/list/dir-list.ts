/**
 * `DirList` — the directory-tree list (`extends ListView<DirNode>`), a decode of `TDirListBox`
 * (`tdirlist.cpp`, extends the `TListViewer` spine).
 *
 * TV decode (GATE-1): `TDirListBox : TListBox` holds `TDirEntry` items, not strings — so the faithful
 * jsvision mapping is `ListView<DirNode>` (the string `ListBox` preset can't carry the per-node path),
 * a single column owning its vertical bar. `getText(node) = connector + label` (the tree geometry lives
 * in the pure `buildDirTree`, proven cell-by-cell in `tree.spec`). Selecting a node emits its path
 * (`cmChangeDir`). The tree is a reactive derivation of `directory` — a change re-roots it. Labels are
 * sanitized at the draw boundary (`ctx.text`, AC-14). `.js` per NodeNext.
 */
import { ListView, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { FileSystem } from '../fs/types.js';
import { buildDirTree } from '../fs/tree.js';
import type { DirNode } from '../fs/tree.js';

/** Construction options for {@link DirList}. */
export interface DirListOptions {
  /** The filesystem seam. */
  fs: FileSystem;
  /** The current directory (shared with the owning dialog; the tree re-roots on change). */
  directory: Signal<string>;
  /** The focused display index (default an internal signal at 0). */
  focused?: Signal<number>;
  /** The selected display index (default an internal signal at -1). */
  selected?: Signal<number>;
  /** Fired when a node is activated (Enter/double-click) with its absolute path (`cmChangeDir`). */
  onChangeDir?: (path: string) => void;
  /** A command emitted on activation (like `Button`). */
  command?: string;
}

/** The directory-tree list over a reactive `buildDirTree` derivation. */
export class DirList extends ListView<DirNode> {
  /** The current directory (the tree re-roots on change). */
  readonly directory: Signal<string>;
  /** The tree nodes (a writable signal kept in sync with `buildDirTree`). */
  readonly nodes: Signal<DirNode[]>;
  /** The currently-focused node, or `undefined` when empty. */
  readonly focusedNode: () => DirNode | undefined;
  private readonly fsSeam: FileSystem;

  constructor(opts: DirListOptions) {
    const nodes = signal<DirNode[]>([]);
    const onChange = opts.onChangeDir; // capture before super() (no `this` pre-super)
    super({
      items: nodes,
      getText: (n) => n.connector + n.label,
      focused: opts.focused,
      selected: opts.selected,
      typeAhead: true,
      sorted: false, // buildDirTree order is the tree order, not ascending getText
      command: opts.command,
      onSelect: (_index, node) => onChange?.(node.path), // cmChangeDir
    });
    this.fsSeam = opts.fs;
    this.directory = opts.directory;
    this.nodes = nodes;
    // A plain reactive accessor (not a `computed` — no owner-less computation), mirroring FileList.
    this.focusedNode = () => this.nodes()[this.focused()];

    // Reactive re-root: a `directory` change re-derives the tree. The owned `bind` reader runs
    // immediately on mount + on change; an unreadable directory yields an empty tree.
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
