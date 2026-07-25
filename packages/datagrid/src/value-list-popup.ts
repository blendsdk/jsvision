/**
 * `ValueList` — the Excel-style distinct-value picker embedded in the filter popup. It populates
 * asynchronously from a `distinct()` thunk (grid-computed for in-memory sources, delegated to
 * `source.distinct` when present), shows one checkbox per distinct **formatted label** (sorted
 * case-insensitively, and scrollable so a large distinct set stays usable), a type-ahead search that
 * narrows the *visible* labels without touching the selection, a Select All, and a visible truncation
 * disclosure when the distinct set was capped. Apply reports the checked label set, which the
 * container turns into a `{ kind: 'set' }` column filter.
 *
 * Its sections (search · checkbox list + scroll bar · Select All / Apply · status) flow top-to-bottom
 * via the `col` layout DSL directly on the host popup's background — it is not a separate card. The
 * checkbox list scrolls by keyboard, mouse wheel, and a grabbable scroll bar. All labels are checked
 * by default (equivalent to no filter); unchecking narrows the kept rows.
 */
import type { I18n } from '@jsvision/i18n';
import { Group, View, Input, Button, Text, ScrollBar, col, row, spacer, signal, grow, fixed } from '@jsvision/ui';
import type { Signal, DispatchEvent, DrawContext } from '@jsvision/ui';
import type { DistinctResult } from './filter.js';
import { buttonRow, buttonCellWidth } from './button-row.js';
import { createEnglishDatagridI18n, DATAGRID_ENGLISH_CATALOG } from './i18n/catalog.js';
import { datagridAcceleratorLabel } from './i18n/label.js';

/** Fixed rows around the checkbox list: search caption + search input + gap + buttons (2). The status
 * row is counted separately in {@link ValueList.desiredHeight} because it collapses when it is empty. */
const VALUE_LIST_CHROME_ROWS = 5;
/** The checkbox list's fixed height in rows — more values than this scroll; fewer leave blank rows. */
const LIST_ROWS = 8;

/**
 * The natural face width of the value-list's widest action button, so an embedding popup can size
 * every one of its buttons to a single shared width.
 *
 * @returns The widest of the value-list buttons' face widths, in cells.
 * @example
 * import { Button } from '@jsvision/ui';
 * import { valueListButtonWidth } from './value-list-popup.js';
 * import { buttonCellWidth } from './button-row.js';
 *
 * const apply = new Button('Apply');
 * const clear = new Button('Clear');
 * const width = Math.max(buttonCellWidth([apply, clear]), valueListButtonWidth());
 */
export function valueListButtonWidth(i18n?: I18n): number {
  const service = i18n ?? createEnglishDatagridI18n();
  return buttonCellWidth([
    new Button(datagridAcceleratorLabel(service, 'datagrid.filter.action.select-all', 'Select All', false)),
    new Button(datagridAcceleratorLabel(service, 'datagrid.filter.action.apply', 'Apply', false)),
  ]);
}

/** Sort distinct labels the way a user scans them: alphabetical, ignoring case. */
function sortLabels(labels: readonly string[], i18n?: I18n): string[] {
  return [...labels].sort((a, b) =>
    i18n === undefined
      ? a.localeCompare(b, undefined, { sensitivity: 'base' })
      : i18n.compare(a, b, { sensitivity: 'base' }),
  );
}

/** Construction config for {@link ValueList}. */
export interface ValueListConfig {
  /** Resolves to the column's distinct formatted labels (and a `truncated` flag when capped). */
  distinct: () => Promise<DistinctResult>;
  /** The currently-selected labels, checked on reopen; when omitted, every label starts checked. */
  current?: ReadonlySet<string>;
  /** Reports the checked label set (the container turns it into a `{ kind: 'set' }` filter). */
  onApply: (selected: ReadonlySet<string>) => void;
  /** Forced Select All / Apply width, so a popup can size all its buttons alike; omit to self-size. */
  buttonWidth?: number;
  /** Translation service for package-owned labels; defaults to isolated English text. */
  i18n?: I18n;
}

