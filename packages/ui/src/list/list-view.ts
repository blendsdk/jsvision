/**
 * `ListView<T>` — a Turbo Vision `TListViewer` as a `Group` = a focusable rows-renderer + an
 * auto-owned vertical `ScrollBar`, laid out `[rows fr | bar 1]` (RD-11 AC-4/AC-5/AC-6, PA-2).
 *
 * Single column only (multi-column → RD-07, AR-104). The heavy lifting (drawing, keyboard/mouse,
 * virtual scroll, sorted/type-ahead) lives in the internal {@link ListRows}; this class just composes
 * it with the shared `focused` signal (also the bar's `value`, so the bar reflects the focused item —
 * TV `focusItem → vScrollBar.value`, `tlstview.cpp:161`) and the owned bar. Expose {@link rows} as the
 * focus target (a plain `Group` is not itself focusable; Tab/click descend to the rows renderer).
 * `.js` specifiers per NodeNext.
 */
import { Group } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { ScrollBar } from '../scroll/index.js';
import { ListRows } from './list-rows.js';

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
}

/** A single-column virtual-scroll list: a rows renderer + an owned vertical scroll bar. */
export class ListView<T> extends Group {
  /** Lay the children out horizontally: `[rows fr | bar 1]`. */
  override layout = { direction: 'row' as const };
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
    });
    this.rows.layout = { size: { kind: 'fr', weight: 1 } };
    this.bar = new ScrollBar({ value: this.focused, orientation: 'vertical' });
    this.bar.layout = { size: { kind: 'fixed', cells: 1 } };
    this.rows.bar = this.bar; // the rows renderer re-limits the bar each draw (TV setRange)

    this.add(this.rows); // z-order: rows (left) then bar (right)
    this.add(this.bar);
  }
}
