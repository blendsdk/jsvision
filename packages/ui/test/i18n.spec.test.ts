/**
 * Specification tests for i18n application identity, package boundaries, host propagation, and
 * locale-first catalog precedence.
 *
 * The fixture catalogs are deliberately local test data rather than official locale exports. These
 * tests pin the public service seams without global state or implementation mocks. `.js` specifiers
 * are required by NodeNext ESM resolution.
 */
import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { createI18n } from '@jsvision/i18n';
import type { KeyEvent } from '@jsvision/core';
import type {
  Catalog as I18nCatalog,
  CatalogInput as I18nCatalogInput,
  I18n as I18nService,
  Message as I18nMessage,
  TranslateOptions as I18nTranslateOptions,
} from '@jsvision/i18n';
import * as ui from '../src/index.js';
import type {
  ApplicationOptions,
  Catalog,
  CatalogInput,
  I18n,
  Message,
  ModalDialogHost,
  TranslateOptions,
} from '../src/index.js';
import { createApplication } from '../src/app/index.js';
import { at, createRenderRoot, Group } from '../src/view/index.js';
import type { View } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { Calendar } from '../src/date/calendar.js';
import type { CalendarDate } from '../src/date/calendar-date.js';
import { DatePicker } from '../src/date/date-picker.js';
import { Switch } from '../src/controls/switch.js';
import { cancelButton, noButton, okButton, okCancelButtons, yesButton, yesNoButtons } from '../src/dialog/buttons.js';
import { confirm, messageBox } from '../src/dialog/message-box.js';
import { findDialog } from '../src/editor/dialogs.js';
import { Commands } from '../src/status/index.js';
import {
  appDutchFixture,
  appEnglishFixture,
  createDutchUiFixture,
  createEnglishUiFixture,
  i18nTestCaps,
  uiDutchFixture,
  uiEnglishFixture,
} from './fixtures/i18n.js';

const viewport = { width: 20, height: 6 };
const calendarDate: CalendarDate = { year: 2026, month: 3, day: 4 };

/** Read one rendered row exactly, including trailing cells. */
function rowText(buffer: ReturnType<ReturnType<typeof createRenderRoot>['buffer']>, y: number): string {
  let output = '';
  for (let x = 0; x < buffer.width; x += 1) output += buffer.get(x, y)?.char ?? ' ';
  return output;
}

/** Render a real standard button at its natural size and return its visible face row. */
function buttonFace(button: ReturnType<typeof okButton>): string {
  const size = button.measure();
  const root = createRenderRoot(size, { caps: i18nTestCaps });
  root.mount(button);
  return rowText(root.buffer(), 0).trim();
}

/** Render a naturally sized real view and return all visible rows. */
function naturalScreen(view: View & { measure(): { width: number; height: number } }): string {
  const root = createRenderRoot(view.measure(), { caps: i18nTestCaps });
  root.mount(view);
  return root
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Read the complete current application surface. */
function applicationScreen(app: ReturnType<typeof createApplication>): string {
  const buffer = app.loop.renderRoot.buffer();
  return Array.from({ length: buffer.height }, (_, y) => rowText(buffer, y)).join('\n');
}

/** Build one key event for the real event loop. */
function key(keyName: string, options: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: keyName, alt: false, ctrl: false, shift: false, ...options };
}

/** Return every descendant without depending on a composed view's private layout structure. */
function descendants(view: View): View[] {
  const children = (view as View & { readonly children?: readonly View[] }).children ?? [];
  return children.flatMap((child) => [child, ...descendants(child)]);
}

/** Open a real DatePicker popup and return its localized weekday order plus field bytes. */
function openDatePicker(options: Pick<ConstructorParameters<typeof DatePicker>[0], 'i18n' | 'firstDayOfWeek'> = {}): {
  readonly field: string;
  readonly weekdays: readonly string[];
} {
  const value = signal<CalendarDate | null>(calendarDate);
  const picker = new DatePicker({ value, today: calendarDate, ...options });
  const content = new Group();
  content.add(at(picker, 1, 0, 16, 1));
  const app = createApplication({
    caps: i18nTestCaps,
    viewport: { width: 50, height: 18 },
    content,
    ...(options.i18n === undefined ? {} : { i18n: options.i18n }),
  });
  app.loop.focusView(picker.input);
  app.loop.dispatch(key('down', { alt: true }));
  app.loop.renderRoot.flush();

  const overlay = app.loop.popupHost?.overlay;
  const calendar = overlay === undefined ? undefined : descendants(overlay).find((view) => view instanceof Calendar);
  if (!(calendar instanceof Calendar)) throw new TypeError('Expected DatePicker to open a Calendar.');
  const origin = app.loop.renderRoot.originOf(calendar);
  if (origin === null) throw new TypeError('Expected hosted Calendar origin.');
  const buffer = app.loop.renderRoot.buffer();
  const weekdayRow = Array.from(
    { length: calendar.measure().width },
    (_, offset) => buffer.get(origin.x + offset, origin.y + 1)?.char ?? ' ',
  ).join('');
  return {
    field: picker.input.getValueSignal()(),
    weekdays: weekdayRow.trim().split(/\s+/u),
  };
}

