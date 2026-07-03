/**
 * `GridRows<T>` + `GridHeader<T>` — the RD-16 `DataGrid` renderers: a focusable multi-column
 * virtual-scroll body and its non-scrolling sticky header. A faithful extension of Turbo Vision
 * `TListViewer` (`source/tvision/tlstview.cpp`, GATE-1 decoded + GATE-2 diffed) to N heterogeneous
 * columns.
 *
 * **TV decode (the faithful row spine):**
 *   • **`draw`** `:76-152` — for each visible row `i`, `item = topItem + i` (single column ⇒
 *     `numCols≡1`, so TV's `j*size.y` term is 0); blank the row in its colour then draw each cell's
 *     text. Row colour when the list is `(sfSelected|sfActive)`: `focused=getColor(3)`,
 *     `selected=getColor(4)`, else `normal=getColor(1)` (`:83-98`) → our `listFocused`/`listSelected`/
 *     `listNormal`. **Priority focused > selected > normal** (`:112-124` tests focus before select;
 *     the shipped `list-rows.ts:21` GATE-2 note). The colour is the ONLY focus indicator (no caret).
 *   • **`indent = hScrollBar->value`** (`:99-102`) — the horizontal cell offset. TV skips the first
 *     `indent` chars of each *cell*; our documented extension pans the whole column layout left
 *     (`x = starts[c] − indent`) so heterogeneous columns scroll as a unit (RD AR-156).
 *   • **Divider** `moveChar(curCol+colWidth-1,'\xB3',getColor(5),1)` (`:130`, AR-179) — a `│` (U+2502)
 *     in `getColor(5)`=`listDivider` at the right edge of EVERY column, drawn over the row colour.
 *   • **`emptyText`** at `curCol+1` when the list is empty (`:127-128`) → `<empty>` (AC-14).
 *   • **`handleEvent`** `:213-320` — Space→`selectItem(focused)` (`:282`); ↑↓ ±1; PgUp/PgDn
 *     `±size.y` (numCols≡1, AR-182); Home=`topItem`, End=`topItem+size.y-1`; Ctrl+PgUp=`0`,
 *     Ctrl+PgDn=`range-1` (`:308-317`). ←/→ drive the horizontal `indent` (our extension; TV uses
 *     them for `numCols>1` newspaper columns, `:302-307`).
 *
 * **jsvision extensions (behaviour + the header, not TV drawing):** the sticky `GridHeader` (TV has
 * no table class), heterogeneous per-column accessors, `{col,dir}` sort with a `▲`/`▼` indicator,
 * whole-grid H-scroll, and mouse-wheel (`±3`).
 *
 * **GATE-2 (AFTER-diff, verified against `tlstview.cpp`):** the faithful row spine matches cell by
 * cell — the row-colour selection + focus>select>normal priority (`:83-124`), the `│` divider glyph
 * (`\xB3`→U+2502) at each column's right edge in `getColor(5)`=`listDivider` (`:130`), the `emptyText`
 * at `curCol+1` (`:127-128`), `indent=hScrollBar->value` (`:99-102`), and the `handleEvent` key math
 * (`±size.y` paging, Ctrl+PgUp/Dn, Home/End, Space-select; `:296-317`). Two documented departures,
 * both flagged extensions (TV has no table class, RD AR-151), NOT drift: the whole-grid H-scroll
 * (`x=starts[c]−indent`, vs TV's per-cell char skip) and the sticky header. The `.js` extension is
 * required by NodeNext ESM.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { KeyEvent } from '@jsvision/core';
import type { Signal } from '../reactive/index.js';
import type { ScrollBar } from '../scroll/index.js';
import { stringWidth } from '../controls/measure.js';
import { clampIndex, keepVisible } from '../list/virtual.js';
import type { Column, SortState, ColumnGeometry } from './columns.js';
import { apportionColumns, alignCell } from './columns.js';

/** The text drawn once, top-left, for an empty grid (TV `emptyText`, `tlstview.cpp:127-128`). */
const EMPTY_TEXT = '<empty>';
/** The inter-column divider `│` (TV `\xB3`, `tlstview.cpp:130`). */
const DIVIDER = '│';
/** Ascending / descending sort indicators drawn in the header (jsvision extension). */
const SORT_ASC = '▲'; // ▲ BLACK UP-POINTING TRIANGLE
const SORT_DESC = '▼'; // ▼ BLACK DOWN-POINTING TRIANGLE

