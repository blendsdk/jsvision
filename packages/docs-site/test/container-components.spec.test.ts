/**
 * Specification tests for the container and dropdown documentation wave.
 *
 * The expected IDs, page obligations, and observable outcomes are fixed independently from the
 * catalog and registry so deleting an implementation cannot make the oracle pass.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComboBox, createRoot, Input, ListView, Scroller, SplitView, TabView, Tree } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
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
import { CONTAINER_CATALOG_ENTRY_IDS, CONTAINER_CONTRACTS, CONTAINER_EXAMPLE_IDS } from './contracts/containers.js';
import type { ContainerProbe } from './contracts/containers.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source-backed teaching obligations for one container or dropdown page. */
interface ContainerPageExpectation {
  readonly id: (typeof CONTAINER_CATALOG_ENTRY_IDS)[number];
  readonly filePath: string;
  readonly exampleId: (typeof CONTAINER_EXAMPLE_IDS)[number];
  readonly headings: readonly string[];
  readonly symbols: readonly string[];
  readonly roles: readonly string[];
}

/** Complete ordered page fixture, independent from the runtime catalog. */
const CONTAINER_PAGES = [
  {
    id: 'containers/dialog',
    filePath: 'components/containers/dialog.md',
    exampleId: 'containers/dialog',
    headings: ['Modality and validation', 'Closing and commands'],
    symbols: ['Dialog', 'DialogOptions', 'Commands'],
    roles: ['dialog', 'windowInactive'],
  },
  {
    id: 'containers/group-box',
    filePath: 'components/containers/group-box.md',
    exampleId: 'containers/group-box',
    headings: ['Caption behavior', 'Passivity and focus', 'Composition and nesting'],
    symbols: ['GroupBox', 'GroupBoxOptions', 'GroupBoxTitleAlignment'],
    roles: ['staticText', 'shadow'],
  },
  {
    id: 'containers/list-view',
    filePath: 'components/containers/list-view.md',
    exampleId: 'containers/list-view',
    headings: ['Virtual rows and selection', 'Sorting and type-ahead'],
    symbols: ['ListView', 'ListViewOptions', 'Signal'],
    roles: ['listNormal', 'listFocused', 'listSelected', 'listDivider'],
  },
  {
    id: 'containers/list-box',
    filePath: 'components/containers/list-box.md',
    exampleId: 'containers/list-box',
    headings: ['Reactive string lists', 'Selection and activation'],
    symbols: ['ListBox', 'ListBoxOptions', 'ListView'],
    roles: ['listNormal', 'listFocused', 'listSelected'],
  },
  {
    id: 'containers/scroller',
    filePath: 'components/containers/scroller.md',
    exampleId: 'containers/scroller',
    headings: ['Viewport and extent', 'Keyboard and wheel scrolling'],
    symbols: ['Scroller', 'ScrollerOptions', 'ScrollbarsMode'],
    roles: ['scrollBarControls', 'scrollBarPage', 'dialog'],
  },
  {
    id: 'containers/scroll-bar',
    filePath: 'components/containers/scroll-bar.md',
    exampleId: 'containers/scroll-bar',
    headings: ['Range and binding', 'Mouse interaction'],
    symbols: ['ScrollBar', 'ScrollBarOptions', 'Signal'],
    roles: ['scrollBarControls', 'scrollBarPage'],
  },
  {
    id: 'containers/tree',
    filePath: 'components/containers/tree.md',
    exampleId: 'containers/tree',
    headings: ['Expansion and navigation', 'Selection and markers'],
    symbols: ['Tree', 'TreeOptions', 'TreeNode', 'MarkerStyle'],
    roles: ['outlineNormal', 'outlineFocused', 'outlineSelected', 'outlineNotExpanded'],
  },
  {
    id: 'containers/tabs',
    filePath: 'components/containers/tabs.md',
    exampleId: 'containers/tabs',
    headings: ['Tab lifecycle and state', 'Keyboard navigation'],
    symbols: ['TabView', 'TabViewOptions', 'Tab'],
    roles: ['tabActive', 'tabInactive', 'tabDisabled', 'staticText'],
  },
  {
    id: 'containers/split-view',
    filePath: 'components/containers/split-view.md',
    exampleId: 'containers/split-view',
    headings: ['Pane sizing and constraints', 'Resize lifecycle'],
    symbols: ['SplitView', 'SplitViewOptions', 'Signal'],
    roles: ['splitter', 'splitterDragging', 'dialog'],
  },
  {
    id: 'dropdown/combo-box',
    filePath: 'components/dropdown/combo-box.md',
    exampleId: 'dropdown/combo-box',
    headings: ['Editable and select-only modes', 'Popup and selection'],
    symbols: ['ComboBox', 'ComboBoxOptions', 'Input'],
    roles: [
      'inputNormal',
      'inputSelected',
      'inputSelection',
      'inputPlaceholder',
      'historyButtonArrow',
      'historyButtonSides',
      'listFocused',
    ],
  },
  {
    id: 'dropdown/history',
    filePath: 'components/dropdown/history.md',
    exampleId: 'dropdown/history',
    headings: ['MRU ownership', 'Recall workflow'],
    symbols: ['History', 'HistoryOptions', 'HISTORY_MAX_ENTRIES', 'Input'],
    roles: ['historyButtonArrow', 'historyButtonSides', 'historyWindow', 'historyViewerFocused'],
  },
] as const satisfies readonly ContainerPageExpectation[];

