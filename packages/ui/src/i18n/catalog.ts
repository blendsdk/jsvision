import { createI18n, defineCatalog } from '@jsvision/i18n';
import type { I18n } from '@jsvision/i18n';
import { UI_ACCELERATOR_MANIFEST } from './scopes.js';

/**
 * Canonical English catalog for text owned by `@jsvision/ui`.
 *
 * These values intentionally preserve the framework's historical bytes. Applications without an
 * explicit service therefore render exactly as they did before localization support.
 */
export const UI_ENGLISH_CATALOG = defineCatalog(
  {
    schema: 1,
    locale: 'en',
    messages: {
      'ui.action.ok': '~O~K',
      'ui.action.cancel': '~C~ancel',
      'ui.action.yes': '~Y~es',
      'ui.action.no': '~N~o',
      'ui.dialog.confirm.title': 'Confirm',
      'ui.calendar.today': 'Today',
      'ui.calendar.month.january': 'January',
      'ui.calendar.month.february': 'February',
      'ui.calendar.month.march': 'March',
      'ui.calendar.month.april': 'April',
      'ui.calendar.month.may': 'May',
      'ui.calendar.month.june': 'June',
      'ui.calendar.month.july': 'July',
      'ui.calendar.month.august': 'August',
      'ui.calendar.month.september': 'September',
      'ui.calendar.month.october': 'October',
      'ui.calendar.month.november': 'November',
      'ui.calendar.month.december': 'December',
      'ui.calendar.weekday.sunday.short2': 'Su',
      'ui.calendar.weekday.monday.short2': 'Mo',
      'ui.calendar.weekday.tuesday.short2': 'Tu',
      'ui.calendar.weekday.wednesday.short2': 'We',
      'ui.calendar.weekday.thursday.short2': 'Th',
      'ui.calendar.weekday.friday.short2': 'Fr',
      'ui.calendar.weekday.saturday.short2': 'Sa',
      'ui.calendar.weekday.sunday.short3': 'Sun',
      'ui.calendar.weekday.monday.short3': 'Mon',
      'ui.calendar.weekday.tuesday.short3': 'Tue',
      'ui.calendar.weekday.wednesday.short3': 'Wed',
      'ui.calendar.weekday.thursday.short3': 'Thu',
      'ui.calendar.weekday.friday.short3': 'Fri',
      'ui.calendar.weekday.saturday.short3': 'Sat',
      'ui.switch.on': 'On',
      'ui.switch.off': 'Off',
      'ui.editor.find.title': 'Find',
      'ui.editor.replace.title': 'Replace',
      'ui.editor.find.label': '~T~ext to find',
      'ui.editor.replace.label': '~N~ew text',
      'ui.editor.case-sensitive': '~C~ase sensitive',
      'ui.editor.whole-words': '~W~hole words only',
      'ui.editor.prompt-on-replace': '~P~rompt on replace',
      'ui.editor.replace-all': '~R~eplace all',
      'ui.editor.replace-occurrence': 'Replace this occurence?',
      'ui.editor.search-not-found': 'Search string not found.',
      'ui.editor.save-modified': '${name} has been modified. Save?',
      'ui.editor.save-untitled': 'Save untitled file?',
      'ui.editor.read-error': 'Error reading file ${name}.',
      'ui.editor.write-error': 'Error writing file ${name}.',
      'ui.editor.create-error': 'Error creating file ${name}.',
      'ui.editor.out-of-memory': 'Not enough memory for this operation.',
    },
  },
  {
    acceleratorManifest: UI_ACCELERATOR_MANIFEST,
    placeholderManifest: {
      'ui.editor.save-modified': ['name'],
      'ui.editor.read-error': ['name'],
      'ui.editor.write-error': ['name'],
      'ui.editor.create-error': ['name'],
    },
  },
);

/**
 * Creates an isolated English service containing the framework catalog.
 *
 * A new service is returned for each application so runtime overlays and diagnostics never leak
 * between applications.
 */
export function createEnglishUiI18n(): I18n {
  return createI18n({ locale: 'en', catalogs: [UI_ENGLISH_CATALOG] });
}