/** Load one workspace package manifest without importing package implementation. */
async function packageDependencies(packageName: 'ui' | 'forms' | 'files' | 'datagrid' | 'core') {
  const path = new URL(`../../${packageName}/package.json`, import.meta.url);
  const manifest = JSON.parse(await readFile(path, 'utf8')) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  return manifest.dependencies ?? {};
}

/**
 * Compile-time identity proof for UI's browser-safe type re-exports. Runtime assertions below cover
 * the corresponding value exports.
 */
function acceptsUiI18nTypes(
  service: I18n,
  catalog: Catalog,
  input: CatalogInput,
  message: Message,
  options: TranslateOptions,
): readonly [I18nService, I18nCatalog, I18nCatalogInput, I18nMessage, I18nTranslateOptions] {
  return [service, catalog, input, message, options];
}

test('createApplication preserves the exact supplied i18n service', () => {
  const i18n = createDutchUiFixture();
  const options = { caps: i18nTestCaps, viewport, i18n } satisfies ApplicationOptions;
  const app = createApplication(options);

  expect(app.i18n).toBe(i18n);
  expect(app.i18n.locale).toBe('nl');
});

test('omission creates a private English service and preserves English button bytes', () => {
  const first = createApplication({ caps: i18nTestCaps, viewport });
  const second = createApplication({ caps: i18nTestCaps, viewport });

  expect(first.i18n.locale).toBe('en');
  expect(first.i18n.availableLocales).toContain('en');
  expect(first.i18n).not.toBe(second.i18n);
  expect(buttonFace(okButton())).toContain('OK');
});

test('package graphs keep i18n direct in UI consumers and absent from Core', async () => {
  for (const packageName of ['ui', 'forms', 'files', 'datagrid'] as const) {
    await expect(packageDependencies(packageName)).resolves.toHaveProperty('@jsvision/i18n');
  }
  await expect(packageDependencies('core')).resolves.not.toHaveProperty('@jsvision/i18n');
});

test('UI re-exports browser-safe i18n authoring APIs and excludes the Node loader', () => {
  expect(ui.createI18n).toBeTypeOf('function');
  expect(ui.defineCatalog).toBeTypeOf('function');
  expect(ui.plural).toBeTypeOf('function');
  expect(ui.select).toBeTypeOf('function');
  expect('jsonFileSource' in ui).toBe(false);

  const service = createDutchUiFixture();
  const typeProof = acceptsUiI18nTypes(service, uiDutchFixture, uiDutchFixture, '~O~K', {
    defaultMessage: '~O~K',
  });
  expect(typeProof[0]).toBe(service);
});

test('standard button factories use an explicit service or their private English default', () => {
  const i18n = createDutchUiFixture();
  const explicit = [
    [okButton(i18n), 'Okee'],
    [cancelButton(i18n), 'Afbreken'],
    [yesButton(i18n), 'Ja'],
    [noButton(i18n), 'Nee'],
  ] as const;
  for (const [button, label] of explicit) expect(buttonFace(button)).toContain(label);

  const explicitPairs = [...okCancelButtons(i18n), ...yesNoButtons(i18n)].map(buttonFace);
  for (const label of ['Okee', 'Afbreken', 'Ja', 'Nee']) {
    expect(explicitPairs.some((face) => face.includes(label))).toBe(true);
  }

  const english = [okButton(), cancelButton(), yesButton(), noButton()].map(buttonFace);
  for (const label of ['OK', 'Cancel', 'Yes', 'No']) {
    expect(english.some((face) => face.includes(label))).toBe(true);
  }
});

test('a hosted modal uses host.i18n while caller title and text remain authoritative', async () => {
  const i18n = createDutchUiFixture();
  const app = createApplication({ caps: i18nTestCaps, viewport: { width: 50, height: 14 }, i18n });
  const host: ModalDialogHost = app;
  const result = messageBox(host, { title: 'Caller', text: 'Caller text' });

  app.loop.renderRoot.flush();
  const buffer = app.loop.renderRoot.buffer();
  const screen = Array.from({ length: buffer.height }, (_, y) => rowText(buffer, y)).join('\n');
  expect(screen).toContain('Caller');
  expect(screen).toContain('Caller text');
  expect(screen).toContain('Okee');

  app.loop.emitCommand(Commands.ok);
  await expect(result).resolves.toBe('ok');
});