/**
 * The checkable label list — a self-drawing focusable leaf that paints the visible window of labels
 * with a `[x]`/`[ ]` box, tracks a keyboard focus row and a shared scroll offset, scrolls the focus
 * row into view, steps on the mouse wheel, and toggles a label on Space or a click. A sibling
 * {@link ScrollBar} (bound to the same offset) is re-limited from the live viewport on each draw — so
 * its thumb is grabbable and wheel/keyboard/drag all scroll the one list.
 */
class CheckboxList extends View {
  override focusable = true;
  private readonly focusedRow = signal(0);
  /** Last scroll-range max pushed to the bar; a change repaints the bar (its `value` alone did not move). */
  private lastBarMax = -1;

  constructor(
    private readonly visible: () => readonly string[],
    private readonly checked: Signal<ReadonlySet<string>>,
    private readonly onToggle: (label: string) => void,
    /** First-visible-row offset, shared two-way with the sibling scroll bar. */
    private readonly top: Signal<number>,
    /** The sibling scroll bar, re-limited from the live viewport + row count on each draw. */
    private readonly bar: ScrollBar,
  ) {
    super();
    this.onMount(() => {
      // Repaint when the visible labels, the checked set, the focus row, or the scroll offset change.
      this.bind(() => {
        this.visible();
        this.checked();
        this.focusedRow();
        this.top();
      });
    });
  }

  /** The largest valid scroll offset for `count` labels in a `height`-row viewport. */
  private maxTop(count: number, height: number): number {
    return Math.max(0, count - height);
  }

  override draw(ctx: DrawContext): void {
    const labels = this.visible();
    const checked = this.checked();
    const focused = this.focusedRow();
    const normal = ctx.color('listNormal');
    const h = ctx.size.height;
    const w = ctx.size.width;
    ctx.fill(' ', normal);
    const maxTop = this.maxTop(labels.length, h);
    const top = Math.min(this.top(), maxTop);
    for (let i = 0; i < h && top + i < labels.length; i += 1) {
      const idx = top + i;
      const label = labels[idx];
      const box = checked.has(label) ? '[x] ' : '[ ] ';
      const role = idx === focused ? ctx.color('listFocused') : normal;
      ctx.text(0, i, (box + label).slice(0, w), role);
    }
    // Re-limit the sibling scroll bar from the live viewport + row count (the draw-time sync ListView
    // uses): offsets 0..maxTop, a page = one viewport, an arrow (and thus one wheel notch) = one row.
    this.bar.setRange(0, maxTop, Math.max(1, h - 1), 1);
    // The bar only repaints when its bound offset moves, but its range also changes as labels load or
    // the search narrows — repaint it then so the thumb/track reflect the new extent (async populate).
    if (maxTop !== this.lastBarMax) {
      this.lastBarMax = maxTop;
      this.bar.invalidate();
    }
  }

  /** Move the focus row by `delta`, clamped to the label range, and scroll it into view. */
  private moveFocus(delta: number): void {
    const count = this.visible().length;
    const next = Math.min(Math.max(0, count - 1), Math.max(0, this.focusedRow() + delta));
    this.focusedRow.set(next);
    this.scrollIntoView(next);
  }

  /** Scroll by `delta` rows (the mouse wheel), clamped to the valid offset range. */
  private scrollBy(delta: number): void {
    const h = this.bounds.height;
    const maxTop = this.maxTop(this.visible().length, h);
    this.top.set(Math.min(maxTop, Math.max(0, this.top() + delta)));
  }

  /** Adjust the scroll offset so `row` sits within the viewport (using the last laid-out height). */
  private scrollIntoView(row: number): void {
    const h = this.bounds.height;
    if (h <= 0) return;
    let top = this.top();
    if (row < top) top = row;
    else if (row >= top + h) top = row - h + 1;
    this.top.set(Math.min(top, this.maxTop(this.visible().length, h)));
  }

