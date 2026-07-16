/**
 * The two opt-in leading affordances of {@link EditableDataGrid} — a selection **checkbox column** and a
 * **row-number gutter** — as fixed-width *synthetic prefix* cells that live in the left-pinned region.
 *
 * They are deliberately NOT caller {@link GridColumn}s: they are not in the sortable/filterable
 * `apportionColumns` track, are never reached by the `←`/`→` column cursor, and never scroll
 * horizontally. This module exports the pure geometry/glyph helpers plus two internal band views —
 * `SyntheticHeaderBand` (the tri-state header box) and `SyntheticBodyBand` (per-row checkbox + gutter) —
 * that {@link buildGridBody} prepends as a leading segment to the leftmost panel. The body band extends
 * the engine `GridRows`, so it inherits the identical virtual-scroll window from the shared `focused` /
 * `display` and stays row-aligned with the data body for free.
 */
import { GridRows, View } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, GridRowsConfig, Signal } from '@jsvision/ui';
import type { Key, TriState } from './selection.js';

/** The fixed width of the checkbox cell (`[x]` / `[ ]` / `[-]`). */
const CHECKBOX_WIDTH = 3;

/** Which synthetic prefix cells are enabled, and the row count that sizes the gutter. */
export interface SyntheticPrefix {
  /** Show the per-row selection checkbox + the tri-state header box (`opts.checkboxColumn`). */
  readonly checkbox: boolean;
  /** Show the 1-based display-number gutter (`opts.rowNumbers`). */
  readonly rowNumbers: boolean;
  /** The displayed row count — sizes the gutter to the widest 1-based number. */
  readonly rowCount: number;
}

/** The gutter's fixed width in cells: the digit count of the largest 1-based number plus a trailing pad. */
function gutterWidth(rowCount: number): number {
  return String(Math.max(1, rowCount)).length + 1;
}

/**
 * The total synthetic-prefix width in cells (0 when neither affordance is enabled). This is reserved to
 * the left of the data columns, in the non-scrolling region.
 *
 * @param p Which affordances are enabled and the row count.
 * @returns The prefix width in cells.
 * @example
 * ```ts
 * import { prefixWidth } from '@jsvision/datagrid';
 * prefixWidth({ checkbox: true, rowNumbers: false, rowCount: 0 }); // 3  → "[x]"
 * prefixWidth({ checkbox: false, rowNumbers: true, rowCount: 100 }); // 4 → "100 "
 * prefixWidth({ checkbox: true, rowNumbers: true, rowCount: 9 }); // 3 + 2 = 5
 * ```
 */
export function prefixWidth(p: SyntheticPrefix): number {
  return (p.checkbox ? CHECKBOX_WIDTH : 0) + (p.rowNumbers ? gutterWidth(p.rowCount) : 0);
}

/**
 * The per-row checkbox glyph for a selection state.
 *
 * @param selected Whether the row is in the selection.
 * @returns `'[x]'` when selected, `'[ ]'` otherwise.
 * @example
 * ```ts
 * import { checkboxGlyph } from '@jsvision/datagrid';
 * checkboxGlyph(true); // '[x]'
 * checkboxGlyph(false); // '[ ]'
 * ```
 */
export function checkboxGlyph(selected: boolean): string {
  return selected ? '[x]' : '[ ]';
}

/**
 * The tri-state header-checkbox glyph over the displayed rows.
 *
 * @param state `'none'` (empty box), `'some'` (dash), or `'all'` (checked).
 * @returns `'[ ]'`, `'[-]'`, or `'[x]'`.
 * @example
 * ```ts
 * import { headerCheckboxGlyph } from '@jsvision/datagrid';
 * headerCheckboxGlyph('none'); // '[ ]'
 * headerCheckboxGlyph('some'); // '[-]'
 * headerCheckboxGlyph('all');  // '[x]'
 * ```
 */
export function headerCheckboxGlyph(state: TriState): string {
  return state === 'all' ? '[x]' : state === 'some' ? '[-]' : '[ ]';
}

