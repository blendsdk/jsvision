import { defineBehaviorContract } from './_contract.js';
import type { StandardProbe } from './_contract.js';

/** Button reference behavior: inert states, reactive enablement, and command feedback. */
export const BUTTON_CONTRACT = defineBehaviorContract<
  'state-gallery' | 'reactive-enablement' | 'default-command',
  StandardProbe
>({
  exampleId: 'controls/button',
  capabilities: ['state-gallery', 'reactive-enablement', 'default-command'],
  cases: [
    {
      id: 'disabled-and-default',
      covers: ['state-gallery', 'default-command'],
      initial: [
        { probe: 'rendered-text', operator: 'contains', value: 'Last action: Nothing yet' },
        { probe: 'focused-view', operator: 'equals', value: 'Button' },
        { probe: 'menu-background', operator: 'equals', value: '#aaaaaa' },
        { probe: 'dialog-background', operator: 'equals', value: '#aaaaaa' },
      ],
      actions: [
        { kind: 'key', key: 'u', modifiers: ['Alt'] },
        { kind: 'key', key: 'enter', modifiers: [] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Deploy command + callback' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'reactive-save',
      covers: ['reactive-enablement'],
      initial: [{ probe: 'rendered-text', operator: 'excludes', value: 'Saved "JS"' }],
      actions: [
        { kind: 'key', key: 'n', modifiers: ['Alt'] },
        { kind: 'key', key: 'J', modifiers: [] },
        { kind: 'key', key: 'S', modifiers: [] },
        { kind: 'key', key: 's', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Saved "JS"' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Input reference behavior: filtered binding plus externally controlled load and clear actions. */
export const INPUT_CONTRACT = defineBehaviorContract<
  'filtered-binding' | 'external-load' | 'external-clear',
  StandardProbe
>({
  exampleId: 'controls/input',
  capabilities: ['filtered-binding', 'external-load', 'external-clear'],
  cases: [
    {
      id: 'filter-typed-name',
      covers: ['filtered-binding'],
      initial: [
        { probe: 'rendered-text', operator: 'contains', value: 'Name' },
        { probe: 'focused-view', operator: 'equals', value: 'Input' },
      ],
      actions: [
        { kind: 'key', key: 'n', modifiers: ['Alt'] },
        { kind: 'key', key: 'A', modifiers: [] },
        { kind: 'key', key: 'd', modifiers: [] },
        { kind: 'key', key: 'a', modifiers: [] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Ada' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'load-and-clear',
      covers: ['external-load', 'external-clear'],
      initial: [{ probe: 'rendered-text', operator: 'excludes', value: 'Ada Lovelace' }],
      actions: [
        { kind: 'key', key: 's', modifiers: ['Alt'] },
        { kind: 'key', key: 'c', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'rendered-text', operator: 'contains', value: 'Status: cleared' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Text reference behavior: reactive copy, semantic samples, and deterministic reset. */
export const TEXT_CONTRACT = defineBehaviorContract<'semantic-gallery' | 'reactive-copy' | 'reset', StandardProbe>({
  exampleId: 'controls/text',
  capabilities: ['semantic-gallery', 'reactive-copy', 'reset'],
  cases: [
    {
      id: 'increment-and-toggle',
      covers: ['semantic-gallery', 'reactive-copy'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Warning: review before continuing.' }],
      actions: [
        { kind: 'key', key: 'i', modifiers: ['Alt'] },
        { kind: 'key', key: 't', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Count: 1' },
        { probe: 'rendered-text', operator: 'contains', value: 'Detailed mode' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'reset-copy',
      covers: ['reset'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'Count: 0' }],
      actions: [
        { kind: 'key', key: 'i', modifiers: ['Alt'] },
        { kind: 'key', key: 'r', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: 'Count: 0' },
        { probe: 'rendered-text', operator: 'contains', value: 'Concise mode' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Immutable cumulative reference-example population delivered before family migrations. */
export const REFERENCE_EXAMPLE_IDS = ['controls/button', 'controls/input', 'controls/text'] as const;

/** Behavior contracts keyed one-for-one to the cumulative reference population. */
export const REFERENCE_CONTRACTS = [BUTTON_CONTRACT, INPUT_CONTRACT, TEXT_CONTRACT] as const;
