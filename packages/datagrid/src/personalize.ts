/**
 * `personalizeGrid` — the public entry point for the end-user "Personalize columns" modal. It opens a
 * staged {@link PersonalizeDialog} over a grid: the user shows/hides, reorders, freezes, and resizes
 * columns and manages saved layout **variants**, and only **OK** commits the result to the grid (via
 * `grid.applyVariant`); **Cancel/Esc** leave the grid untouched. Persistence is the caller's — the
 * dialog reads and writes an app-provided {@link VariantStore}; the grid holds no registry.
 */
import { Commands } from '@jsvision/ui';
import type { ModalDialogHost } from '@jsvision/ui';
import type { EditableDataGrid } from './grid.js';
import { PersonalizeDialog } from './personalize-dialog.js';
import type { VariantStore } from './variant-store.js';

/** Options for {@link personalizeGrid}. */
export interface PersonalizeOptions {
  /** The app-provided store the dialog reads and writes variants through. */
  readonly store: VariantStore;
  /** The modal host (an `Application` satisfies it — as `formDialog`/`openFile` use). */
  readonly host: ModalDialogHost;
  /** The dialog title (default `'Personalize columns'`). */
  readonly title?: string;
}

/** The outcome of {@link personalizeGrid}: `ok` is `true` only when the user committed with OK. */
export interface PersonalizeResult {
  /** `true` when OK committed the pending layout; `false` on Cancel/Esc (the grid is untouched). */
  readonly ok: boolean;
}

/**
 * Open the "Personalize columns" modal over `grid` and resolve once the user closes it. On OK the
 * pending layout is committed with `grid.applyVariant`; on Cancel/Esc the grid is left exactly as it
 * was. The dialog ships **no** default keybinding — wire this to a menu item or a key of your choice.
 *
 * @param grid The grid to personalize.
 * @param opts The variant `store`, the modal `host`, and an optional `title`.
 * @returns `{ ok: true }` when the layout was committed, `{ ok: false }` on Cancel/Esc.
 * @example
 * ```ts
 * import { personalizeGrid, createMemoryVariantStore } from '@jsvision/datagrid';
 *
 * const store = createMemoryVariantStore(); // back it with a file/DB if you like
 * const { ok } = await personalizeGrid(grid, { store, host: app, title: 'Personalize columns' });
 * if (ok) {
 *   // the grid already reflects the user's chosen layout
 * }
 * ```
 */
export async function personalizeGrid<T>(
  grid: EditableDataGrid<T>,
  opts: PersonalizeOptions,
): Promise<PersonalizeResult> {
  const dlg = new PersonalizeDialog(grid, opts.store, opts.host, opts.title ?? 'Personalize columns');
  opts.host.desktop.addWindow(dlg);
  try {
    const command = await opts.host.loop.execView<string>(dlg);
    if (command === Commands.ok) {
      grid.applyVariant(dlg.result());
      return { ok: true };
    }
    return { ok: false }; // Cancel / Esc — the grid is untouched
  } finally {
    opts.host.desktop.removeWindow(dlg);
  }
}
