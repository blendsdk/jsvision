/**
 * Body assembly for {@link EditableDataGrid} — turns a resolved {@link FreezePartition} into the stack
 * of header / body / scroll-bar bands, in one of two shapes:
 *
 * - **No freeze** → a single {@link SortHeader} + a single {@link EditableGridRows} over the visible
 *   columns (the original, unchanged layout). This path is byte-identical to the pre-freeze grid.
 * - **Frozen** → left / center / right panels that share one row cursor, one vertical scroll, and one
 *   *global* column cursor. Only the center panel scrolls horizontally (it binds the shared `indent`);
 *   the frozen panels bind a constant `0`. A {@link FreezeDivider} marks each freeze boundary, and the
 *   header stays sticky above every panel. The shared column cursor is linear: it crosses the freeze
 *   boundary via the `onCursorEnterPanel` focus hop, so ← / → and `Ctrl+Home`/`End` span the whole grid.
 *
 * The container owns every shared signal and passes it in via {@link GridBodyDeps}; this module never
 * reaches back into the grid, so both shapes are pure assembly.
 */
import { Group, ScrollBar, View, signal } from '@jsvision/ui';
import type { Column, DispatchEvent, DrawContext, LayoutProps, Signal } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import type { FreezePartition } from './column-model.js';
import type { Key, TriState } from './selection.js';
import type { SortKey } from './sort.js';
import type { FilterModel } from './filter.js';
import type { OnCommit } from './commit.js';
import type { DirtyRegistry } from './editing.js';
import type { GridKeymap } from './keymap.js';
import { SortHeader } from './sort-header.js';
import { QuickFilterRow } from './quick-filter-row.js';
import { EditableGridRows } from './editable-grid-rows.js';
import { prefixWidth, SyntheticHeaderBand, SyntheticBodyBand } from './synthetic-columns.js';
import type { SyntheticPrefix } from './synthetic-columns.js';
import { FooterBand } from './footer-band.js';

/**
 * Everything {@link buildGridBody} needs from the container: the shared reactive state, the column
 * resolution helpers, the sort/filter models and their sinks, the editing wiring, and the two scroll
 * bars. All columns are addressed by id and resolved through `columnIndex`/`columnMap`/`autoWidths`,
 * so a panel renders any slice of the visible order without the container pre-slicing anything.
 */
