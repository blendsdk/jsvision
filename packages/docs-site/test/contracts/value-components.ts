import { defineBehaviorContract } from './_contract.js';
import type { StandardProbe } from './_contract.js';

/** Observable state exposed by the feedback, date, and color family runner. */
export type ValueComponentProbe =
  | StandardProbe
  | 'progress-percent'
  | 'progress-widget-text'
  | 'progress-fill-cells'
  | 'spinner-frame'
  | 'spinner-widget-text'
  | 'date-value'
  | 'calendar-week-number-width'
  | 'color-value'
  | 'input-count'
  | 'commit-count'
  | 'popup-view-count';

/** ProgressBar behavior covers two-way updates, captions, labels, and safe clamping. */
export const PROGRESS_BAR_CONTRACT = defineBehaviorContract<
  'reactive-value' | 'caption' | 'positioned-label' | 'clamping',
  ValueComponentProbe
>({
  exampleId: 'feedback/progress-bar',
  capabilities: ['reactive-value', 'caption', 'positioned-label', 'clamping'],
  cases: [
    {
      id: 'advance-progress',
      covers: ['reactive-value', 'caption', 'positioned-label'],
      initial: [
        { probe: 'progress-percent', operator: 'equals', value: 25 },
        { probe: 'progress-widget-text', operator: 'contains', value: 'Copying' },
        { probe: 'progress-widget-text', operator: 'contains', value: '25%' },
        { probe: 'progress-widget-text', operator: 'contains', value: 'Right label' },
        { probe: 'progress-widget-text', operator: 'contains', value: 'Top-left label' },
        { probe: 'progress-fill-cells', operator: 'less-than', value: 40 },
      ],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [
        { probe: 'progress-percent', operator: 'equals', value: 50 },
        { probe: 'progress-widget-text', operator: 'contains', value: '50%' },
        { probe: 'progress-fill-cells', operator: 'greater-than', value: 40 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'clamp-overshoot',
      covers: ['clamping'],
      initial: [{ probe: 'progress-percent', operator: 'equals', value: 25 }],
      actions: [{ kind: 'key', key: 'm', modifiers: ['Alt'] }],
      expected: [
        { probe: 'progress-percent', operator: 'equals', value: 100 },
        { probe: 'rendered-text', operator: 'contains', value: 'clamped from 140%' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Spinner behavior covers caller-owned frames, preset variety, and deterministic manual stepping. */
export const SPINNER_CONTRACT = defineBehaviorContract<
  'caller-owned-frame' | 'preset-variety' | 'deterministic-step',
  ValueComponentProbe
>({
  exampleId: 'feedback/spinner',
  capabilities: ['caller-owned-frame', 'preset-variety', 'deterministic-step'],
  cases: [
    {
      id: 'advance-all-presets',
      covers: ['caller-owned-frame', 'preset-variety', 'deterministic-step'],
      initial: [
        { probe: 'spinner-frame', operator: 'equals', value: 0 },
        { probe: 'spinner-widget-text', operator: 'contains', value: '| dots — Unicode rotation' },
        { probe: 'spinner-widget-text', operator: 'contains', value: '| line — universal ASCII' },
        { probe: 'spinner-widget-text', operator: 'contains', value: '| blocks — grows then shrinks' },
      ],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [
        { probe: 'spinner-frame', operator: 'equals', value: 1 },
        { probe: 'spinner-widget-text', operator: 'contains', value: '/ dots — Unicode rotation' },
        { probe: 'spinner-widget-text', operator: 'contains', value: '/ line — universal ASCII' },
        { probe: 'spinner-widget-text', operator: 'contains', value: '/ blocks — grows then shrinks' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Calendar behavior covers cursor navigation, committing a civil date, and deterministic today. */
export const CALENDAR_CONTRACT = defineBehaviorContract<
  'day-navigation' | 'two-way-value' | 'deterministic-today' | 'bounds' | 'disabled-dates' | 'week-numbers',
  ValueComponentProbe
>({
  exampleId: 'date/calendar',
  capabilities: ['day-navigation', 'two-way-value', 'deterministic-today', 'bounds', 'disabled-dates', 'week-numbers'],
  cases: [
    {
      id: 'move-and-commit-day',
      covers: ['day-navigation', 'two-way-value', 'deterministic-today'],
      initial: [
        { probe: 'date-value', operator: 'equals', value: 'none' },
        { probe: 'rendered-text', operator: 'contains', value: 'Selection: none' },
      ],
      actions: [
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'date-value', operator: 'equals', value: '2026-07-16' },
        { probe: 'rendered-text', operator: 'contains', value: 'Selection: 2026-07-16' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'clamp-to-minimum',
      covers: ['bounds', 'week-numbers'],
      initial: [
        { probe: 'date-value', operator: 'equals', value: 'none' },
        { probe: 'calendar-week-number-width', operator: 'equals', value: 3 },
      ],
      actions: [
        { kind: 'key', key: 'home', modifiers: [] },
        { kind: 'key', key: 'left', modifiers: [] },
        { kind: 'key', key: 'left', modifiers: [] },
        { kind: 'key', key: 'left', modifiers: [] },
        { kind: 'key', key: 'left', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [{ probe: 'date-value', operator: 'equals', value: '2026-07-10' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'reject-disabled-sunday',
      covers: ['disabled-dates'],
      initial: [{ probe: 'date-value', operator: 'equals', value: 'none' }],
      actions: [
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [{ probe: 'date-value', operator: 'equals', value: 'none' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** DatePicker behavior covers its masked field, shared value, popup trigger, and clearing. */
export const DATE_PICKER_CONTRACT = defineBehaviorContract<
  'masked-field' | 'two-way-value' | 'popup-calendar' | 'nullable-value',
  ValueComponentProbe
>({
  exampleId: 'date/date-picker',
  capabilities: ['masked-field', 'two-way-value', 'popup-calendar', 'nullable-value'],
  cases: [
    {
      id: 'load-a-date',
      covers: ['masked-field', 'two-way-value'],
      initial: [
        { probe: 'date-value', operator: 'equals', value: 'none' },
        { probe: 'input-count', operator: 'equals', value: 1 },
      ],
      actions: [{ kind: 'paste', text: '21082026' }],
      expected: [
        { probe: 'date-value', operator: 'equals', value: '2026-08-21' },
        { probe: 'rendered-text', operator: 'contains', value: '21/08/2026' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'pick-from-popup',
      covers: ['nullable-value', 'popup-calendar'],
      initial: [
        { probe: 'date-value', operator: 'equals', value: 'none' },
        { probe: 'popup-view-count', operator: 'equals', value: 0 },
      ],
      actions: [
        { kind: 'key', key: 'down', modifiers: ['Alt'] },
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'date-value', operator: 'equals', value: '2026-08-13' },
        { probe: 'popup-view-count', operator: 'equals', value: 0 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** ColorSwatch behavior distinguishes live palette movement from a discrete commit. */
export const COLOR_SWATCH_CONTRACT = defineBehaviorContract<
  'palette-grid' | 'wrap-navigation' | 'live-input' | 'discrete-commit',
  ValueComponentProbe
>({
  exampleId: 'color/color-swatch',
  capabilities: ['palette-grid', 'wrap-navigation', 'live-input', 'discrete-commit'],
  cases: [
    {
      id: 'preview-then-commit',
      covers: ['palette-grid', 'live-input', 'discrete-commit'],
      initial: [
        { probe: 'color-value', operator: 'equals', value: 'red' },
        { probe: 'input-count', operator: 'equals', value: 0 },
        { probe: 'commit-count', operator: 'equals', value: 0 },
      ],
      actions: [
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'color-value', operator: 'equals', value: 'green' },
        { probe: 'input-count', operator: 'equals', value: 1 },
        { probe: 'commit-count', operator: 'equals', value: 1 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'wrap-left',
      covers: ['wrap-navigation'],
      initial: [{ probe: 'color-value', operator: 'equals', value: 'red' }],
      actions: [{ kind: 'key', key: 'left', modifiers: [] }],
      expected: [{ probe: 'color-value', operator: 'equals', value: 'yellow' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** ColorPicker behavior covers popup selection, custom hex guidance, live input, and commit. */
export const COLOR_PICKER_CONTRACT = defineBehaviorContract<
  'popup-swatch' | 'custom-hex' | 'live-input' | 'discrete-commit',
  ValueComponentProbe
>({
  exampleId: 'color/color-picker',
  capabilities: ['popup-swatch', 'custom-hex', 'live-input', 'discrete-commit'],
  cases: [
    {
      id: 'pick-from-popup',
      covers: ['popup-swatch', 'live-input', 'discrete-commit'],
      initial: [
        { probe: 'color-value', operator: 'equals', value: 'red' },
        { probe: 'rendered-text', operator: 'contains', value: '#rrggbb' },
      ],
      actions: [
        { kind: 'key', key: 'down', modifiers: ['Alt'] },
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'color-value', operator: 'equals', value: 'green' },
        { probe: 'input-count', operator: 'equals', value: 1 },
        { probe: 'commit-count', operator: 'equals', value: 1 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'load-custom-color',
      covers: ['custom-hex'],
      initial: [
        { probe: 'color-value', operator: 'equals', value: 'red' },
        { probe: 'popup-view-count', operator: 'equals', value: 0 },
      ],
      actions: [
        { kind: 'key', key: 'down', modifiers: ['Alt'] },
        { kind: 'key', key: 'tab', modifiers: [] },
        { kind: 'key', key: 'a', modifiers: ['Ctrl'] },
        { kind: 'paste', text: '#663399' },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'color-value', operator: 'equals', value: '#663399' },
        { probe: 'rendered-text', operator: 'contains', value: 'Color: #663399' },
        { probe: 'popup-view-count', operator: 'equals', value: 0 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Exact ordered feedback, date, and color example population. */
export const VALUE_COMPONENT_EXAMPLE_IDS = [
  'feedback/progress-bar',
  'feedback/spinner',
  'date/calendar',
  'date/date-picker',
  'color/color-swatch',
  'color/color-picker',
] as const;

/** Exact ordered feedback, date, and color catalog population. */
export const VALUE_COMPONENT_CATALOG_ENTRY_IDS = VALUE_COMPONENT_EXAMPLE_IDS;

/** Complete immutable behavior-contract set for the feedback, date, and color wave. */
export const VALUE_COMPONENT_CONTRACTS = [
  PROGRESS_BAR_CONTRACT,
  SPINNER_CONTRACT,
  CALENDAR_CONTRACT,
  DATE_PICKER_CONTRACT,
  COLOR_SWATCH_CONTRACT,
  COLOR_PICKER_CONTRACT,
] as const;
