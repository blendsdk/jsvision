/**
 * `PersonalizeDialog` — the end-user "Personalize columns" modal (an internal view; the public entry is
 * `personalizeGrid` in `personalize.js`). It is **staged**: every edit mutates a *pending* layout held
 * by the dialog, and only OK commits it to the grid (via `grid.applyVariant(dlg.result())`); Cancel/Esc
 * leave the grid untouched. It composes existing `@jsvision/ui` widgets so the package stays
 * zero-runtime-dependency.
 *
 * The whole dialog is laid out with the flex layout DSL (`col`/`row`/`grow`/`fixed`/`buttonRow`) — one
 * fill `col` of flex-sized sections (header · scrollable column band · count echo · variants section ·
 * two button bars), never a hand-placed per-control rect. Each column row and the header are flex
 * `row`s of the SAME cells (`fixed` marker/toggle/freeze/width around a `grow` title), so a header
 * label always lines up over its control with no column math to keep in sync. The scrollable band is a
 * vertical `col` of those rows sized to its full extent, so the reflow flows and stretches the rows and
 * the Scroller just pans them; the working order is reflected by re-sorting the region's children (the
 * rows are reused, so a reorder keeps keyboard focus), not by a per-row rect.
 *
 * The region reconciles per-row widgets with a list-cursor keyboard model using the event router's
 * focused-leaf → ancestor bubbling: each row's widgets are the focusable leaves (they handle their own
 * activation), while the row container owns a selection cursor and handles the `↑`/`↓` / `Alt`+arrows
 * the leaves ignore.
 */
import { sanitize } from '@jsvision/core';
import type { DispatchEvent, DrawContext, ModalDialogHost, Signal } from '@jsvision/ui';
import {
  Button,
  col,
  confirm,
  Dialog,
  filter,
  fixed,
  Group,
  grow,
  Input,
  ListBox,
  okCancelButtons,
  row,
  Scroller,
  signal,
  spacer,
  Text,
  View,
} from '@jsvision/ui';
import { buttonRow } from './button-row.js';
import type { ColumnFilter } from './filter.js';
import type { EditableDataGrid } from './grid.js';
import type { SortKey } from './sort.js';
import type { VariantStore } from './variant-store.js';
import type { GridVariant } from './variant.js';

/** The freeze side a column is pinned to in the pending layout. */
export type FreezeSide = 'left' | 'right' | 'none';

/**
 * One column's pending, editable facets as the dialog holds them: identity + title, visibility, freeze
 * side, and the optional width override (`undefined` = auto/declared). The full column order is the
 * array order of {@link PersonalizeDialog.workingColumns}.
 */
export interface WorkingCol {
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;
  readonly freeze: FreezeSide;
  /** The pending width override in cells, or `undefined` for auto/declared width. */
  readonly width: number | undefined;
}

/** The variant name is capped at this many characters at entry (a hard truncation). */
const NAME_MAX = 64;
/** The pending width input accepts at most this many digits. */
const WIDTH_MAX_DIGITS = 3;
/** Each column row is one cell tall; the region scrolls when the column count exceeds the viewport. */
const ROW_HEIGHT = 1;

/**
 * Flex cell widths shared by the header row and every column row, so a header label always lines up
 * over the control it labels; the title cell grows to fill the rest, and {@link ROW_GAP} sits between
 * adjacent cells. Because the header and the rows use the very same cells, alignment is automatic —
 * there is no per-element column math to keep in sync.
 */
const CELL = { marker: 1, toggle: 4, freeze: 8, width: 6 } as const;
/** One cell of gap between adjacent cells in the header row and every column row. */
const ROW_GAP = 1;
/**
 * The one column the Scroller reserves for its vertical bar (scroller.ts computes `viewport = width − 1`).
 * The header row reserves the SAME column as right padding, so the header cells and the scrolled rows are
 * laid out to one identical content width — otherwise `grow(title)` eats the mismatch and every cell to
 * its right (Freeze, Width) drifts, and the Width cell paints under the bar. It must stay in step with the
 * Scroller's `scrollbars: 'vertical'` below.
 */
const SCROLLBAR = 1;
/** The dialog's frame border (1) plus the body `col`'s padding (1), on each side — the content-box inset. */
const BODY_INSET = 2;
/**
 * A breathing column reserved between the Width field's right edge and the scrollbar, so the field never
 * butts against the bar. Reserved identically in the header (its right padding) and the rows (a narrower
 * content width), so the two stay column-aligned.
 */
