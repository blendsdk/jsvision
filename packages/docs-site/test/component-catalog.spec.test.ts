/**
 * Specification tests for the component documentation catalog.
 *
 * The expected inventory is intentionally declared in this file instead of
 * being derived from `components.json`. This keeps the requirement oracle
 * independent: deleting a catalog row cannot make the expected set shrink.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import { APPLICATION_CATALOG_ENTRY_IDS, APPLICATION_EXAMPLE_IDS } from './contracts/application.js';
import { CODE_EDITOR_CATALOG_ENTRY_IDS, CODE_EDITOR_EXAMPLE_IDS } from './contracts/code-editor/index.js';
import { CONTAINER_CATALOG_ENTRY_IDS, CONTAINER_EXAMPLE_IDS } from './contracts/containers.js';
import { CONTROL_CATALOG_ENTRY_IDS, CONTROL_EXAMPLE_IDS } from './contracts/controls.js';
import { DATA_GRID_CATALOG_ENTRY_IDS, DATA_GRID_EXAMPLE_IDS } from './contracts/data-grid/index.js';
import { EDITING_CATALOG_ENTRY_IDS, EDITING_EXAMPLE_IDS } from './contracts/editing.js';
import { FILE_CATALOG_ENTRY_IDS, FILE_EXAMPLE_IDS } from './contracts/files.js';
import { VALUE_COMPONENT_CATALOG_ENTRY_IDS, VALUE_COMPONENT_EXAMPLE_IDS } from './contracts/value-components.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(PACKAGE_ROOT, 'components.json');
const CATALOG_MODULE_PATH = '../src/components/component-catalog.mjs';
const TARGET_MODULE_PATH = '../src/api/component-target.mjs';
const API_MAP_MODULE_PATH = '../src/api/api-map.mjs';

type PackageName = 'ui' | 'forms' | 'files' | 'datagrid' | 'code-editor';

interface ExpectedComponent {
  readonly id: string;
  readonly package: PackageName;
  readonly symbols: readonly string[];
}

interface ExpectedTopic {
  readonly id: string;
  readonly hub: 'data-grid' | 'code-editor';
  readonly profile: 'landing' | 'capability' | 'api';
}

interface CatalogComponent extends ExpectedComponent {
  readonly kind: 'component';
  readonly complexity: 'standard' | 'data-grid-hub' | 'code-editor-hub';
  readonly examples: readonly string[];
  readonly apiSymbols: readonly { readonly package: PackageName; readonly symbol: string }[];
  readonly primary: boolean;
}

interface CatalogTopic extends ExpectedTopic {
  readonly kind: 'topic';
  readonly examples: readonly string[];
}

type CatalogEntry = (CatalogComponent | CatalogTopic) & {
  readonly title: string;
  readonly family: string;
  readonly page: string;
  readonly related: readonly string[];
  readonly sidebarOrder: number;
};

interface CatalogDocument {
  readonly schemaVersion: 1;
  readonly entries: readonly CatalogEntry[];
}

interface CatalogModule {
  readonly validateComponentCatalog: (value: unknown) => CatalogDocument;
  readonly projectComponentNavigation: (entries: readonly CatalogEntry[]) => ComponentNavigation;
}

interface NavigationItem {
  readonly id: string;
  readonly text: string;
  readonly link: string;
}

interface NavigationGroup {
  readonly text: string;
  readonly items: readonly NavigationItem[];
}

interface ComponentNavigation {
  readonly components: readonly NavigationGroup[];
  readonly dataGrid: readonly NavigationItem[];
  readonly codeEditor: readonly NavigationItem[];
}

interface ComponentTarget {
  readonly route: string;
  readonly fragment?: string;
  readonly label: string;
  readonly buildKey: string;
}

interface ComponentTargetModule {
  readonly parseComponentTarget: (target: string) => ComponentTarget;
}

interface ApiMapRow {
  readonly pkg: PackageName;
  readonly symbol: string;
  readonly componentPage: string;
}

/**
 * Complete primary component inventory approved for the documentation site.
 *
 * A specialist component entry owns the public visual symbols for its hub.
 * Topic entries separately own the hub's teaching routes and navigation.
 */
