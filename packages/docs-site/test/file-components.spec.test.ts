/**
 * Specification tests for the Form Dialog and composable file-component documentation wave.
 *
 * Every example runs only against an in-memory filesystem; denied and I/O-error paths are
 * deterministic fixture behavior, never host filesystem access.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot, Dialog, View } from '@jsvision/ui';
import { ChDirDialog, DirList, FileEditor, FileInfoPane, FileInput, FileList } from '@jsvision/files';
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
  viewsIn,
} from './example-lab-harness.js';
import type { ProbeExpectation } from './contracts/_contract.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import { FILE_CATALOG_ENTRY_IDS, FILE_CONTRACTS, FILE_EXAMPLE_IDS } from './contracts/files.js';
import type { FileComponentProbe } from './contracts/files.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Let promise continuations from modal completion and reactive updates settle. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Source-backed teaching obligations for one form or file page. */
interface FilePageExpectation {
  readonly id: (typeof FILE_CATALOG_ENTRY_IDS)[number];
  readonly filePath: string;
  readonly exampleId: (typeof FILE_EXAMPLE_IDS)[number];
  readonly headings: readonly string[];
  readonly symbols: readonly string[];
  readonly roles: readonly string[];
}

/** Complete page fixture in catalog order. */
const FILE_PAGES = [
  {
    id: 'controls/form-dialog',
    filePath: 'components/controls/form-dialog.md',
    exampleId: 'controls/form-dialog',
    headings: ['Validation and submission', 'Modal lifecycle'],
    symbols: ['formDialog', 'FormDialogOptions', 'createForm', 'Form'],
    roles: ['dialog'],
  },
  {
    id: 'files/file-dialog',
    filePath: 'components/files/file-dialog.md',
    exampleId: 'files/file-dialog',
    headings: ['Browsing and resolving', 'Open and save modes'],
    symbols: ['FileDialog', 'FileDialogOptions', 'FileSystem', 'openFile'],
    roles: ['dialog', 'fileInfo'],
  },
  {
    id: 'files/chdir-dialog',
    filePath: 'components/files/chdir-dialog.md',
    exampleId: 'files/chdir-dialog',
    headings: ['Directory navigation', 'Validation and results'],
    symbols: ['ChDirDialog', 'ChDirDialogOptions', 'changeDir', 'FileSystem'],
    roles: ['dialog', 'listNormal', 'listFocused'],
  },
  {
    id: 'files/file-list',
    filePath: 'components/files/file-list.md',
    exampleId: 'files/file-list',
    headings: ['Scanning and filtering', 'Activation and focus'],
    symbols: ['FileList', 'FileListOptions', 'DirEntry', 'scanDirectory'],
    roles: ['listNormal', 'listFocused', 'listSelected'],
  },
  {
    id: 'files/dir-list',
    filePath: 'components/files/dir-list.md',
    exampleId: 'files/dir-list',
    headings: ['Tree derivation', 'Rerooting and activation'],
    symbols: ['DirList', 'DirListOptions', 'DirNode', 'buildDirTree'],
    roles: ['listNormal', 'listFocused', 'listSelected'],
  },
  {
    id: 'files/file-input',
    filePath: 'components/files/file-input.md',
    exampleId: 'files/file-input',
    headings: ['Entry mirroring', 'Focused editing'],
    symbols: ['FileInput', 'FileInputOptions', 'DirEntry', 'Signal'],
    roles: ['inputNormal', 'inputFocused', 'inputSelected'],
  },
  {
    id: 'files/file-info-pane',
    filePath: 'components/files/file-info-pane.md',
    exampleId: 'files/file-info-pane',
    headings: ['Search path', 'Entry metadata'],
    symbols: ['FileInfoPane', 'FileInfoPaneOptions', 'DirEntry', 'FileSystem'],
    roles: ['fileInfo'],
  },
  {
    id: 'files/file-editor',
    filePath: 'components/files/file-editor.md',
    exampleId: 'files/file-editor',
    headings: ['Loading and saving', 'Backups and close prompts'],
    symbols: ['FileEditor', 'FileEditorOptions', 'FileSystem', 'openFileInEditor'],
    roles: ['editorNormal', 'editorSelected'],
  },
] as const satisfies readonly FilePageExpectation[];

/** Complete one-row teaching lines that must survive the standard 80×24 render. */
const FILE_VISIBLE_LINES = [
  { exampleId: 'controls/form-dialog', lines: ['Alt+O opens · complete fields · Esc cancels'] },
  { exampleId: 'files/file-dialog', lines: ['Alt+F enters src · Alt+E shows a denied read'] },
  { exampleId: 'files/chdir-dialog', lines: ['Alt+N enters src · Alt+R reverts · Alt+E denies'] },
  { exampleId: 'files/file-list', lines: ['Alt+H hidden · Alt+T TypeScript · Alt+E error'] },
  { exampleId: 'files/dir-list', lines: ['Alt+N reroots to src · Alt+R resets · Alt+E error'] },
  { exampleId: 'files/file-input', lines: ['Alt+D mirrors a directory · typing pauses mirroring'] },
  { exampleId: 'files/file-info-pane', lines: ['Alt+N changes entry · Alt+B shows a broken link'] },
  { exampleId: 'files/file-editor', lines: ['Edit normally · Alt+S saves · Alt+E fails safely'] },
] as const;