const GUTTER = 1;

/** The human freeze-side labels painted in the freeze cell (the model keeps the lowercase enum). */
const FREEZE_LABEL: Record<FreezeSide, string> = { none: 'None', left: 'Left', right: 'Right' };

/** Parse a width input's text to an override: empty → `undefined` (auto), else the digit value. */
function parseWidth(text: string): number | undefined {
  const t = text.trim();
  return t === '' ? undefined : Number(t);
}

/**
 * A focusable checkbox cell that paints `[x]`/`[ ]` from a reactive `checked` reader and greys + drops
 * from the Tab order when `disabledReader` is true (the last-visible-column guard). A click or Space
 * toggles it through `onToggle`; `↑`/`↓`/`Alt`+arrows are ignored so they bubble to the row container.
 */
class ToggleCell extends View {
  override focusable = true;

  constructor(
    private readonly checked: () => boolean,
    private readonly onToggle: () => void,
    private readonly disabledReader: () => boolean,
  ) {
    super();
    this.onMount(() => {
      this.bind(() => {
        this.checked(); // repaint when the visibility flips
      });
      this.bind(
        () => this.disabledReader(),
        (d) => {
          this.state.disabled = d; // greys the cell and takes it out of key handling / the Tab order
        },
      );
    });
  }

  override draw(ctx: DrawContext): void {
    const role = this.state.disabled ? ctx.color('listDivider') : ctx.color('listNormal');
    ctx.fill(' ', role);
    ctx.text(0, 0, this.checked() ? '[x]' : '[ ]', role);
  }

  override onEvent(ev: DispatchEvent): void {
    const e = ev.event;
    if (this.state.disabled) return; // guarded: never toggles, never consumes
    if (e.type === 'key' && e.key === 'space') {
      this.onToggle();
      ev.handled = true;
    } else if (e.type === 'mouse' && e.kind === 'down') {
      this.onToggle();
      ev.handled = true;
    }
  }
}

/**
 * A focusable freeze-side cell that paints the current side (`None`/`Left`/`Right`) from a reactive
 * reader and cycles it (`None → Left → Right → None`) on Space or a click; `↑`/`↓`/`Alt`+arrows are
 * ignored so they bubble to the row container. It sits under the "Freeze" header — one self-describing
 * control in place of a separate button paired with a raw-enum `none` label. Enter is left for the
 * dialog's default OK button, mirroring {@link ToggleCell}.
 */
class FreezeCell extends View {
  override focusable = true;

  constructor(
    private readonly sideReader: () => FreezeSide,
    private readonly onCycle: () => void,
  ) {
    super();
    this.onMount(() => {
      this.bind(() => {
        this.sideReader(); // repaint when the freeze side changes
      });
    });
  }

  override draw(ctx: DrawContext): void {
    const role = ctx.color('listNormal');
    ctx.fill(' ', role);
    ctx.text(0, 0, FREEZE_LABEL[this.sideReader()], role);
  }

  override onEvent(ev: DispatchEvent): void {
    const e = ev.event;
    if (e.type === 'key' && e.key === 'space') {
      this.onCycle();
      ev.handled = true;
    } else if (e.type === 'mouse' && e.kind === 'down') {
      this.onCycle();
      ev.handled = true;
    }
  }
}

/**
 * The row container: the Scroller's content Group, a vertical `col` sized to the full extent so the
 * reflow flows its rows within the extent (each stretched to full width, aligned under the header)
 * rather than compressing them into the shorter viewport. It holds one built-once composite row per
 * column and owns the selection cursor. It handles the `↑`/`↓` / `Alt`+arrows that a focused row widget
 * ignored (they bubble up to it), driving `selected` and reorder; per-row widgets keep handling their
 * own activation.
 */
class ColumnRegion extends Group {
  constructor(private readonly dlg: PersonalizeDialog<unknown>) {
    super();
  }

  override onEvent(ev: DispatchEvent): void {
    const e = ev.event;
    if (e.type !== 'key') return;
    if (e.key === 'up' && !e.alt) {
      this.dlg.moveSelection(-1, ev);
      ev.handled = true;
    } else if (e.key === 'down' && !e.alt) {
      this.dlg.moveSelection(1, ev);
      ev.handled = true;
    } else if (e.key === 'up' && e.alt) {
      this.dlg.reorderSelected(-1);
      ev.handled = true;
    } else if (e.key === 'down' && e.alt) {
      this.dlg.reorderSelected(1);
      ev.handled = true;
    }
  }

