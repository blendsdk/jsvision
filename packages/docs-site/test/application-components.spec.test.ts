/**
 * Specification tests for the foundations and application-shell documentation wave.
 *
 * The expected IDs, page obligations, and interaction outcomes are fixed independently from the
 * catalog and lazy registry so a missing implementation cannot disappear from the oracle.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot, MenuBar, Window } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { validateComponentPage } from '../src/components/component-pages.mjs';
import {
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';
import type { ProbeExpectation } from './contracts/_contract.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import {
  APPLICATION_CATALOG_ENTRY_IDS,
  APPLICATION_CONTRACTS,
  APPLICATION_EXAMPLE_IDS,
} from './contracts/application.js';
import type { ApplicationProbe } from './contracts/application.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source-backed teaching obligations for one foundation or application-shell page. */
interface ApplicationPageExpectation {
  readonly id: (typeof APPLICATION_CATALOG_ENTRY_IDS)[number];
  readonly filePath: string;
  readonly exampleId: (typeof APPLICATION_EXAMPLE_IDS)[number];
  readonly headings: readonly string[];
  readonly symbols: readonly string[];
  readonly roles: readonly string[];
}

/** Complete ordered page fixture, independent from the runtime catalog. */
const APPLICATION_PAGES = [
  {
    id: 'foundations/view',
    filePath: 'components/foundations/view.md',
    exampleId: 'foundations/view',
    headings: ['Drawing and invalidation', 'Input and focus'],
    symbols: ['View', 'DrawContext', 'DispatchEvent'],
    roles: ['dialog', 'staticText', 'labelShortcut'],
  },
  {
    id: 'foundations/group',
    filePath: 'components/foundations/group.md',
    exampleId: 'foundations/group',
    headings: ['Children and paint order', 'Dynamic composition'],
    symbols: ['Group', 'View'],
    roles: ['dialog', 'staticText', 'warningText'],
  },
  {
    id: 'application/application',
    filePath: 'components/application/application.md',
    exampleId: 'application/application',
    headings: ['Commands and keymaps', 'Lifecycle and host integration'],
    symbols: ['createApplication', 'Application', 'ApplicationOptions'],
    roles: ['desktop', 'menuBar', 'statusBar', 'dialog'],
  },
  {
    id: 'application/desktop',
    filePath: 'components/application/desktop.md',
    exampleId: 'application/desktop',
    headings: ['Activation and z-order', 'Window arrangement'],
    symbols: ['Desktop', 'Window'],
    roles: ['desktop', 'window', 'windowInactive'],
  },
  {
    id: 'application/router',
    filePath: 'components/application/router.md',
    exampleId: 'application/router',
    headings: ['Navigation stack', 'Focus and chrome'],
    symbols: ['createRouter', 'Router', 'RouterOptions'],
    roles: ['dialog', 'button', 'staticText'],
  },
  {
    id: 'application/window',
    filePath: 'components/application/window.md',
    exampleId: 'application/window',
    headings: ['Activation and window state', 'Moving and resizing'],
    symbols: ['Window', 'Desktop'],
    roles: ['window', 'windowInactive', 'dialog'],
  },
  {
    id: 'application/menu-bar',
    filePath: 'components/application/menu-bar.md',
    exampleId: 'application/menu-bar',
    headings: ['Menus and commands', 'Keyboard navigation'],
    symbols: ['MenuBar', 'menuBar', 'subMenu', 'item'],
    roles: ['menuBar', 'menuSelected', 'menuDisabled'],
  },
  {
    id: 'application/status-line',
    filePath: 'components/application/status-line.md',
    exampleId: 'application/status-line',
    headings: ['Command items and enablement', 'Keyboard and pointer input'],
    symbols: ['StatusLine', 'statusLine', 'statusItem', 'spacer'],
    roles: ['statusBar', 'statusSelected', 'statusDisabled'],
  },
] as const satisfies readonly ApplicationPageExpectation[];

/** Read one shared observable from a mounted foundation/application example. */
function probeValue(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  probe: ApplicationProbe,
): string | number {
  if (probe === 'rendered-text') return frameText(app);
  if (probe === 'dialog-width') return dialog.bounds.width;
  if (probe === 'dialog-height') return dialog.bounds.height;
  if (probe === 'focused-view') return app.loop.getFocused()?.constructor.name ?? 'none';
  if (probe === 'nested-window-count' || probe === 'nested-window-max-height') {
    const windows = viewsIn(dialog).filter((view): view is Window => view instanceof Window && view !== dialog);
    if (probe === 'nested-window-count') return windows.length;
    return Math.max(0, ...windows.map((window) => window.bounds.height));
  }
  if (probe === 'menu-titles') {
    const root = app.desktop?.parent ?? app.desktop;
    const menu =
      root === undefined ? undefined : viewsIn(root).find((view): view is MenuBar => view instanceof MenuBar);
    if (menu === undefined) return '';
    return menu.items
      .filter((node) => node.kind === 'sub' || node.kind === 'item')
      .map((node) => node.title.replaceAll('~', ''))
      .join(', ');
  }
  const buffer = app.loop.renderRoot.buffer();
  if (probe === 'menu-background') return buffer.get(10, 0)?.bg ?? 'missing';
  return buffer.get(dialog.bounds.x + 1, dialog.bounds.y + 2)?.bg ?? 'missing';
}

/** Assert one contract probe while keeping implementation objects out of the specification. */
function expectProbe(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  expectation: ProbeExpectation<ApplicationProbe>,
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

/** Resolve and load one lazily registered foundation/application example. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing foundation/application example ${exampleId}`);
  return (await entry.load()).default;
}

describe('foundations and application-shell population', () => {
  test('keeps page, example, and contract populations exact', () => {
    expect(APPLICATION_PAGES.map((page) => page.id)).toEqual(APPLICATION_CATALOG_ENTRY_IDS);
    expect(APPLICATION_PAGES.map((page) => page.exampleId)).toEqual(APPLICATION_EXAMPLE_IDS);
    expect(APPLICATION_CONTRACTS.map((contract) => contract.exampleId)).toEqual(APPLICATION_EXAMPLE_IDS);
    for (const contract of APPLICATION_CONTRACTS) validateBehaviorContract(contract);
  });
});

describe('foundations and application-shell pages', () => {
  test.each(APPLICATION_PAGES)('$id satisfies its source-backed teaching contract', async (page) => {
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

describe('foundations and application-shell template1 examples', () => {
  test.each(APPLICATION_EXAMPLE_IDS)('%s owns a compact centered Classic dialog', async (exampleId) => {
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

describe('foundations and application-shell behavior contracts', () => {
  test.each(APPLICATION_CONTRACTS)('$exampleId executes every independently rebuilt case', async (contract) => {
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