const EXPECTED_COMPONENTS = [
  { id: 'foundations/view', package: 'ui', symbols: ['View'] },
  { id: 'foundations/group', package: 'ui', symbols: ['Group'] },
  { id: 'application/application', package: 'ui', symbols: ['createApplication'] },
  { id: 'application/desktop', package: 'ui', symbols: ['Desktop'] },
  { id: 'application/router', package: 'ui', symbols: ['createRouter'] },
  { id: 'application/window', package: 'ui', symbols: ['Window'] },
  { id: 'application/menu-bar', package: 'ui', symbols: ['MenuBar'] },
  { id: 'application/status-line', package: 'ui', symbols: ['StatusLine'] },
  { id: 'controls/button', package: 'ui', symbols: ['Button'] },
  { id: 'controls/input', package: 'ui', symbols: ['Input'] },
  { id: 'controls/text', package: 'ui', symbols: ['Text'] },
  { id: 'controls/label', package: 'ui', symbols: ['Label'] },
  { id: 'controls/check-group', package: 'ui', symbols: ['CheckGroup'] },
  { id: 'controls/radio-group', package: 'ui', symbols: ['RadioGroup'] },
  { id: 'controls/multi-check-group', package: 'ui', symbols: ['MultiCheckGroup'] },
  { id: 'controls/slider', package: 'ui', symbols: ['Slider'] },
  { id: 'controls/switch', package: 'ui', symbols: ['Switch'] },
  { id: 'containers/dialog', package: 'ui', symbols: ['Dialog'] },
  { id: 'containers/list-view', package: 'ui', symbols: ['ListView'] },
  { id: 'containers/list-box', package: 'ui', symbols: ['ListBox'] },
  { id: 'containers/scroller', package: 'ui', symbols: ['Scroller'] },
  { id: 'containers/scroll-bar', package: 'ui', symbols: ['ScrollBar'] },
  { id: 'containers/tree', package: 'ui', symbols: ['Tree'] },
  { id: 'containers/tabs', package: 'ui', symbols: ['TabView'] },
  { id: 'containers/split-view', package: 'ui', symbols: ['SplitView'] },
  { id: 'dropdown/combo-box', package: 'ui', symbols: ['ComboBox'] },
  { id: 'dropdown/history', package: 'ui', symbols: ['History'] },
  { id: 'feedback/progress-bar', package: 'ui', symbols: ['ProgressBar'] },
  { id: 'feedback/spinner', package: 'ui', symbols: ['Spinner'] },
  { id: 'date/calendar', package: 'ui', symbols: ['Calendar'] },
  { id: 'date/date-picker', package: 'ui', symbols: ['DatePicker'] },
  { id: 'color/color-swatch', package: 'ui', symbols: ['ColorSwatch'] },
  { id: 'color/color-picker', package: 'ui', symbols: ['ColorPicker'] },
  { id: 'surface/surface', package: 'ui', symbols: ['Surface'] },
  { id: 'surface/surface-view', package: 'ui', symbols: ['SurfaceView'] },
  { id: 'editor/editor', package: 'ui', symbols: ['Editor'] },
  { id: 'editor/memo', package: 'ui', symbols: ['Memo'] },
  { id: 'editor/edit-window', package: 'ui', symbols: ['EditWindow'] },
  { id: 'editor/indicator', package: 'ui', symbols: ['Indicator'] },
  { id: 'terminal/terminal', package: 'ui', symbols: ['Terminal'] },
  { id: 'controls/form-dialog', package: 'forms', symbols: ['formDialog'] },
  { id: 'files/file-dialog', package: 'files', symbols: ['FileDialog'] },
  { id: 'files/chdir-dialog', package: 'files', symbols: ['ChDirDialog'] },
  { id: 'files/file-list', package: 'files', symbols: ['FileList'] },
  { id: 'files/dir-list', package: 'files', symbols: ['DirList'] },
  { id: 'files/file-input', package: 'files', symbols: ['FileInput'] },
  { id: 'files/file-info-pane', package: 'files', symbols: ['FileInfoPane'] },
  { id: 'files/file-editor', package: 'files', symbols: ['FileEditor'] },
  {
    id: 'data-grid',
    package: 'ui',
    symbols: ['DataGrid', 'GridRows', 'GridHeader'],
  },
  {
    id: 'editable-data-grid',
    package: 'datagrid',
    symbols: [
      'EditableDataGrid',
      'EditableGridRows',
      'SortHeader',
      'QuickFilterRow',
      'FilterPopup',
      'ValueList',
      'FooterBand',
      'personalizeGrid',
    ],
  },
  {
    id: 'code-editor',
    package: 'code-editor',
    symbols: ['CodeEditor', 'CodeEditorWindow'],
  },
] as const satisfies readonly ExpectedComponent[];