  override onEvent(ev: DispatchEvent): void {
    const e = ev.event;
    if (e.type === 'wheel') {
      // Wheel over the list scrolls it (three rows per notch, matching the scroll bar).
      if (e.dir === 'up' || e.dir === 'down') {
        this.scrollBy(e.dir === 'up' ? -3 : 3);
        ev.handled = true;
      }
      return;
    }
    const labels = this.visible();
    if (e.type === 'key') {
      if (e.key === 'up') {
        this.moveFocus(-1);
        ev.handled = true;
      } else if (e.key === 'down') {
        this.moveFocus(1);
        ev.handled = true;
      } else if (e.key === 'space') {
        const label = labels[this.focusedRow()];
        if (label !== undefined) this.onToggle(label);
        ev.handled = true;
      }
    } else if (e.type === 'mouse' && e.kind === 'down') {
      // A click maps a viewport row to a label through the current scroll offset.
      const top = Math.min(this.top(), this.maxTop(labels.length, this.bounds.height));
      const idx = top + (ev.local?.y ?? -1);
      const label = labels[idx];
      if (label !== undefined) {
        this.focusedRow.set(idx);
        this.onToggle(label);
      }
      ev.handled = true;
    }
  }
}

/**
 * The Excel value-list picker — see the module overview.
 *
 * @example
 * import { ValueList } from '@jsvision/datagrid';
 *
 * const list = new ValueList({
 *   distinct: () => Promise.resolve({ values: ['east', 'north', 'west'] }),
 *   onApply: (selected) => { console.log('keep only', [...selected]); },
 * });
 * // A user checks/unchecks labels; drive it programmatically:
 * list.toggle('west');   // uncheck 'west'
 * list.apply();          // onApply(new Set(['east', 'north']))
 */
export class ValueList extends Group {
  private readonly i18n: I18n;
  private readonly comparisonI18n?: I18n;
  private readonly onApplySink: (selected: ReadonlySet<string>) => void;
  private readonly allLabels: Signal<string[]> = signal<string[]>([]);
  private readonly checked: Signal<ReadonlySet<string>>;
  private readonly truncatedFlag: Signal<boolean> = signal(false);
  private readonly loadingFlag: Signal<boolean> = signal(true);
  private readonly errorFlag: Signal<boolean> = signal(false);
  /** The search-narrowed, sorted labels (case-insensitive contains); a stable derived accessor. */
  private readonly visible: () => string[];

  /** The type-ahead search text — narrows the visible labels, never the selection. */
  readonly search: Signal<string> = signal('');

  /**
   * @param cfg The distinct thunk, the optional current selection, and the apply sink.
   */
  constructor(cfg: ValueListConfig) {
    super();
    this.i18n = cfg.i18n ?? createEnglishDatagridI18n();
    this.comparisonI18n = cfg.i18n;
    this.onApplySink = cfg.onApply;
    this.checked = signal<ReadonlySet<string>>(cfg.current ?? new Set());
    this.visible = this.derived(() => {
      const fold = (value: string): string =>
        this.comparisonI18n === undefined
          ? value.toLowerCase()
          : value.normalize('NFC').toLocaleLowerCase(this.comparisonI18n.locale);
      const q = fold(this.search());
      return sortLabels(
        this.allLabels().filter((label) => fold(label).includes(q)),
        this.comparisonI18n,
      );
    });

    const searchLabel = new Text(this.text('datagrid.filter.field.search'));
    fixed(searchLabel, 1);
    const searchInput = new Input({ value: this.search });
    fixed(searchInput, 1);

    // The checkbox list and its scroll bar share one offset signal: the list drives it from the
    // keyboard + wheel, the bar from clicks + a grabbable thumb, and each renders from it.
    const scrollTop = signal(0);
    const scrollBar = new ScrollBar({ value: scrollTop, orientation: 'vertical' });
    fixed(scrollBar, 1);
    const list = new CheckboxList(this.visible, this.checked, (label) => this.toggle(label), scrollTop, scrollBar);
    grow(list);
    const listRow = row({ fill: true }, list, scrollBar);

    const selectAll = new Button(this.action('datagrid.filter.action.select-all'), {
      onClick: () => this.selectAll(),
    });
    const apply = new Button(this.action('datagrid.filter.action.apply'), { onClick: () => this.apply() });
    const controls = buttonRow([selectAll, apply], cfg.buttonWidth);

    // One status line: loading → error → truncation disclosure → blank. Never silent about truncation.
    const status = new Text(() =>
      this.loadingFlag()
        ? this.text('datagrid.filter.status.loading')
        : this.errorFlag()
          ? this.text('datagrid.filter.status.error')
          : this.truncatedFlag()
            ? this.text('datagrid.filter.status.truncated')
            : '',
    );
    fixed(status, 1);
    status.state.visible = this.hasStatus(); // collapse the row once loaded, unless truncated/errored

    // Flow the sections top-to-bottom via the `col` DSL, filling the value-list's slot so they sit
    // directly on the popup's background — the popup root already supplies the padding. A one-row gap
    // separates the checkbox list from the Select All / Apply bar, matching the condition section.
    const inner = col({ position: 'fill' }, searchLabel, searchInput, listRow, spacer({ fixed: 1 }), controls, status);
    this.add(inner);

    this.onMount(() => {
      // The status row only occupies space while it has a message (loading / error / truncation);
      // otherwise it collapses so the value-list has no empty trailing row.
      this.bind(
        () => this.hasStatus(),
        (show) => {
          status.state.visible = show;
        },
        { relayout: true },
      );
      // Populate asynchronously; default every label to checked (equivalent to no filter) unless a
      // current selection was supplied. A rejection surfaces an inline error line, never a throw.
      cfg
        .distinct()
        .then((result) => {
          this.allLabels.set([...result.values]);
          this.truncatedFlag.set(result.truncated ?? false);
          this.loadingFlag.set(false);
          if (cfg.current === undefined) this.checked.set(new Set(result.values));
        })
        .catch(() => {
          this.loadingFlag.set(false);
          this.errorFlag.set(true);
        });
    });
  }

