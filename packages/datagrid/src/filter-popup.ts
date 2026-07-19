/**
 * `FilterPopup<T>` — the anchored condition-filter popup for one column, opened from the header funnel.
 * It presents a type-appropriate operator selector (a `RadioGroup`) plus one or two operand editors
 * (`Input` for text/number, `DatePicker` for date; the second operand appears only for `between`), and
 * Apply / Clear buttons. Apply builds the column's {@link ColumnFilter} and reports it through
 * `onApply`; Clear reports `onClear`; Apply, Clear, and Escape all call `onClose`.
 *
 * The popup is a passive `Group` (its focusable children own the keys). Escape/Enter bubble up the
 * focus chain from a focused child to this group's `onEvent` — Escape closes, Enter applies — the same
 * mechanism the in-cell editor host relies on. A `distinct` thunk in the config reserves the value-list
 * section (added in a later phase); the condition section here ignores it.
 */
import {
  Group,
  Input,
  DatePicker,
  RadioGroup,
  Button,
  Text,
  col,
  spacer,
  signal,
  filter,
  grow,
  fixed,
} from '@jsvision/ui';
import type { View, Signal, DispatchEvent, CalendarDate } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import type { ColumnFilter, DistinctResult, FilterType } from './filter.js';
import { ValueList, valueListButtonWidth } from './value-list-popup.js';
import { buttonRow, buttonCellWidth } from './button-row.js';

/** The operator choices offered per column filter type — the exact op values a {@link ColumnFilter} uses. */
const OPERATORS: Record<FilterType, readonly string[]> = {
  text: ['contains', 'startsWith', 'endsWith', 'equals'],
  number: ['gt', 'lt', 'between', 'eq'],
  date: ['before', 'after', 'on', 'between'],
};

/** Human labels for each operator (shown in the selector); the op value stays the model-level token. */
const OP_LABELS: Record<string, string> = {
  contains: 'contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  equals: 'equals',
  gt: 'greater than',
  lt: 'less than',
  between: 'between',
  eq: 'equals',
  before: 'before',
  after: 'after',
  on: 'on',
};

/**
 * Stack a caption above an editor as one two-row field block (the DSL `col`), so a filter operand
 * always shows what it is for.
 */
function labelledField(caption: Text, editor: View): Group {
  fixed(caption, 1);
  fixed(editor, 1);
  return col({ fixed: 2 }, caption, editor);
}

/** Construction config for {@link FilterPopup}. */
export interface FilterPopupConfig<T> {
  /** The column being filtered (used by the reserved value-list section). */
  column: GridColumn<T>;
  /** The column id — reported back through `onApply`/`onClear`. */
  columnId: string;
  /** The column's existing filter, pre-filling the operator + operands when reopening. */
  current?: ColumnFilter;
  /** The resolved filter type — selects the operator set and operand editors. */
  filterType: FilterType;
  /** When present, embeds the value-list section (added in a later phase). */
  distinct?: () => Promise<DistinctResult>;
  /** Reports an applied condition filter for the column. */
  onApply: (columnId: string, filter: ColumnFilter) => void;
  /** Reports that the column's filter should be cleared. */
  onClear: (columnId: string) => void;
  /** Closes the popup — called after Apply/Clear and on Escape / click-away. */
  onClose: () => void;
}

/**
 * The context a {@link FilterPopupConfig}-shaped `filterPopup` factory receives — everything needed to
 * build a custom popup for one column. It carries the opened column, its resolved filter type, the
 * column's current filter (for pre-filling), the value-list `distinct` thunk, and the apply/clear/close
 * sinks, plus `defaultPopup()` which builds the **built-in** popup so a factory can wrap or reuse it
 * (e.g. return `ctx.defaultPopup()` unchanged, or place it inside a framed container).
 *
 * @example
 * import type { FilterPopupContext } from '@jsvision/datagrid';
 * // A factory that reuses the built-in popup unchanged (the grid's default behavior):
 * const filterPopup = (ctx: FilterPopupContext<Row>) => ctx.defaultPopup();
 */