/** Required specialist routes and their page-profile contract. */
const EXPECTED_TOPICS = [
  { id: 'data-grid/overview', hub: 'data-grid', profile: 'landing' },
  { id: 'data-grid/data-and-columns', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/layout-and-rendering', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/sorting-and-filtering', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/rows-selection-navigation', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/editing-and-editors', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/validation-and-lifecycle', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/footer-and-detail', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/data-at-scale', hub: 'data-grid', profile: 'capability' },
  { id: 'data-grid/export-and-personalization', hub: 'data-grid', profile: 'capability' },
  {
    id: 'data-grid/theming-accessibility-performance',
    hub: 'data-grid',
    profile: 'capability',
  },
  { id: 'data-grid/api', hub: 'data-grid', profile: 'api' },
  { id: 'code-editor/overview', hub: 'code-editor', profile: 'landing' },
  {
    id: 'code-editor/documents-and-lifecycle',
    hub: 'code-editor',
    profile: 'capability',
  },
  {
    id: 'code-editor/editing-navigation-clipboard',
    hub: 'code-editor',
    profile: 'capability',
  },
  { id: 'code-editor/languages-and-syntax', hub: 'code-editor', profile: 'capability' },
  { id: 'code-editor/folding', hub: 'code-editor', profile: 'capability' },
  { id: 'code-editor/search-and-replace', hub: 'code-editor', profile: 'capability' },
  {
    id: 'code-editor/language-intelligence',
    hub: 'code-editor',
    profile: 'capability',
  },
  {
    id: 'code-editor/viewport-and-large-documents',
    hub: 'code-editor',
    profile: 'capability',
  },
  {
    id: 'code-editor/themes-and-fallbacks',
    hub: 'code-editor',
    profile: 'capability',
  },
  {
    id: 'code-editor/host-safety-and-recovery',
    hub: 'code-editor',
    profile: 'capability',
  },
  { id: 'code-editor/api', hub: 'code-editor', profile: 'api' },
] as const satisfies readonly ExpectedTopic[];

/** Fixed permutations make ordering failures reproducible on every runner. */
function catalogPermutations(entries: readonly CatalogEntry[]): readonly (readonly CatalogEntry[])[] {
  const forward = [...entries];
  const reverse = [...entries].reverse();
  const rotateBySeven = [...entries.slice(7), ...entries.slice(0, 7)];
  const adversarial = [...entries].sort((left, right) => {
    const leftKey = `${left.sidebarOrder % 3}:${left.id}`;
    const rightKey = `${right.sidebarOrder % 3}:${right.id}`;
    return rightKey.localeCompare(leftKey);
  });
  return [forward, reverse, rotateBySeven, adversarial];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnaryFunction(value: unknown): value is (argument: unknown) => unknown {
  return typeof value === 'function';
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.family !== 'string' ||
    typeof value.page !== 'string' ||
    !isStringArray(value.related) ||
    typeof value.sidebarOrder !== 'number' ||
    !isStringArray(value.examples)
  ) {
    return false;
  }
  if (value.kind === 'topic') {
    return (
      (value.hub === 'data-grid' || value.hub === 'code-editor') &&
      (value.profile === 'landing' || value.profile === 'capability' || value.profile === 'api')
    );
  }
  return (
    value.kind === 'component' &&
    (value.package === 'ui' ||
      value.package === 'forms' ||
      value.package === 'files' ||
      value.package === 'datagrid' ||
      value.package === 'code-editor') &&
    isStringArray(value.symbols) &&
    (value.complexity === 'standard' ||
      value.complexity === 'data-grid-hub' ||
      value.complexity === 'code-editor-hub') &&
    Array.isArray(value.apiSymbols) &&
    typeof value.primary === 'boolean'
  );
}

function assertCatalogDocument(value: unknown): asserts value is CatalogDocument {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.entries) ||
    !value.entries.every(isCatalogEntry)
  ) {
    throw new TypeError('catalog validator must return a schema-version-1 catalog document');
  }
}

function assertComponentTarget(value: unknown): asserts value is ComponentTarget {
  if (
    !isRecord(value) ||
    typeof value.route !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.buildKey !== 'string' ||
    (value.fragment !== undefined && typeof value.fragment !== 'string')
  ) {
    throw new TypeError('component target parser returned an invalid target');
  }
}

