/**
 * A virtual-scroll list of items of any type `T`, laid out as a focusable rows renderer beside an
 * owned vertical scroll bar. It draws only the visible window, so it stays fast for large lists, and
 * supports keyboard navigation (↑↓/PgUp/PgDn/Home/End), mouse selection, the wheel, optional
 * ascending-`getText` sorting, and optional case-insensitive type-ahead.
 *
 * Bind `items` (a `Signal<T[]>`) and a `getText` to render each row. The `focused` (highlighted) and
 * `selected` (chosen) indices are exposed as signals you can read or drive; the owned bar shares the
 * `focused` signal so it always reflects the current row.
 *
 * A plain group is not itself a focus leaf, so focus and clicks descend to {@link rows} — focus that
 * view (`loop.focusView(list.rows)`), not the `ListView` group. Multi-column mode (`numCols > 1`)
 * lays the items out column-major with a `│` divider between columns while keeping vertical scrolling.
 */
import { Group } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { ScrollBar } from '../scroll/index.js';
import { ListRows } from './list-rows.js';
import type { ListRoles } from './list-rows.js';

/** Construction options for {@link ListView}. */
export interface ListViewOptions<T> {
  /** The source items. */
  items: Signal<T[]>;
  /** Render an item to its row text. */
  getText: (item: T) => string;
  /** The focused (highlighted) display index (default an internal signal at 0). */
  focused?: Signal<number>;
  /** The selected (chosen) display index (default an internal signal at -1). */
  selected?: Signal<number>;
  /** Activation callback (Enter/Space or double-click); `index` is display order, `item` the value. */
  onSelect?: (index: number, item: T) => void;
  /** Command emitted on activation (like `Button`). */
  command?: string;
  /** Display items in ascending `getText` order (stable); `focused`/`selected` index the display. */
  sorted?: boolean;
  /** Enable the linear case-insensitive prefix type-ahead. */
  typeAhead?: boolean;
  /** Row theme roles (default the standard `list*` roles); override for a different palette. */
  roles?: ListRoles;
  /**
   * Number of columns (default `1`). `>1` lays the items out column-major with a `│` divider between
   * columns; the scroll model stays vertical.
   */
  numCols?: number;
  /**
   * Inject an externally owned + placed `ScrollBar` to bind to, instead of this view owning a vertical
   * right-edge bar. When provided, `ListView` does not create or lay out a bar — the caller owns and
   * places it (e.g. a horizontal bottom bar) and this view only wires the rows renderer to drive it.
   * The injected bar must share this view's `focused` signal (construct it with `value: <that signal>`).
   */
  bar?: ScrollBar;
}

/**
 * A single-column virtual-scroll list: a rows renderer + an owned vertical scroll bar.
 *
 * @example
 * import { ListView, Group, createEventLoop, signal, at } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * interface Person { name: string; age: number; }
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const people = signal<Person[]>([{ name: 'Ada', age: 36 }, { name: 'Alan', age: 41 }]);
 * const selected = signal(-1);
 * const list = new ListView<Person>({
 *   items: people,
 *   getText: (p) => `${p.name} (${p.age})`,
 *   selected,
 *   onSelect: (index, person) => console.log('chose', person.name),
 * });
 *
 * const root = new Group();
 * root.add(at(list, 0, 0, 24, 8));
 * const loop = createEventLoop({ width: 24, height: 8 }, { caps });
 * loop.mount(root);
 * loop.focusView(list.rows); // focus the rows renderer, not the group
 */
export class ListView<T> extends Group {
  /** Lay the children out horizontally: `[rows fr | bar 1]`. */
  override readonly layout: Readonly<LayoutProps> = { direction: 'row' };
  /** The focusable rows renderer (the focus target — a `Group` is not itself a focus leaf). */
  readonly rows: ListRows<T>;
  /** The owned vertical scroll bar (its `value` is the shared `focused` signal). */
  protected readonly bar: ScrollBar;
  /** The focused-index signal (shared with the bar), exposed for binding. */
  readonly focused: Signal<number>;
  /** The selected-index signal, exposed for binding (`-1` = none). */
  readonly selected: Signal<number>;

  /**
   * @param opts `items` + `getText` + optional `focused`/`selected` signals, `onSelect`/`command`,
   *   `sorted`, `typeAhead`.
   */
  constructor(opts: ListViewOptions<T>) {
    super();
    this.focused = opts.focused ?? signal(0);
    this.selected = opts.selected ?? signal(-1);
    this.rows = new ListRows<T>({
      items: opts.items,
      getText: opts.getText,
      focused: this.focused,
      selected: this.selected,
      sorted: opts.sorted ?? false,
      typeAhead: opts.typeAhead ?? false,
      onSelect: opts.onSelect,
      command: opts.command,
      roles: opts.roles,
      numCols: opts.numCols,
    });
    this.rows.setLayout({ size: { kind: 'fr', weight: 1 } });
    this.bar = opts.bar ?? new ScrollBar({ value: this.focused, orientation: 'vertical' });
    this.rows.bar = this.bar; // the rows renderer re-limits the bar's range on each draw

    if (opts.bar === undefined) {
      // Default: this view owns + lays out the vertical right-edge bar as a `[rows fr | bar 1]` child.
      this.bar.setLayout({ size: { kind: 'fixed', cells: 1 } });
      this.add(this.rows); // z-order: rows (left) then bar (right)
      this.add(this.bar);
    } else {
      // Injected bar: the caller owns and places it as an absolute sibling; this view only holds the
      // rows, which fill it. The bar is added to the tree by the caller.
      this.add(this.rows);
    }
  }
}
