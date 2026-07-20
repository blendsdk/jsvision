/**
 * `Tree<T>` — a focusable, virtual-scrolling, expandable outline widget. See the {@link Tree} class
 * for the full description and a worked example.
 *
 * It takes a forest of {@link TreeNode} roots, flattens the currently-visible (expanded) nodes into
 * an ordered row list, virtual-scrolls it, and owns a vertical scroll bar. Nodes carry `│├└─`
 * connector guides and a `+`/`─` expand marker. Expand state is owned by the view (not by the node
 * data), so the node objects stay plain and immutable.
 */
import { Group } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { ScrollBar } from '../scroll/index.js';
import { TreeRows } from './tree-rows.js';
import { flattenVisible } from './graph.js';
import type { FlatRow, MarkerStyle, TreeNode } from './graph.js';

// Re-export the node model + marker style so they come from one place (the barrel re-exports both).
export type { TreeNode, MarkerStyle } from './graph.js';

/** Construction options for {@link Tree}. */
export interface TreeOptions<T> {
  /** The reactive forest of root nodes; a single-root tree is the 1-element case. */
  roots: Signal<TreeNode<T>[]>;
  /** Render a node's value to its row text. */
  getText: (value: T) => string;
  /** The focused (highlighted) flattened-visible index (default an internal signal at 0). */
  focused?: Signal<number>;
  /** The selected (chosen) flattened-visible index (default an internal signal at -1). */
  selected?: Signal<number>;
  /** Activation callback (Enter / text double-click); `index` is the flattened index, `node` the node. */
  onSelect?: (index: number, node: TreeNode<T>) => void;
  /** Command name emitted on activation, handled elsewhere; no built-in default. */
  command?: string;
  /** Seed every node that has children as expanded at construction (default false = all collapsed). */
  expandedByDefault?: boolean;
  /** Draw the `│├└─` connectors (default true); false = flat indent, markers unchanged. */
  guides?: boolean;
  /**
   * The expand-marker style (default `'tv'` — a faithful single `+`/`─`). `'brackets'` draws
   * `[+]`/`[-]` (pure ASCII, the most legible); `'triangle'` draws `▸`/`▾` and falls back to
   * `'brackets'` on a terminal without Unicode. Only the marker column changes — indentation and
   * connectors are identical across styles.
   */
  markerStyle?: MarkerStyle;
}

/**
 * A focusable, virtual-scrolling, expandable outline (file tree, nav tree, etc.). It renders a forest
 * of {@link TreeNode} roots as indented rows with `│├└─` connector guides and a `+`/`─` marker, and
 * only paints its visible window, so it stays fast over large trees.
 *
 * Expand state is owned by the tree, keyed on node object identity — the node data stays plain, and
 * the same node can live in more than one tree with independent expand state. Mutate it with
 * {@link expand}/{@link collapse}/{@link toggle}/{@link expandAll}/{@link collapseAll}/
 * {@link expandSubtree}; each re-flattens and repaints.
 *
 * Keyboard: ↑↓ move focus, PgUp/PgDn page, Home/End, Ctrl+PgUp/PgDn jump to ends, `+`/`-` expand or
 * collapse the focused node, `*` expand its whole subtree, ←/→ collapse-or-parent / expand-or-child,
 * Enter activate. Mouse: click a node's guide zone to toggle it, double-click its text to activate.
 *
 * Because a plain `Group` is not itself a focus target, focus the exposed {@link Tree.rows} renderer,
 * not the tree.
 *
 * @example
 * import { Group, Tree, createEventLoop, resolveCapabilities, signal, at } from '@jsvision/ui';
 * import type { TreeNode } from '@jsvision/ui';
 *
 * // A leaf is `children: []`.
 * const n = (value: string, children: TreeNode<string>[] = []): TreeNode<string> => ({ value, children });
 *
 * const roots = signal<TreeNode<string>[]>([
 *   n('src', [n('index.ts'), n('engine', [n('buffer.ts')])]),
 *   n('README.md'),
 * ]);
 *
 * const tree = new Tree<string>({
 *   roots,
 *   getText: (name) => name,
 *   command: 'open',
 *   markerStyle: 'brackets', // `[+]`/`[-]` expand markers instead of the default `+`/`─`
 *   onSelect: (_i, node) => console.log('opened', node.value),
 * });
 *
 * const root = new Group();
 * root.add(at(tree, 0, 0, 28, 10));
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const loop = createEventLoop({ width: 28, height: 10 }, { caps });
 * loop.mount(root);
 * loop.focusView(tree.rows); // focus the rows renderer, not the tree
 * tree.expandAll();
 */
