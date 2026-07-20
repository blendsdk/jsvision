/**
 * The string-list preset of {@link ListView}: a `ListView<string>` whose row text is the string
 * itself, so you only supply a `Signal<string[]>`. Writing a new array to that signal re-renders the
 * visible rows and clamps the focused index into the new range.
 */
import { ListView } from './list-view.js';
import type { ListViewOptions } from './list-view.js';

/** Construction options for {@link ListBox} — {@link ListViewOptions} without the fixed `getText`. */
export type ListBoxOptions = Omit<ListViewOptions<string>, 'getText'>;

/**
 * A single-column list of strings over a `Signal<string[]>`.
 *
 * @example
 * import { ListBox, Group, createEventLoop, signal, at } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const items = signal(['Apple', 'Banana', 'Grape', 'Kiwi', 'Mango']);
 * const focused = signal(0);
 * const selected = signal(-1);
 * const list = new ListBox({ items, focused, selected, typeAhead: true });
 *
 * const root = new Group();
 * root.add(at(list, 0, 0, 20, 8));
 * const loop = createEventLoop({ width: 20, height: 8 }, { caps });
 * loop.mount(root);
 * loop.focusView(list.rows); // the rows renderer is the focus target, not the group
 * // ↓ moves focus, typing "gr" jumps to "Grape", Enter sets `selected`.
 */
export class ListBox extends ListView<string> {
  /**
   * @param opts `items` (a `Signal<string[]>`) + optional `focused`/`selected`/`onSelect`/`command`/
   *   `sorted`/`typeAhead` (identical to {@link ListViewOptions} minus `getText`).
   */
  constructor(opts: ListBoxOptions) {
    super({ ...opts, getText: (s) => s });
  }
}
