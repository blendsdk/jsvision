/**
 * Data Grid hub objective specifications.
 *
 * Each approved example has a typed contract before implementation. The live registry and paint
 * checks ensure the eventual implementation remains lazy, runnable, and visibly grid-backed.
 */
import { DataGrid, Dialog, createRoot } from '@jsvision/ui';
import { EditableDataGrid } from '@jsvision/datagrid';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { buildLabExample, collectTemplate1Evidence, dispatchExampleAction, viewsIn } from './example-lab-harness.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import { DATA_GRID_CONTRACTS, DATA_GRID_EXAMPLE_IDS } from './contracts/data-grid/index.js';
import type { DataGridExpectation } from './contracts/data-grid/_shared.js';
import { DataGridLabProbe } from '../src/example-fixtures/data-grid/probe.js';

/** Let grid editor commits and modal command promises settle after a dispatched input. */
async function settleInteraction(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Resolve one lazily registered Data Grid example. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing Data Grid example ${exampleId}`);
  return (await entry.load()).default;
}

/** Assert one typed expectation against a target-owned laboratory probe. */
function expectProbe(probe: DataGridLabProbe, expectation: DataGridExpectation, dialogWidth: number): void {
  const actual = expectation.probe === 'dialog-width' ? dialogWidth : probe.read(expectation.probe);
  switch (expectation.operator) {
    case 'equals':
      expect(actual, expectation.probe).toBe(expectation.value);
      return;
    case 'contains':
      expect(String(actual), expectation.probe).toContain(String(expectation.value));
      return;
    case 'excludes':
      expect(String(actual), expectation.probe).not.toContain(String(expectation.value));
      return;
    case 'greater-than':
      expect(Number(actual), expectation.probe).toBeGreaterThan(Number(expectation.value));
      return;
    case 'less-than':
      expect(Number(actual), expectation.probe).toBeLessThan(Number(expectation.value));
      return;
  }
}

describe('Data Grid objective contracts', () => {
  test('cover exactly the approved 24-example population', () => {
    expect(DATA_GRID_CONTRACTS.map((contract) => contract.exampleId)).toEqual(DATA_GRID_EXAMPLE_IDS);
    for (const contract of DATA_GRID_CONTRACTS) validateBehaviorContract(contract);
  });

  test('registry contains every approved example once and no obsolete table example', () => {
    const actual = EXAMPLES.filter((entry) => entry.id.startsWith('data-grid/')).map((entry) => entry.id);
    expect(actual).toEqual(DATA_GRID_EXAMPLE_IDS);
    expect(EXAMPLES.some((entry) => entry.id === 'table/data-grid')).toBe(false);
  });
});

describe('Data Grid live examples', () => {
  test.each(DATA_GRID_EXAMPLE_IDS)('%s paints a template1 dialog containing a real grid', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        const descendants = viewsIn(dialog);
        expect(dialog).toBeInstanceOf(Dialog);
        expect(
          descendants.some((view) => view instanceof DataGrid || view instanceof EditableDataGrid),
          `${exampleId} must contain a public grid`,
        ).toBe(true);
        collectTemplate1Evidence(app, dialog);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    });
  });
});

describe('Data Grid executable behavior contracts', () => {
  for (const contract of DATA_GRID_CONTRACTS) {
    for (const behavior of contract.cases) {
      test(`${contract.exampleId} · ${behavior.id}`, async () => {
        const definition = await loadDefinition(contract.exampleId);
        await createRoot(async (dispose) => {
          const { app, dialog } = buildLabExample(contract.exampleId, definition);
          try {
            const probe = viewsIn(dialog).find((view): view is DataGridLabProbe => view instanceof DataGridLabProbe);
            if (probe === undefined) throw new Error(`${contract.exampleId} is missing its target probe`);
            for (const expectation of behavior.initial) expectProbe(probe, expectation, dialog.bounds.width);
            for (const action of behavior.actions) {
              dispatchExampleAction(app, action);
              await settleInteraction();
            }
            for (const expectation of behavior.expected) expectProbe(probe, expectation, dialog.bounds.width);
          } finally {
            try {
              app.loop.dispose();
            } finally {
              dispose();
            }
          }
        });
      });
    }
  }
});
