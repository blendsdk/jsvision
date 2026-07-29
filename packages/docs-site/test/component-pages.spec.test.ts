/**
 * Specification tests for the standard component page and specialist profile contracts.
 *
 * Real reference pages prove that the parser accepts the intended Button/Input/Text teaching
 * structure. Controlled fixtures isolate the three specialist profiles without requiring future
 * hub pages to exist before their delivery phases.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_MODULE_PATH = '../src/components/component-pages.mjs';

type PageProfile = 'standard' | 'landing' | 'capability' | 'api';

interface PageContractOptions {
  readonly filePath: string;
  readonly profile: PageProfile;
  readonly expectedExamples: readonly string[];
  readonly componentSpecificHeadings?: readonly string[];
  readonly requiredPublicSymbols?: readonly string[];
  readonly requiredThemeRoles?: readonly string[];
  readonly validLinks?: readonly string[];
}

interface PageEvidence {
  readonly title: string;
  readonly description: string;
  readonly h1: string;
  readonly headings: readonly string[];
  readonly exampleIds: readonly string[];
  readonly snippetCount: number;
  readonly relatedLinks: readonly string[];
}

interface PageModule {
  readonly validateComponentPage: (source: string, options: PageContractOptions) => PageEvidence;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function assertPageEvidence(value: unknown): asserts value is PageEvidence {
  if (
    !isRecord(value) ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.h1 !== 'string' ||
    !isStringArray(value.headings) ||
    !isStringArray(value.exampleIds) ||
    typeof value.snippetCount !== 'number' ||
    !isStringArray(value.relatedLinks)
  ) {
    throw new TypeError('component page validator returned invalid evidence');
  }
}

async function loadPageModule(): Promise<PageModule> {
  const candidate: unknown = await import(PAGE_MODULE_PATH);
  if (!isRecord(candidate) || typeof candidate.validateComponentPage !== 'function') {
    throw new TypeError('component-pages.mjs must export validateComponentPage');
  }
  const validate = candidate.validateComponentPage;
  return {
    validateComponentPage(source, options) {
      const result: unknown = Reflect.apply(validate, undefined, [source, options]);
      assertPageEvidence(result);
      return result;
    },
  };
}

const REFERENCES = [
  {
    filePath: 'components/controls/button.md',
    expectedExamples: ['controls/button'],
    componentSpecificHeadings: ['Keyboard & mouse'],
    requiredPublicSymbols: ['Button'],
    requiredThemeRoles: [
      'button',
      'buttonFocused',
      'buttonDefault',
      'buttonDisabled',
      'buttonShortcut',
      'buttonShadow',
    ],
  },
  {
    filePath: 'components/controls/input.md',
    expectedExamples: ['controls/input'],
    componentSpecificHeadings: ['Validation', 'Reactive values and selection'],
    requiredPublicSymbols: ['Input', 'Signal<string>'],
    requiredThemeRoles: ['inputNormal', 'inputSelected', 'inputSelection', 'inputArrows', 'inputPlaceholder'],
  },
  {
    filePath: 'components/controls/text.md',
    expectedExamples: ['controls/text'],
    componentSpecificHeadings: ['Wrapping and line breaks', 'Semantic severity'],
    requiredPublicSymbols: ['Text'],
    requiredThemeRoles: ['staticText', 'warningText', 'dangerText'],
  },
] as const;

const LANDING_FIXTURE = `---
title: Data Grid
description: Choose DataGrid or EditableDataGrid and learn the grid capability map.
---

# Data Grid

Choose the read-only grid for display-first tables and the editable grid for controlled mutation.
Both use typed columns and stable row identity.

## Quick start

\`\`\`ts
import { DataGrid } from '@jsvision/ui';
const grid = new DataGrid({ columns: [], rows: [] });
\`\`\`

<PlayExample id="data-grid/quick-start" title="Grid choices" blurb="Switch grids and observe editing availability." />

## Capability map

Follow data, layout, sorting, editing, scale, and export in order.

## Cross-cutting practices

Keep row keys stable and data sources bounded.

## Related

- [API](/api/ui/classes/DataGrid)
- [Editable grid](/components/data-grid/editing-and-editors)
`;

const CAPABILITY_FIXTURE = `---
title: Sorting and filtering
description: Sort and filter Data Grid rows through explicit typed state.
---

# Sorting and filtering

Start with typed columns and stable row keys. This lesson assumes the quick start.

## Focused usage

\`\`\`ts
import { column } from '@jsvision/datagrid';
const name = column({ id: 'name', title: 'Name', value: row => row.name });
\`\`\`

## Multi-column sorting

Add explicit sort keys in priority order and expose the current precedence to the reader.

<PlayExample id="data-grid/sorting" title="Sorting priorities" blurb="Add sort keys and observe priority." />

## Quick and advanced filters

Keep quick search distinct from typed column filters so each state remains understandable.

<PlayExample id="data-grid/quick-filter" title="Quick filter" blurb="Type a query and observe visible rows." />

## Limits and practices

Push transforms into windowed sources and disclose partial distinct values.

## Related

- [Data sources](/components/data-grid/data-and-columns)
- [API](/api/datagrid/functions/column)
`;

const API_FIXTURE = `---
title: Code Editor API map
description: Find Code Editor visual surfaces and supporting APIs by task.
---

# Code Editor API map

Use this map after choosing a task-oriented capability page.

## Visual surfaces

| Task | Public API |
|---|---|
| Compose an editor | [CodeEditor](/api/code-editor/classes/CodeEditor) |
| Add window chrome | [CodeEditorWindow](/api/code-editor/classes/CodeEditorWindow) |

## Ownership boundaries

Controllers own document mutation while views own terminal projection and input routing.

## Related

- [Overview](/components/code-editor/)
- [Languages](/components/code-editor/languages-and-syntax)
`;

describe('standard component-page contract', () => {
  test.each(REFERENCES)('$filePath satisfies the complete standard backbone', async (reference) => {
    const source = await readFile(join(PACKAGE_ROOT, reference.filePath), 'utf8');
    const { validateComponentPage } = await loadPageModule();
    const evidence = validateComponentPage(source, {
      ...reference,
      profile: 'standard',
    });

    expect(evidence.exampleIds).toEqual(reference.expectedExamples);
    expect(evidence.snippetCount).toBeGreaterThan(0);
    expect(evidence.relatedLinks.length).toBeGreaterThan(1);
  });
});

describe('specialist page profiles', () => {
  test.each([
    ['landing', LANDING_FIXTURE, ['data-grid/quick-start']],
    ['capability', CAPABILITY_FIXTURE, ['data-grid/sorting', 'data-grid/quick-filter']],
    ['api', API_FIXTURE, []],
  ] as const)('accepts a substantive %s profile', async (profile, source, expectedExamples) => {
    const { validateComponentPage } = await loadPageModule();
    const evidence = validateComponentPage(source, {
      filePath: `fixtures/${profile}.md`,
      profile,
      expectedExamples,
    });
    expect(evidence.exampleIds).toEqual(expectedExamples);
  });
});

describe('focused snippet and teaching obligations', () => {
  test.each([
    [
      'internal imports',
      LANDING_FIXTURE.replace(
        "import { DataGrid } from '@jsvision/ui';",
        "import { DataGrid } from '../../ui/src/table/data-grid.js';",
      ),
      /public package entry/,
    ],
    [
      'full demo-shell plumbing',
      LANDING_FIXTURE.replace(
        'const grid = new DataGrid({ columns: [], rows: [] });',
        'const app = demoApp(ctx); const dialog = new Dialog(); app.desktop.add(dialog);',
      ),
      /focused snippet/,
    ],
    [
      'generic-only standard sections',
      LANDING_FIXTURE.replace('## Quick start', '## Usage')
        .replace('<PlayExample', '## Live example\n\n<PlayExample')
        .replace('## Capability map', '## Props')
        .replace(
          '## Cross-cutting practices',
          '## Size and Layout\n\nSizing guidance.\n\n## Best Practices\n\nPractical guidance.\n\n## Theming',
        ),
      /component-specific/,
    ],
  ])('rejects %s', async (_case, source, expectedMessage) => {
    const { validateComponentPage } = await loadPageModule();
    expect(() =>
      validateComponentPage(source, {
        filePath: 'fixtures/invalid.md',
        profile: 'standard',
        expectedExamples: ['data-grid/quick-start'],
        componentSpecificHeadings: ['Capability map'],
      }),
    ).toThrow(expectedMessage);
  });

  test('requires public usage before the flagship and requirements-owned section evidence', async () => {
    const source = await readFile(join(PACKAGE_ROOT, 'components/controls/button.md'), 'utf8');
    const { validateComponentPage } = await loadPageModule();
    const baseOptions = {
      filePath: 'fixtures/button.md',
      profile: 'standard',
      expectedExamples: ['controls/button'],
      componentSpecificHeadings: ['Keyboard & mouse'],
      requiredPublicSymbols: ['Button'],
      requiredThemeRoles: ['buttonFocused'],
    } as const;

    const movedUsage = source
      .replace('## Usage', '## Deferred usage')
      .replace('## Live example', '## Live example\n\n## Usage');
    expect(() => validateComponentPage(movedUsage, baseOptions)).toThrow(/Usage must precede/);
    expect(() => validateComponentPage(source, { ...baseOptions, requiredPublicSymbols: ['WrongOptions'] })).toThrow(
      /must name WrongOptions/,
    );
    expect(() =>
      validateComponentPage(source, { ...baseOptions, requiredThemeRoles: ['nonexistentThemeRole'] }),
    ).toThrow(/must name nonexistentThemeRole/);
  });

  test('rejects dead root-absolute links when a requirements-owned allowlist is supplied', async () => {
    const { validateComponentPage } = await loadPageModule();
    expect(() =>
      validateComponentPage(LANDING_FIXTURE, {
        filePath: 'fixtures/landing-links.md',
        profile: 'landing',
        expectedExamples: ['data-grid/quick-start'],
        validLinks: ['/api/ui/classes/DataGrid'],
      }),
    ).toThrow(/invalid related\/API link/);
  });
});