/**
 * The largest column index whose region contains content-space x `px` (columns tile
 * `[starts[c], starts[c]+widths[c]+1)`), or `-1` when `px` is outside all columns.
 */
function columnAt(geom: ColumnGeometry, px: number): number {
  if (px < 0 || px >= geom.totalWidth) return -1;
  for (let c = geom.starts.length - 1; c >= 0; c -= 1) {
    if (px >= geom.starts[c]) return c;
  }
  return -1;
}

/** Shared configuration handed from a `DataGrid` to its {@link GridRows}. */
export interface GridRowsConfig<T> {
  /** The sorted display rows (a `computed` in `DataGrid`; `focused`/`selected` index THIS list). */
  display: () => T[];
  /** The heterogeneous columns. */
  columns: Column<T>[];
  /** The memoized `auto` measurement (a `computed` over the source rows, PF-102). */
  autoWidths: () => (number | null)[];
  /** The horizontal cell offset (shared with the owned horizontal `ScrollBar.value`). */
  indent: Signal<number>;
  /** The focused (highlighted) display index (shared with the vertical `ScrollBar.value`). */
  focused: Signal<number>;
  /** The selected (chosen) display index (`-1` = none). */
  selected: Signal<number>;
  /** Stripe odd rows in `staticText` (below focus/selection in priority, AR-176). */
  zebra: boolean;
  /** Activation callback (Enter/Space); `index` is DISPLAY order, `row` the `T`. */
  onSelect?: (index: number, row: T) => void;
  /** Command emitted on activation (like `Button`). */
  command?: string;
}

/** The focusable, multi-column, virtual-scroll grid body — draws only the visible window. */
export class GridRows<T> extends View {
  override focusable = true;
  protected readonly display: () => T[];
  protected readonly columns: Column<T>[];
  protected readonly autoWidths: () => (number | null)[];
  protected readonly indent: Signal<number>;
  protected readonly focused: Signal<number>;
  protected readonly selected: Signal<number>;
  protected readonly zebra: boolean;
  protected readonly onSelect?: (index: number, row: T) => void;
  protected readonly command?: string;
  /** The first visible display index (TV `topItem`). */
  protected topItem = 0;
  /** The owned vertical scroll bar (its `value` is the shared `focused`); re-limited each draw. */
  vbar?: ScrollBar;
  /** The owned horizontal scroll bar (its `value` is the shared `indent`); re-limited each draw. */
  hbar?: ScrollBar;

  /**
   * @param cfg The shared grid configuration (display, columns, geometry, signals, callbacks).
   */
  constructor(cfg: GridRowsConfig<T>) {
    super();
    this.display = cfg.display;
    this.columns = cfg.columns;
    this.autoWidths = cfg.autoWidths;
    this.indent = cfg.indent;
    this.focused = cfg.focused;
    this.selected = cfg.selected;
    this.zebra = cfg.zebra;
    this.onSelect = cfg.onSelect;
    this.command = cfg.command;

    this.onMount(() => {
      // Keep the focused item visible + repaint when focus moves (a key/click/wheel or a bar drag).
      this.bind(
        () => this.focused(),
        () => this.updateTop(),
      );
      // On a rows/sort change (the display array is a fresh reference on any reorder OR length
      // change): clamp focused into the new range (TV `newList`), keep it visible, and repaint — a
      // pure reorder keeps the length but must still repaint the reordered rows.
      this.bind(
        () => this.display(),
        () => {
          this.clampFocusedToRange();
          this.updateTop();
        },
      );
      // Repaint on selection + H-scroll changes.
      this.bind(
        () => this.selected(),
        () => undefined,
      );
      this.bind(
        () => this.indent(),
        () => undefined,
      );
    });
  }

  /** The number of visible rows (the renderer's laid-out height). */
  protected viewportRows(): number {
    return this.bounds.height;
  }

  /** The column geometry for the current viewport width + memoized auto widths (O(cols), per call). */
  protected geometry(width: number): ColumnGeometry {
    return apportionColumns(this.columns, this.autoWidths(), width);
  }

  /** Recompute `topItem` to keep the (clamped) focused item visible. */
  protected updateTop(): void {
    const range = this.display().length;
    const focused = clampIndex(this.focused(), range);
    this.topItem = keepVisible(focused, this.topItem, this.viewportRows(), range);
  }

  /** Clamp the focused signal into the current range (TV `focusItemNum`/`newList`). */
  protected clampFocusedToRange(): void {
    const range = this.display().length;
    const clamped = clampIndex(this.focused(), range);
    if (clamped !== this.focused()) this.focused.set(clamped);
  }

