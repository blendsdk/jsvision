/**
 * Specification tests for the complete controls page and live-example family.
 *
 * The expected IDs, headings, roles, and interaction outcomes are fixed here independently of the
 * catalog and example registry so deleting an implementation cannot make the oracle pass.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot } from '@jsvision/ui';
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
} from './example-lab-harness.js';
import type { ProbeExpectation, StandardProbe } from './contracts/_contract.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import {
  CONTROL_CATALOG_ENTRY_IDS,
  CONTROL_CONTRACTS,
  CONTROL_EXAMPLE_IDS,
  NEW_CONTROL_CONTRACTS,
  NEW_CONTROL_EXAMPLE_IDS,
} from './contracts/controls.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source-backed page obligations for one control documentation target. */
interface ControlPageExpectation {
  readonly id: (typeof CONTROL_CATALOG_ENTRY_IDS)[number];
  readonly filePath: string;
  readonly exampleId: (typeof CONTROL_EXAMPLE_IDS)[number];
  readonly headings: readonly string[];
  readonly symbols: readonly string[];
  readonly roles: readonly string[];
}

/** Complete ordered controls page fixture, independent from the runtime catalog. */
const CONTROL_PAGES = [
  {
    id: 'controls/button',
    filePath: 'components/controls/button.md',
    exampleId: 'controls/button',
    headings: ['Keyboard & mouse'],
    symbols: ['Button'],
    roles: ['button', 'buttonFocused', 'buttonDefault', 'buttonDisabled', 'buttonShortcut', 'buttonShadow'],
  },
  {
    id: 'controls/input',
    filePath: 'components/controls/input.md',
    exampleId: 'controls/input',
    headings: ['Validation', 'Reactive values and selection'],
    symbols: ['Input', 'Signal<string>'],
    roles: ['inputNormal', 'inputSelected', 'inputSelection', 'inputArrows', 'inputPlaceholder'],
  },
  {
    id: 'controls/text',
    filePath: 'components/controls/text.md',
    exampleId: 'controls/text',
    headings: ['Wrapping and line breaks', 'Semantic severity'],
    symbols: ['Text'],
    roles: ['staticText', 'warningText', 'dangerText'],
  },
  {
    id: 'controls/label',
    filePath: 'components/controls/label.md',
    exampleId: 'controls/label',
    headings: ['Linking and focus', 'Keyboard & mouse'],
    symbols: ['Label', 'View'],
    roles: ['label', 'labelSelected', 'labelShortcut'],
  },
  {
    id: 'controls/check-group',
    filePath: 'components/controls/check-group.md',
    exampleId: 'controls/check-group',
    headings: ['Independent selection', 'Keyboard & mouse'],
    symbols: ['CheckGroup', 'CheckGroupOptions', 'Signal<boolean[]>'],
    roles: ['clusterNormal', 'clusterSelected', 'clusterShortcut', 'clusterDisabled'],
  },
  {
    id: 'controls/radio-group',
    filePath: 'components/controls/radio-group.md',
    exampleId: 'controls/radio-group',
    headings: ['Exclusive selection', 'Keyboard & mouse'],
    symbols: ['RadioGroup', 'RadioGroupOptions', 'Signal<number>'],
    roles: ['clusterNormal', 'clusterSelected', 'clusterShortcut', 'clusterDisabled'],
  },
  {
    id: 'controls/multi-check-group',
    filePath: 'components/controls/multi-check-group.md',
    exampleId: 'controls/multi-check-group',
    headings: ['State cycles', 'Keyboard & mouse'],
    symbols: ['MultiCheckGroup', 'MultiCheckGroupOptions', 'Signal<number[]>'],
    roles: ['clusterNormal', 'clusterSelected', 'clusterShortcut', 'clusterDisabled'],
  },
  {
    id: 'controls/slider',
    filePath: 'components/controls/slider.md',
    exampleId: 'controls/slider',
    headings: ['Live input and commits', 'Keyboard & mouse'],
    symbols: ['Slider', 'SliderOptions', 'Signal<number>'],
    roles: ['sliderTrack', 'sliderThumb'],
  },
  {
    id: 'controls/switch',
    filePath: 'components/controls/switch.md',
    exampleId: 'controls/switch',
    headings: ['States and disabled behavior', 'Keyboard & mouse'],
    symbols: ['Switch', 'SwitchOptions', 'Signal<boolean>'],
    roles: ['button', 'buttonFocused', 'staticText', 'labelShortcut', 'clusterDisabled'],
  },
] as const satisfies readonly ControlPageExpectation[];

/** Read one portable observable from a mounted control example. */
function probeValue(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  probe: StandardProbe,
): string | number {
  if (probe === 'rendered-text') return frameText(app);
  if (probe === 'dialog-width') return dialog.bounds.width;
  if (probe === 'dialog-height') return dialog.bounds.height;
  if (probe === 'focused-view') return app.loop.getFocused()?.constructor.name ?? 'none';
  const buffer = app.loop.renderRoot.buffer();
  if (probe === 'menu-background') return buffer.get(10, 0)?.bg ?? 'missing';
  const origin = absoluteOrigin(dialog);
  return buffer.get(origin.x + 1, origin.y + 1)?.bg ?? 'missing';
}

/** Assert one behavior-contract probe without exposing view internals to the contract. */
function expectProbe(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  expectation: ProbeExpectation<StandardProbe>,
): void {
  const actual = probeValue(app, dialog, expectation.probe);
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

/** Resolve and load one lazily registered control example. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing controls example ${exampleId}`);
  return (await entry.load()).default;
}

describe('controls family population', () => {
  test('keeps catalog, page, example, and contract populations exact', () => {
    expect(CONTROL_PAGES.map((page) => page.id)).toEqual(CONTROL_CATALOG_ENTRY_IDS);
    expect(CONTROL_PAGES.map((page) => page.exampleId)).toEqual(CONTROL_EXAMPLE_IDS);
    expect(CONTROL_CONTRACTS.map((contract) => contract.exampleId)).toEqual(CONTROL_EXAMPLE_IDS);
    expect(NEW_CONTROL_CONTRACTS.map((contract) => contract.exampleId)).toEqual(NEW_CONTROL_EXAMPLE_IDS);
    for (const contract of CONTROL_CONTRACTS) validateBehaviorContract(contract);
  });
});

describe('controls component pages', () => {
  test.each(CONTROL_PAGES)('$id satisfies its source-backed teaching contract', async (page) => {
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

describe('new controls template1 examples', () => {
  test.each(NEW_CONTROL_EXAMPLE_IDS)('%s owns a compact centered Classic dialog', async (exampleId) => {
    const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
    expect(entry?.kind).toBe('app');
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
});

describe('new controls behavior contracts', () => {
  test.each(NEW_CONTROL_CONTRACTS)('$exampleId executes every independently rebuilt case', async (contract) => {
    const definition = await loadDefinition(contract.exampleId);
    for (const interaction of contract.cases) {
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(contract.exampleId, definition);
        try {
          for (const initial of interaction.initial) expectProbe(app, dialog, initial);
          for (const action of interaction.actions) dispatchExampleAction(app, action);
          for (const expected of interaction.expected) expectProbe(app, dialog, expected);
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
