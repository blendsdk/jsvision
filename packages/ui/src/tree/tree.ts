/**
 * `Tree<T>` — a Turbo Vision `TOutlineViewer`/`TOutline` (RD-15): a focusable, virtual-scrolling
 * expandable outline. A `Group` laid out `[rows fr | vertical-bar 1]` (mirrors `ListView`) that
 * flattens the visible (expanded) nodes of a **forest** of roots into an ordered row list,
 * virtual-scrolls it via {@link TreeRows}, and owns a vertical `ScrollBar`.
 *
 * The **drawing/geometry/glyphs match TV exactly** (the `graph.ts` `│├└─`+`+`/`─` builder, the
 * two-tone collapsed text, the `cpOutlineViewer` colours — GATE-1 decoded in `tree-rows.ts`/`graph.ts`),
 * while the **data model + behaviour modernise**: a plain reactive `TreeNode<T>` (`{ value, children }`,
 * AR-141), **view-owned** expand state (an object-identity `Set` in a version `Signal`, PA-4; the node
 * data stays plain), and `←`/`→` collapse/expand (PA-12). Built entirely on existing primitives — no
 * new engine seams; the only additive surface is the 4 core `cpOutlineViewer` theme roles.
 *
 * Expose {@link rows} as the focus target (a plain `Group` is not itself focusable; Tab/click descend
 * to the rows renderer), like `ListView.rows`. `.js` specifiers per NodeNext.
 */
import { Group } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal, computed } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { ScrollBar } from '../scroll/index.js';
import { TreeRows } from './tree-rows.js';
import { flattenVisible } from './graph.js';
import type { FlatRow, TreeNode } from './graph.js';

// Re-export the node model so `Tree` + `TreeNode` come from one place (the barrel also re-exports it).
export type { TreeNode } from './graph.js';

/** Construction options for {@link Tree}. */
export interface TreeOptions<T> {
  /** The forest of root nodes (PA-2); a single-root tree is the 1-element case. */
  roots: Signal<TreeNode<T>[]>;
  /** Render a node's value to its row text. */
  getText: (value: T) => string;
  /** The focused (highlighted) flattened-visible index (default an internal signal at 0). */
  focused?: Signal<number>;
  /** The selected (chosen) flattened-visible index (default an internal signal at -1). */
  selected?: Signal<number>;
  /** Activation callback (Enter / text-click); `index` is the flattened index, `node` the `TreeNode` (PA-13). */
  onSelect?: (index: number, node: TreeNode<T>) => void;
  /** Command emitted on activation (TV `cmOutlineItemSelected`); no built-in default (PA-13). */
  command?: string;
  /** Seed every node with children as expanded at construction (default false = all collapsed, PA-3). */
  expandedByDefault?: boolean;
  /** Draw the `│├└─` connectors (default true); false = flat indent, markers unchanged (PA-6). */
  guides?: boolean;
}

/** A focusable, virtual-scrolling expandable outline: a rows renderer + an owned vertical scroll bar. */
export class Tree<T> extends Group {
  /** Lay the children out horizontally: `[rows fr | bar 1]`. */
  override layout: LayoutProps = { direction: 'row' };
  /** The focusable rows renderer (the focus target — a `Group` is not itself a focus leaf). */
  readonly rows: TreeRows<T>;
  /** The owned vertical scroll bar (its `value` is the shared `focused` signal). */
  protected readonly bar: ScrollBar;
  /** The focused-index signal (shared with the bar), exposed for binding. */
  readonly focused: Signal<number>;
  /** The selected-index signal, exposed for binding (`-1` = none). */
  readonly selected: Signal<number>;
  /** The forest of roots. */
  protected readonly roots: Signal<TreeNode<T>[]>;
  /** Command emitted on activation (consumed by the Phase-2 select wiring). */
  protected readonly command?: string;
  /** Activation callback (consumed by the Phase-2 select wiring). */
  protected readonly onSelect?: (index: number, node: TreeNode<T>) => void;
  /** View-owned expand state: object-identity node set (PA-4), observed via {@link expandVersion}. */
  protected readonly expandedSet = new Set<TreeNode<T>>();
  /** Bumped on every expand-state mutation so the flatten computed re-runs (PA-4). */
  protected readonly expandVersion: Signal<number> = signal(0);
  /** The flattened-visible rows (recomputes on a `roots` or expand change). */
  protected readonly flattened: () => FlatRow<T>[];

  /**
   * @param opts `roots` + `getText` + optional `focused`/`selected` signals, `onSelect`/`command`,
   *   `expandedByDefault`, `guides`.
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
    this.flattened = computed(() => {
      this.expandVersion();
      return flattenVisible(this.roots(), (node) => this.expandedSet.has(node));
    });

    this.rows = new TreeRows<T>({
      getText: opts.getText,
      focused: this.focused,
      selected: this.selected,
      guides: opts.guides ?? true,
      flatten: this.flattened,
      command: this.command,
      onSelect: this.onSelect,
      expand: (node) => this.expand(node),
      collapse: (node) => this.collapse(node),
      toggle: (node) => this.toggle(node),
      expandSubtree: (node) => this.expandSubtree(node),
    });
    this.rows.layout = { size: { kind: 'fr', weight: 1 } };
    this.bar = new ScrollBar({ value: this.focused, orientation: 'vertical' });
    this.bar.layout = { size: { kind: 'fixed', cells: 1 } };
    this.rows.bar = this.bar; // the rows renderer re-limits the bar each draw (TV setLimit)

    this.add(this.rows); // z-order: rows (left) then bar (right)
    this.add(this.bar);
  }

  /** Whether `node` is currently expanded (object identity, PA-4). */
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

  /** Expand every node in the forest (TV `expandAll` over all roots, PA-6); one repaint. */
  expandAll(): void {
    this.seedExpanded(this.roots());
    this.bump();
  }

  /** Collapse every node (PA-6); one repaint. */
  collapseAll(): void {
    this.expandedSet.clear();
    this.bump();
  }

  /** Expand `node` and its whole subtree (TV `expandAll(node)`, `toutline.cpp:106`; the `*` key); one repaint. */
  expandSubtree(node: TreeNode<T>): void {
    this.seedExpanded([node]);
    this.bump();
  }

  /** Seed every node that has children as expanded (TV `expandedByDefault`, PA-3). Iterative. */
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

  /** Bump the expand version so the flatten computed re-runs (PA-4). */
  protected bump(): void {
    this.expandVersion.set(this.expandVersion() + 1);
  }
}