/**
 * The right-aligned 1-based display number for a body row, padded to `width` with a trailing gap cell so
 * the number never touches the first data column.
 *
 * @param index0 The 0-based display index of the row.
 * @param width The gutter width in cells (see {@link prefixWidth}).
 * @returns A `width`-cell string: the right-aligned `index0 + 1` plus a trailing space.
 * @example
 * ```ts
 * import { gutterLabel } from '@jsvision/datagrid';
 * gutterLabel(0, 4); // '  1 '  (display row 1)
 * gutterLabel(99, 4); // '100 '
 * ```
 */
export function gutterLabel(index0: number, width: number): string {
  const label = String(index0 + 1);
  const usable = Math.max(1, width - 1); // reserve the last cell as a gap before the data columns
  return `${label.padStart(usable).slice(-usable)} `;
}

/** Construction config for {@link SyntheticHeaderBand}. */
export interface SyntheticHeaderBandConfig {
  /** Which affordances are enabled + the row count (fixes the band width). */
  readonly prefix: SyntheticPrefix;
  /** The header tri-state over the current display (`triState(selectedKeys(), displayKeys())`). */
  readonly triState: () => TriState;
  /** Header-box click sink — the container toggles select-all/clear by the current tri-state. */
  readonly onToggleAll: () => void;
}

/**
 * The header row's synthetic-prefix cell: the tri-state select-all box (when the checkbox column is on)
 * over a blank gutter slot, painted in the `tableHeader` role so it reads as part of the header. A
 * mouse-down on the box fires `onToggleAll`; a click on the gutter slot is inert. Passive chrome — it is
 * not focusable, so it never steals the keyboard from the body.
 */
export class SyntheticHeaderBand extends View {
  override focusable = false;
  private readonly prefix: SyntheticPrefix;
  private readonly triState: () => TriState;
  private readonly onToggleAll: () => void;

  /** @param cfg The prefix spec, the tri-state thunk, and the select-all sink. */
  constructor(cfg: SyntheticHeaderBandConfig) {
    super();
    this.prefix = cfg.prefix;
    this.triState = cfg.triState;
    this.onToggleAll = cfg.onToggleAll;
    this.onMount(() => {
      // Repaint when the tri-state changes (a selection or display change flips none/some/all).
      this.bind(
        () => this.triState(),
        () => undefined,
      );
    });
  }

  draw(ctx: DrawContext): void {
    const header = ctx.color('tableHeader');
    ctx.fill(' ', header); // blank the whole band in the header colour
    if (this.prefix.checkbox) ctx.text(0, 0, headerCheckboxGlyph(this.triState()), header);
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse' || inner.kind !== 'down') return;
    const local = ev.local;
    if (local !== undefined && this.prefix.checkbox && local.x < CHECKBOX_WIDTH) this.onToggleAll();
    ev.handled = true; // consume clicks in the prefix band (never fall through to the header behind)
  }
}

/** Construction config for {@link SyntheticBodyBand} (the engine grid config plus the prefix wiring). */
export interface SyntheticBodyBandConfig<T> extends GridRowsConfig<T> {
  /** Which affordances are enabled + the row count (fixes the band width). */
  readonly prefix: SyntheticPrefix;
  /** The datagrid selection set — the per-row checkbox reads its membership. */
  readonly selectedKeys: Signal<ReadonlySet<Key>>;
  /** Row identity (to test selection membership per row). */
  readonly rowKey: (row: T) => Key;
  /** Per-row checkbox click sink — toggles the row at a display index (the container moves the cursor). */
  readonly onToggleRow: (rowIndex: number) => void;
  /** Grid-wide focus predicate — the focused row lights up while any panel holds the keyboard. */
  readonly active: () => boolean;
  /** Lower / upper clamp on the virtual window's top row (frozen-rows split); defaults `0` / `∞`. */
  readonly rowFloor?: number;
  readonly rowCeil?: number;
}

/**
 * The body's synthetic-prefix band: the per-row `[ ]`/`[x]` checkbox and the 1-based gutter number,
 * painted on each row's own background colour (focused > selected > zebra > normal) so the prefix reads
 * as a continuous part of the row. It subclasses the engine `GridRows` purely to inherit the identical
 * virtual-scroll window (the shared `focused` / `display`), so it stays row-aligned with the data body
 * with no scroll bookkeeping of its own. A mouse-down on a checkbox cell toggles that row; the gutter is
 * display-only. Not focusable — the data body owns the keyboard.
 */