  /**
   * Paint the visible window (TV `draw`): re-limit both bars, keep the focus visible, then draw each
   * row in its resolved colour with every column's aligned cell + a right-edge divider.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const rows = ctx.size.height;
    const width = ctx.size.width;
    const display = this.display();
    const range = display.length;
    const geom = this.geometry(width);
    // TV setRange: vbar value = focused, range [0, range-1], page keeps one row of context.
    this.vbar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));
    const maxIndent = Math.max(0, geom.totalWidth - width);
    this.hbar?.setRange(0, maxIndent, Math.max(1, width - 1));
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));

    const normal = ctx.color('listNormal');
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // TV emptyText at curCol+1 (tlstview.cpp:127-128)
      return;
    }

    const focused = clampIndex(this.focused(), range);
    this.topItem = keepVisible(focused, this.topItem, rows, range);
    const active = this.state.focused;
    const selected = this.selected();
    const divider = ctx.color('listDivider');

    for (let i = 0; i < rows; i += 1) {
      const item = this.topItem + i;
      if (item >= range) {
        ctx.fillRect(0, i, width, 1, ' ', normal); // blank trailing row
        continue;
      }
      // Priority focused > selected > zebra > normal (TV draw tests focus before select, :112-124).
      const roleName =
        item === focused
          ? active
            ? 'listFocused'
            : 'listSelected'
          : item === selected
            ? 'listSelected'
            : this.zebra && (item & 1) === 1
              ? 'staticText' // AR-176 odd-row stripe
              : 'listNormal';
      const style = ctx.color(roleName);
      ctx.fillRect(0, i, width, 1, ' ', style); // blank the row in its colour
      const row = display[item];
      for (let c = 0; c < this.columns.length; c += 1) {
        const col = this.columns[c];
        const x = geom.starts[c] - indent;
        const cell = alignCell(col.accessor(row), geom.widths[c], col.align ?? 'left', stringWidth);
        ctx.text(x, i, cell, style); // ctx clips off-screen cells (H-scroll)
        ctx.text(x + geom.widths[c], i, DIVIDER, divider); // divider at the column right edge
      }
    }
  }

  /**
   * Route grid keyboard/mouse/wheel (TV `handleEvent` + the jsvision extensions).
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
      const local = ev.local;
      if (local === undefined) return;
      const range = this.display().length;
      if (range > 0) {
        // A click below the last row focuses/selects the LAST item (TV `focusItemNum` clamp).
        const newItem = Math.min(this.topItem + local.y, range - 1);
        this.focusTo(newItem);
        this.select(newItem); // a row click focuses + selects (no emit — AR-177)
      }
      ev.handled = true;
      return;
    }
    if (inner.type !== 'key') return;
    if (this.handleKey(inner, ev)) ev.handled = true;
  }

  /** Apply a navigation / H-scroll / activation key; returns whether it was consumed. */
  protected handleKey(inner: KeyEvent, ev: DispatchEvent): boolean {
    const rows = this.viewportRows();
    switch (inner.key) {
      case 'up':
        this.focusBy(-1);
        return true;
      case 'down':
        this.focusBy(1);
        return true;
      case 'pageup':
        if (inner.ctrl) this.focusTo(0);
        else this.focusBy(-rows);
        return true;
      case 'pagedown':
        if (inner.ctrl) this.focusTo(this.display().length - 1);
        else this.focusBy(rows);
        return true;
      case 'home':
        this.focusTo(this.topItem);
        return true;
      case 'end':
        this.focusTo(this.topItem + rows - 1);
        return true;
      case 'left':
        this.indentBy(-1);
        return true;
      case 'right':
        this.indentBy(1);
        return true;
      case 'enter':
      case 'space':
        this.activate(ev);
        return true;
      default:
        return false;
    }
  }

  /** Move focus by `delta` rows (clamped into range by the bind). */
  protected focusBy(delta: number): void {
    this.focusTo(this.focused() + delta);
  }

  /** Focus the given display index, clamped into range (the bind updates `topItem` + repaints). */
  protected focusTo(index: number): void {
    this.focused.set(clampIndex(index, this.display().length));
  }

  /** Step the horizontal indent by `delta`, clamped to `[0, totalWidth − viewportWidth]`. */
  protected indentBy(delta: number): void {
    const geom = this.geometry(this.bounds.width);
    const maxIndent = Math.max(0, geom.totalWidth - this.bounds.width);
    const next = Math.min(maxIndent, Math.max(0, this.indent() + delta));
    if (next !== this.indent()) this.indent.set(next);
  }

