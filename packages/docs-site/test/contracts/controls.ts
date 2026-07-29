import { defineBehaviorContract } from './_contract.js';
import type { StandardProbe } from './_contract.js';
import { REFERENCE_CONTRACTS, REFERENCE_EXAMPLE_IDS } from './references.js';

/** Label behavior: its accelerator and clickable caption both transfer input focus. */
export const LABEL_CONTRACT = defineBehaviorContract<'linked-hotkey' | 'linked-click', StandardProbe>({
  exampleId: 'controls/label',
  capabilities: ['linked-hotkey', 'linked-click'],
  cases: [
    {
      id: 'focus-email-by-hotkey',
      covers: ['linked-hotkey'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Email value: (empty)' }],
      actions: [
        { kind: 'key', key: 'e', modifiers: ['Alt'] },
        { kind: 'key', key: 'a', modifiers: [] },
      ],
      expected: [
        { probe: 'focused-view', operator: 'equals', value: 'Input' },
        { probe: 'rendered-text', operator: 'contains', value: 'Email value: a' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'focus-name-by-click',
      covers: ['linked-click'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Name value: (empty)' }],
      actions: [
        { kind: 'mouse', gesture: 'click', at: { x: 10, y: 7 }, button: 'left' },
        { kind: 'key', key: 'J', modifiers: [] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Name value: J' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** CheckGroup behavior: independent toggles, accelerators, and inert disabled items. */
export const CHECK_GROUP_CONTRACT = defineBehaviorContract<
  'independent-selection' | 'item-hotkeys' | 'disabled-item',
  StandardProbe
>({
  exampleId: 'controls/check-group',
  capabilities: ['independent-selection', 'item-hotkeys', 'disabled-item'],
  cases: [
    {
      id: 'toggle-independent-items',
      covers: ['independent-selection', 'item-hotkeys'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Selected: Bold' }],
      actions: [
        { kind: 'key', key: 'i', modifiers: ['Alt'] },
        { kind: 'key', key: 's', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Selected: Bold, Italic, Strike' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'disabled-item-is-inert',
      covers: ['disabled-item'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Underline is disabled' }],
      actions: [{ kind: 'key', key: 'u', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Selected: Bold' },
        { probe: 'rendered-text', operator: 'excludes', value: 'Selected: Bold, Underline' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** RadioGroup behavior: exclusive selection follows arrows while disabled rows are skipped. */
export const RADIO_GROUP_CONTRACT = defineBehaviorContract<
  'exclusive-selection' | 'arrow-selection' | 'disabled-skip',
  StandardProbe
>({
  exampleId: 'controls/radio-group',
  capabilities: ['exclusive-selection', 'arrow-selection', 'disabled-skip'],
  cases: [
    {
      id: 'arrows-select-one-option',
      covers: ['exclusive-selection', 'arrow-selection'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Alignment: Left' }],
      actions: [{ kind: 'key', key: 'down', modifiers: [] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Alignment: Center' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'disabled-option-is-skipped',
      covers: ['disabled-skip'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Justify is disabled' }],
      actions: [
        { kind: 'key', key: 'up', modifiers: [] },
        { kind: 'key', key: 'up', modifiers: [] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Alignment: Center' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** MultiCheckGroup behavior: each item cycles independently through an ordered state set. */
export const MULTI_CHECK_GROUP_CONTRACT = defineBehaviorContract<
  'multi-state-cycle' | 'state-wrap' | 'independent-items',
  StandardProbe
>({
  exampleId: 'controls/multi-check-group',
  capabilities: ['multi-state-cycle', 'state-wrap', 'independent-items'],
  cases: [
    {
      id: 'cycle-to-partial',
      covers: ['multi-state-cycle'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Sync: Off' }],
      actions: [{ kind: 'key', key: 's', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Sync: Partial' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'advance-to-full',
      covers: ['multi-state-cycle'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Sync: Off' }],
      actions: [
        { kind: 'key', key: 's', modifiers: ['Alt'] },
        { kind: 'key', key: 'space', modifiers: [] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Sync: Full' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'wrap-an-independent-item',
      covers: ['state-wrap', 'independent-items'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Backup: Full' }],
      actions: [{ kind: 'key', key: 'b', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Backup: Off' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Slider behavior: keyboard motion, bounds, orientation, and live/commit callbacks stay visible. */
export const SLIDER_CONTRACT = defineBehaviorContract<
  'keyboard-range' | 'live-and-commit' | 'vertical-orientation',
  StandardProbe
>({
  exampleId: 'controls/slider',
  capabilities: ['keyboard-range', 'live-and-commit', 'vertical-orientation'],
  cases: [
    {
      id: 'jump-to-range-end',
      covers: ['keyboard-range', 'live-and-commit'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Horizontal: 40 · previews 0 · commits 0' }],
      actions: [{ kind: 'key', key: 'end', modifiers: [] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Horizontal: 100 · previews 1 · commits 1' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'step-vertical-slider',
      covers: ['vertical-orientation'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Vertical: 50' }],
      actions: [
        { kind: 'key', key: 't', modifiers: ['Alt'] },
        { kind: 'key', key: 'down', modifiers: [] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Vertical: 55' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Switch behavior: hotkeys toggle enabled switches while disabled state remains inert. */
export const SWITCH_CONTRACT = defineBehaviorContract<
  'on-off-state' | 'global-hotkey' | 'disabled-state' | 'reset',
  StandardProbe
>({
  exampleId: 'controls/switch',
  capabilities: ['on-off-state', 'global-hotkey', 'disabled-state', 'reset'],
  cases: [
    {
      id: 'toggle-by-hotkey',
      covers: ['on-off-state', 'global-hotkey'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Wi-Fi: Off · Sync: On · Locked: Off' }],
      actions: [{ kind: 'key', key: 'w', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Wi-Fi: On · Sync: On · Locked: Off' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'disabled-is-inert',
      covers: ['disabled-state'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Locked is disabled' }],
      actions: [{ kind: 'key', key: 'l', modifiers: ['Alt'] }],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Wi-Fi: Off · Sync: On · Locked: Off' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'reset-enabled-switches',
      covers: ['reset'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Wi-Fi: Off · Sync: On · Locked: Off' }],
      actions: [
        { kind: 'key', key: 'w', modifiers: ['Alt'] },
        { kind: 'key', key: 's', modifiers: ['Alt'] },
        { kind: 'key', key: 'r', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Wi-Fi: Off · Sync: On · Locked: Off' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Controls added after the accepted Button, Input, and Text reference examples. */
export const NEW_CONTROL_EXAMPLE_IDS = [
  'controls/label',
  'controls/check-group',
  'controls/radio-group',
  'controls/multi-check-group',
  'controls/slider',
  'controls/switch',
] as const;

/** Complete immutable catalog population for the controls documentation family. */
export const CONTROL_CATALOG_ENTRY_IDS = [
  'controls/button',
  'controls/input',
  'controls/text',
  ...NEW_CONTROL_EXAMPLE_IDS,
] as const;

/** Complete immutable example population for the controls documentation family. */
export const CONTROL_EXAMPLE_IDS = [...REFERENCE_EXAMPLE_IDS, ...NEW_CONTROL_EXAMPLE_IDS] as const;

/** New control contracts authored before their pages and examples. */
export const NEW_CONTROL_CONTRACTS = [
  LABEL_CONTRACT,
  CHECK_GROUP_CONTRACT,
  RADIO_GROUP_CONTRACT,
  MULTI_CHECK_GROUP_CONTRACT,
  SLIDER_CONTRACT,
  SWITCH_CONTRACT,
] as const;

/** Cumulative contracts for every delivered controls example. */
export const CONTROL_CONTRACTS = [...REFERENCE_CONTRACTS, ...NEW_CONTROL_CONTRACTS] as const;