/** Complete one-row teaching lines that must survive the 80×24 render without wrapping or clipping. */
const CONTAINER_VISIBLE_LINES = [
  {
    exampleId: 'containers/dialog',
    lines: ['Alt+V OK gate · Alt+C Cancel · Alt+A age', 'Edit 17 to 18, then test validation again.'],
  },
  {
    exampleId: 'containers/group-box',
    lines: [
      'Start, center, and end captions share one passive workspace.',
      'Click Add module · Tab focuses it · Alt+A/Space updates caption',
      'Status: 2 modules · GroupBox stays out of the Tab order',
    ],
  },
  {
    exampleId: 'containers/list-view',
    lines: [
      'Typed items use sorted getText labels.',
      '↑↓/Pg/Home/End navigate · Enter selects',
      'Type a prefix (try G) · Alt+P focuses rows',
      'Focus and selection use separate signals.',
    ],
  },
  {
    exampleId: 'containers/list-box',
    lines: [
      'Reactive strings with ListView navigation.',
      'End then Alt+R shrinks five values to two.',
      'Enter selects · prefix search · Alt+C focus',
    ],
  },
  {
    exampleId: 'containers/scroller',
    lines: [
      'A 58×18 sheet inside a 43×7 viewport.',
      'PgDn pages · End bottom · arrows move one cell',
      'Alt+X clamps right · wheel and bars also work',
    ],
  },
  {
    exampleId: 'containers/scroll-bar',
    lines: [
      'Two bar orientations share one value signal.',
      'Click arrows/page/thumb · Alt+N sets 40',
      'Alt+D collapses both ranges in place',
    ],
  },
  {
    exampleId: 'containers/tree',
    lines: [
      'Tree owns expansion; node data stays plain.',
      'Right expands/descends · Left collapses/returns',
      'Enter selects · +/−/* branches · Alt+P focus',
    ],
  },
  {
    exampleId: 'containers/tabs',
    lines: [
      'All tab pages stay mounted; one lays out.',
      'Ctrl+PgUp/PgDn cycle enabled · Alt+G/O jump',
      'Alt+C closes active closeable tab · arrows work on strip',
    ],
  },
  {
    exampleId: 'containers/split-view',
    lines: [
      'One divider trades cells between two panes.',
      '←/→ resize · drag commits once on release',
      'Alt+G toggles the public grabMark signal',
    ],
  },
  {
    exampleId: 'dropdown/combo-box',
    lines: [
      'Editable text filters typed color candidates.',
      'Type “gr” · Alt+Down opens · Enter picks Green',
      'Unmatched text keeps value null · Alt+C focus',
    ],
  },
  {
    exampleId: 'dropdown/history',
    lines: [
      'App-owned MRU records the current field on open.',
      'Alt+Down opens · Enter recalls focused /var/log',
      'Esc dismisses unchanged · Alt+P focuses field',
    ],
  },
] as const;

/** Return the first descendant of a requested public widget class. */
function widgetIn<T extends View>(
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  type: abstract new (...args: never[]) => T,
): T {
  const widget = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (widget === undefined) throw new Error(`missing ${type.name} in container laboratory`);
  return widget;
}

