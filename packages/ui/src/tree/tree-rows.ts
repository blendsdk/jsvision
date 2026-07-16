/**
 * `TreeRows<T>` — the internal, focusable rows renderer of a {@link Tree}. Construct a `Tree` rather
 * than using this directly. It draws each visible row as a tree-line graph prefix followed by the
 * node text, virtual-scrolls a flattened row list, and owns the tree's keyboard/mouse handling.
 *
 * How each row draws:
 *   • Row colour priority is focused > selected > normal, and colour is the only focus indicator.
 *   • The row is cleared in its colour, the graph prefix (`│├└─` + `+`/`─` marker) is drawn in that
 *     colour, then the node text is drawn after it.
 *   • A collapsed node draws its text two-tone (a dimmer foreground) to signal there is more beneath
 *     it; expanded nodes and leaves draw single-tone.
 *   • Rows past the last node are blanked; an empty tree shows `<empty>` at column 1.
 *
 * Interaction: ↑↓ move focus, PgUp/PgDn page, Home/End, Ctrl+PgUp/PgDn jump to ends, wheel scrolls
 * ±3, `+`/`-`/`*` expand/collapse/expand-subtree the focused node, ←/→ collapse-or-parent /
 * expand-or-child, Enter activates. A mouse click in the graph zone toggles the node; a double-click
 * on the text activates it. See {@link onEvent}.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, ThemeRoleName } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent, Style } from '@jsvision/core';
import type { ScrollBar } from '../scroll/index.js';
import { clampIndex, keepVisible } from '../list/virtual.js';
import { createGraph, graphWidth, OV_EXPANDED, OV_CHILDREN } from './graph.js';
import type { FlatRow, MarkerStyle, TreeNode } from './graph.js';

/** The text drawn top-left for an empty tree. */
const EMPTY_TEXT = '<empty>';

/** Shared configuration handed from a {@link Tree} to its rows renderer. */
export interface TreeRowsConfig<T> {
  /** Render a node's value to its row text. */
  getText: (value: T) => string;
  /** The focused (highlighted) flattened-visible index; shared with the owned `ScrollBar.value`. */
  focused: Signal<number>;
  /** The selected (chosen) flattened-visible index (`-1` = none). */
  selected: Signal<number>;
  /** Draw the `│├└─` connectors (default true); false = flat indent, markers unchanged. */
  guides: boolean;
  /** The expand-marker style (`'tv'` default). `'triangle'` falls back to `'brackets'` without Unicode. */
  markerStyle: MarkerStyle;
  /** The current flattened-visible rows (a computed reading `roots` + the expand state, from `Tree`). */
  flatten: () => FlatRow<T>[];
  /** Command name emitted on activation (Enter / text double-click). */
  command?: string;
  /** Activation callback (Enter / text double-click); `index` is the flattened index, `node` the node. */
  onSelect?: (index: number, node: TreeNode<T>) => void;
  /** Expand a node (from the `+`/`→` keys or a graph-zone click); provided by the owning `Tree`. */
  expand: (node: TreeNode<T>) => void;
  /** Collapse a node (from the `-`/`←` keys or a graph-zone click). */
  collapse: (node: TreeNode<T>) => void;
  /** Toggle a node's expand state (a graph-zone click). */
  toggle: (node: TreeNode<T>) => void;
  /** Expand a node's whole subtree (the `*` key). */
  expandSubtree: (node: TreeNode<T>) => void;
}

