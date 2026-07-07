/**
 * `TreeRows<T>` — the internal focusable rows-renderer of a {@link Tree} (RD-15). The Tree-specific
 * sibling of `ListRows`: it draws each visible row as a faithful Turbo Vision tree-line **graph
 * prefix** + the node text (two-tone for a collapsed node), virtual-scrolls a `flatten()`ed row list,
 * and owns tree keyboard/mouse. Built on the RD-11 virtual-scroll helpers (`clampIndex`/`keepVisible`)
 * + the owned-`ScrollBar` pattern; the graph/flatten math is the pure `graph.ts`.
 *
 * **TV GATE-1 decode — `drawTree` (`source/tvision/toutline.cpp:54-102`), the fidelity oracle:**
 *   • **row colour** (`:66-71`): `foc && sfFocused → getColor(0x0202)` (focused) `else isSelected →
 *     getColor(0x0303)` (selected) `else getColor(0x0401)` (normal). Priority focused > selected >
 *     normal → `outlineFocused` / `outlineSelected` / `outlineNormal` (RD-15 PA-8/PA-16).
 *   • **clear + graph** (`:72-79`): `moveChar(0,' ',color,size.x)` clears the row in the row colour,
 *     then the graph prefix is drawn in that same colour at `x = strwidth(graph)` (col 0 here — no
 *     horizontal scroll, PA-5).
 *   • **two-tone text** (`:80-84`): `TColorAttr c = (flags & ovExpanded) ? color : (color >> 8)`. The
 *     Normal pair `getColor(0x0401)` has low byte = slot 1 (`outlineNormal`) and high byte = slot 4
 *     (`outlineNotExpanded`), so a **collapsed** normal node's text draws in `outlineNotExpanded` and an
 *     **expanded/leaf** normal node's in `outlineNormal`. Focus/select pairs (`0x0202`/`0x0303`) have
 *     equal bytes ⇒ single-tone. Both outline-normal bytes share the blue bg, so the two-tone changes
 *     only the fg — no background seam over the row clear.
 *   • **fill remainder** (`draw`, `:93-102`): rows past the last node are blanked in the normal colour.
 *   • **sizing** (`:587-594`): `setLimit(updateMaxX, updateCount)` → the owned vertical bar range =
 *     the flattened row count (H deferred, PA-5).
 *
 * Empty tree → `<empty>` at column 1, matching the sibling `ListRows` (`list-rows.ts:36`; PF-003 — TV
 * has no oracle for an empty outline). Full interaction: vertical `↑↓`/paging/`Home`/`End`/`Ctrl+Pg`/
 * wheel, `+`/`-`/`*` expand, `←`/`→` collapse-or-parent / expand-or-child (PA-12), mouse graph-toggle
 * vs text-select (PA-14), and Enter select — see {@link onEvent}.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, ThemeRoleName } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent, Style } from '@jsvision/core';
import type { ScrollBar } from '../scroll/index.js';
import { clampIndex, keepVisible } from '../list/virtual.js';
import { createGraph, graphWidth, OV_EXPANDED, OV_CHILDREN } from './graph.js';
import type { FlatRow, TreeNode } from './graph.js';

/** The text drawn top-left for an empty tree (matches `ListRows` `EMPTY_TEXT`, `list-rows.ts:36`; PF-003). */
const EMPTY_TEXT = '<empty>';

/** Shared configuration handed from a {@link Tree} to its rows renderer. */
export interface TreeRowsConfig<T> {
  /** Render a node's value to its row text. */
  getText: (value: T) => string;
  /** The focused (highlighted) flattened-visible index; shared with the owned `ScrollBar.value`. */
  focused: Signal<number>;
  /** The selected (chosen) flattened-visible index (`-1` = none). */
  selected: Signal<number>;
  /** Draw the `│├└─` connectors (default true); false = flat indent, markers unchanged (PA-6). */
  guides: boolean;
  /** The current flattened-visible rows (a computed reading `roots` + the expand version, from `Tree`). */
  flatten: () => FlatRow<T>[];
  /** Command emitted on activation (Enter / text-click), TV `cmOutlineItemSelected` (PA-13). */
  command?: string;
  /** Activation callback (Enter / text-click); `index` is the flattened index, `node` the `TreeNode`. */
  onSelect?: (index: number, node: TreeNode<T>) => void;
  /** Expand a node (from the `+`/`→` keys or a graph-zone click); provided by the owning `Tree`. */
  expand: (node: TreeNode<T>) => void;
  /** Collapse a node (from the `-`/`←` keys or a graph-zone click). */
  collapse: (node: TreeNode<T>) => void;
  /** Toggle a node's expand state (a graph-zone click, PA-14). */
  toggle: (node: TreeNode<T>) => void;
  /** Expand a node's whole subtree (the `*` key, TV `expandAll`). */
  expandSubtree: (node: TreeNode<T>) => void;
}