  /**
   * Reorder the held rows to `ordered` in place — mutating child order, never re-adding — so the rows
   * stay mounted and the focused row keeps its focus across a reorder. Relayouts so the `col` re-flows
   * the rows top-to-bottom in the new working order.
   *
   * @param ordered The row views in the new working order (a permutation of the current children).
   */
  setRowOrder(ordered: View[]): void {
    this.children.length = 0;
    for (const view of ordered) this.children.push(view);
    this.invalidateLayout();
  }
}

/**
 * The staged "Personalize columns" dialog. Construct it with the grid, the caller's variant store, the
 * modal host, and a title; open + drive it through {@link personalizeGrid}. Its edit logic is exposed
 * as small methods (`toggleSelectedVisibility`, `reorderSelected`, `cycleSelectedFreeze`,
 * `setSelectedWidth`, `reset`, `result`) that the row widgets and the tests both drive.
 *
 * @example
 * ```ts
 * const dlg = new PersonalizeDialog(grid, store, app, 'Personalize columns');
 * app.desktop.addWindow(dlg);
 * const command = await app.loop.execView<string>(dlg);
 * if (command === 'ok') grid.applyVariant(dlg.result());
 * app.desktop.removeWindow(dlg);
 * ```
 */
export class PersonalizeDialog<T> extends Dialog {
  private readonly grid: EditableDataGrid<T>;
  protected readonly store: VariantStore;
  /** The modal host (named `dlgHost` so it never shadows the base `View.host` render seam). */
  protected readonly dlgHost: ModalDialogHost;

  /** The pending column facets (order/visibility/freeze), the single source of truth for the columns. */
  private readonly cols: Signal<WorkingCol[]>;
  /** Pending sort/filter — captured once from the live grid; edited only by the variants panel. */
  private readonly sortModel: Signal<SortKey[]>;
  private readonly filterModel: Signal<Array<{ columnId: string; filter: ColumnFilter }>>;
  /** The selection cursor (an index into {@link cols}). */
  private readonly selectedIdx = signal(0);
  /** The width input text per column id (empty = auto); the source of a column's pending width. */
  private readonly widthText = new Map<string, Signal<string>>();
  /** The variant-name field (used by the variants panel; capped at {@link NAME_MAX} on entry). */
  protected readonly name: Signal<string> = signal('');
  /** The visibility toggle cell per column id, so the region can focus the selected row's toggle. */
  private readonly toggleById = new Map<string, ToggleCell>();
  /** The built-once composite row per column id (repositioned by the working order). */
  private readonly rowById = new Map<string, Group>();
  private readonly region: ColumnRegion;
  /** The variant names shown in the panel list — refreshed after every store mutation. */
  private readonly variantNames: Signal<string[]>;
  /** The panel list's cursor index (the selected variant). */
  private readonly variantSelected = signal(0);
  /** The dialog's own width, known at construction — used only to size the scroller's content extent. */
  private readonly dlgW: number;

  constructor(grid: EditableDataGrid<T>, store: VariantStore, host: ModalDialogHost, title: string) {
    const bounds = host.desktop.bounds;
    const w = Math.min(Math.max(48, bounds.width - 8), 64);
    const h = Math.min(Math.max(13, bounds.height - 4), 20); // room for the header line above the rows
    super({ title, width: w, height: h });
    // The default Dialog padding (1) is the frame inset; the single fill `col` body lays out inside it.
    this.dlgW = w;
    this.grid = grid;
    this.store = store;
    this.dlgHost = host;

    const pending = grid.saveVariant('(current)'); // the ONE read of the live grid's sort/filter
    this.sortModel = signal(pending.sort.map((k) => ({ ...k })));
    this.filterModel = signal(pending.filter.map((f) => ({ ...f })));
    const titleOf = new Map(grid.columns().map((c) => [c.id, c.title]));
    const left = new Set(pending.freeze.left);
    const right = new Set(pending.freeze.right);
    const initial: WorkingCol[] = pending.columns.map((c) => {
      this.widthText.set(c.id, signal(c.width === undefined ? '' : String(c.width)));
      return {
        id: c.id,
        title: titleOf.get(c.id) ?? c.id,
        visible: c.visible,
        freeze: left.has(c.id) ? 'left' : right.has(c.id) ? 'right' : 'none',
        width: c.width,
      };
    });
    this.cols = signal(initial);
    this.variantNames = signal(store.list().map((v) => v.name));

    this.region = new ColumnRegion(this as PersonalizeDialog<unknown>);
    this.buildBody();
  }

