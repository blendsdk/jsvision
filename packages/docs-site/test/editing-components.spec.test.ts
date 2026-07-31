/**
 * Specification tests for the surface, general editing, and terminal documentation wave.
 *
 * The standard Editor family remains intentionally separate from the specialized Code Editor hub.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot, EditWindow, Editor, ScrollBar, SurfaceView, Text, Terminal, View } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { validateComponentPage } from '../src/components/component-pages.mjs';
import {
  buildLabExample,
  absoluteOrigin,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';
import type { ProbeExpectation } from './contracts/_contract.js';
import { validateBehaviorContract } from './contracts/_contract.js';
import { EDITING_CATALOG_ENTRY_IDS, EDITING_CONTRACTS, EDITING_EXAMPLE_IDS } from './contracts/editing.js';
import type { EditingProbe } from './contracts/editing.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Source-backed teaching obligations for one surface, editor, or terminal page. */
interface EditingPageExpectation {
  readonly id: (typeof EDITING_CATALOG_ENTRY_IDS)[number];
  readonly filePath: string;
  readonly exampleId: (typeof EDITING_EXAMPLE_IDS)[number];
  readonly headings: readonly string[];
  readonly symbols: readonly string[];
  readonly roles: readonly string[];
}

/** Complete page fixture, deliberately excluding every specialized Code Editor hub ID. */
const EDITING_PAGES = [
  {
    id: 'surface/surface',
    filePath: 'components/surface/surface.md',
    exampleId: 'surface/surface',
    headings: ['Cell storage and mutation', 'Resize and snapshots'],
    symbols: ['Surface', 'SurfaceOptions', 'DrawContext', 'ScreenBuffer'],
    roles: ['windowInactive'],
  },
  {
    id: 'surface/surface-view',
    filePath: 'components/surface/surface-view.md',
    exampleId: 'surface/surface-view',
    headings: ['Viewport and clipping', 'Panning and reactive sources'],
    symbols: ['SurfaceView', 'SurfaceViewOptions', 'SurfaceSource', 'Signal'],
    roles: ['windowInactive'],
  },
  {
    id: 'editor/editor',
    filePath: 'components/editor/editor.md',
    exampleId: 'editor/editor',
    headings: ['Editing and navigation', 'Undo, clipboard, and dialogs'],
    symbols: ['Editor', 'EditorOptions', 'EditorAction', 'EditorCommandSeam'],
    roles: ['editorNormal', 'editorSelected'],
  },
  {
    id: 'editor/memo',
    filePath: 'components/editor/memo.md',
    exampleId: 'editor/memo',
    headings: ['Signal synchronization', 'Dialog focus behavior'],
    symbols: ['Memo', 'MemoOptions', 'EditorOptions', 'Signal'],
    roles: ['memoNormal', 'memoSelected'],
  },
  {
    id: 'editor/edit-window',
    filePath: 'components/editor/edit-window.md',
    exampleId: 'editor/edit-window',
    headings: ['Window composition', 'Gadgets and resize'],
    symbols: ['EditWindow', 'EditWindowOptions', 'Editor', 'Indicator'],
    roles: [
      'windowActive',
      'windowInactive',
      'editorNormal',
      'editorSelected',
      'scrollBarControls',
      'scrollBarPage',
      'indicatorNormal',
      'indicatorDragging',
    ],
  },
  {
    id: 'editor/indicator',
    filePath: 'components/editor/indicator.md',
    exampleId: 'editor/indicator',
    headings: ['Caret and modified state', 'Window drag presentation'],
    symbols: ['Indicator', 'IndicatorTarget', 'setValue'],
    roles: ['indicatorNormal', 'indicatorDragging'],
  },
  {
    id: 'terminal/terminal',
    filePath: 'components/terminal/terminal.md',
    exampleId: 'terminal/terminal',
    headings: ['Streaming and retention', 'Scrollback and safety'],
    symbols: ['Terminal', 'TerminalOptions', 'terminalWriter'],
    roles: ['terminalNormal'],
  },
] as const satisfies readonly EditingPageExpectation[];

/** Complete one-row teaching lines that must survive the 80×24 laboratory render. */
const EDITING_VISIBLE_LINES = [
  { exampleId: 'surface/surface', lines: ['Alt+G grows · Alt+C clears · Alt+R redraws'] },
  {
    exampleId: 'surface/surface-view',
    lines: ['Alt+P pans · Alt+R resets · surface edits repaint', 'scrollTo/panBy clamp · direct delta may overscroll'],
  },
  { exampleId: 'editor/editor', lines: ['Type and select · Ctrl+Z/Y undo/redo · Ctrl+A/C/X/V'] },
  {
    exampleId: 'editor/memo',
    lines: ['Type to update the signal · Alt+R replaces externally', 'Tab moves to the next dialog control.'],
  },
  { exampleId: 'editor/edit-window', lines: ['Edit normally · Alt+Z zooms/restores · bars follow'] },
  { exampleId: 'editor/indicator', lines: ['Alt+N moves/marks · Alt+C returns to clean 1:1'] },
  { exampleId: 'terminal/terminal', lines: ['Wheel scrolls history · Alt+W writes · Alt+C clears'] },
] as const;

