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
 * has no oracle for an empty outline). Navigation keys `+`/`-`/`*`, `←`/`→`, mouse graph-toggle vs
 * text-select, and Enter land in Phase 2; Phase 1 ships draw + vertical `↑↓`/paging/wheel.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, ThemeRoleName } from '../view/index.js';
import type { Signal } from '../reactive/index.js';
import type { KeyEvent, Style } from '@jsvision/core';
import type { ScrollBar } from '../scroll/index.js';
import { clampIndex, keepVisible } from '../list/virtual.js';
import { createGraph, graphWidth, OV_EXPANDED } from './graph.js';
import type { FlatRow } from './graph.js';

/** The text drawn top-left for an empty tree (matches `ListRows` `EMPTY_TEXT`, `list-rows.ts:36`; PF-003). */
const EMPTY_TEXT = '<empty>';

/** Shared configuration handed from a {@link Tree} to its rows renderer (Phase 1 render + scroll). */
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
  /** The first visible flattened index (TV `topItem`/`delta.y`). */
  protected topItem = 0;
  /** The owned scroll bar, wired by the `Tree` (its `value` is the shared `focused` signal). */
  bar?: ScrollBar;

  /**
   * @param cfg The shared configuration (text, signals, guides, the flatten accessor).
   */
  constructor(cfg: TreeRowsConfig<T>) {
    super();
    this.getText = cfg.getText;
    this.focused = cfg.focused;
    this.selected = cfg.selected;
    this.guides = cfg.guides;
    this.flatten = cfg.flatten;

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
   * Route tree keyboard/wheel. Phase 1: wheel ±3 and vertical `↑↓`/`PgUp`/`PgDn`/`Home`/`End`
   * (TV `handleEvent` `:484-539`). The tree-specific keys (`+`/`-`/`*`, `←`/`→`, Enter) + mouse land
   * in Phase 2.
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
    if (inner.type !== 'key') return;
    if (this.handleKey(inner)) ev.handled = true;
  }

  /** Apply a vertical-navigation key; returns whether it was consumed. */
  protected handleKey(inner: KeyEvent): boolean {
    const page = Math.max(1, this.viewportRows() - 1); // TV `size.y - 1` (toutline.cpp:498-501)
    switch (inner.key) {
      case 'up':
        this.focusBy(-1);
        return true;
      case 'down':
        this.focusBy(1);
        return true;
      case 'pageup':
        this.focusBy(-page);
        return true;
      case 'pagedown':
        this.focusBy(page);
        return true;
      case 'home':
        this.focusTo(this.topItem); // TV kbHome = delta.y (top of view)
        return true;
      case 'end':
        this.focusTo(this.topItem + this.viewportRows() - 1); // TV kbEnd = delta.y + size.y - 1
        return true;
      default:
        return false;
    }
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