/** The virtual-scroll rows renderer: draws only the visible window + owns tree keyboard/mouse. */
export class TreeRows<T> extends View {
  override focusable = true;
  protected readonly getText: (value: T) => string;
  protected readonly focused: Signal<number>;
  protected readonly selected: Signal<number>;
  protected readonly guides: boolean;
  /** The configured marker style; the effective style is resolved per frame from the caps. */
  protected readonly markerStyle: MarkerStyle;
  /**
   * The marker style actually drawn last frame (the `triangle`→`brackets` no-Unicode fallback
   * resolved). Cached from `draw()` so the mouse hit-zone can size its graph-zone to the glyphs on
   * screen — `draw()` always runs before a click can land, so this is current at interaction time.
   */
  protected effectiveStyle: MarkerStyle;
  /** The flattened-visible rows accessor (reactive; recomputes on a `roots`/expand change). */
  protected readonly flatten: () => FlatRow<T>[];
  /** Command emitted on activation (Enter / text-click). */
  protected readonly command?: string;
  /** Activation callback (Enter / text-click). */
  protected readonly onSelect?: (index: number, node: TreeNode<T>) => void;
  /** Expand-state mutators provided by the owning `Tree` (the keys/mouse drive them). */
  protected readonly expand: (node: TreeNode<T>) => void;
  protected readonly collapse: (node: TreeNode<T>) => void;
  protected readonly toggle: (node: TreeNode<T>) => void;
  protected readonly expandSubtree: (node: TreeNode<T>) => void;
  /** The flattened index of the first visible row. */
  protected topItem = 0;
  /** The owned scroll bar, wired by the `Tree` (its `value` is the shared `focused` signal). */
  bar?: ScrollBar;

  /**
   * @param cfg The shared configuration (text, signals, guides, the flatten accessor, the mutators).
   */
  constructor(cfg: TreeRowsConfig<T>) {
    super();
    this.getText = cfg.getText;
    this.focused = cfg.focused;
    this.selected = cfg.selected;
    this.guides = cfg.guides;
    this.markerStyle = cfg.markerStyle;
    this.effectiveStyle = cfg.markerStyle;
    this.flatten = cfg.flatten;
    this.command = cfg.command;
    this.onSelect = cfg.onSelect;
    this.expand = cfg.expand;
    this.collapse = cfg.collapse;
    this.toggle = cfg.toggle;
    this.expandSubtree = cfg.expandSubtree;

    this.onMount(() => {
      // Repaint + keep the focused row visible when focus moves (a key/wheel/bar drag).
      this.bind(
        () => this.focused(),
        () => this.updateTop(),
      );
      // On a structural/expand change (the flatten recomputes): clamp focused into range + repaint.
      this.bind(
        () => this.flatten(),
        () => {
          this.clampFocusedToRange();
          this.updateTop();
        },
      );
      // Repaint on selection change and on focus in/out (the focused-row colour toggles).
      this.bind(
        () => this.selected(),
        () => undefined,
      );
      this.bind(
        () => this.focusSignal()(),
        () => undefined,
      );
    });
  }

  /** The number of visible rows (the renderer's laid-out height). */
  protected viewportRows(): number {
    return this.bounds.height;
  }

  /** Recompute `topItem` to keep the (clamped) focused row visible. */
  protected updateTop(): void {
    const range = this.flatten().length;
    this.topItem = keepVisible(clampIndex(this.focused(), range), this.topItem, this.viewportRows(), range);
  }

  /** Clamp the focused signal into the current flattened range after the row set changes. */
  protected clampFocusedToRange(): void {
    const range = this.flatten().length;
    const clamped = clampIndex(this.focused(), range);
    if (clamped !== this.focused()) this.focused.set(clamped);
  }

