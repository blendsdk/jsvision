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
import type { SortKey } from './sort.js';
import type { FilterModel } from './filter.js';
import type { OnCommit } from './commit.js';
import type { DirtyRegistry } from './editing.js';
import { SortHeader } from './sort-header.js';
import { QuickFilterRow } from './quick-filter-row.js';
import { EditableGridRows } from './editable-grid-rows.js';

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
  /** Shared selection index. */
  selected: Signal<number>;
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
  /** Stripe odd rows. */
  zebra: boolean;
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
  /** Whether the opt-in quick-filter band is shown. */
  quickFilter: boolean;
  /** Quick-filter text sink (empty text ⇒ clear that column's filter). */
  onQuickFilter: (columnId: string, text: string) => void;
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
 * cell between each pair (no trailing gutter — the {@link FreezeDivider} provides the boundary). Sizing
 * the band this tight makes the panel apportion its columns at exactly their resolved widths.
 */
function panelBandWidth(ids: string[], resolvedWidth: (id: string) => number): number {
  let sum = 0;
  for (const id of ids) sum += resolvedWidth(id);
  return sum + Math.max(0, ids.length - 1);
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
  const headers: SortHeader<T>[] = [];
  // Only in frozen mode do the row highlight / cursor / dirty markers key on grid-wide focus and does a
  // cursor move hop focus across panels; a single body keeps its own focus and never hops.
  const gridActive = frozen ? (): boolean => anyPanelFocused(panels) : undefined;
  const hop = frozen
    ? (globalCol: number, ev: DispatchEvent): void => {
        const owner = panels.find((p) => globalCol >= p.columnOffset && globalCol < p.columnOffset + p.columnCount);
        if (owner) ev.focusView?.(owner);
      }
    : undefined;

  const engineOf = (id: string): Column<T> => deps.engineCols[deps.columnIndex.get(id) ?? 0];
  const sliceCols = (ids: string[]): Column<T>[] => ids.map(engineOf);
  const sliceTyped = (ids: string[]): GridColumn<T>[] => ids.map((id) => deps.columnMap.get(id)!);
  // A per-slice auto-width reader: reindexes the shared measurement into this slice's local order, and
  // stays reactive (it reads `deps.autoWidths()` on each call, so a re-measure repaints the panel).
  const sliceAuto = (ids: string[]) => (): (number | null)[] => {
    const aw = deps.autoWidths();
    return ids.map((id) => aw[deps.columnIndex.get(id) ?? 0]);
  };

  const makeHeader = (ids: string[], indent: Signal<number>): SortHeader<T> => {
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
      zebra: deps.zebra,
      focusedCol: deps.focusedCol,
      typedColumns: sliceTyped(ids),
      overlay: deps.overlay,
      onCommit: deps.onCommit,
      rowKey: deps.rowKey,
      bumpVersion: deps.bumpVersion,
      dirty: deps.dirty,
      columnOffset: offset,
      totalCols: () => total,
      onCursorEnterPanel: hop,
      mouseColumns: frozen,
      autoScrollColumns: autoScroll,
      panelActive: gridActive,
    });
    panels.push(body);
    return body;
  };

  // The horizontal bands share one column container; the grid's own `layout` prop stays free for the
  // parent to place the whole grid (an absolute rect or an `fr` flow slot).
  const inner = new Group();
  inner.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };

  const headerRow = bandRow();
  const bodyRow = new Group();
  bodyRow.layout = { direction: 'row', size: { kind: 'fr', weight: 1 } };

  let center: EditableGridRows<T>;
  if (!frozen) {
    // Single-body path — one header + one body over the visible columns, sized `fr` beside the bars.
    const header = makeHeader(part.center, deps.indent);
    const body = makeBody(part.center, deps.indent, 0, false);
    header.layout = fr;
    body.layout = fr;
    headerRow.add(header);
    bodyRow.add(body);
    center = body;
  } else {
    // Frozen path — left? / center / right? panels in visual order, a divider between each pair.
    const zero = signal(0); // frozen panels never pan horizontally
    interface Seg {
      ids: string[];
      indent: Signal<number>;
      offset: number;
      autoScroll: boolean;
      fixed: boolean;
    }
    const segs: Seg[] = [];
    let offset = 0;
    if (part.left.length > 0) {
      segs.push({ ids: part.left, indent: zero, offset, autoScroll: false, fixed: true });
      offset += part.left.length;
    }
    segs.push({ ids: part.center, indent: deps.indent, offset, autoScroll: true, fixed: false });
    offset += part.center.length;
    if (part.right.length > 0) {
      segs.push({ ids: part.right, indent: zero, offset, autoScroll: false, fixed: true });
    }

    center = null as unknown as EditableGridRows<T>; // assigned by the center seg below
    segs.forEach((seg, i) => {
      if (i > 0) {
        // A freeze divider before every seg after the first (marks the boundary in header + body).
        const hd = new FreezeDivider();
        hd.layout = fixed1;
        headerRow.add(hd);
        const bd = new FreezeDivider();
        bd.layout = fixed1;
        bodyRow.add(bd);
      }
      const band: LayoutProps = seg.fixed
        ? { size: { kind: 'fixed', cells: panelBandWidth(seg.ids, deps.resolvedWidth) } }
        : fr;
      const header = makeHeader(seg.ids, seg.indent);
      const body = makeBody(seg.ids, seg.indent, seg.offset, seg.autoScroll);
      header.layout = band;
      body.layout = band;
      headerRow.add(header);
      bodyRow.add(body);
      if (!seg.fixed) center = body;
    });
  }

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
    });
    band.layout = fr;
    const quickRow = bandRow();
    quickRow.add(band);
    quickRow.add(corner());
    inner.add(quickRow);
  }

  inner.add(bodyRow);

  const botRow = bandRow();
  botRow.add(deps.hbar);
  botRow.add(corner());
  inner.add(botRow);

  return { inner, panels, headers, center };
}