  // ── Layout (flex DSL) ────────────────────────────────────────────────────────────────────────────

  /**
   * Compose the whole dialog with the flex layout DSL: one fill `col` of flex-sized sections — the
   * fixed header, the growing scrollable column band, the visible-count echo, the variants section,
   * and the two `buttonRow` bars. Nothing is hand-placed with a per-control rect, so the layout
   * reflows and never leaves a control mis-sized (a two-row-tall `buttonRow` is why the buttons paint).
   */
  private buildBody(): void {
    // The scrollable band's content width: the frame-inset content box, minus the column the vertical
    // scrollbar reserves and one breathing gutter before it. The header row reserves the same two columns
    // (its right padding), so both are laid out to this one width and line up, and the Width field neither
    // paints under the bar nor butts against it.
    const contentW = Math.max(8, this.dlgW - 2 * BODY_INSET - SCROLLBAR - GUTTER);

    const echo = new Text(() => `${this.visibleCount()} of ${this.cols().length} columns visible`);

    // The variant-management bar and the commit bar. `buttonRow` lays a row of equal, individually
    // centered, two-row-tall cells — uniform regardless of label lengths, and clip-free when narrow.
    const save = new Button('Save', { onClick: () => void this.saveAs() });
    const apply = new Button('Apply', { onClick: () => this.applySelected() });
    const del = new Button('Delete', { onClick: () => void this.deleteSelected() });
    const setDefault = new Button('Default', { onClick: () => this.setDefaultSelected() });
    const reset = new Button('Reset', { onClick: () => this.reset() });
    const [ok, cancel] = okCancelButtons();

    this.add(
      col(
        { position: 'fill', padding: 1 },
        this.buildHeaderRow(),
        // The band GROWS to fill the space left by the fixed sections, so the two button bars stay
        // pinned to the bottom and visible; a fixed height here overflows and clips the OK/Cancel bar.
        fixed(this.buildColumnScroller(contentW), 5),
        fixed(echo, 1),
        spacer({ fixed: 1 }), // a gap between the two button bars
        this.buildVariantsSection(),
        spacer({ fixed: 1 }), // a gap between the two button bars
        buttonRow([save, apply, del, setDefault, reset]),
        buttonRow([ok, cancel]),
      ),
    );
  }

  /** The fixed column header (Show · Column · Freeze · Width) — the same flex cells a row uses. */
  private buildHeaderRow(): Group {
    // padding-right reserves the scrollbar column plus the gutter, so a header label lines up with the
    // scrolled rows (which reserve the same two columns via their narrower content width).
    return row(
      {
        size: { kind: 'fixed', cells: ROW_HEIGHT },
        gap: ROW_GAP,
        padding: { top: 0, right: SCROLLBAR + GUTTER, bottom: 0, left: 0 },
      },
      fixed(new Text(' '), CELL.marker),
      fixed(new Text('Show'), CELL.toggle),
      grow(new Text('Column'), 1),
      fixed(new Text('Freeze'), CELL.freeze),
      fixed(new Text('Width'), CELL.width),
    );
  }

  /**
   * Build the composite rows once, stack them in the vertical `col` region, and wrap it in a Scroller.
   * The region carries an absolute rect at the FULL extent size — the one load-bearing detail: it makes
   * the reflow flow the rows within the extent (each stretched to full width, aligned under the header)
   * rather than compressing them into the shorter viewport; the Scroller then simply pans that band. The
   * column count never changes (only the order and per-row facets), so the extent is fixed and only the
   * child ORDER is reactive: a working-order bind re-sorts the region's children in place, and because
   * the rows are reused (never rebuilt) a reorder preserves keyboard focus.
   */
  private buildColumnScroller(contentW: number): Scroller {
    const height = Math.max(1, this.cols().length * ROW_HEIGHT);
    for (const c of this.cols()) this.rowById.set(c.id, this.buildRow(c));
    this.region.layout = {
      direction: 'col',
      position: 'absolute',
      rect: { x: 0, y: 0, width: contentW, height },
    };
    for (const c of this.cols()) this.region.add(this.rowById.get(c.id)!);
    // Keep the region's child order in step with the working order (the rows themselves are reused).
    this.region.onMount(() => {
      this.region.bind(
        () => this.cols(),
        (order) => {
          const ordered = order.map((c) => this.rowById.get(c.id)).filter((r): r is Group => r !== undefined);
          this.region.setRowOrder(ordered);
        },
      );
    });

    return new Scroller({
      content: this.region,
      extent: () => ({ width: contentW, height: Math.max(1, this.cols().length * ROW_HEIGHT) }),
      scrollbars: 'vertical',
    });
  }