  /**
   * Paint the visible window: re-limit the owned scroll bar, keep the focused row visible, then draw
   * each visible row as clear + graph prefix (in the row colour) + two-tone node text.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const rows = ctx.size.height;
    const flat = this.flatten();
    const range = flat.length;
    // Bar range = flattened row count; page step keeps one row of context.
    this.bar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));

    const normal = ctx.color('outlineNormal');
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // <empty> placeholder, one cell in from the left
      return;
    }

    const focused = clampIndex(this.focused(), range);
    this.topItem = keepVisible(focused, this.topItem, rows, range);
    const active = this.state.focused;
    const selected = this.selected();
    const width = ctx.size.width;
    // Resolve the effective marker style once per frame: `triangle` needs Unicode, else use brackets
    // (an ASCII-safe superset of the same collapsed/expanded/leaf cues). Cache it for the hit-zone.
    const style: MarkerStyle =
      this.markerStyle === 'triangle' && !ctx.caps.unicode.utf8 ? 'brackets' : this.markerStyle;
    this.effectiveStyle = style;

    for (let i = 0; i < rows; i += 1) {
      const index = this.topItem + i;
      if (index >= range) {
        ctx.fillRect(0, i, width, 1, ' ', normal); // blank trailing row in the normal colour
        continue;
      }
      const row = flat[index];
      const roleName = this.rowRole(index, focused, selected, active);
      const rowStyle = ctx.color(roleName);
      ctx.fillRect(0, i, width, 1, ' ', rowStyle); // clear the row in its colour

      const graph = createGraph(row.level, row.lines, row.flags, this.guides, style);
      ctx.text(0, i, graph, rowStyle); // graph prefix in the row colour

      const expanded = (row.flags & OV_EXPANDED) !== 0;
      const textStyle = this.textStyle(ctx, roleName, expanded);
      const gw = graphWidth(row.level, style, row.flags);
      const text = this.getText(row.node.value).slice(0, Math.max(0, width - gw));
      ctx.text(gw, i, text, textStyle); // node text at the post-graph column, two-tone
    }
  }

  /** The row's theme role, by priority: focused > selected > normal. */
  protected rowRole(index: number, focused: number, selected: number, active: boolean): ThemeRoleName {
    if (index === focused) return active ? 'outlineFocused' : 'outlineSelected';
    if (index === selected) return 'outlineSelected';
    return 'outlineNormal';
  }

  /**
   * The node-text colour: a collapsed normal node's text draws in the dimmer `outlineNotExpanded`
   * role (a hint that it has hidden children); everything else is single-tone (the row colour).
   */
  protected textStyle(ctx: DrawContext, roleName: ThemeRoleName, expanded: boolean): Style {
    if (roleName === 'outlineNormal' && !expanded) return ctx.color('outlineNotExpanded');
    return ctx.color(roleName);
  }