export interface FilterPopupContext<T> {
  /** The column whose popup is being opened. */
  readonly column: GridColumn<T>;
  /** The column id — reported back through `onApply`/`onClear`. */
  readonly columnId: string;
  /** The resolved filter type (selects the operator set + operand editors). */
  readonly filterType: FilterType;
  /** The column's existing filter, if any (pre-fills a reopened popup). */
  readonly current?: ColumnFilter;
  /** The distinct-value source for the value-list section. */
  readonly distinct: () => Promise<DistinctResult>;
  /** Report an applied condition/set filter for the column. */
  readonly onApply: (columnId: string, filter: ColumnFilter) => void;
  /** Report that the column's filter should be cleared. */
  readonly onClear: (columnId: string) => void;
  /** Close the popup — call after applying/clearing, or on cancel. */
  readonly onClose: () => void;
  /** Build the built-in {@link FilterPopup} with this context (for wrapping or reuse). */
  defaultPopup(): FilterPopup<T>;
}

/**
 * The condition-filter popup for one column — see the module overview.
 *
 * @example
 * import { column, FilterPopup } from '@jsvision/datagrid';
 *
 * const col = column({ id: 'qty', title: 'Qty', value: (r: { qty: number }) => r.qty });
 * const popup = new FilterPopup({
 *   column: col,
 *   columnId: 'qty',
 *   filterType: 'number',
 *   onApply: (id, filter) => { console.log('apply', id, filter); },
 *   onClear: (id) => { console.log('clear', id); },
 *   onClose: () => { console.log('close'); },
 * });
 * // Drive it programmatically (a user would use the selector + inputs):
 * popup.selectOperator('between');
 * popup.operandA.set('100');
 * popup.operandB.set('500');
 * popup.apply(); // onApply('qty', { kind: 'number', op: 'between', a: 100, b: 500 })
 */
export class FilterPopup<T> extends Group {
  private readonly columnId: string;
  private readonly filterType: FilterType;
  private readonly onApply: (columnId: string, filter: ColumnFilter) => void;
  private readonly onClear: (columnId: string) => void;
  private readonly onClose: () => void;

  /** The selected operator's index into {@link operators} (the `RadioGroup`'s two-way binding). */
  private readonly operatorIndex: Signal<number>;
  /** The operator selector — the popup's initial focus target. */
  private readonly operatorGroup: RadioGroup;
  /** The second operand editor (number/date only), toggled by {@link needsSecondOperand}; hidden for text. */
  private readonly operandBView?: View;
  /** The embedded value-list, if any — its wanted height drives the popup's auto-sizing. */
  private readonly valueListView?: ValueList;

  /** Operand A as raw text (text/number filters read this). */
  readonly operandA: Signal<string>;
  /** Operand B as raw text (a number `between` filter reads this). */
  readonly operandB: Signal<string>;
  /** Operand A as a calendar date (date filters read this). */
  readonly dateOperandA: Signal<CalendarDate | null>;
  /** Operand B as a calendar date (a date `between` filter reads this). */
  readonly dateOperandB: Signal<CalendarDate | null>;