  /** The variants section (flex): a labelled saved-layouts list beside a labelled save-name field. */
  private buildVariantsSection(): Group {
    const savedLabel = new Text('Saved layouts');
    const list = new ListBox({ items: this.variantNames, focused: this.variantSelected });
    const nameLabel = new Text('Save as:');
    const nameInput = new Input({ value: this.name, maxLength: NAME_MAX, placeholder: 'variant name' });

    // Two equal halves: label-over-list on the left, label-over-field on the right.
    return row(
      { size: { kind: 'fixed', cells: 4 }, gap: 2 },
      col({ fill: true }, fixed(savedLabel, 1), grow(list, 1)),
      col({ fill: true }, fixed(nameLabel, 1), fixed(nameInput, 1), spacer()),
    );
  }

  /**
   * Build one composite row with the flex DSL — the same cells as the header (marker · toggle · grow
   * title · freeze · width), so they align. The row is a plain flow child of the `col` region: the col
   * flows it at its natural one-cell height and stretches it to the region width, so `grow(title)` fills
   * the space between the fixed cells. Reordering is the region's job, not a per-row rect.
   */
  private buildRow(column: WorkingCol): Group {
    const id = column.id;

    const marker = new Text(() => (this.cols()[this.selectedIdx()]?.id === id ? '▸' : ' '));
    const toggle = new ToggleCell(
      () => this.isVisible(id),
      () => this.toggleVisibility(id),
      () => this.isLastVisible(id),
    );
    this.toggleById.set(id, toggle);
    const title = new Text(column.title);
    const freeze = new FreezeCell(
      () => this.freezeOf(id),
      () => this.cycleFreeze(id),
    );
    const widthSig = this.widthText.get(id)!;
    // `placeholder: 'auto'` makes an empty width cell self-explanatory (empty = declared/auto width).
    const widthInput = new Input({
      value: widthSig,
      maxLength: WIDTH_MAX_DIGITS,
      validator: filter('0-9'),
      placeholder: 'auto',
    });

    return row(
      { gap: ROW_GAP },
      fixed(marker, CELL.marker),
      fixed(toggle, CELL.toggle),
      grow(title, 1),
      fixed(freeze, CELL.freeze),
      fixed(widthInput, CELL.width),
    );
  }

  // ── Pending reads ──────────────────────────────────────────────────────────────────────────────

  /** The pending column facets, in working order — each with its resolved pending width. */
  workingColumns(): readonly WorkingCol[] {
    return this.cols().map((c) => ({ ...c, width: parseWidth(this.widthText.get(c.id)?.() ?? '') }));
  }

  /** The index of a column id in the working order, or `-1`. */
  indexOf(id: string): number {
    return this.cols().findIndex((c) => c.id === id);
  }

  /** The current selection cursor (an index into the working order). */
  selected(): number {
    return this.selectedIdx();
  }

  /** How many columns are currently visible in the pending layout. */
  visibleCount(): number {
    return this.cols().filter((c) => c.visible).length;
  }

  /** The variant-name field's current value (capped at 64 on entry). */
  nameValue(): string {
    return this.name();
  }

  /** The variant name with control bytes stripped — what is echoed and persisted. */
  sanitizedName(): string {
    return sanitize(this.name());
  }

  private isVisible(id: string): boolean {
    return this.cols().find((c) => c.id === id)?.visible ?? false;
  }

  private freezeOf(id: string): FreezeSide {
    return this.cols().find((c) => c.id === id)?.freeze ?? 'none';
  }