function isNavigationItem(value: unknown): value is NavigationItem {
  return (
    isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string' && typeof value.link === 'string'
  );
}

function isNavigationGroup(value: unknown): value is NavigationGroup {
  return (
    isRecord(value) &&
    typeof value.text === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isNavigationItem)
  );
}

function assertComponentNavigation(value: unknown): asserts value is ComponentNavigation {
  if (
    !isRecord(value) ||
    !Array.isArray(value.components) ||
    !value.components.every(isNavigationGroup) ||
    !Array.isArray(value.dataGrid) ||
    !value.dataGrid.every(isNavigationItem) ||
    !Array.isArray(value.codeEditor) ||
    !value.codeEditor.every(isNavigationItem)
  ) {
    throw new TypeError('component navigation projection returned an invalid shape');
  }
}

function isApiMapRow(value: unknown): value is ApiMapRow {
  return (
    isRecord(value) &&
    (value.pkg === 'ui' ||
      value.pkg === 'forms' ||
      value.pkg === 'files' ||
      value.pkg === 'datagrid' ||
      value.pkg === 'code-editor') &&
    typeof value.symbol === 'string' &&
    typeof value.componentPage === 'string'
  );
}

/** Convert a catalog route into its checked-in Markdown source path. */
function markdownPathForRoute(route: string): string {
  const relative = route.replace(/^\/components\//, '');
  return relative.endsWith('/')
    ? join(PACKAGE_ROOT, 'components', relative, 'index.md')
    : join(PACKAGE_ROOT, 'components', `${relative}.md`);
}

/** Produce the stable lowercase heading form used by the catalog's explicit anchors. */
function headingSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-');
}

async function loadCatalogModule(): Promise<CatalogModule> {
  const candidate: unknown = await import(CATALOG_MODULE_PATH);
  if (
    !isRecord(candidate) ||
    !isUnaryFunction(candidate.validateComponentCatalog) ||
    !isUnaryFunction(candidate.projectComponentNavigation)
  ) {
    throw new TypeError('component-catalog.mjs must export validateComponentCatalog and projectComponentNavigation');
  }
  const validate = candidate.validateComponentCatalog;
  const project = candidate.projectComponentNavigation;
  return {
    validateComponentCatalog(value: unknown) {
      const result = validate(value);
      assertCatalogDocument(result);
      return result;
    },
    projectComponentNavigation(entries: readonly CatalogEntry[]) {
      const result = project(entries);
      assertComponentNavigation(result);
      return result;
    },
  };
}

async function loadTargetModule(): Promise<ComponentTargetModule> {
  const candidate: unknown = await import(TARGET_MODULE_PATH);
  if (!isRecord(candidate) || !isUnaryFunction(candidate.parseComponentTarget)) {
    throw new TypeError('component-target.mjs must export parseComponentTarget');
  }
  const parse = candidate.parseComponentTarget;
  return {
    parseComponentTarget(target: string) {
      const result = parse(target);
      assertComponentTarget(result);
      return result;
    },
  };
}

async function loadApiMap(): Promise<readonly ApiMapRow[]> {
  const candidate: unknown = await import(API_MAP_MODULE_PATH);
  if (!isRecord(candidate) || !Array.isArray(candidate.API_MAP) || !candidate.API_MAP.every(isApiMapRow)) {
    throw new TypeError('api-map.mjs must export a valid API_MAP array');
  }
  return candidate.API_MAP;
}