  /** Resolve one Datagrid-owned message with its canonical English fallback. */
  private text(key: keyof typeof DATAGRID_ENGLISH_CATALOG.messages): string {
    return this.i18n.t(key, { defaultMessage: DATAGRID_ENGLISH_CATALOG.messages[key] });
  }

  /** Resolve one optional-accelerator action label with its canonical English fallback. */
  private action(key: 'datagrid.filter.action.select-all' | 'datagrid.filter.action.apply'): string {
    const english = DATAGRID_ENGLISH_CATALOG.messages[key];
    if (typeof english !== 'string') throw new TypeError(`Datagrid label ${key} must be text.`);
    return datagridAcceleratorLabel(this.i18n, key, english, false);
  }

  /** The labels currently visible after the search filter (sorted, reactive). */
  visibleLabels(): readonly string[] {
    return this.visible();
  }

  /**
   * The height this value-list wants, in cells: its fixed chrome, the status row only while it has a
   * message, and the checkbox list's fixed height (a larger distinct set scrolls within it). Reactive
   * on the status — an embedding popup binds to it to drop the empty status row.
   *
   * @returns The desired total height of the value-list section, in cells.
   */
  desiredHeight(): number {
    return VALUE_LIST_CHROME_ROWS + (this.hasStatus() ? 1 : 0) + LIST_ROWS;
  }

  /** Whether the status line has a message to show (loading, error, or a truncation disclosure). */
  private hasStatus(): boolean {
    return this.loadingFlag() || this.errorFlag() || this.truncatedFlag();
  }

  /** The set of currently-checked labels (reactive). */
  checkedLabels(): ReadonlySet<string> {
    return this.checked();
  }

  /** Whether the distinct set was truncated by the source (reactive). */
  truncated(): boolean {
    return this.truncatedFlag();
  }

  /** Whether the distinct values are still loading (reactive). */
  loading(): boolean {
    return this.loadingFlag();
  }

  /**
   * Flip one label's checked state.
   *
   * @param label The label to toggle.
   */
  toggle(label: string): void {
    const next = new Set(this.checked());
    if (next.has(label)) next.delete(label);
    else next.add(label);
    this.checked.set(next);
  }

  /** Check every label (equivalent to clearing the value filter). */
  selectAll(): void {
    this.checked.set(new Set(this.allLabels()));
  }

  /** Report the checked label set through the apply sink. */
  apply(): void {
    this.onApplySink(new Set(this.checked()));
  }
}
