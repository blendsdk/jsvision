/**
 * `PersonalizeDialog` — the end-user "Personalize columns" modal (an internal view; the public entry is
 * `personalizeGrid` in `personalize.js`). It is **staged**: every edit mutates a *pending* layout held
 * by the dialog, and only OK commits it to the grid (via `grid.applyVariant(dlg.result())`); Cancel/Esc
 * leave the grid untouched. It composes existing `@jsvision/ui` widgets — a sync `Dialog` with
 * `okCancelButtons()`, a column region of built-once composite rows, and (added by the variants panel) a
 * store list — so the package stays zero-runtime-dependency.
 *
 * The column region reconciles per-row widgets with a list-cursor keyboard model using the event
 * router's focused-leaf → ancestor bubbling: each row's widgets are the focusable leaves (they handle
 * their own activation), while the row container owns a selection cursor and handles the `↑`/`↓` /
 * `Alt`+arrows the leaves ignore. Rows are built once and repositioned by a reactive index bind, so
 * keyboard focus survives every edit.
 */
import { Dialog, Group, View, Button, Text, Input, Scroller, okCancelButtons, filter, signal } from '@jsvision/ui';
import type { Signal, DispatchEvent, DrawContext, ModalDialogHost } from '@jsvision/ui';
import { sanitize } from '@jsvision/core';
import type { EditableDataGrid } from './grid.js';
import type { GridVariant } from './variant.js';
import type { SortKey } from './sort.js';
import type { ColumnFilter } from './filter.js';
import type { VariantStore } from './variant-store.js';

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
 * The row container: the Scroller's content Group. It holds one built-once composite row per column
 * (repositioned by a reactive index bind) and owns the selection cursor. It handles the `↑`/`↓` /
 * `Alt`+arrows that a focused row widget ignored (they bubble up to it), driving `selected` and
 * reorder; per-row widgets keep handling their own activation.
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
  /** The dialog's own content dimensions, known at construction (this.bounds is 0 until layout). */
  private readonly dlgW: number;
  private readonly dlgH: number;

  constructor(grid: EditableDataGrid<T>, store: VariantStore, host: ModalDialogHost, title: string) {
    const bounds = host.desktop.bounds;
    const w = Math.min(Math.max(48, bounds.width - 8), 64);
    const h = Math.min(Math.max(12, bounds.height - 4), 20);
    super({ title, width: w, height: h });
    this.layout = { ...this.layout, padding: 0 }; // place children at explicit frame offsets (message-box/form-dialog idiom)
    this.dlgW = w;
    this.dlgH = h;
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

    this.region = new ColumnRegion(this as PersonalizeDialog<unknown>);
    this.buildColumnRegion();
    this.buildFooter();
  }

  // ── Layout ─────────────────────────────────────────────────────────────────────────────────────

  /** Build the built-once composite rows, wrap them in a scroller, and pin the region as the body. */
  private buildColumnRegion(): void {
    const order = this.cols();
    const rowWidth = Math.max(48, this.dlgW - 2);
    for (const col of order) {
      this.rowById.set(col.id, this.buildRow(col, rowWidth));
    }
    // Position the rows by their working-order index; re-bind on reorder so built-once rows move.
    this.region.onMount(() => {
      this.region.bind(
        () => this.cols(),
        (o) => {
          o.forEach((c, i) => {
            const row = this.rowById.get(c.id);
            if (row !== undefined)
              row.layout = {
                position: 'absolute',
                rect: { x: 0, y: i * ROW_HEIGHT, width: rowWidth, height: ROW_HEIGHT },
              };
          });
        },
        { relayout: true },
      );
    });
    for (const col of order) this.region.add(this.rowById.get(col.id)!);

    const scroller = new Scroller({
      content: this.region,
      extent: () => ({ width: rowWidth, height: Math.max(1, this.cols().length * ROW_HEIGHT) }),
      scrollbars: 'vertical',
    });
    scroller.layout = {
      position: 'absolute',
      rect: { x: 1, y: 1, width: this.dlgW - 2, height: Math.max(1, this.dlgH - 6) },
    };
    this.add(scroller);

    // The live visibility read-out, e.g. "4 of 6 columns visible", reactive on the pending visibility.
    const echo = new Text(() => `${this.visibleCount()} of ${this.cols().length} columns visible`);
    echo.layout = {
      position: 'absolute',
      rect: { x: 1, y: Math.max(1, this.dlgH - 4), width: this.dlgW - 2, height: 1 },
    };
    this.add(echo);
  }

  /** Build one composite row: marker · visibility toggle · title · freeze cycle + side · width input. */
  private buildRow(col: WorkingCol, rowWidth: number): Group {
    const row = new Group();
    const id = col.id;

    const marker = new Text(() => (this.cols()[this.selectedIdx()]?.id === id ? '▸' : ' '));
    marker.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 1, height: 1 } };

    const toggle = new ToggleCell(
      () => this.isVisible(id),
      () => this.toggleVisibility(id),
      () => this.isLastVisible(id),
    );
    toggle.layout = { position: 'absolute', rect: { x: 2, y: 0, width: 3, height: 1 } };
    this.toggleById.set(id, toggle);

    const title = new Text(col.title);
    title.layout = { position: 'absolute', rect: { x: 6, y: 0, width: 16, height: 1 } };

    const freezeBtn = new Button('Freeze', { onClick: () => this.cycleFreeze(id) });
    freezeBtn.layout = { position: 'absolute', rect: { x: 23, y: 0, width: 8, height: 1 } };
    const freezeSide = new Text(() => this.freezeOf(id));
    freezeSide.layout = { position: 'absolute', rect: { x: 32, y: 0, width: 6, height: 1 } };

    const widthSig = this.widthText.get(id)!;
    const widthInput = new Input({ value: widthSig, maxLength: WIDTH_MAX_DIGITS, validator: filter('0-9') });
    widthInput.layout = { position: 'absolute', rect: { x: 40, y: 0, width: 5, height: 1 } };

    row.add(marker);
    row.add(toggle);
    row.add(title);
    row.add(freezeBtn);
    row.add(freezeSide);
    row.add(widthInput);
    row.layout = { position: 'absolute', rect: { x: 0, y: 0, width: rowWidth, height: ROW_HEIGHT } };
    return row;
  }

  /** Place OK / Cancel at the dialog foot; OK is the default (Enter) and commits, Cancel discards. */
  private buildFooter(): void {
    const [ok, cancel] = okCancelButtons();
    const y = Math.max(2, this.dlgH - 3);
    ok.layout = { position: 'absolute', rect: { x: Math.max(1, this.dlgW - 24), y, width: 10, height: 2 } };
    cancel.layout = { position: 'absolute', rect: { x: Math.max(12, this.dlgW - 13), y, width: 12, height: 2 } };
    this.add(ok);
    this.add(cancel);
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
  protected applyStored(variant: GridVariant): void {
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