export class SyntheticBodyBand<T> extends GridRows<T> {
  override focusable = false;
  private readonly prefix: SyntheticPrefix;
  private readonly selectedKeys: Signal<ReadonlySet<Key>>;
  private readonly bandRowKey: (row: T) => Key;
  private readonly onToggleRow: (rowIndex: number) => void;
  private readonly active: () => boolean;
  private readonly rowFloor: number;
  private readonly rowCeil: number;
  private readonly checkboxW: number;
  private readonly gutterW: number;

  /** @param cfg The engine grid config plus the prefix spec, selection set, and toggle sink. */
  constructor(cfg: SyntheticBodyBandConfig<T>) {
    super(cfg);
    this.prefix = cfg.prefix;
    this.selectedKeys = cfg.selectedKeys;
    this.bandRowKey = cfg.rowKey;
    this.onToggleRow = cfg.onToggleRow;
    this.active = cfg.active;
    this.rowFloor = cfg.rowFloor ?? 0;
    this.rowCeil = cfg.rowCeil ?? Number.POSITIVE_INFINITY;
    this.checkboxW = this.prefix.checkbox ? CHECKBOX_WIDTH : 0;
    this.gutterW = this.prefix.rowNumbers ? gutterWidth(this.prefix.rowCount) : 0;
    this.onMount(() => {
      // Repaint when the selection changes so the checkboxes flip reactively (the base binds focused/display).
      this.bind(
        () => this.selectedKeys(),
        () => undefined,
      );
    });
  }

  /** Keep the focused row visible (base), then clamp the window top into `[rowFloor, rowCeil]` (frozen rows). */
  protected override updateTop(): void {
    super.updateTop();
    this.topItem = Math.max(this.rowFloor, Math.min(this.topItem, this.rowCeil));
  }

  override draw(ctx: DrawContext): void {
    const rows = ctx.size.height;
    const width = ctx.size.width;
    const display = this.display();
    const range = display.length;
    const normal = ctx.color('listNormal');
    if (range === 0) {
      ctx.fill(' ', normal);
      return;
    }
    this.updateTop();
    const top = this.topItem;
    const focusedRow = Math.max(0, Math.min(this.focused(), range - 1));
    const active = this.active();
    const selectedKeys = this.selectedKeys();

    for (let i = 0; i < rows; i += 1) {
      const item = top + i;
      if (item >= range) {
        ctx.fillRect(0, i, width, 1, ' ', normal); // blank trailing row
        continue;
      }
      const row = display[item];
      const selected = selectedKeys.has(this.bandRowKey(row));
      const zebra = this.zebra && (item & 1) === 1;
      // Match the data body's row-colour priority: focused > selected > zebra > normal. A selected row
      // paints the dedicated `gridSelectedRow` band so its checkbox/gutter reads on the same highlight.
      const roleName =
        item === focusedRow
          ? active
            ? 'listFocused'
            : 'listSelected'
          : selected
            ? 'gridSelectedRow'
            : zebra
              ? 'staticText'
              : 'listNormal';
      const style = ctx.color(roleName);
      ctx.fillRect(0, i, width, 1, ' ', style); // blank the band row in its colour
      if (this.prefix.checkbox) ctx.text(0, i, checkboxGlyph(selected), style);
      if (this.prefix.rowNumbers) ctx.text(this.checkboxW, i, gutterLabel(item, this.gutterW), style);
    }
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'mouse' || inner.kind !== 'down') return;
    const local = ev.local;
    if (local !== undefined) {
      const range = this.display().length;
      // A click on the checkbox cell toggles that row; the gutter is display-only.
      if (range > 0 && this.prefix.checkbox && local.x < this.checkboxW) {
        this.onToggleRow(Math.min(this.topItem + local.y, range - 1));
      }
    }
    ev.handled = true; // consume clicks in the prefix band (never fall through to the panel behind)
  }
}
