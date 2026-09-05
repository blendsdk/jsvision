import { defineBehaviorContract } from './_contract.js';
import type { StandardProbe } from './_contract.js';

/** Target-owned state exposed by the container and dropdown family test runner. */
export type ContainerProbe =
  | StandardProbe
  | 'list-focused'
  | 'list-selected'
  | 'list-count'
  | 'scroll-x'
  | 'scroll-y'
  | 'scroll-value'
  | 'disabled-track-cells'
  | 'tree-expanded'
  | 'tree-selected'
  | 'tab-active'
  | 'tab-count'
  | 'mounted-tab-pages'
  | 'split-first-width'
  | 'split-grab-mark'
  | 'combo-filtered-count'
  | 'combo-value'
  | 'history-input-value';

/** Dialog behavior covers automatic placement and its validation-aware terminating-command gate. */
export const DIALOG_CONTRACT = defineBehaviorContract<
  'automatic-centering' | 'validation-gate' | 'cancel-bypass',
  ContainerProbe
>({
  exampleId: 'containers/dialog',
  capabilities: ['automatic-centering', 'validation-gate', 'cancel-bypass'],
  cases: [
    {
      id: 'reject-invalid-ok',
      covers: ['automatic-centering', 'validation-gate'],
      initial: [
        { probe: 'dialog-width', operator: 'equals', value: 48 },
        { probe: 'rendered-text', operator: 'contains', value: 'Validation: waiting' },
      ],
      actions: [{ kind: 'key', key: 'v', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Validation: blocked invalid value' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'cancel-bypasses-validation',
      covers: ['cancel-bypass'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Cancel bypass: not checked' }],
      actions: [{ kind: 'key', key: 'c', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Cancel bypass: allowed' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** GroupBox behavior covers passive framing, reactive captions, nesting, and descendant focus. */
export const GROUP_BOX_CONTRACT = defineBehaviorContract<
  'caption-alignment' | 'reactive-caption' | 'nesting' | 'descendant-focus',
  ContainerProbe
>({
  exampleId: 'containers/group-box',
  capabilities: ['caption-alignment', 'reactive-caption', 'nesting', 'descendant-focus'],
  cases: [
    {
      id: 'update-reactive-caption',
      covers: ['caption-alignment', 'reactive-caption', 'nesting'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Modules: 2' }],
      actions: [{ kind: 'key', key: 'a', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Modules: 3' },
        { probe: 'rendered-text', operator: 'contains', value: 'Status: Added module 3' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'focus-descendant',
      covers: ['descendant-focus'],
      initial: [{ probe: 'focused-view', operator: 'equals', value: 'Button' }],
      actions: [{ kind: 'key', key: 'tab', modifiers: [] }],
      expected: [{ probe: 'focused-view', operator: 'equals', value: 'Button' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Generic ListView behavior covers navigation, activation, sorting, and type-ahead. */
export const LIST_VIEW_CONTRACT = defineBehaviorContract<
  'keyboard-navigation' | 'selection' | 'sorting' | 'type-ahead',
  ContainerProbe
>({
  exampleId: 'containers/list-view',
  capabilities: ['keyboard-navigation', 'selection', 'sorting', 'type-ahead'],
  cases: [
    {
      id: 'navigate-and-select',
      covers: ['keyboard-navigation', 'selection', 'sorting'],
      initial: [
        { probe: 'list-focused', operator: 'equals', value: 0 },
        { probe: 'rendered-text', operator: 'contains', value: 'Ada · 36' },
      ],
      actions: [
        { kind: 'key', key: 'down', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'list-focused', operator: 'equals', value: 1 },
        { probe: 'list-selected', operator: 'equals', value: 1 },
        { probe: 'rendered-text', operator: 'contains', value: 'Selected: Alan' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'jump-by-prefix',
      covers: ['type-ahead'],
      initial: [{ probe: 'list-focused', operator: 'equals', value: 0 }],
      actions: [{ kind: 'key', key: 'g', modifiers: [] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Focus: Grace' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** ListBox behavior covers string rendering and safe focus clamping after reactive item changes. */
export const LIST_BOX_CONTRACT = defineBehaviorContract<
  'string-items' | 'reactive-items' | 'focus-clamping',
  ContainerProbe
>({
  exampleId: 'containers/list-box',
  capabilities: ['string-items', 'reactive-items', 'focus-clamping'],
  cases: [
    {
      id: 'replace-items-and-clamp',
      covers: ['string-items', 'reactive-items', 'focus-clamping'],
      initial: [
        { probe: 'list-count', operator: 'equals', value: 5 },
        { probe: 'rendered-text', operator: 'contains', value: 'Five' },
      ],
      actions: [
        { kind: 'key', key: 'end', modifiers: [] },
        { kind: 'key', key: 'r', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'list-count', operator: 'equals', value: 2 },
        { probe: 'list-focused', operator: 'equals', value: 1 },
        { probe: 'rendered-text', operator: 'contains', value: 'Items: 2 · focus 1' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Scroller behavior covers both axes, paging, and clamping at the content extent. */
export const SCROLLER_CONTRACT = defineBehaviorContract<
  'content-clipping' | 'keyboard-scrolling' | 'two-axis-scrolling' | 'clamping',
  ContainerProbe
>({
  exampleId: 'containers/scroller',
  capabilities: ['content-clipping', 'keyboard-scrolling', 'two-axis-scrolling', 'clamping'],
  cases: [
    {
      id: 'page-content',
      covers: ['content-clipping', 'keyboard-scrolling'],
      initial: [{ probe: 'scroll-y', operator: 'equals', value: 0 }],
      actions: [{ kind: 'key', key: 'pagedown', modifiers: [] }],
      expected: [
        { probe: 'scroll-y', operator: 'greater-than', value: 0 },
        { probe: 'rendered-text', operator: 'contains', value: 'Offset:' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'reach-both-extents',
      covers: ['two-axis-scrolling', 'clamping'],
      initial: [
        { probe: 'scroll-x', operator: 'equals', value: 0 },
        { probe: 'scroll-y', operator: 'equals', value: 0 },
      ],
      actions: [
        { kind: 'key', key: 'end', modifiers: [] },
        { kind: 'key', key: 'x', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'scroll-x', operator: 'greater-than', value: 0 },
        { probe: 'scroll-y', operator: 'greater-than', value: 0 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** ScrollBar behavior covers orientation, range changes, and its two-way position signal. */
export const SCROLL_BAR_CONTRACT = defineBehaviorContract<
  'orientation' | 'range' | 'two-way-value' | 'disabled-state',
  ContainerProbe
>({
  exampleId: 'containers/scroll-bar',
  capabilities: ['orientation', 'range', 'two-way-value', 'disabled-state'],
  cases: [
    {
      id: 'advance-bound-values',
      covers: ['orientation', 'range', 'two-way-value'],
      initial: [{ probe: 'scroll-value', operator: 'equals', value: 0 }],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [
        { probe: 'scroll-value', operator: 'equals', value: 40 },
        { probe: 'rendered-text', operator: 'contains', value: 'Bound value: 40' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'collapse-range',
      covers: ['disabled-state'],
      initial: [
        { probe: 'rendered-text', operator: 'excludes', value: 'Disabled track: yes' },
        { probe: 'disabled-track-cells', operator: 'equals', value: 0 },
      ],
      actions: [{ kind: 'key', key: 'd', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Disabled track: yes' },
        { probe: 'disabled-track-cells', operator: 'greater-than', value: 0 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Tree behavior covers expand state, directional navigation, and activation. */
export const TREE_CONTRACT = defineBehaviorContract<
  'expand-collapse' | 'directional-navigation' | 'selection' | 'marker-styles',
  ContainerProbe
>({
  exampleId: 'containers/tree',
  capabilities: ['expand-collapse', 'directional-navigation', 'selection', 'marker-styles'],
  cases: [
    {
      id: 'expand-and-select-child',
      covers: ['expand-collapse', 'directional-navigation', 'selection', 'marker-styles'],
      initial: [
        { probe: 'tree-expanded', operator: 'equals', value: 0 },
        { probe: 'rendered-text', operator: 'contains', value: '[+]' },
      ],
      actions: [
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'right', modifiers: [] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'tree-expanded', operator: 'equals', value: 1 },
        { probe: 'tree-selected', operator: 'equals', value: 1 },
        { probe: 'rendered-text', operator: 'contains', value: 'Opened: index.ts' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** TabView behavior covers enabled cycling, accelerators, retained pages, and closeable tabs. */
export const TABS_CONTRACT = defineBehaviorContract<
  'enabled-cycling' | 'accelerators' | 'mounted-pages' | 'closeable-tabs',
  ContainerProbe
>({
  exampleId: 'containers/tabs',
  capabilities: ['enabled-cycling', 'accelerators', 'mounted-pages', 'closeable-tabs'],
  cases: [
    {
      id: 'cycle-past-disabled-tab',
      covers: ['enabled-cycling', 'mounted-pages'],
      initial: [
        { probe: 'tab-active', operator: 'equals', value: 0 },
        { probe: 'mounted-tab-pages', operator: 'equals', value: 3 },
      ],
      actions: [{ kind: 'key', key: 'pagedown', modifiers: ['Ctrl'] }],
      expected: [
        { probe: 'tab-active', operator: 'equals', value: 2 },
        { probe: 'mounted-tab-pages', operator: 'equals', value: 3 },
        { probe: 'rendered-text', operator: 'contains', value: 'Active: Output' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'protect-non-closeable-tab',
      covers: ['closeable-tabs'],
      initial: [
        { probe: 'tab-active', operator: 'equals', value: 0 },
        { probe: 'tab-count', operator: 'equals', value: 3 },
      ],
      actions: [{ kind: 'key', key: 'c', modifiers: ['Alt'] }],
      expected: [
        { probe: 'tab-active', operator: 'equals', value: 0 },
        { probe: 'tab-count', operator: 'equals', value: 3 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'accelerate-and-close',
      covers: ['accelerators', 'closeable-tabs'],
      initial: [{ probe: 'tab-count', operator: 'equals', value: 3 }],
      actions: [
        { kind: 'key', key: 'o', modifiers: ['Alt'] },
        { kind: 'key', key: 'c', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'tab-count', operator: 'equals', value: 2 },
        { probe: 'tab-active', operator: 'equals', value: 0 },
        { probe: 'rendered-text', operator: 'contains', value: 'Closed: Output' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** SplitView behavior covers sizing, keyboard resize, minimums, and live grab-mark styling. */
export const SPLIT_VIEW_CONTRACT = defineBehaviorContract<
  'pane-sizing' | 'keyboard-resize' | 'minimum-size' | 'grab-mark',
  ContainerProbe
>({
  exampleId: 'containers/split-view',
  capabilities: ['pane-sizing', 'keyboard-resize', 'minimum-size', 'grab-mark'],
  cases: [
    {
      id: 'resize-first-pane',
      covers: ['pane-sizing', 'keyboard-resize', 'minimum-size'],
      initial: [{ probe: 'split-first-width', operator: 'equals', value: 13 }],
      actions: [{ kind: 'key', key: 'right', modifiers: [] }],
      expected: [
        { probe: 'split-first-width', operator: 'greater-than', value: 13 },
        { probe: 'rendered-text', operator: 'contains', value: 'Resize commits: 1' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'toggle-grab-mark',
      covers: ['grab-mark'],
      initial: [{ probe: 'split-grab-mark', operator: 'equals', value: true }],
      actions: [{ kind: 'key', key: 'g', modifiers: ['Alt'] }],
      expected: [{ probe: 'split-grab-mark', operator: 'equals', value: false }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** ComboBox behavior covers editable filtering, popup selection, and exact value/text binding. */
export const COMBO_BOX_CONTRACT = defineBehaviorContract<
  'editable-filtering' | 'popup-selection' | 'value-text-binding',
  ContainerProbe
>({
  exampleId: 'dropdown/combo-box',
  capabilities: ['editable-filtering', 'popup-selection', 'value-text-binding'],
  cases: [
    {
      id: 'filter-and-pick',
      covers: ['editable-filtering', 'popup-selection', 'value-text-binding'],
      initial: [
        { probe: 'combo-filtered-count', operator: 'equals', value: 5 },
        { probe: 'combo-value', operator: 'equals', value: 'none' },
      ],
      actions: [
        { kind: 'key', key: 'g', modifiers: [] },
        { kind: 'key', key: 'r', modifiers: [] },
        { kind: 'key', key: 'down', modifiers: ['Alt'] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'combo-filtered-count', operator: 'equals', value: 1 },
        { probe: 'combo-value', operator: 'equals', value: 'Green' },
        { probe: 'rendered-text', operator: 'contains', value: 'Value: Green' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** History behavior covers app-owned MRU recording, keyboard opening, and field replacement. */
export const HISTORY_CONTRACT = defineBehaviorContract<
  'app-owned-history' | 'keyboard-popup' | 'field-replacement',
  ContainerProbe
>({
  exampleId: 'dropdown/history',
  capabilities: ['app-owned-history', 'keyboard-popup', 'field-replacement'],
  cases: [
    {
      id: 'record-and-recall',
      covers: ['app-owned-history', 'keyboard-popup', 'field-replacement'],
      initial: [{ probe: 'history-input-value', operator: 'equals', value: '/workspace/current' }],
      actions: [
        { kind: 'key', key: 'down', modifiers: ['Alt'] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [
        { probe: 'history-input-value', operator: 'equals', value: '/var/log' },
        { probe: 'rendered-text', operator: 'contains', value: 'Entries: 4' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Exact container/dropdown catalog population delivered by this family wave. */
export const CONTAINER_CATALOG_ENTRY_IDS = [
  'containers/dialog',
  'containers/group-box',
  'containers/list-view',
  'containers/list-box',
  'containers/scroller',
  'containers/scroll-bar',
  'containers/tree',
  'containers/tabs',
  'containers/split-view',
  'dropdown/combo-box',
  'dropdown/history',
] as const;

/** Exact runnable population delivered by this family wave. */
export const CONTAINER_EXAMPLE_IDS = [...CONTAINER_CATALOG_ENTRY_IDS] as const;

/** Exact behavior-contract population, in catalog order. */
export const CONTAINER_CONTRACTS = [
  DIALOG_CONTRACT,
  GROUP_BOX_CONTRACT,
  LIST_VIEW_CONTRACT,
  LIST_BOX_CONTRACT,
  SCROLLER_CONTRACT,
  SCROLL_BAR_CONTRACT,
  TREE_CONTRACT,
  TABS_CONTRACT,
  SPLIT_VIEW_CONTRACT,
  COMBO_BOX_CONTRACT,
  HISTORY_CONTRACT,
] as const;
