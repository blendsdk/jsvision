/**
 * Localized Calendar presentation inputs shared by Calendar and DatePicker.
 *
 * Resolving every month before geometry is intentional: a popup must reserve enough display cells
 * for any month the user can navigate to, not only the month visible when it opens.
 */
import type { I18n } from '@jsvision/i18n';
import { metricsFor } from './calendar-metrics.js';
import type { CalendarDensity, CalendarMetrics } from './calendar-metrics.js';

/** Stable weekday key suffixes in Sunday-first order. */
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

/** Historical English weekday abbreviations in Sunday-first order. */
const UI_WEEKDAY_SHORT2 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const UI_WEEKDAY_SHORT3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Localized weekday labels at the two Calendar density widths. */
export interface LocalizedWeekdayNames {
  /** Compact two-cell weekday labels in Sunday-first order. */
  readonly short2: readonly string[];
  /** Comfortable/spacious weekday labels in Sunday-first order. */
  readonly short3: readonly string[];
}

/** Stable month key suffixes indexed 1-12 (index 0 unused). */
const MONTH_KEYS = [
  '',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

/** Historical English month names indexed 1-12 (index 0 unused). */
const UI_MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Resolve all localized month names once so measurement and drawing consume the same strings. */
export function localizedMonthNames(i18n: I18n): readonly string[] {
  return MONTH_KEYS.map((month, index) =>
    index === 0
      ? ''
      : i18n.t(`ui.calendar.month.${month}`, {
          defaultMessage: UI_MONTH_NAMES[index],
        }),
  );
}

/** Resolve both supported localized weekday label sets in Sunday-first order. */
export function localizedWeekdayNames(i18n: I18n): LocalizedWeekdayNames {
  return {
    short2: WEEKDAY_KEYS.map((day, index) =>
      i18n.t(`ui.calendar.weekday.${day}.short2`, {
        defaultMessage: UI_WEEKDAY_SHORT2[index],
      }),
    ),
    short3: WEEKDAY_KEYS.map((day, index) =>
      i18n.t(`ui.calendar.weekday.${day}.short3`, {
        defaultMessage: UI_WEEKDAY_SHORT3[index],
      }),
    ),
  };
}

/**
 * Resolve the localized Calendar geometry shared by standalone calendars and DatePicker popups.
 *
 * @param i18n Translation service used for month names and the Today action.
 * @param density Calendar density.
 * @param showWeekNumbers Whether to reserve the ISO week-number column.
 * @param monthNames Pre-resolved localized month names shared with drawing.
 * @param weekdayNames Pre-resolved localized weekday labels shared with drawing.
 * @returns One display-cell metric used for measurement, drawing, hit-testing, and popup allocation.
 */
export function localizedCalendarMetrics(
  i18n: I18n,
  density: CalendarDensity = 'comfortable',
  showWeekNumbers = false,
  monthNames: readonly string[] = localizedMonthNames(i18n),
  weekdayNames: LocalizedWeekdayNames = localizedWeekdayNames(i18n),
): CalendarMetrics {
  const todayLabel = i18n.t('ui.calendar.today', { defaultMessage: 'Today' });
  return metricsFor(density, showWeekNumbers, todayLabel, monthNames, weekdayNames);
}