  /** Whether hiding this column would leave zero visible (so its toggle is guarded/disabled). */
  private isLastVisible(id: string): boolean {
    return this.isVisible(id) && this.visibleCount() === 1;
  }

  // ── Selection + edits (driven by the widgets and the tests) ──────────────────────────────────────

  /** Move the selection cursor to `index`, clamped to the column range. */
  select(index: number): void {
    const max = this.cols().length - 1;
    this.selectedIdx.set(Math.min(Math.max(0, index), Math.max(0, max)));
  }

  /** Move the selection by `delta`; when an event is supplied, focus the newly-selected row's toggle. */
  moveSelection(delta: number, ev?: DispatchEvent): void {
    this.select(this.selectedIdx() + delta);
    const id = this.cols()[this.selectedIdx()]?.id;
    const toggle = id !== undefined ? this.toggleById.get(id) : undefined;
    if (toggle !== undefined) ev?.focusView?.(toggle);
  }

  /** Toggle the selected column's visibility (guarded: hiding the last visible column is a no-op). */
  toggleSelectedVisibility(): void {
    const id = this.cols()[this.selectedIdx()]?.id;
    if (id !== undefined) this.toggleVisibility(id);
  }

  /** Toggle a specific column's visibility; hiding the last visible column is a guarded no-op. */
  toggleVisibility(id: string): void {
    if (this.isLastVisible(id)) return; // never build a zero-visible layout
    this.cols.set(this.cols().map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }

  /** Cycle the selected column's freeze side (`none → left → right → none`). */
  cycleSelectedFreeze(): void {
    const id = this.cols()[this.selectedIdx()]?.id;
    if (id !== undefined) this.cycleFreeze(id);
  }

  /** Cycle a specific column's freeze side. */
  cycleFreeze(id: string): void {
    const next: Record<FreezeSide, FreezeSide> = { none: 'left', left: 'right', right: 'none' };
    this.cols.set(this.cols().map((c) => (c.id === id ? { ...c, freeze: next[c.freeze] } : c)));
  }

  /** Reorder the selected column by `delta` (a boundary move is a no-op); the cursor follows it. */
  reorderSelected(delta: number): void {
    const from = this.selectedIdx();
    const to = from + delta;
    const order = this.cols();
    if (to < 0 || to >= order.length) return; // boundary no-op
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.cols.set(next);
    this.selectedIdx.set(to);
  }

  /** Set the selected column's width input text (empty = auto). Clamping lands on OK via applyVariant. */
  setSelectedWidth(text: string): void {
    const id = this.cols()[this.selectedIdx()]?.id;
    if (id !== undefined) this.widthText.get(id)?.set(text);
  }

  /** Set the variant-name field, hard-capped at 64 characters (as the Input does on entry). */
  setName(text: string): void {
    this.name.set(text.slice(0, NAME_MAX));
  }

  /**
   * Reset the pending **column facets** to the construction baseline — every column visible, in
   * construction order, no freeze, and no width overrides. The pending sort/filter are left untouched.
   */
  reset(): void {
    const base = this.grid.defaultColumnLayout();
    // Rebuild from the baseline with width OMITTED — the baseline width is display-only; copying it back
    // would re-establish an override and defeat the clear on OK.
    this.cols.set(base.map((c) => ({ id: c.id, title: c.title, visible: true, freeze: 'none', width: undefined })));
    for (const c of base) this.widthText.get(c.id)?.set('');
    this.selectedIdx.set(0);
  }

  /** Replace the whole pending layout with a saved variant (columns + freeze + sort + filter). */
  applyStored(variant: GridVariant): void {
    this.sortModel.set(variant.sort.map((k) => ({ ...k })));
    this.filterModel.set(variant.filter.map((f) => ({ ...f })));
    const titleOf = new Map(this.cols().map((c) => [c.id, c.title]));
    const left = new Set(variant.freeze.left);
    const right = new Set(variant.freeze.right);
    const next: WorkingCol[] = variant.columns.map((c) => {
      this.widthText.get(c.id)?.set(c.width === undefined ? '' : String(c.width));
      return {
        id: c.id,
        title: titleOf.get(c.id) ?? c.id,
        visible: c.visible,
        freeze: left.has(c.id) ? 'left' : right.has(c.id) ? 'right' : 'none',
        width: c.width,
      };
    });
    this.cols.set(next);
    this.selectedIdx.set(0);
  }

  // ── Variants panel (store-backed; save/apply/delete/set-default) ─────────────────────────────────

  /** The variants currently in the store (a live snapshot). */
  storeVariants(): readonly GridVariant[] {
    return this.store.list();
  }

  /** The name of the currently-selected variant in the panel list, or `undefined`. */
  selectedVariantName(): string | undefined {
    return this.variantNames()[this.variantSelected()];
  }

  /** Move the panel selection to a named variant (a no-op if absent). */
  selectVariant(name: string): void {
    const i = this.variantNames().indexOf(name);
    if (i >= 0) this.variantSelected.set(i);
  }

  private refreshVariants(): void {
    this.variantNames.set(this.store.list().map((v) => v.name));
  }

  /** The pending layout as a named variant to persist (all facets: columns/freeze/sort/filter). */
  private buildVariant(name: string): GridVariant {
    return { ...this.result(), name };
  }

  /**
   * Save the pending layout under the name field. A blank/whitespace name is rejected; an existing name
   * prompts a nested confirm-overwrite (declining leaves the store unchanged). The name is sanitized
   * before it is stored.
   *
   * @returns `'blank'` (rejected), `'saved'` (new), `'overwrote'` (confirmed overwrite), or `'declined'`.
   */
  async saveAs(): Promise<'blank' | 'saved' | 'overwrote' | 'declined'> {
    const clean = sanitize(this.name()).trim();
    if (clean === '') return 'blank'; // nothing written for an empty name
    const exists = this.store.list().some((v) => v.name === clean);
    if (exists) {
      const ok = await confirm(this.dlgHost, `Overwrite "${clean}"?`);
      if (!ok) return 'declined'; // declined → store untouched
      this.store.save(this.buildVariant(clean));
      this.refreshVariants();
      return 'overwrote';
    }
    this.store.save(this.buildVariant(clean));
    this.refreshVariants();
    return 'saved';
  }

  /** Apply the currently-selected variant to the pending layout (a no-op if none is selected). */
  applySelected(): void {
    const name = this.selectedVariantName();
    if (name === undefined) return;
    const v = this.store.list().find((x) => x.name === name);
    if (v !== undefined) this.applyStored(v);
  }

  /**
   * Delete a variant after a nested confirm. Declining leaves the store untouched; confirming removes it
   * (and clears the default if it named it, on the store side).
   *
   * @param name The variant name to delete.
   * @returns `'deleted'` or `'declined'`.
   */
  async deleteStored(name: string): Promise<'deleted' | 'declined'> {
    const ok = await confirm(this.dlgHost, `Delete "${name}"?`);
    if (!ok) return 'declined';
    this.store.delete(name);
    this.refreshVariants();
    this.variantSelected.set(0);
    return 'deleted';
  }

  /** Delete the currently-selected variant (nested confirm); `'none'` when nothing is selected. */
  async deleteSelected(): Promise<'deleted' | 'declined' | 'none'> {
    const name = this.selectedVariantName();
    if (name === undefined) return 'none';
    return this.deleteStored(name);
  }

  /** Mark a variant the store default. The grid layout is not changed (no auto-apply). */
  setDefaultStored(name: string): void {
    this.store.setDefault(name);
  }

  /** Mark the currently-selected variant the default (a no-op if none is selected). */
  setDefaultSelected(): void {
    const name = this.selectedVariantName();
    if (name !== undefined) this.setDefaultStored(name);
  }

  // ── Result ───────────────────────────────────────────────────────────────────────────────────────

  /**
   * The pending layout as a {@link GridVariant} — every column named (full order) so OK deterministically
   * sets or clears each width override. Sort/filter carry through from the pending model.
   *
   * @returns The pending variant to hand to `grid.applyVariant` on OK.
   */
  result(): GridVariant {
    const cols = this.cols();
    return {
      name: '(current)',
      columns: cols.map((c) => {
        const w = parseWidth(this.widthText.get(c.id)?.() ?? '');
        return w === undefined ? { id: c.id, visible: c.visible } : { id: c.id, visible: c.visible, width: w };
      }),
      freeze: {
        left: cols.filter((c) => c.freeze === 'left').map((c) => c.id),
        right: cols.filter((c) => c.freeze === 'right').map((c) => c.id),
      },
      sort: this.sortModel().map((k) => ({ ...k })),
      filter: this.filterModel().map((f) => ({ ...f })),
    };
  }
}