export interface GridBodyDeps<T> {
  /** Shared row cursor (all panels bind it → one highlighted row across the freeze boundary). */
  focused: Signal<number>;
  /** Shared global column cursor over `[0, totalCols)` (a panel owns `[offset, offset+count)`). */
  focusedCol: Signal<number>;
  /** The merged chord→action keymap (computed once by the container), shared by every panel. */
  keymap: GridKeymap;
  /** Shared selection index (the base's required click sink — kept, but not the paint driver). */
  selected: Signal<number>;
  /** Shared datagrid selection set, keyed by `rowKey` — every panel paints its `selected` role from it. */
  selectedKeys: Signal<ReadonlySet<Key>>;
  /** Toggle-row sink (`Space` on a read-only cell / `Ctrl`+click) — the container moves the cursor + toggles. */
  onToggleRow: (rowIndex: number) => void;
  /** Range-extend sink (`Shift`+click / `Shift`+↑↓) — the container moves the cursor + unions the run. */
  onRangeToRow: (rowIndex: number) => void;
  /** The synthetic-prefix spec (checkbox / row-number gutter + row count). `prefixWidth` 0 ⇒ no band. */
  prefix: SyntheticPrefix;
  /** The header tri-state over the current display (drives the header checkbox glyph). */
  triState: () => TriState;
  /** Header-checkbox click sink — the container toggles select-all / clear by the current tri-state. */
  onToggleAll: () => void;
  /** Shared horizontal scroll offset — bound only by the center panel; frozen panels bind a constant `0`. */
  indent: Signal<number>;
  /** The materialized, sorted+filtered display rows (shared by every panel). */
  display: () => T[];
  /** Row identity (from the data source). */
  rowKey: (row: T) => string | number;
  /** The engine columns in original author order (indexed via `columnIndex`). */
  engineCols: Column<T>[];
  /** id → original column index, to resolve a visible-id slice back to its engine/auto-width entry. */
  columnIndex: ReadonlyMap<string, number>;
  /** id → typed column (parse/set/format), to slice a panel's typed columns. */
  columnMap: ReadonlyMap<string, GridColumn<T>>;
  /** The memoized auto-width measurement over `engineCols` (indexed like `engineCols`). */
  autoWidths: () => (number | null)[];
  /** A column's resolved width in cells (override → fixed → auto → title), to size a frozen band. */
  resolvedWidth: (id: string) => number;
  /**
   * A column's explicit width override in cells, or `undefined` when none is set. Reactive — the panel
   * columns' `width` reads it so a live resize re-apportions without a rebuild. Unlike `resolvedWidth`
   * it preserves a column's original `'auto'`/`fr` kind when there is no override.
   */
  widthOverride: (id: string) => number | undefined;
  /** Reactive width-override trigger — bound by every header + body for repaint on a live resize. */
  widthTick: () => unknown;
  /** Stripe odd rows. */
  zebra: boolean;
  /** Compact density — drop the inter-column divider across every band (header, panels, quick-filter). */
  compact: boolean;
  /**
   * Pin the first N rows as a non-scrolling band below the header (0 = no band). Every body panel floors
   * its window at N; a parallel pinned band renders rows `[0, N)`, so a pinned row never scrolls or duplicates.
   */
  freezeRows: number;
  /** The container's sort model (read by every header). */
  sort: Signal<SortKey[]>;
  /** The container's filter model (read by every header). */
  filters: Signal<FilterModel>;
  /** Header click sink (sort). */
  onHeaderClick: (columnId: string, additive: boolean) => void;
  /**
   * Funnel click sink (open filter popup). Carries the clicked {@link SortHeader} so the popup anchors
   * to the panel header that owns the funnel — in a frozen grid the three headers have different origins.
   */
  onFunnelClick: (columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent, header: SortHeader<T>) => void;
  /** Live column-resize sink (a captured grip drag) — routes to the container's `setColumnWidth`. */
  onColumnResize: (columnId: string, width: number) => void;
  /** Grip double-click sink — routes to the container's `autoFitColumn`. */
  onColumnAutoFit: (columnId: string) => void;
  /**
   * Committed column-reorder sink (a title press-drag-drop) — the `from`/`to` indices in the global
   * visible order. Routes to the container's panel-constrained reorder. Each header adds its panel's
   * `columnOffset` so a panel-local drag reports global indices.
   */
  onColumnReorder: (fromVisible: number, toVisible: number) => void;
  /** Reorder-start sink — fired once when a title press becomes a drag; the container reverts the on-down sort. */
  onReorderStart: () => void;
  /** Whether the opt-in quick-filter band is shown. */
  quickFilter: boolean;
  /** Quick-filter text sink (empty text ⇒ clear that column's filter). */
  onQuickFilter: (columnId: string, text: string) => void;
  /**
   * Open-filter sink for the body's `Alt+Down`: the GLOBAL focused column index + the live envelope.
   * The container maps the column to its id + owning header and opens the condition popup.
   */
  onOpenFilter: (globalCol: number, ev: DispatchEvent) => void;
  /** The editor mount host (the container's absolute overlay). */
  overlay: Group;
  /** The per-cell veto sink. */
  onCommit?: OnCommit<T>;
  /** Bump-on-write repaint hook. */
  bumpVersion: () => void;
  /** The shared dirty registry. */
  dirty: DirtyRegistry;
  /** The vertical scroll bar (bound by the center/only body). */
  vbar: ScrollBar;
  /** The horizontal scroll bar (bound by the center/only body). */
  hbar: ScrollBar;
  /**
   * The footer aggregate-cell accessor (the footer controller's on-demand fold), or `undefined` for no
   * aggregate row. When present, a sticky, column-aligned aggregate band is assembled below the body.
   */
  footerCell?: (columnId: string) => string;
  /**
   * The caller's free-form footer widgets, or `undefined`/empty for no widget row. When non-empty, a flow
   * row hosting them (spanning the full band width) is assembled below the aggregate row.
   */
  footerWidgets?: readonly View[];
}

