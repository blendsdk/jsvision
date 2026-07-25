import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';

/** Deterministic headless capabilities shared by the UI i18n specification tests. */
export const i18nTestCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** English UI catalog used only by the specification tests. */
export const uiEnglishFixture = defineCatalog({
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
});

/** Dutch framework catalog stand-in; this is test data, not an official locale export. */
export const uiDutchFixture = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'ui.action.ok': '~O~kee',
    'ui.action.cancel': '~A~fbreken',
    'ui.action.yes': '~J~a',
    'ui.action.no': '~N~ee',
    'ui.dialog.confirm.title': 'Bevestigen',
    'ui.calendar.today': 'Vandaag',
    'ui.calendar.month.january': 'januari',
    'ui.calendar.month.february': 'februari',
    'ui.calendar.month.march': 'maart',
    'ui.calendar.month.april': 'april',
    'ui.calendar.month.may': 'mei',
    'ui.calendar.month.june': 'juni',
    'ui.calendar.month.july': 'juli',
    'ui.calendar.month.august': 'augustus',
    'ui.calendar.month.september': 'september',
    'ui.calendar.month.october': 'oktober',
    'ui.calendar.month.november': 'november',
    'ui.calendar.month.december': 'december',
    'ui.calendar.weekday.sunday.short2': 'zo',
    'ui.calendar.weekday.monday.short2': 'ma',
    'ui.calendar.weekday.tuesday.short2': 'di',
    'ui.calendar.weekday.wednesday.short2': 'wo',
    'ui.calendar.weekday.thursday.short2': 'do',
    'ui.calendar.weekday.friday.short2': 'vr',
    'ui.calendar.weekday.saturday.short2': 'za',
    'ui.calendar.weekday.sunday.short3': 'zon',
    'ui.calendar.weekday.monday.short3': 'maa',
    'ui.calendar.weekday.tuesday.short3': 'din',
    'ui.calendar.weekday.wednesday.short3': 'woe',
    'ui.calendar.weekday.thursday.short3': 'don',
    'ui.calendar.weekday.friday.short3': 'vri',
    'ui.calendar.weekday.saturday.short3': 'zat',
    'ui.switch.on': 'Aan',
    'ui.switch.off': 'Uit',
    'ui.editor.find.title': 'Zoeken',
    'ui.editor.replace.title': 'Vervangen',
    'ui.editor.find.label': '~Z~oektekst',
    'ui.editor.replace.label': '~N~ieuwe tekst',
    'ui.editor.case-sensitive': '~H~oofdlettergevoelig',
    'ui.editor.whole-words': 'Hele ~w~oorden',
    'ui.editor.prompt-on-replace': 'Vervanging be~v~estigen',
    'ui.editor.replace-all': '~A~lles vervangen',
    'ui.editor.replace-occurrence': 'Dit voorkomen vervangen?',
    'ui.editor.search-not-found': 'Zoektekst niet gevonden.',
    'ui.editor.save-modified': '${name} is gewijzigd. Opslaan?',
    'ui.editor.save-untitled': 'Naamloos bestand opslaan?',
    'ui.editor.read-error': 'Fout bij lezen van ${name}.',
    'ui.editor.write-error': 'Fout bij schrijven van ${name}.',
    'ui.editor.create-error': 'Fout bij maken van ${name}.',
    'ui.editor.out-of-memory': 'Onvoldoende geheugen voor deze bewerking.',
  },
});

/** Same-locale application override, ordered after the framework catalog. */
export const appDutchFixture = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'ui.action.ok': '~G~oed',
  },
});

/** English application override used to prove locale fallback precedes layer priority. */
export const appEnglishFixture = defineCatalog({
  schema: 1,
  locale: 'en',
  messages: {
    'ui.action.ok': 'App ~O~K',
  },
});

/** Create an isolated Dutch service carrying only the fixture-owned UI framework catalog. */
export function createDutchUiFixture() {
  return createI18n({ locale: 'nl', catalogs: [uiEnglishFixture, uiDutchFixture] });
}

/** Create an isolated English service carrying the fixture-owned UI framework catalog. */
export function createEnglishUiFixture() {
  return createI18n({ locale: 'en', catalogs: [uiEnglishFixture] });
}
