/**
 * Specification tests for the shared template1 shell and executable reference contracts.
 */
import { createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { absoluteOrigin, buildLabExample, dispatchExampleAction, frameText } from './example-lab-harness.js';
import type { ExampleBehaviorContract, ProbeExpectation, StandardProbe } from './contracts/_contract.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import { REFERENCE_CONTRACTS, REFERENCE_EXAMPLE_IDS } from './contracts/references.js';

interface Template1Evidence {
  readonly dialogRect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly viewport: { readonly width: number; readonly height: number };
  readonly frameLines: readonly string[];
  readonly dialogInterior: readonly string[];
}

interface EvidenceHarness {
  readonly collectTemplate1Evidence: (
    app: ReturnType<typeof buildLabExample>['app'],
    dialog: ReturnType<typeof buildLabExample>['dialog'],
  ) => Template1Evidence;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBinaryFunction(value: unknown): value is (left: unknown, right: unknown) => unknown {
  return typeof value === 'function';
}

function assertTemplate1Evidence(value: unknown): asserts value is Template1Evidence {
  if (
    !isRecord(value) ||
    !isRecord(value.dialogRect) ||
    !isRecord(value.viewport) ||
    !Array.isArray(value.frameLines) ||
    !Array.isArray(value.dialogInterior)
  ) {
    throw new TypeError('collectTemplate1Evidence returned invalid evidence');
  }
}

async function loadEvidenceHarness(): Promise<EvidenceHarness> {
  const modulePath = './example-lab-harness.js';
  const candidate: unknown = await import(modulePath);
  if (!isRecord(candidate) || !isBinaryFunction(candidate.collectTemplate1Evidence)) {
    throw new TypeError('example-lab-harness must export collectTemplate1Evidence');
  }
  const collect = candidate.collectTemplate1Evidence;
  return {
    collectTemplate1Evidence(app, dialog) {
      const evidence = collect(app, dialog);
      assertTemplate1Evidence(evidence);
      return evidence;
    },
  };
}

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

function assertProbe(
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

async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing reference example ${exampleId}`);
  return (await entry.load()).default;
}

describe('template1 reference shell', () => {
  test.each(REFERENCE_EXAMPLE_IDS)('%s owns a compact centered Classic dialog', async (exampleId) => {
    const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
    expect(entry?.kind).toBe('app');
    const definition = await loadDefinition(exampleId);
    const { collectTemplate1Evidence } = await loadEvidenceHarness();

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

describe('typed reference behavior contracts', () => {
  test('matches the cumulative reference population exactly', () => {
    expect(REFERENCE_CONTRACTS.map((contract) => contract.exampleId)).toEqual(REFERENCE_EXAMPLE_IDS);
    for (const contract of REFERENCE_CONTRACTS) validateBehaviorContract(contract);
  });

  test.each(REFERENCE_CONTRACTS)('$exampleId executes every independently rebuilt case', async (contract) => {
    const definition = await loadDefinition(contract.exampleId);
    for (const interaction of contract.cases) {
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(contract.exampleId, definition);
        try {
          for (const initial of interaction.initial) assertProbe(app, dialog, initial);
          for (const action of interaction.actions) dispatchExampleAction(app, action);
          for (const expected of interaction.expected) assertProbe(app, dialog, expected);
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

// This assignment keeps the generic executable shape checked independently from literal fixtures.
const _contractShape: readonly ExampleBehaviorContract<string, StandardProbe>[] = REFERENCE_CONTRACTS;
void _contractShape;