describe('component catalog specification', () => {
  test('ST-1: accepts exactly the approved discriminated schema', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);

    expect(catalog.schemaVersion).toBe(1);
    for (const entry of catalog.entries) {
      expect(entry).not.toHaveProperty('status');
      expect(entry).not.toHaveProperty('maturity');
      if (entry.kind === 'component') {
        expect(entry.symbols.length).toBeGreaterThan(0);
        expect(entry.examples.length).toBeGreaterThan(0);
        expect(entry).not.toHaveProperty('hub');
        expect(entry).not.toHaveProperty('profile');
      } else {
        expect(entry).not.toHaveProperty('package');
        expect(entry).not.toHaveProperty('symbols');
        expect(entry).not.toHaveProperty('complexity');
        expect(entry).not.toHaveProperty('apiSymbols');
        expect(entry).not.toHaveProperty('primary');
        expect(entry.profile === 'api' || entry.examples.length > 0).toBe(true);
      }
    }
  });

  test('ST-2: contains the immutable component and specialist-topic inventory', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);

    const actualComponents = catalog.entries
      .filter((entry): entry is CatalogEntry & CatalogComponent => entry.kind === 'component')
      .map(({ id, package: pkg, symbols }) => ({ id, package: pkg, symbols: [...symbols] }));
    const actualTopics = catalog.entries
      .filter((entry): entry is CatalogEntry & CatalogTopic => entry.kind === 'topic')
      .map(({ id, hub, profile }) => ({ id, hub, profile }));

    expect(actualComponents).toEqual(EXPECTED_COMPONENTS);
    expect(actualTopics).toEqual(EXPECTED_TOPICS);
  });

  test('ST-3: every declared visual symbol is exported by its public package', async () => {
    const publicPackages: Readonly<Record<PackageName, string>> = {
      ui: '@jsvision/ui',
      forms: '@jsvision/forms',
      files: '@jsvision/files',
      datagrid: '@jsvision/datagrid',
      'code-editor': '@jsvision/code-editor',
    };

    for (const expected of EXPECTED_COMPONENTS) {
      const exports: unknown = await import(publicPackages[expected.package]);
      expect(isRecord(exports), `${expected.package} public barrel did not load`).toBe(true);
      if (!isRecord(exports)) continue;
      for (const symbol of expected.symbols) {
        expect(symbol in exports, `${expected.package} does not export ${symbol}`).toBe(true);
      }
    }

    const ownership = EXPECTED_COMPONENTS.flatMap((entry) =>
      entry.symbols.map((symbol) => `${entry.package}:${symbol}`),
    );
    expect(new Set(ownership).size).toBe(ownership.length);
  });

  test('ST-4: every catalog page and optional heading anchor resolves', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);

    for (const entry of catalog.entries) {
      const [route, fragment] = entry.page.split('#');
      const source = await readFile(markdownPathForRoute(route!), 'utf8');
      if (fragment === undefined) continue;
      const headingSlugs = [...source.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((match) => headingSlug(match[1]!));
      expect(headingSlugs, `${entry.id}: missing #${fragment}`).toContain(fragment);
    }
  });

  test('ST-5: every catalog example resolves exactly once through a unique runnable source', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);
    const catalogExamples = new Set(catalog.entries.flatMap((entry) => entry.examples));

    for (const exampleId of catalogExamples) {
      expect(
        EXAMPLES.filter((entry) => entry.id === exampleId),
        exampleId,
      ).toHaveLength(1);
    }
    expect(new Set(EXAMPLES.map((entry) => entry.sourcePath)).size).toBe(EXAMPLES.length);
  });

  test('ST-6: projected standard and specialist navigation has exact catalog parity', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { projectComponentNavigation, validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);
    const navigation = projectComponentNavigation(catalog.entries);
    const componentIds = navigation.components.flatMap((group) => group.items.map((item) => item.id));
    const expectedComponentIds = catalog.entries
      .filter(
        (entry) =>
          (entry.kind === 'topic' && entry.profile === 'landing') ||
          (entry.kind === 'component' && entry.complexity === 'standard' && entry.primary),
      )
      .map((entry) => entry.id);
    const expectedDataGridIds = catalog.entries
      .filter((entry) => entry.kind === 'topic' && entry.hub === 'data-grid')
      .map((entry) => entry.id);
    const expectedCodeEditorIds = catalog.entries
      .filter((entry) => entry.kind === 'topic' && entry.hub === 'code-editor')
      .map((entry) => entry.id);

    expect([...componentIds].sort()).toEqual([...expectedComponentIds].sort());
    expect(navigation.dataGrid.map((item) => item.id)).toEqual(expectedDataGridIds);
    expect(navigation.codeEditor.map((item) => item.id)).toEqual(expectedCodeEditorIds);
    expect(new Set(componentIds).size).toBe(componentIds.length);
    expect(new Set(navigation.dataGrid.map((item) => item.id)).size).toBe(navigation.dataGrid.length);
    expect(new Set(navigation.codeEditor.map((item) => item.id)).size).toBe(navigation.codeEditor.length);
  });

  test('ST-7: related IDs and catalog API ownership match the checked-in backlink map', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);
    const ids = new Set(catalog.entries.map((entry) => entry.id));

    for (const entry of catalog.entries) {
      expect(entry.related, `${entry.id}: self-related`).not.toContain(entry.id);
      expect(
        entry.related.every((related) => ids.has(related)),
        `${entry.id}: unresolved related ID`,
      ).toBe(true);
    }

    const expectedApiRows = catalog.entries
      .filter((entry): entry is CatalogEntry & CatalogComponent => entry.kind === 'component')
      .flatMap((entry) => entry.apiSymbols.map(({ package: pkg, symbol }) => `${pkg}:${symbol}:${entry.page}`))
      .sort();
    const apiMap = await loadApiMap();
    const actualApiRows = apiMap.map(({ pkg, symbol, componentPage }) => `${pkg}:${symbol}:${componentPage}`).sort();
    expect(actualApiRows).toEqual(expectedApiRows);
  });

  test('family and specialist delivery sets cover every catalog row and distinct catalog example', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);
    const deliveredCatalogIds = [
      ...APPLICATION_CATALOG_ENTRY_IDS,
      ...CONTROL_CATALOG_ENTRY_IDS,
      ...CONTAINER_CATALOG_ENTRY_IDS,
      ...VALUE_COMPONENT_CATALOG_ENTRY_IDS,
      ...EDITING_CATALOG_ENTRY_IDS,
      ...FILE_CATALOG_ENTRY_IDS,
      ...DATA_GRID_CATALOG_ENTRY_IDS,
      ...CODE_EDITOR_CATALOG_ENTRY_IDS,
    ];
    const deliveredExampleIds = [
      ...APPLICATION_EXAMPLE_IDS,
      ...CONTROL_EXAMPLE_IDS,
      ...CONTAINER_EXAMPLE_IDS,
      ...VALUE_COMPONENT_EXAMPLE_IDS,
      ...EDITING_EXAMPLE_IDS,
      ...FILE_EXAMPLE_IDS,
      ...DATA_GRID_EXAMPLE_IDS,
      ...CODE_EDITOR_EXAMPLE_IDS,
    ];
    const catalogExampleIds = [...new Set(catalog.entries.flatMap((entry) => entry.examples))];

    expect([...deliveredCatalogIds].sort()).toEqual(catalog.entries.map((entry) => entry.id).sort());
    expect(new Set(deliveredCatalogIds).size).toBe(deliveredCatalogIds.length);
    expect([...deliveredExampleIds].sort()).toEqual(catalogExampleIds.sort());
    expect(new Set(deliveredExampleIds).size).toBe(deliveredExampleIds.length);
  });

  test('ST-8: navigation projection is stable for fixed adversarial permutations', async () => {
    const raw: unknown = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
    const { projectComponentNavigation, validateComponentCatalog } = await loadCatalogModule();
    const catalog = validateComponentCatalog(raw);
    const projections = catalogPermutations(catalog.entries).map((entries) => projectComponentNavigation(entries));

    expect(projections.slice(1)).toEqual(projections.slice(1).map(() => projections[0]));
    expect(projections[0]).toMatchObject({
      components: expect.arrayContaining([
        {
          text: 'Specialists',
          items: [
            expect.objectContaining({ link: '/components/code-editor/' }),
            expect.objectContaining({ link: '/components/data-grid/' }),
          ],
        },
      ]),
    });
  });
});

describe('fragment-aware component targets', () => {
  test.each([
    [
      '/components/controls/button',
      {
        route: '/components/controls/button',
        label: 'Button',
        buildKey: 'components/controls/button.html',
      },
    ],
    [
      '/components/controls/button#keyboard-behavior',
      {
        route: '/components/controls/button',
        fragment: 'keyboard-behavior',
        label: 'Button',
        buildKey: 'components/controls/button.html',
      },
    ],
    [
      '/components/data-grid/',
      {
        route: '/components/data-grid/',
        label: 'Data Grid',
        buildKey: 'components/data-grid/index.html',
      },
    ],
    [
      '/components/data-grid/#editing',
      {
        route: '/components/data-grid/',
        fragment: 'editing',
        label: 'Data Grid',
        buildKey: 'components/data-grid/index.html',
      },
    ],
  ])('parses %s into a route, label, build key, and optional fragment', async (target, expected) => {
    const { parseComponentTarget } = await loadTargetModule();
    expect(parseComponentTarget(target)).toEqual(expected);
  });
});
