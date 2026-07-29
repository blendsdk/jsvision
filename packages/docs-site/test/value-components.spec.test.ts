/**
 * Specification tests for the feedback, date, and color documentation wave.
 *
 * The expected IDs, teaching obligations, and observable outcomes are fixed independently from the
 * catalog and registry so deleting an implementation cannot make the oracle pass.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Calendar,
  ColorPicker,
  ColorSwatch,
  createRoot,
  DatePicker,
  Group,
  Input,
  ProgressBar,
  signal,
  Spinner,
  toISO,
  View,
} from '@jsvision/ui';
import type { CalendarDate } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { validateComponentPage } from '../src/components/component-pages.mjs';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';
import type { ProbeExpectation } from './contracts/_contract.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import {
  VALUE_COMPONENT_CATALOG_ENTRY_IDS,
  VALUE_COMPONENT_CONTRACTS,
  VALUE_COMPONENT_EXAMPLE_IDS,
} from './contracts/value-components.js';
import type { ValueComponentProbe } from './contracts/value-components.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source-backed teaching obligations for one feedback, date, or color page. */
interface ValueComponentPageExpectation {
  readonly id: (typeof VALUE_COMPONENT_CATALOG_ENTRY_IDS)[number];
  readonly filePath: string;
  readonly exampleId: (typeof VALUE_COMPONENT_EXAMPLE_IDS)[number];
  readonly headings: readonly string[];
  readonly symbols: readonly string[];
  readonly roles: readonly string[];
}

/** Complete ordered page fixture, independent from the runtime catalog. */
const VALUE_COMPONENT_PAGES = [
  {
    id: 'feedback/progress-bar',
    filePath: 'components/feedback/progress-bar.md',
    exampleId: 'feedback/progress-bar',
    headings: ['Value and rendering', 'Labels and captions'],
    symbols: ['ProgressBar', 'ProgressBarOptions', 'Signal', 'LabelPosition'],
    roles: ['progressFill', 'progressTrack', 'staticText'],
  },
  {
    id: 'feedback/spinner',
    filePath: 'components/feedback/spinner.md',
    exampleId: 'feedback/spinner',
    headings: ['Frames and timer ownership', 'Presets and fallbacks'],
    symbols: ['Spinner', 'SpinnerOptions', 'runSpinner', 'TimerSeam'],
    roles: ['staticText', 'label'],
  },
  {
    id: 'date/calendar',
    filePath: 'components/date/calendar.md',
    exampleId: 'date/calendar',
    headings: ['Navigation and selection', 'Bounds and disabled dates'],
    symbols: ['Calendar', 'CalendarOptions', 'CalendarDate', 'Signal'],
    roles: ['calendarNormal', 'calendarToday', 'calendarSelected', 'calendarCursor', 'calendarDisabled'],
  },
  {
    id: 'date/date-picker',
    filePath: 'components/date/date-picker.md',
    exampleId: 'date/date-picker',
    headings: ['Masked field and value', 'Popup calendar'],
    symbols: ['DatePicker', 'DatePickerOptions', 'DateFormat', 'Calendar'],
    roles: [
      'inputNormal',
      'inputSelected',
      'calendarNormal',
      'calendarSelected',
      'historyButtonSides',
      'historyButtonArrow',
    ],
  },
  {
    id: 'color/color-swatch',
    filePath: 'components/color/color-swatch.md',
    exampleId: 'color/color-swatch',
    headings: ['Live selection and commit', 'Palette geometry'],
    symbols: ['ColorSwatch', 'ColorSwatchOptions', 'Color', 'ANSI16_ORDER'],
    roles: ['colorMarker'],
  },
  {
    id: 'color/color-picker',
    filePath: 'components/color/color-picker.md',
    exampleId: 'color/color-picker',
    headings: ['Popup selection and custom colors', 'Live preview and commit'],
    symbols: ['ColorPicker', 'ColorPickerOptions', 'ColorSwatch', 'Input'],
    roles: ['inputNormal', 'inputSelected', 'colorMarker', 'historyButtonSides', 'historyButtonArrow'],
  },
] as const satisfies readonly ValueComponentPageExpectation[];

