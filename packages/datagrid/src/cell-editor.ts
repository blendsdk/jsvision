/**
 * The cell-editor seam: `createCellEditor` builds the editor view mounted over a grid cell, two-way
 * bound to the edit field. A column's optional `editor` descriptor selects *which* typed widget a cell
 * mounts — a filtered text `Input` today, and (as the switch grows) a checkbox, a date picker, or a
 * value-help dropdown — while the column's `parse`/`set` pair still decides *whether* the cell is
 * editable at all. A read-only column, or an explicit `{ kind: 'readonly' }`, yields `null`, which is
 * how the grid rejects begin-edit. The editing lifecycle never changes shape to gain a new editor kind.
 */
import { Input, filter, signal, CheckGroup, DatePicker, ComboBox } from '@jsvision/ui';
import type { View, Signal, Group, Validator } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import { isEditable } from './column.js';
import { boolBridge, dateBridge, enumBridge, lookupBridge } from './editor-bridges.js';

/**
 * What an editor may need to open its own sub-UI (a dropdown or value-help popup). The default text
 * `Input` ignores it — it is here so a richer editor can mount a popup into the grid's overlay without
 * the seam changing shape.
 */
export interface CellEditorHost {
  /** The grid's absolute overlay group — an editor with a popup mounts it here. */
  readonly overlay: Group;
}

/**
 * The concrete editor a cell mounts. `text`/`integer`/`decimal` are single-line inputs (the numeric
 * kinds add a keystroke filter); `boolean`/`date`/`enum`/`lookup` are typed widgets; `readonly` yields
 * no editor; `custom` is the caller's own factory.
 *
 * @example
 * ```ts
 * import type { CellEditorKind } from '@jsvision/datagrid';
 * const kind: CellEditorKind = 'boolean'; // one of text|integer|decimal|boolean|date|enum|lookup|readonly|custom
 * ```
 */
export type CellEditorKind =
  'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'enum' | 'lookup' | 'readonly' | 'custom';

/**
 * One row of a value-help lookup: the stored `key` (what commits) and the shown `label` (what displays).
 *
 * @example
 * ```ts
 * import type { LookupItem } from '@jsvision/datagrid';
 * const row: LookupItem = { key: '7', label: 'Ada Lovelace' }; // commits '7', shows 'Ada Lovelace'
 * ```
 */
export interface LookupItem {
  /** The value written to the record on select (the stored key). */
  readonly key: string;
  /** The human-readable text shown in the dropdown. */
  readonly label: string;
}

/**
 * A lookup editor's rows: a static array, or an async provider invoked once when the editor opens. A
 * rejected provider leaves the dropdown empty; it never throws into the render loop.
 *
 * @example
 * ```ts
 * import type { LookupProvider } from '@jsvision/datagrid';
 * const staticRows: LookupProvider = [{ key: '7', label: 'Ada' }];
 * const asyncRows: LookupProvider = async () => (await fetch('/api/customers')).json();
 * ```
 */
export type LookupProvider = readonly LookupItem[] | (() => Promise<LookupItem[]>);

/**
 * The declarative editor descriptor a column carries. Only `kind` is required; the remaining fields
 * apply to specific kinds — `values` to `enum`, `items` to `lookup`, `create` to `custom`, and
 * `validator` to override a numeric kind's built-in keystroke filter.
 *
 * @example
 * ```ts
 * import type { CellEditorSpec } from '@jsvision/datagrid';
 * const boolSpec: CellEditorSpec = { kind: 'boolean' };
 * const enumSpec: CellEditorSpec = { kind: 'enum', values: ['open', 'paid', 'shipped'] };
 * const lookupSpec: CellEditorSpec = { kind: 'lookup', items: [{ key: '7', label: 'Ada' }] };
 * ```
 */
export interface CellEditorSpec {
  /** Which typed editor the cell mounts. */
  readonly kind: CellEditorKind;
  /** Live keystroke filter (defaults per kind; overrides the built-in default when set). */
  readonly validator?: Validator;
  /** The value set for `kind: 'enum'` — rendered in order; selecting one commits that string. */
  readonly values?: readonly string[];
  /** The rows for `kind: 'lookup'` (a static array or an async provider). */
  readonly items?: LookupProvider;
  /** The factory for `kind: 'custom'` — returns a `View` bound to `field`, honoring Enter=commit/Esc=cancel. */
  readonly create?: (field: Signal<string>, host: CellEditorHost) => View | null;
}