/** Return the first descendant matching a public widget class. */
function widgetIn<T extends View>(
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  type: abstract new (...args: never[]) => T,
): T {
  const widget = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (widget === undefined) throw new Error(`missing ${type.name} in forms/files laboratory`);
  return widget;
}

/** Read only the mounted cells owned by one widget. */
function viewText(app: ReturnType<typeof buildLabExample>['app'], view: View): string {
  const origin = absoluteOrigin(view);
  const buffer = app.loop.renderRoot.buffer();
  const lines: string[] = [];
  for (let y = 0; y < view.bounds.height; y += 1) {
    let line = '';
    for (let x = 0; x < view.bounds.width; x += 1) {
      line += buffer.get(origin.x + x, origin.y + y)?.char ?? ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Read one target-owned observable from a mounted family laboratory. */
function probeValue(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  probe: FileComponentProbe,
): string | number | boolean {
  const text = frameText(app);
  if (probe === 'rendered-text') return text;
  if (probe === 'dialog-width') return dialog.bounds.width;
  if (probe === 'dialog-height') return dialog.bounds.height;
  if (probe === 'focused-view') return app.loop.getFocused()?.constructor.name ?? 'none';
  const buffer = app.loop.renderRoot.buffer();
  if (probe === 'menu-background') return buffer.get(10, 0)?.bg ?? 'missing';
  if (probe === 'dialog-background') return buffer.get(dialog.bounds.x + 1, dialog.bounds.y + 2)?.bg ?? 'missing';
  if (probe === 'dialog-count') {
    return app.desktop?.children.filter((view) => view instanceof Dialog).length ?? 0;
  }
  if (probe === 'active-dialog-title' || probe === 'form-status' || probe === 'error-status') {
    return text;
  }
  const fileList = viewsIn(dialog).find((view): view is FileList => view instanceof FileList);
  const dirList = viewsIn(dialog).find((view): view is DirList => view instanceof DirList);
  if (probe === 'file-entry-names') {
    if (fileList !== undefined)
      return fileList
        .entries()
        .map((entry) => entry.name)
        .join(',');
    if (dirList !== undefined)
      return dirList
        .nodes()
        .map((node) => node.label)
        .join(',');
    return '';
  }
  if (probe === 'directory-value') {
    const chdir = viewsIn(dialog).find((view): view is ChDirDialog => view instanceof ChDirDialog);
    return chdir?.directory() ?? fileList?.directory() ?? dirList?.directory() ?? '';
  }
  if (probe === 'filename-value') return viewText(app, widgetIn(dialog, FileInput)).trim();
  if (probe === 'file-info-text') return viewText(app, widgetIn(dialog, FileInfoPane));
  if (probe === 'editor-text' || probe === 'editor-modified') {
    const editor = widgetIn(dialog, FileEditor);
    return probe === 'editor-text' ? editor.getText() : editor.modified();
  }
  throw new Error(`unsupported forms/files probe ${probe}`);
}

/** Assert one typed behavior-contract probe. */
function expectProbe(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  expectation: ProbeExpectation<FileComponentProbe>,
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

/** Resolve one lazily registered family example. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing forms/files example ${exampleId}`);
  return (await entry.load()).default;
}

describe('forms and files population', () => {
  test('keeps page, example, and contract populations exact', () => {
    expect(FILE_PAGES.map((page) => page.id)).toEqual(FILE_CATALOG_ENTRY_IDS);
    expect(FILE_PAGES.map((page) => page.exampleId)).toEqual(FILE_EXAMPLE_IDS);
    expect(FILE_CONTRACTS.map((contract) => contract.exampleId)).toEqual(FILE_EXAMPLE_IDS);
    for (const contract of FILE_CONTRACTS) validateBehaviorContract(contract);
  });
});

describe('forms and files pages', () => {
  test.each(FILE_PAGES)('$id satisfies its source-backed teaching contract', async (page) => {
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

describe('forms and files template1 examples', () => {
  test.each(FILE_EXAMPLE_IDS)('%s owns a compact centered Classic dialog', async (exampleId) => {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      try {
        expect(collectTemplate1Evidence(app, dialog).dialogInterior.length).toBeGreaterThan(0);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    });
  });

  test.each(FILE_VISIBLE_LINES)('$exampleId renders every complete teaching line', async ({ exampleId, lines }) => {
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
  });
});

describe('forms and files behavior contracts', () => {
  test.each(FILE_CONTRACTS)('$exampleId executes every independently rebuilt case', async (contract) => {
    const definition = await loadDefinition(contract.exampleId);
    for (const interaction of contract.cases) {
      let app!: ReturnType<typeof buildLabExample>['app'];
      let dialog!: ReturnType<typeof buildLabExample>['dialog'];
      let dispose!: () => void;
      createRoot((rootDispose) => {
        dispose = rootDispose;
        ({ app, dialog } = buildLabExample(contract.exampleId, definition));
      });
      try {
        for (const initial of interaction.initial) expectProbe(app, dialog, initial);
        for (const action of interaction.actions) {
          dispatchExampleAction(app, action);
          await tick();
        }
        for (const expected of interaction.expected) expectProbe(app, dialog, expected);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    }
  });
});
