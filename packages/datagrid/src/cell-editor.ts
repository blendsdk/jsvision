/**
 * The cell-editor seam: `createCellEditor` builds the editor view mounted over a grid cell, two-way
 * bound to the edit field. It ships one default — a single-line text `Input` — and returns `null` for
 * a read-only column, which is how the grid rejects begin-edit. Typed editors (number, date, lookup
 * with value help) slot in behind this same signature in a later release, so the editing lifecycle
 * never has to change shape to gain them.
 */
import { Input } from '@jsvision/ui';
import type { View, Signal, Group } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import { isEditable } from './column.js';

/**
 * What an editor may need to open its own sub-UI (a dropdown or value-help popup) in a later release.
 * The default text `Input` ignores it — it is here so a richer editor can mount a popup without the
 * seam changing shape.
 */
export interface CellEditorHost {
  /** The grid's absolute overlay group — an editor with a popup mounts it here. */
  readonly overlay: Group;
}

/**
 * Build the editor view for a cell, two-way bound to `field`. Returns `null` when the column is
 * read-only (no `parse`/`set`), which the caller treats as "reject begin-edit". This default always
 * returns a single-line text `Input`; typed editors arrive behind this same signature later.
 *
 * @param column The typed column being edited.
 * @param field The edit-buffer signal (seeded from the cell, parsed back on commit).
 * @param _host What a richer editor would use to open a sub-popup; ignored by the text `Input`.
 * @returns A focusable editor view bound to `field`, or `null` for a read-only column.
 * @example
 * ```ts
 * import { Group, signal } from '@jsvision/ui';
 * import { column, createCellEditor } from '@jsvision/datagrid';
 * interface Person { name: string; }
 * const name = column({
 *   id: 'name', title: 'Name', value: (r: Person) => r.name,
 *   parse: (t) => t, set: (r, v) => { r.name = v; },
 * });
 * const field = signal('Ada');
 * const editor = createCellEditor(name, field, { overlay: new Group() }); // an Input bound to `field`
 * ```
 */
export function createCellEditor<T>(column: GridColumn<T>, field: Signal<string>, _host: CellEditorHost): View | null {
  if (!isEditable(column)) return null;
  return new Input({ value: field });
}