  /** Set the selected (chosen) index (visual selection). */
  protected select(index: number): void {
    this.selected.set(index);
  }

  /** Activate the focused row: select it, call `onSelect`, emit `command` (Enter/Space). */
  protected activate(ev: DispatchEvent): void {
    const display = this.display();
    const index = this.focused();
    if (index < 0 || index >= display.length) return;
    this.select(index);
    this.onSelect?.(index, display[index]);
    if (this.command !== undefined) ev.emit?.(this.command);
  }
}

/** Shared configuration handed from a `DataGrid` to its {@link GridHeader}. */
export interface GridHeaderConfig<T> {
  /** The heterogeneous columns. */
  columns: Column<T>[];
  /** The memoized `auto` measurement (shared with {@link GridRows} — identical geometry, PF-101). */
  autoWidths: () => (number | null)[];
  /** The horizontal cell offset (shared with the rows — the header pans in lockstep). */
  indent: Signal<number>;
  /** The active sort (this view draws its `▲`/`▼` indicator + a header click toggles it). */
  sort: Signal<SortState>;
}

/** The non-scrolling sticky header: column titles in `tableHeader`, a sort indicator, click-to-sort. */
export class GridHeader<T> extends View {
  override focusable = false; // passive chrome — the rows renderer owns the keys
  protected readonly columns: Column<T>[];
  protected readonly autoWidths: () => (number | null)[];
  protected readonly indent: Signal<number>;
  protected readonly sort: Signal<SortState>;

  /**
   * @param cfg The shared header configuration (columns, geometry, indent, sort).
   */
  constructor(cfg: GridHeaderConfig<T>) {
    super();
    this.columns = cfg.columns;
    this.autoWidths = cfg.autoWidths;
    this.indent = cfg.indent;
    this.sort = cfg.sort;
    this.onMount(() => {
      this.bind(
        () => this.sort(),
        () => undefined,
      );
      this.bind(
        () => this.indent(),
        () => undefined,
      );
    });
  }

  /** The column geometry for the current viewport width (identical inputs to {@link GridRows}). */
  protected geometry(width: number): ColumnGeometry {
    return apportionColumns(this.columns, this.autoWidths(), width);
  }

  /**
   * Draw the header row: blank in `tableHeader`, each title left-aligned with a right-edge `│`
   * divider; the active sort column reserves its last content cell for the `▲`/`▼` indicator (so the
   * arrow is visible even when the column width equals the title width, PF-103).
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const width = ctx.size.width;
    const geom = this.geometry(width);
    const maxIndent = Math.max(0, geom.totalWidth - width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const header = ctx.color('tableHeader');
    const divider = ctx.color('listDivider');
    const sort = this.sort();

    ctx.fill(' ', header); // blank the header row in the tableHeader colour
    for (let c = 0; c < this.columns.length; c += 1) {
      const col = this.columns[c];
      const w = geom.widths[c];
      const x = geom.starts[c] - indent;
      if (sort !== null && sort.col === c && w > 0) {
        // Reserve the last content cell for the arrow; clip the title to width−1 (PF-103).
        ctx.text(x, 0, alignCell(col.title, w - 1, 'left', stringWidth), header);
        ctx.text(x + w - 1, 0, sort.dir === 'asc' ? SORT_ASC : SORT_DESC, header);
      } else {
        ctx.text(x, 0, alignCell(col.title, w, 'left', stringWidth), header);
      }
      ctx.text(x + w, 0, DIVIDER, divider); // divider at the column right edge
    }
  }

  /**
   * A header click maps `local.x` (+ the H-indent) to a column and toggles its sort: a fresh column
   * sorts ascending; re-clicking the active column flips asc↔desc (AC-6, AR-158).
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse' || inner.kind !== 'down') return;
    const local = ev.local;
    if (local === undefined) return;
    const geom = this.geometry(this.bounds.width);
    const maxIndent = Math.max(0, geom.totalWidth - this.bounds.width);
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));
    const c = columnAt(geom, local.x + indent);
    if (c >= 0) {
      const cur = this.sort();
      if (cur !== null && cur.col === c) {
        this.sort.set({ col: c, dir: cur.dir === 'asc' ? 'desc' : 'asc' });
      } else {
        this.sort.set({ col: c, dir: 'asc' });
      }
    }
    ev.handled = true;
  }
}