/** The virtual-scroll rows renderer: draws only the visible window + owns tree keyboard/mouse. */
export class TreeRows<T> extends View {
  override focusable = true;
  protected readonly getText: (value: T) => string;
  protected readonly focused: Signal<number>;
  protected readonly selected: Signal<number>;
  protected readonly guides: boolean;
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
  /** The first visible flattened index (TV `topItem`/`delta.y`). */
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

  /** Clamp the focused signal into the current flattened range (TV `adjustFocus`, `toutline.cpp:35`). */
  protected clampFocusedToRange(): void {
    const range = this.flatten().length;
    const clamped = clampIndex(this.focused(), range);
    if (clamped !== this.focused()) this.focused.set(clamped);
  }

  /**
   * Paint the visible window (TV `draw`/`drawTree`): re-limit the owned bar, keep the focus visible,
   * then draw each visible row = clear + graph prefix (row colour) + two-tone node text.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const rows = ctx.size.height;
    const flat = this.flatten();
    const range = flat.length;
    // TV setLimit(updateMaxX, updateCount): bar range = flattened count; pgStep = size.y-1 (HR-53 parity).
    this.bar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));

    const normal = ctx.color('outlineNormal');
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // <empty> at column 1 (ListRows parity, PF-003)
      return;
    }

    const focused = clampIndex(this.focused(), range);
    this.topItem = keepVisible(focused, this.topItem, rows, range);
    const active = this.state.focused;
    const selected = this.selected();
    const width = ctx.size.width;

    for (let i = 0; i < rows; i += 1) {
      const index = this.topItem + i;
      if (index >= range) {
        ctx.fillRect(0, i, width, 1, ' ', normal); // blank trailing row in the normal colour
        continue;
      }
      const row = flat[index];
      const roleName = this.rowRole(index, focused, selected, active);
      const rowStyle = ctx.color(roleName);
      ctx.fillRect(0, i, width, 1, ' ', rowStyle); // clear the row in its colour (TV moveChar)

      const graph = createGraph(row.level, row.lines, row.flags, this.guides);
      ctx.text(0, i, graph, rowStyle); // graph prefix in the row colour

      const expanded = (row.flags & OV_EXPANDED) !== 0;
      const textStyle = this.textStyle(ctx, roleName, expanded);
      const gw = graphWidth(row.level);
      const text = this.getText(row.node.value).slice(0, Math.max(0, width - gw));
      ctx.text(gw, i, text, textStyle); // node text at the post-graph column, two-tone
    }
  }

  /** The row's theme role: focused > selected > normal (TV `drawTree` `:66-71`). */
  protected rowRole(index: number, focused: number, selected: number, active: boolean): ThemeRoleName {
    if (index === focused) return active ? 'outlineFocused' : 'outlineSelected';
    if (index === selected) return 'outlineSelected';
    return 'outlineNormal';
  }

  /**
   * The node-text colour, two-tone (TV `:82`): a **collapsed** normal node's text draws in the high
   * byte of the Normal pair (`outlineNotExpanded`); everything else is single-tone (the row colour).
   */
  protected textStyle(ctx: DrawContext, roleName: ThemeRoleName, expanded: boolean): Style {
    if (roleName === 'outlineNormal' && !expanded) return ctx.color('outlineNotExpanded');
    return ctx.color(roleName);
  }

