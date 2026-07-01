/**
 * `ListBox` — the string-list preset of {@link ListView} (RD-11 AC-7, PA-15).
 *
 * Turbo Vision `TListBox` (`source/tvision/tlistbox.cpp`) is a `TListViewer` whose `getText`
 * (`:52`) is `items->at(item)` — the identity string. `ListBox` = `ListView<string>` with
 * `getText = (s) => s`, bound to a `Signal<string[]>`; a change to the items signal re-renders the
 * visible rows and clamps `focused` into the new range (TV `newList`, `:63`) — behaviour inherited
 * from `ListView`/`ListRows` (its items-length bind clamps focused). `.js` per NodeNext.
 */
import { ListView } from './list-view.js';
import type { ListViewOptions } from './list-view.js';

/** Construction options for {@link ListBox} — {@link ListViewOptions} without the fixed `getText`. */
export type ListBoxOptions = Omit<ListViewOptions<string>, 'getText'>;

/** A single-column list of strings over a `Signal<string[]>`. */
export class ListBox extends ListView<string> {
  /**
   * @param opts `items` (a `Signal<string[]>`) + optional `focused`/`selected`/`onSelect`/`command`/
   *   `sorted`/`typeAhead` (identical to {@link ListViewOptions} minus `getText`).
   */
  constructor(opts: ListBoxOptions) {
    super({ ...opts, getText: (s) => s });
  }
}