/** Count exact item labels that are visible in a compact family laboratory. */
function visibleItemCount(exampleId: string, text: string): number {
  const labels =
    exampleId === 'containers/list-box'
      ? ['One', 'Two', 'Three', 'Four', 'Five']
      : ['Ada · 36', 'Alan · 41', 'Grace · 37', 'Linus · 28'];
  return labels.filter((label) => text.includes(label)).length;
}

/** Read one observable from a mounted container/dropdown example. */
function probeValue(
  exampleId: string,
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  probe: ContainerProbe,
): string | number | boolean {
  const text = frameText(app);
  if (probe === 'rendered-text') return text;
  if (probe === 'dialog-width') return dialog.bounds.width;
  if (probe === 'dialog-height') return dialog.bounds.height;
  if (probe === 'focused-view') return app.loop.getFocused()?.constructor.name ?? 'none';
  const buffer = app.loop.renderRoot.buffer();
  if (probe === 'menu-background') return buffer.get(10, 0)?.bg ?? 'missing';
  if (probe === 'dialog-background') return buffer.get(dialog.bounds.x + 1, dialog.bounds.y + 2)?.bg ?? 'missing';

  if (probe === 'list-focused' || probe === 'list-selected') {
    const list = widgetIn(dialog, ListView);
    return probe === 'list-focused' ? list.focused() : list.selected();
  }
  if (probe === 'list-count') return visibleItemCount(exampleId, text);
  if (probe === 'scroll-x' || probe === 'scroll-y') {
    const delta = widgetIn(dialog, Scroller).delta;
    return probe === 'scroll-x' ? delta.x : delta.y;
  }
  if (probe === 'scroll-value') {
    const match = /Bound value: (\d+)/.exec(text);
    return match === null ? -1 : Number(match[1]);
  }
  if (probe === 'disabled-track-cells') return [...text].filter((cell) => cell === '▓').length;
  if (probe === 'tree-expanded') return text.split('[-]').length - 1;
  if (probe === 'tree-selected') return widgetIn(dialog, Tree).selected();
  if (probe === 'tab-active' || probe === 'tab-count' || probe === 'mounted-tab-pages') {
    const tabs = widgetIn(dialog, TabView);
    if (probe === 'mounted-tab-pages') return tabs.tabs().filter((tab) => tab.content.mounted).length;
    return probe === 'tab-active' ? tabs.active() : tabs.tabs().length;
  }
  if (probe === 'split-first-width' || probe === 'split-grab-mark') {
    const split = widgetIn(dialog, SplitView);
    return probe === 'split-first-width' ? (split.splitters[0]?.bounds.x ?? -1) : split.grabMark();
  }
  if (probe === 'combo-filtered-count' || probe === 'combo-value') {
    const combo = widgetIn(dialog, ComboBox);
    if (probe === 'combo-filtered-count') return combo.filtered().length;
    return combo.value() === null ? 'none' : String(combo.value());
  }
  return widgetIn(dialog, Input).getValueSignal()();
}

/** Assert one typed contract probe. */
function expectProbe(
  exampleId: string,
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  expectation: ProbeExpectation<ContainerProbe>,
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
  if (entry === undefined) throw new Error(`missing container/dropdown example ${exampleId}`);
  return (await entry.load()).default;
}

describe('container and dropdown population', () => {
  test('keeps page, example, and contract populations exact', () => {
    expect(CONTAINER_PAGES.map((page) => page.id)).toEqual(CONTAINER_CATALOG_ENTRY_IDS);
    expect(CONTAINER_PAGES.map((page) => page.exampleId)).toEqual(CONTAINER_EXAMPLE_IDS);
    expect(CONTAINER_CONTRACTS.map((contract) => contract.exampleId)).toEqual(CONTAINER_EXAMPLE_IDS);
    for (const contract of CONTAINER_CONTRACTS) validateBehaviorContract(contract);
  });
});

describe('container and dropdown pages', () => {
  test.each(CONTAINER_PAGES)('$id satisfies its source-backed teaching contract', async (page) => {
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

describe('container and dropdown template1 examples', () => {
  test.each(CONTAINER_EXAMPLE_IDS)('%s owns a compact centered Classic dialog', async (exampleId) => {
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

  test.each(CONTAINER_VISIBLE_LINES)(
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

describe('container and dropdown behavior contracts', () => {
  test.each(CONTAINER_CONTRACTS)('$exampleId executes every independently rebuilt case', async (contract) => {
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