/** The assembled body: the inner band stack plus the panels/headers and the focusable (center/only) body. */
export interface GridBodyParts<T> {
  /** The column container holding every band — added behind the grid's overlays. */
  inner: Group;
  /** Every body panel (one when not frozen; left/center/right when frozen). */
  panels: EditableGridRows<T>[];
  /** Every header panel, parallel to {@link panels}. */
  headers: SortHeader<T>[];
  /** The focusable body — the center panel when frozen, the single body otherwise. */
  center: EditableGridRows<T>;
}

const fr: LayoutProps = { size: { kind: 'fr', weight: 1 } };
const fixed1: LayoutProps = { size: { kind: 'fixed', cells: 1 } };

/** A one-cell corner filler that squares off the scroll-bar gutter (matches the engine's table chrome). */
function corner(): Group {
  const cell = new Group();
  cell.background = 'scrollBarPage';
  cell.layout = fixed1;
  return cell;
}

/**
 * A one-cell-wide vertical `│` rule drawn between two frozen panels. Passive chrome — it paints the
 * `listDivider` glyph down its whole height so the freeze boundary reads as a continuous line beside
 * the body rows, mirroring the inter-column dividers the body itself draws.
 */
class FreezeDivider extends View {
  override focusable = false;
  draw(ctx: DrawContext): void {
    const style = ctx.color('listDivider');
    for (let y = 0; y < ctx.size.height; y += 1) ctx.text(0, y, '│', style);
  }
}

/**
 * The fixed band width for a frozen panel: the sum of its columns' resolved widths plus one divider
 * cell between each pair (none in compact density) — no trailing gutter, since the {@link FreezeDivider}
 * provides the boundary. Sizing the band this tight makes the panel apportion its columns at exactly
 * their resolved widths.
 */
function panelBandWidth(ids: string[], resolvedWidth: (id: string) => number, compact: boolean): number {
  let sum = 0;
  for (const id of ids) sum += resolvedWidth(id);
  return sum + (compact ? 0 : Math.max(0, ids.length - 1));
}

/**
 * Grid-wide focus predicate for the frozen panels: true when *any* panel holds focus. Reading each
 * panel's `focusSignal()` subscribes the calling panel's draw to every panel's focus tick, so a focus
 * flip on one panel repaints them all — that is what lets the shared row highlight and cursor light up
 * across the freeze boundary even though only one view actually holds the keyboard.
 */
function anyPanelFocused<T>(panels: EditableGridRows<T>[]): boolean {
  let any = false;
  for (const p of panels) {
    p.focusSignal()(); // subscribe (reactive) — do not short-circuit, every panel must be observed
    if (p.state.focused) any = true;
  }
  return any;
}

/** A horizontal band (fixed one row tall) — the header/quick-filter/scroll-bar rows are all this shape. */
function bandRow(): Group {
  const g = new Group();
  g.layout = { direction: 'row', size: { kind: 'fixed', cells: 1 } };
  return g;
}

/**
 * Assemble the grid body from a resolved partition — a single body when not frozen, or left/center/right
 * frozen panels sharing one cursor/scroll otherwise. See the module overview for the two shapes.
 *
 * @param part The resolved left/center/right partition (over-pinned columns already folded into center).
 * @param deps The container-owned shared state, column resolution, models, editing wiring, and bars.
 * @returns The inner band stack plus the panels/headers and the focusable body (center/only).
 */