/** Return the first descendant matching a public widget class. */
function widgetIn<T extends View>(
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  type: abstract new (...args: never[]) => T,
): T {
  const widget = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (widget === undefined) throw new Error(`missing ${type.name} in editing laboratory`);
  return widget;
}

/** Read only the cells painted inside one widget's mounted bounds. */
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

/** Read one observable from a mounted editing-family laboratory. */
function probeValue(
  exampleId: string,
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  probe: EditingProbe,
): string | number | boolean {
  const text = frameText(app);
  if (probe === 'rendered-text') return text;
  if (probe === 'dialog-width') return dialog.bounds.width;
  if (probe === 'dialog-height') return dialog.bounds.height;
  if (probe === 'focused-view') return app.loop.getFocused()?.constructor.name ?? 'none';
  const buffer = app.loop.renderRoot.buffer();
  if (probe === 'menu-background') return buffer.get(10, 0)?.bg ?? 'missing';
  if (probe === 'dialog-background') return buffer.get(dialog.bounds.x + 1, dialog.bounds.y + 2)?.bg ?? 'missing';
  if (probe === 'surface-width' || probe === 'surface-height') {
    const match = /Surface: (\d+)×(\d+)/.exec(text);
    return match === null ? -1 : Number(match[probe === 'surface-width' ? 1 : 2]);
  }
  if (probe === 'surface-delta-x') return widgetIn(dialog, SurfaceView).delta().x;
  if (probe === 'surface-view-text') return viewText(app, widgetIn(dialog, SurfaceView));
  if (probe === 'editor-text' || probe === 'editor-modified' || probe === 'editor-can-undo') {
    const editor = exampleId === 'editor/edit-window' ? widgetIn(dialog, EditWindow).editor : widgetIn(dialog, Editor);
    if (probe === 'editor-text') return editor.getText();
    return probe === 'editor-modified' ? editor.modified() : editor.canUndo();
  }
  if (probe === 'memo-value') {
    const readout = viewsIn(dialog).find(
      (view): view is Text => view instanceof Text && view.bounds.x === 40 && view.bounds.y === 2,
    );
    if (readout === undefined) throw new Error('missing signal readout in Memo laboratory');
    return viewText(app, readout).split('\n').slice(1).join(' ').trim().replace(/\s+/g, ' ');
  }
  if (probe === 'window-width') return widgetIn(dialog, EditWindow).bounds.width;
  if (probe === 'edit-window-scroll-bars-visible') {
    const bars = viewsIn(widgetIn(dialog, EditWindow)).filter((view): view is ScrollBar => view instanceof ScrollBar);
    return bars.length === 2 && bars.every((bar) => bar.state.visible && bar.bounds.width > 0 && bar.bounds.height > 0);
  }
  if (probe === 'terminal-visible-text') return viewText(app, widgetIn(dialog, Terminal));
  throw new Error(`unsupported editing probe ${probe}`);
}

/** Assert one typed behavior-contract probe. */
function expectProbe(
  exampleId: string,
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  expectation: ProbeExpectation<EditingProbe>,
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
  if (entry === undefined) throw new Error(`missing editing example ${exampleId}`);
  return (await entry.load()).default;
}

describe('surface, editing, and terminal population', () => {
  test('keeps page, example, and contract populations exact and outside the Code Editor hub', () => {
    expect(EDITING_PAGES.map((page) => page.id)).toEqual(EDITING_CATALOG_ENTRY_IDS);
    expect(EDITING_PAGES.map((page) => page.exampleId)).toEqual(EDITING_EXAMPLE_IDS);
    expect(EDITING_CONTRACTS.map((contract) => contract.exampleId)).toEqual(EDITING_EXAMPLE_IDS);
    expect(EDITING_EXAMPLE_IDS.some((id) => id.startsWith('code-editor/'))).toBe(false);
    for (const contract of EDITING_CONTRACTS) validateBehaviorContract(contract);
  });
});

describe('surface, editing, and terminal pages', () => {
  test.each(EDITING_PAGES)('$id satisfies its source-backed teaching contract', async (page) => {
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

describe('surface, editing, and terminal template1 examples', () => {
  test.each(EDITING_EXAMPLE_IDS)('%s owns a compact centered Classic dialog', async (exampleId) => {
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

  test.each(EDITING_VISIBLE_LINES)('$exampleId renders every complete teaching line', async ({ exampleId, lines }) => {
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

describe('surface, editing, and terminal behavior contracts', () => {
  test.each(EDITING_CONTRACTS)('$exampleId executes every independently rebuilt case', async (contract) => {
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
      });
    }
  });
});