  /**
   * Route tree keyboard, mouse, and wheel events:
   *   • wheel scrolls focus ±3.
   *   • mouse-down focuses the clicked row; a click within the graph-prefix width toggles the node's
   *     expand state, while a double-click on the text activates it (a single text click only focuses).
   *   • keys: ↑↓, PgUp/PgDn, Home/End, Ctrl+PgUp/PgDn jump to ends; `+`/`-` expand/collapse, `*`
   *     expand the subtree; Enter activates; ←/→ collapse-or-parent / expand-or-child.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'wheel') {
      if (inner.dir === 'up') this.focusBy(-3);
      else if (inner.dir === 'down') this.focusBy(3);
      ev.handled = true;
      return;
    }
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.handleMouseDown(ev);
      return;
    }
    if (inner.type !== 'key') return;
    if (this.handleKey(inner, ev)) ev.handled = true;
  }

  /**
   * Handle a mouse-down: focus the clicked row, then a click within the graph-prefix width toggles
   * the node's expand state, while a double-click on the node text activates it. A single click on
   * the text only focuses the row.
   *
   * Note: because a double-click arrives as two mouse-downs, a graph-zone double-click toggles the
   * node twice (a net no-op) rather than activating — the first down already toggled it.
   */
  protected handleMouseDown(ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined) return;
    const flat = this.flatten();
    if (flat.length > 0) {
      const index = clampIndex(this.topItem + local.y, flat.length);
      this.focusTo(index); // always focus the clicked row
      const row = flat[index];
      if (local.x < graphWidth(row.level, this.effectiveStyle, row.flags)) {
        this.toggle(row.node); // graph zone ⇒ toggle expand (on any click)
      } else if (ev.clickCount === 2) {
        this.select(index, ev); // text double-click ⇒ activate (select + onSelect + emit)
      }
      // single text click ⇒ focus only
    }
    ev.handled = true;
  }

  /** Apply a navigation/expand/select key; returns whether it was consumed. */
  protected handleKey(inner: KeyEvent, ev: DispatchEvent): boolean {
    const page = Math.max(1, this.viewportRows() - 1); // page by one screen, keeping a row of context
    switch (inner.key) {
      case 'up':
        this.focusBy(-1);
        return true;
      case 'down':
        this.focusBy(1);
        return true;
      case 'pageup':
        if (inner.ctrl)
          this.focusTo(0); // Ctrl+PgUp → first row
        else this.focusBy(-page);
        return true;
      case 'pagedown':
        if (inner.ctrl)
          this.focusTo(this.flatten().length - 1); // Ctrl+PgDn → last row
        else this.focusBy(page);
        return true;
      case 'home':
        this.focusTo(this.topItem); // top of the visible window
        return true;
      case 'end':
        this.focusTo(this.topItem + this.viewportRows() - 1); // bottom of the visible window
        return true;
      case 'left':
        this.collapseOrParent();
        return true;
      case 'right':
        this.expandOrChild();
        return true;
      case 'enter':
        this.select(this.focused(), ev); // activate the focused row
        return true;
      case '+':
        this.mutateFocused((node) => this.expand(node));
        return true;
      case '-':
        this.mutateFocused((node) => this.collapse(node));
        return true;
      case '*':
        this.mutateFocused((node) => this.expandSubtree(node)); // expand the whole subtree
        return true;
      default:
        return false;
    }
  }

  /** The currently-focused row (clamped into range), or `undefined` for an empty tree. */
  protected focusedRow(): FlatRow<T> | undefined {
    const flat = this.flatten();
    return flat[clampIndex(this.focused(), flat.length)];
  }

  /** Apply an expand-mutator to the focused node (the `+`/`-`/`*` keys). */
  protected mutateFocused(fn: (node: TreeNode<T>) => void): void {
    const row = this.focusedRow();
    if (row !== undefined) fn(row.node);
  }

  /**
   * `←`: collapse the focused node when it is expanded-with-children; otherwise move focus to its
   * parent (the nearest preceding row at a smaller level).
   */
  protected collapseOrParent(): void {
    const flat = this.flatten();
    const i = clampIndex(this.focused(), flat.length);
    const row = flat[i];
    if (row === undefined) return;
    if ((row.flags & OV_CHILDREN) !== 0) {
      this.collapse(row.node); // expanded-with-children ⇒ collapse
      return;
    }
    for (let k = i - 1; k >= 0; k -= 1) {
      if (flat[k].level < row.level) {
        this.focusTo(k); // collapsed/leaf ⇒ jump to parent
        return;
      }
    }
    // a top-level node with no parent ⇒ no-op
  }

  /**
   * `→`: expand the focused node when it is collapsed-with-children; otherwise, when it is already
   * expanded-with-children, descend to its first child (the next row). A leaf is a no-op.
   */
  protected expandOrChild(): void {
    const flat = this.flatten();
    const i = clampIndex(this.focused(), flat.length);
    const row = flat[i];
    if (row === undefined) return;
    if ((row.flags & OV_CHILDREN) !== 0) {
      if (i + 1 < flat.length) this.focusTo(i + 1); // expanded ⇒ descend to first child
    } else if (row.node.children.length > 0) {
      this.expand(row.node); // collapsed-with-children ⇒ expand
    }
  }

  /** Activate the row at `index`: set `selected`, call `onSelect`, and emit `command` if set. */
  protected select(index: number, ev: DispatchEvent): void {
    const flat = this.flatten();
    if (index < 0 || index >= flat.length) return;
    this.selected.set(index);
    this.onSelect?.(index, flat[index].node);
    if (this.command !== undefined) ev.emit?.(this.command);
  }

  /** Move focus by `delta` rows, clamped into range. */
  protected focusBy(delta: number): void {
    this.focusTo(this.focused() + delta);
  }

  /** Focus the given flattened index, clamped into range (the bind updates `topItem` + repaints). */
  protected focusTo(index: number): void {
    this.focused.set(clampIndex(index, this.flatten().length));
  }
}