export function buildGridBody<T>(part: FreezePartition, deps: GridBodyDeps<T>): GridBodyParts<T> {
  const frozen = part.left.length > 0 || part.right.length > 0;
  const total = part.left.length + part.center.length + part.right.length;
  const fullVisible = [...part.left, ...part.center, ...part.right];

  const panels: EditableGridRows<T>[] = [];
  const bands: EditableGridRows<T>[] = []; // pinned frozen-rows band panels (parallel to `panels`)
  const headers: SortHeader<T>[] = [];
  const freezeRows = Math.max(0, deps.freezeRows);
  // When columns OR rows are frozen the row highlight / cursor / dirty markers key on grid-wide focus so
  // a pinned band (or a sibling column panel) lights up while the scrolling body holds the keyboard. A
  // plain single body keeps its own focus and never hops — byte-identical to the pre-freeze grid.
  const gridActive = frozen || freezeRows > 0 ? (): boolean => anyPanelFocused(panels) : undefined;
  const hop = frozen
    ? (globalCol: number, ev: DispatchEvent): void => {
        const owner = panels.find((p) => globalCol >= p.columnOffset && globalCol < p.columnOffset + p.columnCount);
        if (owner) ev.focusView?.(owner);
      }
    : undefined;

  // Each panel column wraps its engine column with an override-aware `width` getter: apportionColumns
  // reads `col.width` on every (reactive) draw, so reading the override signal there makes a live resize
  // re-apportion with no rebuild. With no override the original width kind (`number`/`'auto'`/fr) passes
  // through unchanged, so a non-resized grid is byte-identical.
  const engineOf = (id: string): Column<T> => {
    const base = deps.engineCols[deps.columnIndex.get(id) ?? 0];
    return {
      ...base,
      get width() {
        const o = deps.widthOverride(id);
        return o !== undefined ? o : base.width;
      },
    };
  };
  const sliceCols = (ids: string[]): Column<T>[] => ids.map(engineOf);
  const sliceTyped = (ids: string[]): GridColumn<T>[] => ids.map((id) => deps.columnMap.get(id)!);
  // Each slice's filterability, parallel to `ids`: a column filters unless it opts out with
  // `filterable: false`. Derived from the same `columnMap` as `sliceTyped`, so the funnel, the
  // quick-filter band, and the keyboard opener all read one consistent per-column gate.
  const sliceFilterable = (ids: string[]): boolean[] => ids.map((id) => deps.columnMap.get(id)?.filterable !== false);
  // Each slice's always-visible-funnel opt-in, parallel to `ids`. A column shows its funnel only while
  // filtered unless it opts in with `showFunnel: true`. Same `columnMap` source as `sliceFilterable`.
  const sliceShowFunnel = (ids: string[]): boolean[] => ids.map((id) => deps.columnMap.get(id)?.showFunnel === true);
  // A per-slice auto-width reader: reindexes the shared measurement into this slice's local order, and
  // stays reactive (it reads `deps.autoWidths()` on each call, so a re-measure repaints the panel).
  const sliceAuto = (ids: string[]) => (): (number | null)[] => {
    const aw = deps.autoWidths();
    return ids.map((id) => aw[deps.columnIndex.get(id) ?? 0]);
  };

  const makeHeader = (ids: string[], indent: Signal<number>, offset: number): SortHeader<T> => {
    const header: SortHeader<T> = new SortHeader<T>({
      columns: sliceCols(ids),
      columnIds: ids,
      autoWidths: sliceAuto(ids),
      indent,
      sort: deps.sort,
      onHeaderClick: deps.onHeaderClick,
      filterModel: deps.filters,
      // Capture this header so the popup anchors on the panel that owns the clicked funnel (in a frozen
      // grid the three headers sit at different origins, so the anchor must be the header that was clicked).
      onFunnelClick: (columnId, anchor, ev) => deps.onFunnelClick(columnId, anchor, ev, header),
      onColumnResize: deps.onColumnResize,
      onColumnAutoFit: deps.onColumnAutoFit,
      widthTick: deps.widthTick,
      onColumnReorder: deps.onColumnReorder,
      onReorderStart: deps.onReorderStart,
      columnOffset: offset, // this panel's start in the global visible order — maps local drops to global
      compact: deps.compact,
      filterable: sliceFilterable(ids), // per-panel filterability → the funnel draw + hit-test gate
      showFunnel: sliceShowFunnel(ids), // per-panel always-visible-funnel opt-in
    });
    headers.push(header);
    return header;
  };

  const makeBody = (
    ids: string[],
    indent: Signal<number>,
    offset: number,
    autoScroll: boolean,
  ): EditableGridRows<T> => {
    const body = new EditableGridRows<T>({
      display: deps.display,
      columns: sliceCols(ids),
      autoWidths: sliceAuto(ids),
      indent,
      focused: deps.focused,
      selected: deps.selected,
      selectedKeys: deps.selectedKeys,
      onToggleRow: deps.onToggleRow,
      onRangeToRow: deps.onRangeToRow,
      zebra: deps.zebra,
      focusedCol: deps.focusedCol,
      keymap: deps.keymap,
      typedColumns: sliceTyped(ids),
      overlay: deps.overlay,
      onCommit: deps.onCommit,
      rowKey: deps.rowKey,
      bumpVersion: deps.bumpVersion,
      dirty: deps.dirty,
      columnOffset: offset,
      totalCols: () => total,
      onCursorEnterPanel: hop,
      onOpenFilter: deps.onOpenFilter, // Alt+Down → the container resolves the owning header + opens the popup
      mouseColumns: frozen,
      autoScrollColumns: autoScroll,
      panelActive: gridActive,
      widthTick: deps.widthTick,
      compact: deps.compact,
      rowFloor: deps.freezeRows, // scrolling body: its window starts after the N pinned rows
    });
    panels.push(body);
    return body;
  };

  // A pinned frozen-rows band panel: it renders the first N rows (`rowFloor: 0, rowCeil: 0` → never
  // scrolls) sharing the body's cursor/selection so a pinned row lights up here. Passive — the scrolling
  // body owns the keyboard; a click still moves the shared cursor onto a pinned row. Not registered in
  // `panels` (it is neither a focus source for `gridActive` nor a hop target).
  const makeBand = (ids: string[], indent: Signal<number>, offset: number): EditableGridRows<T> => {
    const band = new EditableGridRows<T>({
      display: deps.display,
      columns: sliceCols(ids),
      autoWidths: sliceAuto(ids),
      indent,
      focused: deps.focused,
      selected: deps.selected,
      selectedKeys: deps.selectedKeys,
      onToggleRow: deps.onToggleRow,
      onRangeToRow: deps.onRangeToRow,
      zebra: deps.zebra,
      focusedCol: deps.focusedCol,
      keymap: deps.keymap,
      typedColumns: sliceTyped(ids),
      overlay: deps.overlay,
      onCommit: deps.onCommit,
      rowKey: deps.rowKey,
      bumpVersion: deps.bumpVersion,
      dirty: deps.dirty,
      columnOffset: offset,
      totalCols: () => total,
      mouseColumns: frozen,
      autoScrollColumns: false,
      panelActive: gridActive,
      widthTick: deps.widthTick,
      compact: deps.compact,
      rowFloor: 0,
      rowCeil: 0, // pin to the top — the band never scrolls off the first N rows
    });
    band.focusable = false; // passive: mirrors the cursor, but the scrolling body holds the keyboard
    bands.push(band);
    return band;
  };

  // The horizontal bands share one column container; the grid's own `layout` prop stays free for the
  // parent to place the whole grid (an absolute rect or an `fr` flow slot).
  const inner = new Group();
  inner.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };

  const headerRow = bandRow();
  const bodyRow = new Group();
  bodyRow.layout = { direction: 'row', size: { kind: 'fr', weight: 1 } };
  // The pinned frozen-rows band row (built only when freezeRows > 0), `freezeRows` cells tall.
  const freezeRowsRow = new Group();
  freezeRowsRow.layout = { direction: 'row', size: { kind: 'fixed', cells: freezeRows } };

  // One segment list drives every row (header, pinned band, body): the center pans, frozen columns don't.
  // A single, unfrozen grid is exactly one center seg with `fr` layout and no dividers — the original path.
  const zero = signal(0); // frozen column panels never pan horizontally
  interface Seg {
    ids: string[];
    indent: Signal<number>;
    offset: number;
    autoScroll: boolean;
    fixed: boolean;
  }
  const segs: Seg[] = [];
  let segOffset = 0;
  if (part.left.length > 0) {
    segs.push({ ids: part.left, indent: zero, offset: segOffset, autoScroll: false, fixed: true });
    segOffset += part.left.length;
  }
  // The center auto-scrolls its column cursor only in a frozen-column grid (a single body never has).
  segs.push({ ids: part.center, indent: deps.indent, offset: segOffset, autoScroll: frozen, fixed: false });
  segOffset += part.center.length;
  if (part.right.length > 0) {
    segs.push({ ids: part.right, indent: zero, offset: segOffset, autoScroll: false, fixed: true });
  }

  // A fixed panel band is exactly its columns' resolved widths + inter-column dividers (none in compact);
  // the `FreezeDivider` between panels provides the boundary, so no trailing gutter. The center is `fr`.
  const segLayout = (seg: Seg): LayoutProps =>
    seg.fixed ? { size: { kind: 'fixed', cells: panelBandWidth(seg.ids, deps.resolvedWidth, deps.compact) } } : fr;

  let center = null as unknown as EditableGridRows<T>; // assigned by the center seg below

  // The synthetic-prefix bands (checkbox + row-number gutter): fixed-width, non-scrolling segments
  // prepended to the LEFTMOST region (before the first data segment) of the header, the pinned frozen-
  // rows band, and the body. `prefixWidth` 0 (neither affordance on) adds nothing → byte-identical.
  const pw = prefixWidth(deps.prefix);
  if (pw > 0) {
    const prefixLayout: LayoutProps = { size: { kind: 'fixed', cells: pw } };
    // Grid-wide focus for the prefix body band: reuse the frozen predicate, else read the single body's
    // focus reactively so the focused row's prefix cell lights up in lockstep with the data body.
    const bandActive: () => boolean =
      gridActive ??
      ((): boolean => {
        center.focusSignal()(); // subscribe (reactive) so a focus flip repaints the prefix band
        return center.state.focused;
      });
    const makePrefixBody = (rowFloor: number, rowCeil: number): SyntheticBodyBand<T> =>
      new SyntheticBodyBand<T>({
        display: deps.display,
        columns: [],
        autoWidths: () => [],
        indent: zero, // the prefix never pans horizontally
        focused: deps.focused,
        selected: deps.selected,
        zebra: deps.zebra,
        prefix: deps.prefix,
        selectedKeys: deps.selectedKeys,
        rowKey: deps.rowKey,
        onToggleRow: deps.onToggleRow,
        active: bandActive,
        rowFloor,
        rowCeil,
      });

    const headerBand = new SyntheticHeaderBand({
      prefix: deps.prefix,
      triState: deps.triState,
      onToggleAll: deps.onToggleAll,
    });
    headerBand.layout = prefixLayout;
    headerRow.add(headerBand);

    if (freezeRows > 0) {
      const pinnedPrefix = makePrefixBody(0, 0); // pinned band: always the first N rows, never scrolls
      pinnedPrefix.layout = prefixLayout;
      freezeRowsRow.add(pinnedPrefix);
    }

    const bodyPrefix = makePrefixBody(freezeRows, Number.POSITIVE_INFINITY); // scrolling body window
    bodyPrefix.layout = prefixLayout;
    bodyRow.add(bodyPrefix);
  }

  segs.forEach((seg, i) => {
    if (i > 0) {
      // A freeze divider (1 cell) before every seg after the first — in the header, the pinned band, and
      // the body — so the boundary reads as a continuous rule down all three.
      const hd = new FreezeDivider();
      hd.layout = fixed1;
      headerRow.add(hd);
      if (freezeRows > 0) {
        const fd = new FreezeDivider();
        fd.layout = fixed1;
        freezeRowsRow.add(fd);
      }
      const bd = new FreezeDivider();
      bd.layout = fixed1;
      bodyRow.add(bd);
    }
    const layout = segLayout(seg);
    const header = makeHeader(seg.ids, seg.indent, seg.offset);
    header.layout = layout;
    headerRow.add(header);
    if (freezeRows > 0) {
      const band = makeBand(seg.ids, seg.indent, seg.offset);
      band.layout = layout;
      freezeRowsRow.add(band);
    }
    const body = makeBody(seg.ids, seg.indent, seg.offset, seg.autoScroll);
    body.layout = layout;
    bodyRow.add(body);
    if (!seg.fixed) center = body;
  });

  // The center/only body owns both scroll bars (it re-limits their ranges on every draw); frozen panels
  // scroll only in lockstep via the shared `focused`/`indent`, so they never touch a bar.
  center.vbar = deps.vbar;
  center.hbar = deps.hbar;
  deps.vbar.layout = fixed1;
  deps.hbar.layout = fr;
  bodyRow.add(deps.vbar);
  headerRow.add(corner());

  inner.add(headerRow);

  if (deps.quickFilter) {
    // One full-width quick-filter band under the header (over every visible column, panning with center).
    const band = new QuickFilterRow<T>({
      columns: sliceCols(fullVisible),
      columnIds: fullVisible,
      autoWidths: sliceAuto(fullVisible),
      indent: deps.indent,
      onQuickFilter: deps.onQuickFilter,
      compact: deps.compact,
      filterable: sliceFilterable(fullVisible),
    });
    band.layout = fr;
    const quickRow = bandRow();
    quickRow.add(band);
    quickRow.add(corner());
    inner.add(quickRow);
  }

  if (freezeRows > 0) {
    // The pinned rows sit between the header/quick-filter and the scrolling body; a corner squares off
    // the scroll-bar gutter so the band's right edge lines up with the body's.
    freezeRowsRow.add(corner());
    inner.add(freezeRowsRow);
  }

  inner.add(bodyRow);

  // The footer aggregate band: a fixed one-cell row directly below the body, outside its virtual-scroll
  // window (so it is sticky-at-bottom for free) and above the horizontal scroll bar. It mirrors the same
  // `segs` loop as the body — one FooterBand per panel, the same per-segment `indent` (frozen panels do
  // not pan, the center does) and dividers — plus a leading prefix spacer and a trailing gutter corner,
  // so its aggregate cells align to their columns across the frozen/scrolling split.
  if (deps.footerCell !== undefined) {
    const footerCell = deps.footerCell;
    const footerRow = bandRow();
    if (pw > 0) {
      // Reserve the synthetic-prefix width so the aggregate cells line up under the data columns.
      const spacer = new Group();
      spacer.background = 'tableHeader';
      spacer.layout = { size: { kind: 'fixed', cells: pw } };
      footerRow.add(spacer);
    }
    segs.forEach((seg, i) => {
      if (i > 0) {
        const fd = new FreezeDivider();
        fd.layout = fixed1;
        footerRow.add(fd);
      }
      const band = new FooterBand<T>({
        columns: sliceCols(seg.ids),
        columnIds: seg.ids,
        autoWidths: sliceAuto(seg.ids),
        indent: seg.indent,
        compact: deps.compact,
        widthTick: deps.widthTick,
        cell: footerCell,
      });
      band.layout = segLayout(seg);
      footerRow.add(band);
    });
    footerRow.add(corner()); // square off the vbar gutter, like the frozen-rows band
    inner.add(footerRow);
  }

  // The footer widget row: a flow row of the caller's free-form widgets, spanning the full band width
  // (including the vbar-gutter column, so a caller-inserted `spacer()` right-aligns to the body's right
  // edge). Fixed one cell tall in v1; the widgets keep the keyboard-reachable focus order they were given.
  if (deps.footerWidgets !== undefined && deps.footerWidgets.length > 0) {
    const widgetRow = bandRow();
    for (const widget of deps.footerWidgets) widgetRow.add(widget);
    inner.add(widgetRow);
  }

  const botRow = bandRow();
  botRow.add(deps.hbar);
  botRow.add(corner());
  inner.add(botRow);

  return { inner, panels, headers, center };
}