/**
 * Turn a column's `editor` descriptor into a concrete spec. An editor-less editable column defaults to
 * a plain text input (so a column that only sets `parse`/`set` edits exactly as before); a per-row
 * function is called with the row, falling back to text when no row is available (a direct factory call).
 */
function resolveSpec<T>(column: GridColumn<T>, row: T | undefined): CellEditorSpec {
  const e = column.editor;
  if (e === undefined) return { kind: 'text' };
  if (typeof e === 'function') {
    if (row === undefined) return { kind: 'text' };
    return e(row);
  }
  return e;
}

/**
 * The live keystroke filter for a numeric kind: an invalid character never enters the buffer, so the
 * committed string is filter-conformant. Text (and the non-input kinds) get no filter.
 */
function defaultValidator(kind: CellEditorKind): Validator | undefined {
  if (kind === 'integer') return filter('0-9-');
  if (kind === 'decimal') return filter('0-9.-');
  return undefined;
}

/**
 * Build the editor view for a cell, two-way bound to `field`. Returns `null` when the column is
 * read-only (no `parse`/`set`) or its editor resolves to `{ kind: 'readonly' }`, which the caller
 * treats as "reject begin-edit". Otherwise the column's `editor` descriptor selects the widget; with
 * no descriptor an editable column mounts a single-line text `Input`, exactly as before.
 *
 * @param column The typed column being edited.
 * @param field The edit-buffer signal (seeded from the cell, parsed back on commit).
 * @param host What a richer editor uses to open a sub-popup, and what a `custom` factory receives;
 *   ignored by the text/numeric inputs.
 * @param row The row being edited, used to resolve a per-row `editor` function; omit for a static spec.
 * @returns A focusable editor view bound to `field`, or `null` for a read-only column.
 * @example
 * ```ts
 * import { Group, signal } from '@jsvision/ui';
 * import { column, createCellEditor } from '@jsvision/datagrid';
 * interface Product { qty: number; }
 * const qty = column({
 *   id: 'qty', title: 'Qty', value: (r: Product) => r.qty,
 *   parse: (t) => Number(t), set: (r, v) => { r.qty = v; },
 *   editor: { kind: 'integer' }, // a digits-only keystroke filter
 * });
 * const field = signal('7');
 * const editor = createCellEditor(qty, field, { overlay: new Group() }); // a filtered Input bound to `field`
 * ```
 */
export function createCellEditor<T>(
  column: GridColumn<T>,
  field: Signal<string>,
  host: CellEditorHost,
  row?: T,
): View | null {
  if (!isEditable(column)) return null; // the parse+set editability rule wins over any `editor`
  const spec = resolveSpec(column, row);
  switch (spec.kind) {
    case 'text':
    case 'integer':
    case 'decimal':
      return new Input({ value: field, validator: spec.validator ?? defaultValidator(spec.kind) });
    case 'boolean':
      return new CheckGroup({ labels: [column.title], value: boolBridge(field) });
    case 'date':
      return new DatePicker({ value: dateBridge(field) });
    case 'enum': {
      const items = signal<string[]>([...(spec.values ?? [])]);
      return new ComboBox<string>({ items, getText: (s) => s, value: enumBridge(field), editable: false });
    }
    case 'lookup':
      return buildLookupEditor(spec, field);
    case 'custom':
      // The caller's factory owns the view; it is bound to `field` and honors the same Enter=commit /
      // Esc=cancel lifecycle as the built-in editors. A `create` returning `null` reads as read-only.
      return spec.create ? spec.create(field, host) : null;
    case 'readonly':
    default:
      return null; // explicit read-only opt-out (and the not-yet-built kinds until their case lands)
  }
}

/**
 * Build the select-only lookup `ComboBox`. A static array seeds the rows immediately; an async provider
 * loads once (fire-and-forget) into the live `items` signal, so the open list re-renders and the
 * current key re-matches its label when the rows arrive. A rejected provider leaves the rows empty — it
 * never throws into the render loop. The field holds the key; the ComboBox shows the label.
 */
function buildLookupEditor(spec: CellEditorSpec, field: Signal<string>): View {
  const items = signal<LookupItem[]>([]);
  const provider = spec.items;
  if (typeof provider === 'function') {
    void provider().then((rows) => items.set(rows)); // async — load once; a rejection leaves rows empty
  } else if (provider !== undefined) {
    items.set([...provider]); // static list — available immediately
  }
  return new ComboBox<LookupItem>({
    items,
    getText: (it) => it.label,
    value: lookupBridge(field, items),
    editable: false,
  });
}
