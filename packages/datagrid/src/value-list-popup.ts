/**
 * `ValueList` — the Excel-style distinct-value picker embedded in the filter popup. It populates
 * asynchronously from a `distinct()` thunk (grid-computed for in-memory sources, delegated to
 * `source.distinct` when present), shows one checkbox per distinct **formatted label**, a type-ahead
 * search that narrows the *visible* labels without touching the selection, a Select All, and a visible
 * truncation disclosure when the distinct set was capped. Apply reports the checked label set, which the
 * container turns into a `{ kind: 'set' }` column filter.
 *
 * All labels are checked by default (equivalent to no filter); unchecking narrows the kept rows.
 */
import { Group, View, Input, Button, Text, signal } from '@jsvision/ui';
import type { Signal, DispatchEvent, DrawContext } from '@jsvision/ui';
import type { DistinctResult } from './filter.js';

/** Construction config for {@link ValueList}. */
export interface ValueListConfig {
  /** Resolves to the column's distinct formatted labels (and a `truncated` flag when capped). */
  distinct: () => Promise<DistinctResult>;
  /** The currently-selected labels, checked on reopen; when omitted, every label starts checked. */
  current?: ReadonlySet<string>;
  /** Reports the checked label set (the container turns it into a `{ kind: 'set' }` filter). */
  onApply: (selected: ReadonlySet<string>) => void;
}

/**
 * The scrollable, checkable label list — a self-drawing leaf that paints the visible labels with a
 * `[x]`/`[ ]` box, tracks a keyboard focus row, and toggles a label on Space or a click.
 */
class CheckboxList extends View {
  override focusable = true;
  private readonly focusedRow = signal(0);

  constructor(
    private readonly visible: () => readonly string[],
    private readonly checked: Signal<ReadonlySet<string>>,
    private readonly onToggle: (label: string) => void,
  ) {
    super();
    this.onMount(() => {
      // Repaint when the visible labels, the checked set, or the focus row change.
      this.bind(() => {
        this.visible();
        this.checked();
        this.focusedRow();
      });
    });
  }

  override draw(ctx: DrawContext): void {
    const labels = this.visible();
    const checked = this.checked();
    const focused = this.focusedRow();
    const normal = ctx.color('listNormal');
    ctx.fill(' ', normal);
    for (let i = 0; i < labels.length && i < ctx.size.height; i += 1) {
      const label = labels[i];
      const box = checked.has(label) ? '[x] ' : '[ ] ';
      const role = i === focused ? ctx.color('listFocused') : normal;
      ctx.text(0, i, (box + label).slice(0, ctx.size.width), role);
    }
  }

  override onEvent(ev: DispatchEvent): void {
    const e = ev.event;
    const labels = this.visible();
    if (e.type === 'key') {
      if (e.key === 'up') {
        this.focusedRow.set(Math.max(0, this.focusedRow() - 1));
        ev.handled = true;
      } else if (e.key === 'down') {
        this.focusedRow.set(Math.min(Math.max(0, labels.length - 1), this.focusedRow() + 1));
        ev.handled = true;
      } else if (e.key === 'space') {
        const label = labels[this.focusedRow()];
        if (label !== undefined) this.onToggle(label);
        ev.handled = true;
      }
    } else if (e.type === 'mouse' && e.kind === 'down') {
      const row = ev.local?.y ?? -1;
      const label = labels[row];
      if (label !== undefined) {
        this.focusedRow.set(row);
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
  private readonly onApplySink: (selected: ReadonlySet<string>) => void;
  private readonly allLabels: Signal<string[]> = signal<string[]>([]);
  private readonly checked: Signal<ReadonlySet<string>>;
  private readonly truncatedFlag: Signal<boolean> = signal(false);
  private readonly loadingFlag: Signal<boolean> = signal(true);
  private readonly errorFlag: Signal<boolean> = signal(false);
  /** The search-narrowed labels (case-insensitive contains); a stable derived accessor. */
  private readonly visible: () => string[];

  /** The type-ahead search text — narrows the visible labels, never the selection. */
  readonly search: Signal<string> = signal('');

  /**
   * @param cfg The distinct thunk, the optional current selection, and the apply sink.
   */
  constructor(cfg: ValueListConfig) {
    super();
    this.onApplySink = cfg.onApply;
    this.checked = signal<ReadonlySet<string>>(cfg.current ?? new Set());
    this.visible = this.derived(() => {
      const q = this.search().toLowerCase();
      return this.allLabels().filter((label) => label.toLowerCase().includes(q));
    });

    const searchInput = new Input({ value: this.search });
    searchInput.layout = { size: { kind: 'fixed', cells: 1 } };
    const list = new CheckboxList(this.visible, this.checked, (label) => this.toggle(label));
    list.layout = { size: { kind: 'fr', weight: 1 } };

    const selectAll = new Button('Select All', { onClick: () => this.selectAll() });
    const apply = new Button('Apply', { onClick: () => this.apply() });
    selectAll.layout = { size: { kind: 'fixed', cells: 13 } };
    apply.layout = { size: { kind: 'fixed', cells: 9 } };
    const controls = new Group();
    controls.layout = { direction: 'row', size: { kind: 'fixed', cells: 2 }, gap: 1 };
    controls.add(selectAll);
    controls.add(apply);

    // One status line: loading → error → truncation disclosure → blank. Never silent about truncation.
    const status = new Text(() =>
      this.loadingFlag()
        ? 'loading…'
        : this.errorFlag()
          ? 'could not load values'
          : this.truncatedFlag()
            ? 'list truncated — refine search'
            : '',
    );
    status.layout = { size: { kind: 'fixed', cells: 1 } };

    // An inner column fills the value-list and flows the sections top-to-bottom, so the parent is free
    // to place the value-list itself with an absolute rect (its own `direction` then does not matter).
    const inner = new Group();
    inner.layout = { position: 'fill', direction: 'col' };
    inner.add(searchInput);
    inner.add(list);
    inner.add(controls);
    inner.add(status);
    this.add(inner);

    this.onMount(() => {
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

  /** The labels currently visible after the search filter (reactive). */
  visibleLabels(): readonly string[] {
    return this.visible();
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