/** Complete single-row teaching lines that must remain visible in the standard 80×24 host. */
const VALUE_COMPONENT_VISIBLE_LINES = [
  {
    exampleId: 'feedback/progress-bar',
    lines: ['Alt+N advances · Alt+M overshoots · Alt+R resets', 'Signals repaint; values clamp safely to 0…100%.'],
  },
  {
    exampleId: 'feedback/spinner',
    lines: [
      'One frame signal drives dots, line, and blocks.',
      'Alt+N steps · Alt+R resets · timers stay app-owned',
      'Manual steps keep this example deterministic.',
    ],
  },
  {
    exampleId: 'date/calendar',
    lines: ['Arrows move · Enter selects · PgUp/PgDn month', 'Alt+B selects the minimum · T returns to today'],
  },
  {
    exampleId: 'date/date-picker',
    lines: ['Masked DD/MM/YYYY field and shared date value.', 'Alt+Down opens · Alt+N loads · Alt+C clears'],
  },
  {
    exampleId: 'color/color-swatch',
    lines: [
      'Arrows preview live · Enter commits · movement wraps',
      'Mouse drag previews; release over a cell commits.',
    ],
  },
  {
    exampleId: 'color/color-picker',
    lines: ['Alt+Down opens swatch + #rrggbb custom field.', 'Arrows preview · Enter commits · Alt+H loads hex'],
  },
] as const;

/** Return the first descendant of a requested public widget class. */
function widgetIn<T extends View>(
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  type: abstract new (...args: never[]) => T,
): T {
  const widget = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (widget === undefined) throw new Error(`missing ${type.name} in value-component laboratory`);
  return widget;
}

/** Parse a non-negative status counter from the rendered laboratory text. */
function statusCount(text: string, label: 'Input' | 'Commits'): number {
  const match = new RegExp(`${label}: (\\d+)`).exec(text);
  return match === null ? -1 : Number(match[1]);
}

/** Read the exact rendered cells owned by one mounted widget. */
function widgetText(app: ReturnType<typeof buildLabExample>['app'], view: View): string {
  const origin = absoluteOrigin(view);
  const buffer = app.loop.renderRoot.buffer();
  return Array.from({ length: view.bounds.height }, (_, y) =>
    Array.from({ length: view.bounds.width }, (_, x) => buffer.get(origin.x + x, origin.y + y)?.char ?? ' ').join(''),
  ).join('\n');
}

/** Read one observable from a mounted feedback, date, or color example. */
function probeValue(
  exampleId: string,
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  probe: ValueComponentProbe,
): string | number | boolean {
  const text = frameText(app);
  if (probe === 'rendered-text') return text;
  if (probe === 'dialog-width') return dialog.bounds.width;
  if (probe === 'dialog-height') return dialog.bounds.height;
  if (probe === 'focused-view') return app.loop.getFocused()?.constructor.name ?? 'none';
  const buffer = app.loop.renderRoot.buffer();
  if (probe === 'menu-background') return buffer.get(10, 0)?.bg ?? 'missing';
  if (probe === 'dialog-background') return buffer.get(dialog.bounds.x + 1, dialog.bounds.y + 2)?.bg ?? 'missing';
  if (probe === 'progress-percent') return widgetIn(dialog, ProgressBar).percent;
  if (probe === 'progress-widget-text' || probe === 'progress-fill-cells') {
    const rendered = viewsIn(dialog)
      .filter((view): view is ProgressBar => view instanceof ProgressBar)
      .map((view) => widgetText(app, view))
      .join('\n');
    if (probe === 'progress-widget-text') return rendered;
    return [...rendered].filter((cell) => '#█▏▎▍▌▋▊▉'.includes(cell)).length;
  }
  if (probe === 'spinner-frame') {
    const match = /Frame: (\d+)/.exec(text);
    return match === null ? -1 : Number(match[1]);
  }
  if (probe === 'spinner-widget-text') {
    return viewsIn(dialog)
      .filter((view): view is Spinner => view instanceof Spinner)
      .map((view) => widgetText(app, view))
      .join('\n');
  }
  if (probe === 'date-value') {
    const control = exampleId === 'date/calendar' ? widgetIn(dialog, Calendar) : widgetIn(dialog, DatePicker);
    const value = control.value();
    return value === null ? 'none' : toISO(value);
  }
  if (probe === 'calendar-week-number-width') {
    const calendar = widgetIn(dialog, Calendar);
    const withoutWeekNumbers = new Calendar({
      value: signal<CalendarDate | null>(null),
      today: { year: 2026, month: 7, day: 15 },
      density: 'compact',
      firstDayOfWeek: 1,
      showWeekNumbers: false,
    });
    return calendar.measure().width - withoutWeekNumbers.measure().width;
  }
  if (probe === 'color-value') {
    const control = exampleId === 'color/color-swatch' ? widgetIn(dialog, ColorSwatch) : widgetIn(dialog, ColorPicker);
    return control.value();
  }
  if (probe === 'input-count') {
    if (exampleId === 'date/date-picker') return viewsIn(dialog).filter((view) => view instanceof Input).length;
    return statusCount(text, 'Input');
  }
  if (probe === 'popup-view-count') {
    const root = app.desktop?.parent;
    const overlay =
      root instanceof Group
        ? root.children.find((child) => child instanceof Group && child.layout.position === 'absolute')
        : undefined;
    return overlay instanceof Group ? overlay.children.length : 0;
  }
  return statusCount(text, 'Commits');
}