  /**
   * @param cfg The popup configuration (column, id, filter type, existing filter, and the sinks).
   */
  constructor(cfg: FilterPopupConfig<T>) {
    super();
    this.columnId = cfg.columnId;
    this.filterType = cfg.filterType;
    this.onApply = cfg.onApply;
    this.onClear = cfg.onClear;
    this.onClose = cfg.onClose;
    this.background = 'dialog'; // the light-gray dialog surface that its controls sit on
    this.castsShadow = true; // the overlay casts a drop shadow over the grid behind it

    const ops = OPERATORS[cfg.filterType];
    const cur = cfg.current;
    // Pre-fill the operator + operands from an existing filter (reopening a filtered column).
    let opIndex = 0;
    if (cur !== undefined && 'op' in cur) {
      const i = ops.indexOf(cur.op);
      if (i >= 0) opIndex = i;
    }
    this.operatorIndex = signal(opIndex);
    this.operandA = signal('');
    this.operandB = signal('');
    this.dateOperandA = signal<CalendarDate | null>(null);
    this.dateOperandB = signal<CalendarDate | null>(null);
    if (cur !== undefined) {
      if (cur.kind === 'text') this.operandA.set(cur.value);
      else if (cur.kind === 'number') {
        this.operandA.set(String(cur.a));
        if (cur.b !== undefined) this.operandB.set(String(cur.b));
      } else if (cur.kind === 'date') {
        this.dateOperandA.set(cur.a);
        if (cur.b !== undefined) this.dateOperandB.set(cur.b);
      }
    }

    this.operatorGroup = new RadioGroup({ labels: ops.map((o) => OP_LABELS[o]), value: this.operatorIndex });
    fixed(this.operatorGroup, 4);

    // Operand editors depend on the type: DatePicker for date, numeric-filtered Input for number, a
    // plain Input for text (which has a single operand).
    let operandA: View;
    let operandB: View | undefined;
    if (cfg.filterType === 'date') {
      operandA = new DatePicker({ value: this.dateOperandA });
      operandB = new DatePicker({ value: this.dateOperandB });
    } else if (cfg.filterType === 'number') {
      operandA = new Input({ value: this.operandA, validator: filter('0-9.-') });
      operandB = new Input({ value: this.operandB, validator: filter('0-9.-') });
    } else {
      operandA = new Input({ value: this.operandA });
    }
    // Each operand editor sits under its own caption: the first reads "From" for a `between` range
    // and "Value" otherwise; the second ("To") only appears for `between`.
    const fieldA = labelledField(new Text(() => (this.needsSecondOperand() ? 'From' : 'Value')), operandA);
    let fieldB: Group | undefined;
    if (operandB !== undefined) {
      fieldB = labelledField(new Text('To'), operandB);
      // Start collapsed unless the initial operator is `between`; the column flow reclaims its rows.
      fieldB.state.visible = this.needsSecondOperand();
    }
    // Toggle the whole second-operand block (caption + editor) as one unit on the `between` reveal.
    this.operandBView = fieldB;

    // Every button in the popup — Apply/Clear here plus the value-list's Select All/Apply — shares one
    // width, the widest label's face width, so all four line up. Each row centres its buttons in it.
    const applyBtn = new Button('Apply', { onClick: () => this.apply() });
    const clearBtn = new Button('Clear', { onClick: () => this.clear() });
    const buttonWidth = Math.max(buttonCellWidth([applyBtn, clearBtn]), valueListButtonWidth());
    const buttons = buttonRow([applyBtn, clearBtn], buttonWidth);

    // The Excel value-list section, below the condition section, when a distinct thunk is supplied. It
    // applies a `{ kind: 'set' }` filter of the checked labels — last-writer-wins with the condition
    // section (one filter per column). A reopened set filter pre-checks its labels.
    let valueList: ValueList | undefined;
    if (cfg.distinct !== undefined) {
      const currentSet = cur !== undefined && cur.kind === 'set' ? cur.selected : undefined;
      valueList = new ValueList({
        distinct: cfg.distinct,
        current: currentSet,
        buttonWidth,
        onApply: (selected) => {
          this.onApply(this.columnId, { kind: 'set', selected });
          this.onClose();
        },
      });
      grow(valueList); // fill the popup below the buttons
    }
    this.valueListView = valueList;

    // Flow the whole overlay as one padded column (the layout DSL): operator selector → operand
    // field(s) → a one-row gap → Apply/Clear bar → value-list. A hidden second-operand block collapses
    // so the rows below move up with no gap; the cross-axis stretch sizes every row to the padded width.
    const sections: View[] = [this.operatorGroup, fieldA];
    if (fieldB !== undefined) sections.push(fieldB);
    sections.push(spacer({ fixed: 1 }), buttons);
    if (valueList !== undefined) sections.push(valueList);
    // One-cell padding on the top and sides; none at the bottom so the overlay sits one row tighter.
    this.add(col({ position: 'fill', padding: { top: 1, right: 1, bottom: 0, left: 1 } }, ...sections));

    this.onMount(() => {
      // Show the second operand only for `between`, reflowing so the hidden editor leaves no gap.
      if (this.operandBView !== undefined) {
        const view = this.operandBView;
        this.bind(
          () => this.needsSecondOperand(),
          (show) => {
            view.state.visible = show;
          },
          { relayout: true },
        );
      }
      // Auto-size the overlay to its content — the fixed condition rows plus the value-list's wanted
      // height. It shrinks/grows as the second operand reveals or the distinct set loads/filters. The
      // grid mounts it at the worst-case height, so from here it only shrinks and never needs
      // re-clamping to stay on-screen (the anchored top does not move).
      this.bind(
        () => this.contentHeight(),
        (h) => {
          const rect = this.layout.rect;
          if (rect !== undefined && rect.height !== h) this.layout = { ...this.layout, rect: { ...rect, height: h } };
        },
        { relayout: true },
      );
    });
  }