test('same-locale app layers win, but locale fallback precedes English app priority', () => {
  const dutchApp = createI18n({
    locale: 'nl',
    catalogs: [uiEnglishFixture, uiDutchFixture, appEnglishFixture, appDutchFixture],
  });
  expect(dutchApp.t('ui.action.ok')).toBe('~G~oed');

  const dutchFramework = createI18n({
    locale: 'nl',
    catalogs: [uiEnglishFixture, uiDutchFixture, appEnglishFixture],
  });
  expect(dutchFramework.t('ui.action.ok')).toBe('~O~kee');
});

test('Calendar localizes headings and Today only when given an explicit service', () => {
  const render = (i18n?: I18n) =>
    naturalScreen(
      new Calendar({
        value: signal<CalendarDate | null>(calendarDate),
        today: calendarDate,
        density: 'comfortable',
        ...(i18n === undefined ? {} : { i18n }),
      }),
    );

  const dutch = render(createDutchUiFixture());
  expect(dutch).toContain('maart 2026');
  expect(dutch).toContain('maa');
  expect(dutch).toContain('Vandaag');

  const explicitEnglish = render(createEnglishUiFixture());
  expect(explicitEnglish).toContain('March 2026');
  expect(explicitEnglish).toContain('Sun');
  expect(explicitEnglish).toContain('Today');

  const compatibleDefault = render();
  expect(compatibleDefault).toContain('March 2026');
  expect(compatibleDefault).toContain('Sun');
  expect(compatibleDefault).toContain('Today');
});

test('DatePicker applies locale week order only with explicit i18n and keeps ISO values', () => {
  const localeConvention = openDatePicker({ i18n: createDutchUiFixture() });
  expect(localeConvention.weekdays).toEqual(['maa', 'din', 'woe', 'don', 'vri', 'zat', 'zon']);
  expect(localeConvention.field).toBe('2026-03-04');

  const explicitOverride = openDatePicker({ i18n: createDutchUiFixture(), firstDayOfWeek: 0 });
  expect(explicitOverride.weekdays).toEqual(['zon', 'maa', 'din', 'woe', 'don', 'vri', 'zat']);
  expect(explicitOverride.field).toBe('2026-03-04');

  const compatibleDefault = openDatePicker();
  expect(compatibleDefault.weekdays).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  expect(compatibleDefault.field).toBe('2026-03-04');
});

test('Switch localizes default state words and preserves explicit labels byte-for-byte', () => {
  const i18n = createDutchUiFixture();
  expect(naturalScreen(new Switch({ value: signal(true), i18n }))).toContain('Aan');
  expect(naturalScreen(new Switch({ value: signal(false), i18n }))).toContain('Uit');
  expect(naturalScreen(new Switch({ value: signal(true) }))).toContain('On');
  expect(
    naturalScreen(new Switch({ value: signal(true), i18n, onLabel: 'CALLER-ON', offLabel: 'CALLER-OFF' })),
  ).toContain('CALLER-ON');
  expect(
    naturalScreen(new Switch({ value: signal(false), i18n, onLabel: 'CALLER-ON', offLabel: 'CALLER-OFF' })),
  ).toContain('CALLER-OFF');
});

test('localized confirmation keeps caller text and its translated accelerator remains active', async () => {
  const app = createApplication({
    caps: i18nTestCaps,
    viewport: { width: 60, height: 18 },
    i18n: createDutchUiFixture(),
  });
  const result = confirm(app, 'Caller question stays exact');
  app.loop.renderRoot.flush();

  const screen = applicationScreen(app);
  expect(screen).toContain('Bevestigen');
  expect(screen).toContain('Caller question stays exact');
  expect(screen).toContain('Ja');
  expect(screen).toContain('Nee');

  app.loop.dispatch(key('j', { alt: true }));
  await expect(result).resolves.toBe(true);
});

test('a hosted editor dialog localizes package text while preserving the caller search value', async () => {
  const app = createApplication({
    caps: i18nTestCaps,
    viewport: { width: 60, height: 20 },
    i18n: createDutchUiFixture(),
  });
  const initial = {
    find: 'Caller Needle',
    options: { caseSensitive: true, wholeWords: false },
  };
  const result = findDialog(app, initial);
  app.loop.renderRoot.flush();

  const screen = applicationScreen(app);
  expect(screen).toContain('Zoeken');
  expect(screen).toContain('Zoektekst');
  expect(screen).toContain('Hoofdlettergevoelig');
  expect(screen).toContain('Hele woorden');
  expect(screen).toContain('Caller Needle');
  expect(screen).toContain('Okee');
  expect(screen).toContain('Afbreken');

  app.loop.dispatch(key('o', { alt: true }));
  await expect(result).resolves.toEqual(initial);
});