  /**
   * Route tree keyboard/mouse/wheel — TV `handleEvent` (`toutline.cpp:419-541`) with the PA-12/PA-14
   * adaptations:
   *   • **wheel** ±3 (jsvision extension, cf. `ListRows`).
   *   • **mouse-down** (`:433-481`): focus the clicked row; a click with `mouse.x < strwidth(graph)`
   *     toggles expand (`:472`); a text **double**-click activates (`meDoubleClick ⇒ selected`, `:465`),
   *     a single text click focuses only (double-click-activation AR-5; graph-zone double = AR-15).
   *   • **keys** (`:484-539`): `↑↓`/`PgUp`/`PgDn`/`Home`/`End`, `Ctrl+PgUp/PgDn` → ends; `+`/`-`
   *     `adjust`, `*` `expandAll` (`:523-531`); Enter/`Ctrl+Enter` `selected` (`:515-518`). **← / →**
   *     override TV's up/down to collapse-or-parent / expand-or-child (PA-12).
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
   * A mouse-down (TV `TOutlineViewer::handleEvent`, `toutline.cpp:465-472`): focus the clicked row,
   * then a click within the graph-prefix width toggles expand (`mouse.x < strwidth(graph)`, `:472`);
   * a **double**-click on the text activates (`meDoubleClick ⇒ selected(foc)`, `:465`). A **single**
   * text click focuses ONLY — the port's non-TV single-click text emit is dropped
   * (double-click-activation AR-5). A graph-zone double-click toggles twice (no activate) — the
   * accepted AR-15 deviation: our two-down model (`clickCount` 1 then 2) already toggled on the first
   * down, so a single `meDoubleClick` can't be reconstructed.
   */
  protected handleMouseDown(ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined) return;
    const flat = this.flatten();
    if (flat.length > 0) {
      const index = clampIndex(this.topItem + local.y, flat.length);
      this.focusTo(index); // always focus the clicked row
      const row = flat[index];
      if (local.x < graphWidth(row.level)) {
        this.toggle(row.node); // graph-zone ⇒ toggle expand (any click; see AR-15)
      } else if (ev.clickCount === 2) {
        this.select(index, ev); // text double-click ⇒ activate (select + onSelect + emit)
      }
      // single text click ⇒ focus only (TV-faithful, AR-5)
    }
    ev.handled = true;
  }

  /** Apply a navigation/expand/select key; returns whether it was consumed. */
  protected handleKey(inner: KeyEvent, ev: DispatchEvent): boolean {
    const page = Math.max(1, this.viewportRows() - 1); // TV `size.y - 1` (toutline.cpp:498-501)
    switch (inner.key) {
      case 'up':
        this.focusBy(-1);
        return true;
      case 'down':
        this.focusBy(1);
        return true;
      case 'pageup':
        if (inner.ctrl)
          this.focusTo(0); // TV kbCtrlPgUp → 0
        else this.focusBy(-page);
        return true;
      case 'pagedown':
        if (inner.ctrl)
          this.focusTo(this.flatten().length - 1); // TV kbCtrlPgDn → limit.y-1
        else this.focusBy(page);
        return true;
      case 'home':
        this.focusTo(this.topItem); // TV kbHome = delta.y (top of view)
        return true;
      case 'end':
        this.focusTo(this.topItem + this.viewportRows() - 1); // TV kbEnd = delta.y + size.y - 1
        return true;
      case 'left':
        this.collapseOrParent(); // PA-12
        return true;
      case 'right':
        this.expandOrChild(); // PA-12
        return true;
      case 'enter':
        this.select(this.focused(), ev); // TV kbEnter → selected(focus)
        return true;
      case '+':
        this.mutateFocused((node) => this.expand(node)); // TV `+` adjust(node, True)
        return true;
      case '-':
        this.mutateFocused((node) => this.collapse(node)); // TV `-` adjust(node, False)
        return true;
      case '*':
        this.mutateFocused((node) => this.expandSubtree(node)); // TV `*` expandAll(node)
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
   * `←` (PA-12): collapse the focused node when it is expanded-with-children; otherwise move focus to
   * its parent (the nearest preceding row at a smaller level).
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
   * `→` (PA-12): expand the focused node when it is collapsed-with-children; otherwise, when it is
   * already expanded-with-children, descend to its first child (the next row). A leaf is a no-op.
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

  /** Select the row at `index` (TV `selected`): set `selected`, call `onSelect`, emit `command`. */
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