  /**
   * The overlay's wanted height in cells: one-cell padding on top and bottom, the operator selector,
   * the operand field (plus a second one for `between`), the gap, the Apply/Clear bar, and the
   * value-list's own wanted height. Reactive — it re-derives as the operator or the distinct set
   * changes.
   */
  private contentHeight(): number {
    // top padding(1) + selector(4) + operand field(2) + second operand(2, `between` only) + gap(1) + buttons(2)
    const condition = 1 + 4 + 2 + (this.needsSecondOperand() ? 2 : 0) + 1 + 2;
    return condition + (this.valueListView?.desiredHeight() ?? 0);
  }

  /** The operator choices for this popup's filter type (the op values a filter uses). */
  operators(): readonly string[] {
    return OPERATORS[this.filterType];
  }

  /** The currently-selected operator. Reactive — reading it in an effect re-runs on a selection change. */
  currentOperator(): string {
    const ops = OPERATORS[this.filterType];
    return ops[this.operatorIndex()] ?? ops[0];
  }

  /**
   * Select an operator by its op value (a no-op for an operator not in this type's set).
   *
   * @param op The operator to select (e.g. `'between'`).
   */
  selectOperator(op: string): void {
    const i = OPERATORS[this.filterType].indexOf(op);
    if (i >= 0) this.operatorIndex.set(i);
  }

  /** Whether the selected operator takes a second operand (`between`). Reactive. */
  needsSecondOperand(): boolean {
    return this.currentOperator() === 'between';
  }

  /** The view the container focuses when the popup opens (the operator selector). */
  focusTarget(): View {
    return this.operatorGroup;
  }

  /** Build the current filter, emit it through `onApply`, and close. A well-formed filter is required. */
  apply(): void {
    const built = this.buildFilter();
    if (built === null) return; // an incomplete operand (e.g. no date chosen) — do nothing
    this.onApply(this.columnId, built);
    this.onClose();
  }

  /** Clear the column's filter and close. */
  clear(): void {
    this.onClear(this.columnId);
    this.onClose();
  }

  /**
   * The {@link ColumnFilter} for the current operator + operands, or `null` when a date operand is
   * missing. The operator is one of {@link operators} by construction, so each op assertion is sound.
   */
  private buildFilter(): ColumnFilter | null {
    const op = this.currentOperator();
    if (this.filterType === 'text') {
      return { kind: 'text', op: op as 'contains' | 'startsWith' | 'endsWith' | 'equals', value: this.operandA() };
    }
    if (this.filterType === 'number') {
      const a = Number(this.operandA());
      if (op === 'between') return { kind: 'number', op: 'between', a, b: Number(this.operandB()) };
      return { kind: 'number', op: op as 'gt' | 'lt' | 'eq', a };
    }
    const a = this.dateOperandA();
    if (a === null) return null;
    if (op === 'between') {
      const b = this.dateOperandB();
      return b === null ? { kind: 'date', op: 'between', a } : { kind: 'date', op: 'between', a, b };
    }
    return { kind: 'date', op: op as 'before' | 'after' | 'on', a };
  }

  /**
   * Close on Escape and apply on Enter — both bubble up the focus chain from a focused child that
   * leaves them unhandled.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const e = ev.event;
    if (e.type !== 'key') return;
    if (e.key === 'escape') {
      this.onClose();
      ev.handled = true;
    } else if (e.key === 'enter') {
      this.apply();
      ev.handled = true;
    }
  }
}
