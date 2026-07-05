/**
 * `ListView<T>` — a Turbo Vision `TListViewer` as a `Group` = a focusable rows-renderer + an
 * auto-owned vertical `ScrollBar`, laid out `[rows fr | bar 1]` (RD-11 AC-4/AC-5/AC-6, PA-2).
 *
 * Single column by default; `numCols > 1` renders TV's `TListViewer` **column-major** flow with a `│`
 * interior divider (the jsvision-ui/RD-09 PA-14 seam — the multi-column work RD-11 reserved for
 * "→ RD-07, AR-104" now lands here). The heavy lifting (drawing, keyboard/mouse, virtual scroll,
 * sorted/type-ahead) lives in the internal {@link ListRows}; this class just composes it with the
 * shared `focused` signal (also the bar's `value`, so the bar reflects the focused item — TV
 * `focusItem → vScrollBar.value`, `tlstview.cpp:161`). The `ScrollBar` is normally **owned** (a
 * vertical right-edge bar in `[rows fr | bar 1]`), but a caller may **inject** an externally-owned bar
 * via `bar` (e.g. `FileDialog`'s horizontal-bottom bar, PA-14) — then this view holds only the rows and
 * the caller places the bar. Expose {@link rows} as the focus target (a plain `Group` is not itself
 * focusable; Tab/click descend to the rows renderer). `.js` specifiers per NodeNext.
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
  /** Activation callback (Enter/Space); `index` is DISPLAY order, `item` the `T` (PF-003). */
  onSelect?: (index: number, item: T) => void;
  /** Command emitted on activation (like `Button`). */
  command?: string;
  /** Display items in ascending `getText` order (stable) — the `focused`/`selected` index the display. */
  sorted?: boolean;
  /** Enable the linear case-insensitive prefix type-ahead (PA-3). */
  typeAhead?: boolean;
  /** Row theme roles (default the RD-11 `list*` roles); override for a different viewer palette (RD-14). */
  roles?: ListRoles;
  /**
   * Number of columns (default `1`). `>1` renders TV's `TListViewer` **column-major** flow with a `│`
   * interior divider (`listDivider`); the scroll model stays vertical (PA-14, `tlstview.cpp:96-141`).
   */
  numCols?: number;
  /**
   * Inject an externally-owned/placed `ScrollBar` to bind to (default: this view **owns** a vertical
   * right-edge bar in `[rows fr | bar 1]`). When provided, `ListView` does **not** create/lay-out a bar
   * — the caller owns + places it (e.g. `FileDialog` hands `FileList` its horizontal-bottom bar exactly
   * as TV's dialog hands `sb` to `TFileList`); this view only wires the rows renderer to drive it. The
   * bar must share this view's `focused` signal (construct it with `value: <the focused signal>`) so it
   * acts as the vScrollBar. PA-14.
   */
  bar?: ScrollBar;
}

/** A single-column virtual-scroll list: a rows renderer + an owned vertical scroll bar. */
export class ListView<T> extends Group {
  /** Lay the children out horizontally: `[rows fr | bar 1]`. */
  override layout: LayoutProps = { direction: 'row' };
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
    this.rows.layout = { size: { kind: 'fr', weight: 1 } };
    this.bar = opts.bar ?? new ScrollBar({ value: this.focused, orientation: 'vertical' });
    this.rows.bar = this.bar; // the rows renderer re-limits the bar each draw (TV setStep)

    if (opts.bar === undefined) {
      // Default: this view owns + lays out the vertical right-edge bar as a `[rows fr | bar 1]` child.
      this.bar.layout = { size: { kind: 'fixed', cells: 1 } };
      this.add(this.rows); // z-order: rows (left) then bar (right)
      this.add(this.bar);
    } else {
      // Injected: the caller owns + places the bar as an absolute sibling (TV hands `sb` to `TFileList`);
      // this view only holds the rows, which fill it. The bar is added to the tree by the caller.
      this.add(this.rows);
    }
  }
}
