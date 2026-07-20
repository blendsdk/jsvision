/**
 * {@link DatePicker} — a one-line date field: a masked text {@link Input} plus a trailing `▐↓▌`
 * dropdown button that opens a {@link Calendar} in a popup anchored to the field. The mask, parse, and
 * serialize logic for each format lives in `date-format.ts`.
 *
 * The field text follows the chosen `format` (default ISO `YYYY-MM-DD`); a complete valid edit updates
 * the selection, while an incomplete or invalid edit leaves it unchanged. Open the dropdown with Down,
 * Alt+Down, or a click on the button; picking a day in the calendar fills the field and closes the
 * popup. The field and calendar share the picker's `value` and stay in sync. With no overlay host
 * available (headless), opening is a no-op.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal, untrack } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { Input, picture } from '../controls/index.js';
import { openAnchoredPopup, absoluteRect, drawDropdownIcon } from '../dropdown/index.js';
import { Calendar } from './calendar.js';
import { metricsFor } from './calendar-metrics.js';
import type { CalendarDensity, CalendarMetrics } from './calendar-metrics.js';
import type { CalendarDate } from './calendar-date.js';
import { compare } from './calendar-date.js';
import { dateFormat } from './date-format.js';
import type { DateFormat, DateFormatSpec } from './date-format.js';

/**
 * The trailing 3-cell dropdown button drawing the shared `▐↓▌` icon. Not focusable — the field is the
 * focus target; the button is click-only.
 */
class DateButton extends View {
  /** Fixed 3-cell width; stretched to the field height by the row layout. */
  override layout: LayoutProps = { size: { kind: 'fixed', cells: 3 } };

  constructor(private readonly onOpen: (ev: DispatchEvent) => void) {
    super();
  }

  /** Draw the shared `▐↓▌` dropdown icon. */
  override draw(ctx: DrawContext): void {
    drawDropdownIcon(ctx, 0);
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

/** Options for a {@link DatePicker}. */
export interface DatePickerOptions {
  /** Two-way selected day (`null` = none). */
  value: Signal<CalendarDate | null>;
  /** Field format (default ISO `YYYY-MM-DD`). */
  format?: DateFormat;
  /** The "today" day, forwarded to the dropdown `Calendar`. */
  today?: CalendarDate;
  /** Inclusive lower bound, forwarded to the dropdown `Calendar`. */
  min?: CalendarDate;
  /** Inclusive upper bound, forwarded to the dropdown `Calendar`. */
  max?: CalendarDate;
  /** Disabled-day predicate, forwarded to the dropdown `Calendar`. */
  isDisabled?: (d: CalendarDate) => boolean;
  /** First day of the week (0 = Sunday, 1 = Monday), forwarded to the dropdown `Calendar`. */
  firstDayOfWeek?: 0 | 1;
  /** Show ISO week numbers in the dropdown `Calendar`. */
  showWeekNumbers?: boolean;
  /** Density of the dropdown `Calendar` (default `'comfortable'`; the popup sizes to it). */
  density?: CalendarDensity;
  /** A muted hint shown in the field while it is empty; forwarded to the inner text field. */
  placeholder?: string | Signal<string>;
}

/**
 * A one-line date picker: a masked text field that opens a `Calendar` in a dropdown anchored to the
 * field.
 *
 * @example
 * import { Group, DatePicker, Label, signal, toISO, at } from '@jsvision/ui';
 * import type { CalendarDate } from '@jsvision/ui';
 *
 * const g = new Group();
 * const value = signal<CalendarDate | null>(null);
 *
 * const dp = new DatePicker({ value, format: 'DD/MM/YYYY' });
 * g.add(at(dp, 10, 0, 16, 1));
 *
 * // A Label targets the picker's inner field; Down / Alt+Down / the ▐↓▌ button opens the calendar.
 * g.add(new Label('~D~ate', dp.input));
 * // value() is a CalendarDate | null; toISO(value()!) serializes a selection.
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
  protected readonly density: CalendarDensity;
  /** The hosted calendar's resolved geometry (sizes the anchored popup). */
  protected readonly metrics: CalendarMetrics;

  /**
   * @param opts The two-way `value` plus optional `format` and the options forwarded to the dropdown
   *   `Calendar`.
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
    this.density = opts.density ?? 'comfortable';
    this.metrics = metricsFor(this.density, this.showWeekNumbers);

    const initial = this.value();
    this.text = signal(initial !== null ? this.spec.serialize(initial) : '');
    this.input = new Input({
      value: this.text,
      validator: picture(this.spec.mask),
      maxLength: this.spec.mask.length,
      placeholder: opts.placeholder,
    });
    this.input.setLayout({ size: { kind: 'fr', weight: 1 } });
    this.button = new DateButton((ev) => this.open(ev));
    this.add(this.input);
    this.add(this.button);

    this.onMount(() => this.bindValueText());
  }

  /**
   * Wire the two-way binding between `value` and the field text. `value → text` serializes; `text →
   * value` parses. Each direction reads only the *other* signal (the current value is read untracked
   * for the equality guard), so neither subscribes to the signal it writes and there is no feedback
   * loop.
   */
  protected bindValueText(): void {
    this.bind(
      () => this.value(),
      (v) => this.text.set(v !== null ? this.spec.serialize(v) : ''),
    );
    this.bind(
      () => this.spec.parse(this.text()),
      (parsed) => {
        if (parsed === null) return; // incomplete / invalid edit → leave the value unchanged
        const cur = untrack(() => this.value());
        if (cur === null || compare(parsed, cur) !== 0) this.value.set(parsed);
      },
    );
  }

  /**
   * Open on Down / Alt+Down while the field is focused. A mouse-down on the trailing button also opens
   * the dropdown.
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
   * Focus the field, then open the anchored popup hosting a `Calendar` bound to the shared `value`.
   * Picking a day closes the popup (the value is already set). A no-op when there is no overlay host.
   *
   * @param ev The dispatch envelope (source of the popup host + focus seam).
   */
  protected open(ev: DispatchEvent): void {
    const host = ev.popupHost;
    if (host === undefined) return; // no overlay host (headless / no shell) → decline to open
    ev.focusView?.(this.input); // focus the field first
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
          density: this.density,
          onChange: () => commit(), // a day-commit sets `value` then closes the popup
        }),
      // The popup sizes to the calendar's density (width × height) + 1 row of placement border compensation.
      contentSize: { width: this.metrics.width, height: this.metrics.height + 1 },
      focusTarget: (c) => c, // the calendar itself is the focus target
    });
  }
}