export class Tree<T> extends Group {
  /** Lay the children out horizontally: rows on the left, the scroll bar on the right. */
  override layout: LayoutProps = { direction: 'row' };
  /** The focusable rows renderer — focus this (a plain `Group` is not itself a focus target). */
  readonly rows: TreeRows<T>;
  /** The owned vertical scroll bar (its `value` is the shared `focused` signal). */
  protected readonly bar: ScrollBar;
  /** The focused-index signal (shared with the bar), exposed for binding. */
  readonly focused: Signal<number>;
  /** The selected-index signal, exposed for binding (`-1` = none). */
  readonly selected: Signal<number>;
  /** The forest of roots. */
  protected readonly roots: Signal<TreeNode<T>[]>;
  /** Command name emitted on activation. */
  protected readonly command?: string;
  /** Activation callback. */
  protected readonly onSelect?: (index: number, node: TreeNode<T>) => void;
  /** View-owned expand state: a set of expanded nodes keyed on object identity. */
  protected readonly expandedSet = new Set<TreeNode<T>>();
  /** Bumped on every expand-state mutation so the flatten computed re-runs (the set itself is untracked). */
  protected readonly expandVersion: Signal<number> = signal(0);
  /** The flattened-visible rows (recomputes on a `roots` or expand-state change). */
  protected readonly flattened: () => FlatRow<T>[];

  /**
   * @param opts The tree configuration — see {@link TreeOptions}.
   */
  constructor(opts: TreeOptions<T>) {
    super();
    this.roots = opts.roots;
    this.focused = opts.focused ?? signal(0);
    this.selected = opts.selected ?? signal(-1);
    this.command = opts.command;
    this.onSelect = opts.onSelect;
    if (opts.expandedByDefault ?? false) this.seedExpanded(opts.roots());

    // The visible-row list: subscribe to the expand version + the roots, then flatten by identity.
    this.flattened = this.derived(() => {
      this.expandVersion();
      return flattenVisible(this.roots(), (node) => this.expandedSet.has(node));
    });

    this.rows = new TreeRows<T>({
      getText: opts.getText,
      focused: this.focused,
      selected: this.selected,
      guides: opts.guides ?? true,
      markerStyle: opts.markerStyle ?? 'tv',
      flatten: this.flattened,
      command: this.command,
      onSelect: this.onSelect,
      expand: (node) => this.expand(node),
      collapse: (node) => this.collapse(node),
      toggle: (node) => this.toggle(node),
      expandSubtree: (node) => this.expandSubtree(node),
    });
    this.rows.setLayout({ size: { kind: 'fr', weight: 1 } });
    this.bar = new ScrollBar({ value: this.focused, orientation: 'vertical' });
    this.bar.setLayout({ size: { kind: 'fixed', cells: 1 } });
    this.rows.bar = this.bar; // the rows renderer re-limits the bar's range on every draw

    this.add(this.rows); // z-order: rows (left) then bar (right)
    this.add(this.bar);
  }

  /** Whether `node` is currently expanded (matched by object identity). */
  isExpanded(node: TreeNode<T>): boolean {
    return this.expandedSet.has(node);
  }

  /** Expand `node` (a no-op if already expanded); re-flattens + repaints. */
  expand(node: TreeNode<T>): void {
    if (!this.expandedSet.has(node)) {
      this.expandedSet.add(node);
      this.bump();
    }
  }

  /** Collapse `node` (a no-op if already collapsed); re-flattens + repaints. */
  collapse(node: TreeNode<T>): void {
    if (this.expandedSet.delete(node)) this.bump();
  }

  /** Toggle `node`'s expand state; re-flattens + repaints. */
  toggle(node: TreeNode<T>): void {
    if (this.expandedSet.has(node)) this.collapse(node);
    else this.expand(node);
  }

  /** Expand every node in the whole forest; one repaint. */
  expandAll(): void {
    this.seedExpanded(this.roots());
    this.bump();
  }

  /** Collapse every node; one repaint. */
  collapseAll(): void {
    this.expandedSet.clear();
    this.bump();
  }

  /** Expand `node` and its entire subtree (the `*` key); one repaint. */
  expandSubtree(node: TreeNode<T>): void {
    this.seedExpanded([node]);
    this.bump();
  }

  /** Add every node with children (reachable from `nodes`) to the expanded set. Iterative. */
  protected seedExpanded(nodes: TreeNode<T>[]): void {
    const stack = [...nodes];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) break;
      if (node.children.length > 0) {
        this.expandedSet.add(node);
        stack.push(...node.children);
      }
    }
  }

  /** Bump the expand version so the flatten computed re-runs (the expand set is not itself reactive). */
  protected bump(): void {
    this.expandVersion.set(this.expandVersion() + 1);
  }
}
