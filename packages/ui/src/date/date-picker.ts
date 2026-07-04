/**
 * `DatePicker` — a `Group` = a masked `Input` + a trailing `▼` button that opens a `Calendar` in the
 * RD-14 anchored popup, mirroring `ComboBox` (RD-20). It has **no** Turbo Vision counterpart (TV
 * predates date pickers); it is designed fresh but composes shipped pieces + the generalized
 * `openAnchoredPopup` (PA-5). The pure format model (mask/parse/serialize) lives in `date-format.ts`.
 *
 * Composition `[ input (fr) | ▼ button (3) ]`: the field is an `Input` gated by `picture(spec.mask)`;
 * its text is `spec.serialize(value)` and a complete valid edit parses back via `spec.parse`
 * (incomplete/invalid leaves `value` unchanged, AC-11). Open on Down/Alt+Down or a `▼` click; the
 * hosted `Calendar` writes the **same** `value` on a day-commit and its `onChange` calls the injected
 * `commit()` to close (AC-10). No `PopupHost` ⇒ open declines (headless). Two directions of the
 * value⟷text bind each read only the OTHER signal, so there is no feedback loop (the `ComboBox` idiom).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal, untrack } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { Input, picture } from '../controls/index.js';
import { openAnchoredPopup, absoluteRect } from '../dropdown/index.js';
import { Calendar } from './calendar.js';
import type { CalendarDate } from './calendar-date.js';
import { compare } from './calendar-date.js';
import { dateFormat } from './date-format.js';
import type { DateFormat, DateFormatSpec } from './date-format.js';

/** The `▼` down-triangle glyph (U+25BC), matching the `Calendar` header's prev-month arrow. */
const ARROW_DOWN = '▼';

/**
 * The trailing 3-cell `▼` button (mirrors `ComboButton`, `combo-box.ts:67-88`): sides `▐`/`▌` in
 * `historyButtonSides`, the `▼` in `historyButtonArrow`. Not focusable — the field is the focus target;
 * the button is click-only.
 */
class DateButton extends View {
  /** Fixed 3-cell width; stretched to the field height by the row layout. */
  override layout: LayoutProps = { size: { kind: 'fixed', cells: 3 } };

  constructor(private readonly onOpen: (ev: DispatchEvent) => void) {
    super();
  }

  /** Draw `▐▼▌` (the ComboButton chrome with a down-triangle). */
  override draw(ctx: DrawContext): void {
    const sides = ctx.color('historyButtonSides');
    const arrow = ctx.color('historyButtonArrow');
    ctx.text(0, 0, '▐', sides);
    ctx.text(1, 0, ARROW_DOWN, arrow);
    ctx.text(2, 0, '▌', sides);
  }

  /** A mouse-down on the button opens the popup. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.onOpen(ev);
      ev.handled = true;
    }
  }
}

/** Options for a {@link DatePicker}. (PA-8) */
export interface DatePickerOptions {
  /** Two-way selected day (`null` = none). */
  value: Signal<CalendarDate | null>;
  /** Field format (default ISO `YYYY-MM-DD`; PA-11). */
  format?: DateFormat;
  /** Forwarded to the hosted `Calendar` (PF-008). */
  today?: CalendarDate;
  min?: CalendarDate;
  max?: CalendarDate;
  isDisabled?: (d: CalendarDate) => boolean;
  firstDayOfWeek?: 0 | 1;
  showWeekNumbers?: boolean;
}

/**
 * A one-line date picker: a masked field opening a `Calendar` dropdown. See the module doc.
 */
export class DatePicker extends Group {
  /** Two-way selected day (`null` = none). */
  readonly value: Signal<CalendarDate | null>;
  /** The masked text field (the focus target; `picture(spec.mask)`-gated). */
  readonly input: Input;

  protected readonly spec: DateFormatSpec;
  protected readonly text: Signal<string>;
  protected readonly button: DateButton;
  protected readonly today?: CalendarDate;
  protected readonly min?: CalendarDate;
  protected readonly max?: CalendarDate;
  protected readonly isDisabled?: (d: CalendarDate) => boolean;
  protected readonly firstDayOfWeek?: 0 | 1;
  protected readonly showWeekNumbers: boolean;

  /**
   * @param opts The two-way `value` + optional `format` + the forwarded `Calendar` options (PF-008).
   */
  constructor(opts: DatePickerOptions) {
    super();
    this.value = opts.value;
    this.spec = dateFormat(opts.format);
    this.today = opts.today;
    this.min = opts.min;
    this.max = opts.max;
    this.isDisabled = opts.isDisabled;
    this.firstDayOfWeek = opts.firstDayOfWeek;
    this.showWeekNumbers = opts.showWeekNumbers ?? false;

    const initial = this.value();
    this.text = signal(initial !== null ? this.spec.serialize(initial) : '');
    this.input = new Input({ value: this.text, validator: picture(this.spec.mask), maxLength: this.spec.mask.length });
    this.input.layout = { size: { kind: 'fr', weight: 1 } };
    this.button = new DateButton((ev) => this.open(ev));
    this.add(this.input);
    this.add(this.button);

    this.onMount(() => this.bindValueText());
  }

  /**
   * Wire the two-way value⟷text binding. `value → text` (serialize) reads only `value`; `text → value`
   * (parse) reads only `text` (the current value is read via `untrack` for the equality guard), so
   * neither direction subscribes to the signal it writes — no feedback loop (the `ComboBox` idiom).
   */
  protected bindValueText(): void {
    this.bind(
      () => this.value(),
      (v) => this.text.set(v !== null ? this.spec.serialize(v) : ''),
    );
    this.bind(
      () => this.spec.parse(this.text()),
      (parsed) => {
        if (parsed === null) return; // incomplete / invalid → leave value unchanged (AC-11)
        const cur = untrack(() => this.value());
        if (cur === null || compare(parsed, cur) !== 0) this.value.set(parsed);
      },
    );
  }

  /**
   * Open on Down / Alt+Down while the field is focused (the picker sees the key as the Input's ancestor
   * in the focus-chain bubble). A mouse-down on the trailing button opens via {@link DateButton}.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'down' && (this.input.state.focused || inner.alt)) {
      this.open(ev);
      ev.handled = true;
    }
  }

  /**
   * Focus the field, then open the anchored popup hosting a `Calendar` bound to the shared `value`. The
   * calendar's `onChange` calls the injected `commit()` to close (the value is already set). A no-op
   * with no overlay host (headless).
   *
   * @param ev The dispatch envelope (source of the popup host + focus seam).
   */
  protected open(ev: DispatchEvent): void {
    const host = ev.popupHost;
    if (host === undefined) return; // no overlay host (headless / no shell) → decline to open
    ev.focusView?.(this.input); // focus the field first (parallel to ComboBox)
    openAnchoredPopup({
      host,
      anchor: absoluteRect(this),
      buildContent: (commit) =>
        new Calendar({
          value: this.value,
          today: this.today,
          min: this.min,
          max: this.max,
          isDisabled: this.isDisabled,
          firstDayOfWeek: this.firstDayOfWeek,
          showWeekNumbers: this.showWeekNumbers,
          onChange: () => commit(), // a day-commit sets `value` then closes the popup (AC-10)
        }),
      // 8 visible rows + 1 (the placement border compensation, 03-03 Part A); width 20 (23 with week#).
      contentSize: { width: this.showWeekNumbers ? 23 : 20, height: 9 },
      focusTarget: (c) => c, // the calendar itself is the focus target
    });
  }
}