/** Assert one typed contract probe. */
function expectProbe(
  exampleId: string,
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  expectation: ProbeExpectation<ValueComponentProbe>,
): void {
  const actual = probeValue(exampleId, app, dialog, expectation.probe);
  if (expectation.operator === 'equals') expect(actual).toBe(expectation.value);
  else if (expectation.operator === 'contains') expect(actual).toContain(expectation.value);
  else if (expectation.operator === 'excludes') expect(actual).not.toContain(expectation.value);
  else {
    if (typeof actual !== 'number' || typeof expectation.value !== 'number') {
      throw new TypeError(`${expectation.operator} requires numeric values`);
    }
    if (expectation.operator === 'greater-than') expect(actual).toBeGreaterThan(expectation.value);
    else expect(actual).toBeLessThan(expectation.value);
  }
}

/** Resolve one lazily registered family example. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing feedback/date/color example ${exampleId}`);
  return (await entry.load()).default;
}

describe('feedback, date, and color population', () => {
  test('keeps page, example, and contract populations exact', () => {
    expect(VALUE_COMPONENT_PAGES.map((page) => page.id)).toEqual(VALUE_COMPONENT_CATALOG_ENTRY_IDS);
    expect(VALUE_COMPONENT_PAGES.map((page) => page.exampleId)).toEqual(VALUE_COMPONENT_EXAMPLE_IDS);
    expect(VALUE_COMPONENT_CONTRACTS.map((contract) => contract.exampleId)).toEqual(VALUE_COMPONENT_EXAMPLE_IDS);
    for (const contract of VALUE_COMPONENT_CONTRACTS) validateBehaviorContract(contract);
  });
});

describe('feedback, date, and color pages', () => {
  test.each(VALUE_COMPONENT_PAGES)('$id satisfies its source-backed teaching contract', async (page) => {
    const source = await readFile(join(PACKAGE_ROOT, page.filePath), 'utf8');
    const evidence = validateComponentPage(source, {
      filePath: page.filePath,
      profile: 'standard',
      expectedExamples: [page.exampleId],
      componentSpecificHeadings: page.headings,
      requiredPublicSymbols: page.symbols,
      requiredThemeRoles: page.roles,
    });
    expect(evidence.exampleIds).toEqual([page.exampleId]);
  });
});

describe('feedback, date, and color template1 examples', () => {
  test.each(VALUE_COMPONENT_EXAMPLE_IDS)('%s owns a compact centered Classic dialog', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        const evidence = collectTemplate1Evidence(app, dialog);
        expect(evidence.frameLines.length).toBeGreaterThan(0);
        expect(evidence.dialogInterior.length).toBeGreaterThan(0);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
      expect(dialog.mounted).toBe(false);
    });
  });

  test.each(VALUE_COMPONENT_VISIBLE_LINES)(
    '$exampleId renders every complete teaching line',
    async ({ exampleId, lines }) => {
      const definition = await loadDefinition(exampleId);
      createRoot((dispose) => {
        const { app } = buildLabExample(exampleId, definition);
        try {
          const rendered = frameText(app);
          for (const line of lines) expect(rendered).toContain(line);
        } finally {
          try {
            app.loop.dispose();
          } finally {
            dispose();
          }
        }
      });
    },
  );
});

describe('feedback, date, and color behavior contracts', () => {
  test.each(VALUE_COMPONENT_CONTRACTS)('$exampleId executes every independently rebuilt case', async (contract) => {
    const definition = await loadDefinition(contract.exampleId);
    for (const interaction of contract.cases) {
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(contract.exampleId, definition);
        try {
          for (const initial of interaction.initial) expectProbe(contract.exampleId, app, dialog, initial);
          for (const action of interaction.actions) dispatchExampleAction(app, action);
          for (const expected of interaction.expected) expectProbe(contract.exampleId, app, dialog, expected);
        } finally {
          try {
            app.loop.dispose();
          } finally {
            dispose();
          }
        }
        expect(dialog.mounted).toBe(false);
      });
    }
  });
});
