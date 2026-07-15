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
import { Group, Input, DatePicker, RadioGroup, Button, signal, filter } from '@jsvision/ui';
import type { View, Signal, DispatchEvent, CalendarDate } from '@jsvision/ui';
import type { GridColumn } from './column.js';
import type { ColumnFilter, DistinctResult, FilterType } from './filter.js';

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
    this.background = 'window'; // a solid panel over the grid

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
    this.operatorGroup.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 24, height: 4 } };
    this.add(this.operatorGroup);

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
    operandA.layout = { position: 'absolute', rect: { x: 1, y: 4, width: 24, height: 1 } };
    this.add(operandA);
    if (operandB !== undefined) {
      operandB.layout = { position: 'absolute', rect: { x: 1, y: 5, width: 24, height: 1 } };
      this.add(operandB);
    }
    this.operandBView = operandB;

    const applyBtn = new Button('Apply', { onClick: () => this.apply() });
    const clearBtn = new Button('Clear', { onClick: () => this.clear() });
    applyBtn.layout = { position: 'absolute', rect: { x: 1, y: 6, width: 11, height: 2 } };
    clearBtn.layout = { position: 'absolute', rect: { x: 13, y: 6, width: 11, height: 2 } };
    this.add(applyBtn);
    this.add(clearBtn);

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
    });
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
