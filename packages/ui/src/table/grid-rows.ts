/**
 * `GridRows<T>` + `GridHeader<T>` — the two renderers behind `DataGrid`: a focusable, multi-column,
 * virtual-scrolling body and its non-scrolling sticky header. Both are internal; construct a
 * {@link DataGrid} rather than using these directly.
 *
 * How the body draws each frame:
 *   • Only the visible window of rows is painted (virtual scroll), so a grid over thousands of rows
 *     stays cheap.
 *   • Each row is blanked in its resolved colour, then every column's aligned cell is drawn, then a
 *     `│` divider at the column's right edge. Row colour priority is focused > selected > zebra
 *     stripe > normal; colour is the only focus indicator (there is no caret).
 *   • Horizontal scroll pans the whole column layout left as a unit (`x = starts[c] − indent`), so
 *     heterogeneous columns scroll together and stay aligned.
 *   • An empty grid shows `<empty>` at the top-left.
 *
 * Keyboard (body): ↑↓ move focus ±1, PgUp/PgDn page by the viewport height, Home/End jump within the
 * visible window, Ctrl+PgUp/PgDn jump to the first/last row, ←→ scroll horizontally, Enter/Space
 * activate. Mouse: click focuses + selects a row, double-click activates, wheel scrolls ±3.
 *
 * The header draws the column titles, a `▲`/`▼` sort indicator on the active sort column, and toggles
 * that column's sort on click.
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

/** The text drawn once, top-left, for an empty grid. */
const EMPTY_TEXT = '<empty>';
/** The inter-column divider `│` drawn at each column's right edge. */
const DIVIDER = '│';
/** Ascending / descending sort indicators drawn in the active header column. */
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
  /** The memoized `auto`-width measurement (a `computed` over the source rows). */
  autoWidths: () => (number | null)[];
  /** The horizontal cell offset (shared with the owned horizontal scroll bar's value). */
  indent: Signal<number>;
  /** The focused (highlighted) display index (shared with the vertical scroll bar's value). */
  focused: Signal<number>;
  /** The selected (chosen) display index (`-1` = none). */
  selected: Signal<number>;
  /** Stripe odd rows for readability (below focus/selection in priority). */
  zebra: boolean;
  /** Activation callback (Enter/Space or double-click); `index` is display order, `row` the value. */
  onSelect?: (index: number, row: T) => void;
  /** Command name emitted on activation, handled elsewhere. */
  command?: string;
}

/**
 * The focusable, multi-column, virtual-scroll grid body — draws only the visible window.
 *
 * @example
 * ```ts
 * import { GridRows, signal } from '@jsvision/ui';
 * const rows = new GridRows({
 *   display: () => [{ name: 'Ada' }, { name: 'Bo' }],
 *   columns: [{ title: 'Name', accessor: (r) => r.name, width: '1fr' }],
 *   autoWidths: () => [null],
 *   indent: signal(0),
 *   focused: signal(0),
 *   selected: signal(-1),
 *   zebra: true,
 * });
 * // Mount `rows` in a RenderRoot / event loop and focus it — colour marks the focused row.
 * ```
 */
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
  /** The display index of the first visible row. */
  protected topItem = 0;
  /** The owned vertical scroll bar (its `value` is the shared `focused`); its range is re-limited each draw. */
  vbar?: ScrollBar;
  /** The owned horizontal scroll bar (its `value` is the shared `indent`); its range is re-limited each draw. */
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
      // change): clamp focused into the new range, keep it visible, and repaint — a pure reorder
      // keeps the same length but must still repaint the reordered rows.
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

  /** Clamp the focused signal into the current range after the row set changes. */
  protected clampFocusedToRange(): void {
    const range = this.display().length;
    const clamped = clampIndex(this.focused(), range);
    if (clamped !== this.focused()) this.focused.set(clamped);
  }

  /**
   * Paint the visible window: re-limit both scroll bars, keep the focused row visible, then draw each
   * row in its resolved colour with every column's aligned cell and a right-edge divider.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const rows = ctx.size.height;
    const width = ctx.size.width;
    const display = this.display();
    const range = display.length;
    const geom = this.geometry(width);
    // Vertical bar: value = focused, range [0, range-1], page keeps one row of context.
    this.vbar?.setRange(0, Math.max(0, range - 1), Math.max(1, rows - 1));
    const maxIndent = Math.max(0, geom.totalWidth - width);
    this.hbar?.setRange(0, maxIndent, Math.max(1, width - 1));
    const indent = Math.min(maxIndent, Math.max(0, this.indent()));

    const normal = ctx.color('listNormal');
    if (range === 0) {
      ctx.fill(' ', normal);
      ctx.text(1, 0, EMPTY_TEXT, normal); // <empty> placeholder, one cell in from the left
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
      // Row colour priority: focused > selected > zebra stripe > normal.
      const roleName =
        item === focused
          ? active
            ? 'listFocused'
            : 'listSelected'
          : item === selected
            ? 'listSelected'
            : this.zebra && (item & 1) === 1
              ? 'staticText' // odd-row stripe
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
   * Route grid keyboard, mouse, and wheel events.
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
        // A click below the last row focuses/selects the last item.
        const newItem = Math.min(this.topItem + local.y, range - 1);
        this.focusTo(newItem);
        this.select(newItem); // a single click focuses + selects (does not activate)
        // Double-click activates. The event loop stamps `ev.clickCount` on the mouse-down.
        if (ev.clickCount === 2) this.activate(ev);
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
  /** The memoized `auto`-width measurement (shared with {@link GridRows} so both use identical geometry). */
  autoWidths: () => (number | null)[];
  /** The horizontal cell offset (shared with the rows — the header pans in lockstep). */
  indent: Signal<number>;
  /** The active sort (this view draws its `▲`/`▼` indicator + a header click toggles it). */
  sort: Signal<SortState>;
}

/**
 * The non-scrolling sticky header: column titles in `tableHeader`, a sort indicator, click-to-sort.
 *
 * @example
 * ```ts
 * import { GridHeader, signal } from '@jsvision/ui';
 * import type { SortState } from '@jsvision/ui';
 *
 * interface Person {
 *   name: string;
 * }
 *
 * // Name the row type explicitly: unlike GridRows, the header takes no rows, so there is nothing
 * // for it to be inferred from — leave it off and the accessor's argument lands as `unknown`.
 * const header = new GridHeader<Person>({
 *   columns: [{ title: 'Name', accessor: (r) => r.name, width: '1fr' }],
 *   autoWidths: () => [null],
 *   indent: signal(0),
 *   sort: signal<SortState>({ col: 0, dir: 'asc' }),
 * });
 * // Share `autoWidths`/`indent` with a GridRows so header and body stay column-aligned.
 * ```
 */
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
   * Draw the header row: blank it in the header colour, each title left-aligned with a right-edge `│`
   * divider. The active sort column reserves its last content cell for the `▲`/`▼` indicator, so the
   * arrow stays visible even when the column width equals the title width.
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
        // Reserve the last content cell for the arrow; clip the title to width−1.
        ctx.text(x, 0, alignCell(col.title, w - 1, 'left', stringWidth), header);
        ctx.text(x + w - 1, 0, sort.dir === 'asc' ? SORT_ASC : SORT_DESC, header);
      } else {
        ctx.text(x, 0, alignCell(col.title, w, 'left', stringWidth), header);
      }
      ctx.text(x + w, 0, DIVIDER, divider); // divider at the column right edge
    }
  }

  /**
   * A header click maps the click column (plus the horizontal offset) to a column and toggles its
   * sort: clicking a new column sorts ascending; re-clicking the active column flips asc↔desc.
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
