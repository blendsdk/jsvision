/**
 * Immutable specification oracle for the standalone Code Editor showcase.
 *
 * The showcase is a terminal application, but its public demo seams stay synchronous and
 * deterministic so unit tests can exercise the same registry and session without a TTY or an
 * external service. End-to-end process behavior is covered separately.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  CodeEditor,
  CodeEditorWindow,
  createCodeEditorController,
  createDocumentModel,
  projectCodeEditor,
} from '@jsvision/code-editor';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { Window } from '@jsvision/ui';
import { codeEditorStory } from '../kitchen-sink/stories/code-editor.story.js';
import { STORIES } from '../kitchen-sink/stories/index.js';
import {
  CODE_EDITOR_DEMO_FACETS,
  CODE_EDITOR_SCENARIOS,
  runCodeEditorScenarioJourney,
  type CodeEditorDemoFacet,
} from './scenarios.js';
import { createCodeEditorDemoSession } from './session.js';
import { createCodeEditorShowcase } from './shell.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const normalCapabilities = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Creates the one-based mouse coordinates consumed by the terminal event loop. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/**
 * The version-one facets are deliberately broader than individual commands. A scenario may cover
 * several facets, but no facet may disappear from the interactive catalog.
 */
const REQUIRED_FACETS = [
  'editor-and-window',
  'editing-lifecycle',
  'languages-sql-javascript-typescript-plain',
  'local-language-features',
  'lsp-intelligence',
  'host-authorization',
  'hostile-and-unicode-text',
  'themes-and-capabilities',
  'accessibility-and-resize',
  'full-document-tier',
  'large-document-tier',
  'confirmation-document-tier',
] as const satisfies readonly CodeEditorDemoFacet[];

/** Reads a repository artifact as UTF-8 for deterministic release-integration assertions. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

/** Counts cells containing visible content in a projected editor frame. */
function paintedCells(frame: ReturnType<typeof projectCodeEditor>): number {
  let count = 0;
  for (const row of frame.cells) {
    for (const cell of row) {
      if (cell.text !== ' ') count += 1;
    }
  }
  return count;
}

describe('ST-39: standalone Code Editor scenario registry', () => {
  // Every version-one facet has a discoverable, deterministic interactive scenario.
  test('matches the required facet manifest exactly', () => {
    expect([...CODE_EDITOR_DEMO_FACETS].sort()).toEqual([...REQUIRED_FACETS].sort());

    const demonstrated = new Set(CODE_EDITOR_SCENARIOS.flatMap((scenario) => scenario.capabilities));
    for (const facet of REQUIRED_FACETS) {
      expect(demonstrated.has(facet), `missing interactive scenario for "${facet}"`).toBe(true);
    }
  });

  // Stable IDs are navigation keys and each entry owns enough information to reset and mount.
  test('requires unique stable metadata, fixtures, capability mappings, and mount functions', () => {
    expect(CODE_EDITOR_SCENARIOS.length).toBeGreaterThan(0);
    const ids = CODE_EDITOR_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const scenario of CODE_EDITOR_SCENARIOS) {
      expect(scenario.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
      expect(scenario.title.trim()).not.toBe('');
      expect(scenario.description.trim()).not.toBe('');
      expect(scenario.capabilities.length).toBeGreaterThan(0);
      expect(typeof scenario.fixture).toBe('function');
      expect(typeof scenario.mount).toBe('function');

      const first = scenario.fixture();
      const reset = scenario.fixture();
      expect(reset, `${scenario.id} reset must reproduce its fixture`).toEqual(first);
      expect(reset).not.toBe(first);
    }
  });

  // Registry mounts use real public editor objects rather than a parallel demo-only widget.
  test('mounts every scenario through the public editor boundary', () => {
    for (const scenario of CODE_EDITOR_SCENARIOS) {
      const mounted = scenario.mount({
        capabilities: normalCapabilities,
        width: 80,
        height: 24,
      });
      expect(
        mounted instanceof CodeEditor || mounted instanceof CodeEditorWindow,
        `${scenario.id} did not mount a public Code Editor surface`,
      ).toBe(true);
    }
  });

  // SQL, JavaScript, and TypeScript claims are backed by real adapter analysis, not catalog text.
  test('executes local analysis journeys for every supported source language', async () => {
    const evidence = await runCodeEditorScenarioJourney('language-gallery');

    expect(evidence.actions).toEqual(
      expect.arrayContaining(['analyzed-postgresql', 'analyzed-javascript', 'analyzed-typescript']),
    );
    expect(evidence.syntaxSpans).toBeGreaterThan(0);
  });

  // The deterministic in-process language service must exercise results and recovery end to end.
  test('executes completion, diagnostics, reconnect, and host authorization journeys', async () => {
    const evidence = await runCodeEditorScenarioJourney('language-intelligence');

    expect(evidence.completions).toBeGreaterThan(0);
    expect(evidence.diagnostics).toBeGreaterThan(0);
    expect(evidence.actions).toEqual(
      expect.arrayContaining(['completion', 'diagnostics', 'reconnect', 'resynchronize', 'authorize-navigation']),
    );
    expect(evidence.hostEffects).toContain('navigate');
  });

  // Hostile fixture bytes must pass through the real editor projection without terminal controls.
  test('projects hostile and Unicode source as terminal-safe cells', async () => {
    const evidence = await runCodeEditorScenarioJourney('safe-terminal-text');

    expect(evidence.terminalSafe).toBe(true);
  });

  // Generated stress scenarios must reach distinct production classifications.
  test('classifies generated large and confirmation-required documents through public limits', async () => {
    const large = await runCodeEditorScenarioJourney('large-document-tier');
    const confirmation = await runCodeEditorScenarioJourney('confirmation-document-tier');

    expect(large.documentMode).toBe('large');
    expect(large.confirmationRequired).toBe(false);
    expect(confirmation.documentMode).toBe('reduced');
    expect(confirmation.confirmationRequired).toBe(true);
  });
});

describe('ST-40: standalone session lifecycle', () => {
  // The session narrates the same bounded lifecycle under a fixed capability profile.
  test('starts, interacts, resizes, resets, and exits deterministically', () => {
    const run = () => {
      const session = createCodeEditorDemoSession({
        capabilities: normalCapabilities,
        width: 80,
        height: 24,
      });
      session.start();
      session.interact({ kind: 'insert', text: 'x' });
      session.resize({ width: 42, height: 12 });
      session.interact({ kind: 'reset' });
      session.exit();
      return session.snapshot();
    };

    const first = run();
    expect(run()).toEqual(first);
    expect(first.phase).toBe('exited');
    expect(first.width).toBe(42);
    expect(first.height).toBe(12);
    expect(first.narration).toEqual(
      expect.arrayContaining(['demo started', 'document edited', 'terminal resized', 'scenario reset', 'demo exited']),
    );
    expect(first.narration.length).toBeLessThanOrEqual(32);
  });

  // Terminal resizing preserves the tiled showcase while fitting every editor child to its window.
  test('reflows the tiled live showcase without stale editor chrome', () => {
    const showcase = createCodeEditorShowcase(normalCapabilities);

    for (const size of [
      { width: 100, height: 30 },
      { width: 44, height: 12 },
    ]) {
      showcase.app.loop.resize(size);
      showcase.app.loop.renderRoot.flush();
      const editor = showcase.activeEditor();
      const window = editor.parent;

      expect(window).toBeInstanceOf(CodeEditorWindow);
      if (!(window instanceof CodeEditorWindow)) continue;
      const windowRect = window.layout.rect;
      const editorRect = editor.layout.rect;
      const horizontalRect = window.horizontalScrollBar.layout.rect;
      const verticalRect = window.verticalScrollBar.layout.rect;
      const statusRect = window.statusView.layout.rect;
      expect(windowRect).toBeDefined();
      expect(editorRect).toBeDefined();
      expect(horizontalRect).toBeDefined();
      expect(verticalRect).toBeDefined();
      expect(statusRect).toBeDefined();
      if (
        windowRect === undefined ||
        editorRect === undefined ||
        horizontalRect === undefined ||
        verticalRect === undefined ||
        statusRect === undefined
      ) {
        throw new Error('the tiled editor and its chrome must use absolute rectangles');
      }
      expect(editorRect.width).toBe(windowRect.width - 2);
      expect(editorRect.height).toBe(windowRect.height - 3);
      expect(horizontalRect.y).toBe(windowRect.height - 2);
      expect(verticalRect.x).toBe(windowRect.width - 1);
      expect(statusRect.y).toBe(windowRect.height - 1);
      expect(window.bounds.x + window.bounds.width).toBeLessThanOrEqual(size.width);
      expect(window.bounds.y + window.bounds.height).toBeLessThanOrEqual(size.height);
    }
  });

  // Reset restores document content and public state, not merely the selected scenario label.
  test('restores the active fixture and observable editor state on reset', () => {
    const session = createCodeEditorDemoSession({
      capabilities: normalCapabilities,
      width: 80,
      height: 24,
    });
    const initialEditor = session.surface instanceof CodeEditorWindow ? session.surface.editor : session.surface;
    const initial = {
      text: initialEditor.controller.document.text,
      state: initialEditor.controller.publicState,
    };

    session.start();
    session.interact({ kind: 'insert', text: 'changed' });
    expect(initialEditor.controller.document.text).not.toBe(initial.text);
    session.interact({ kind: 'reset' });

    const resetEditor = session.surface instanceof CodeEditorWindow ? session.surface.editor : session.surface;
    expect(resetEditor).not.toBe(initialEditor);
    expect(resetEditor.controller.document.text).toBe(initial.text);
    expect(resetEditor.controller.publicState).toEqual(initial.state);
    session.exit();
  });

  // The demo boundary explicitly proves it needs none of the forbidden production resources.
  test('declares a self-contained terminal-only dependency profile', () => {
    const session = createCodeEditorDemoSession({
      capabilities: normalCapabilities,
      width: 80,
      height: 24,
    });

    expect(session.dependencies).toEqual({
      browser: false,
      dom: false,
      network: false,
      database: false,
      externalLanguageServer: false,
      workspace: false,
      credentials: false,
      arbitraryFileAccess: false,
    });
  });

  // Public package composition is usable without source-relative editor imports.
  test('uses public Code Editor objects for a terminal-safe non-empty projection', () => {
    const document = createDocumentModel({
      uri: 'memory://showcase/public-import.ts',
      languageId: 'typescript',
      text: 'const answer: number = 42;',
    });
    const controller = createCodeEditorController({ document });
    const editor = new CodeEditor({ controller });
    const frame = projectCodeEditor({
      controller,
      width: 40,
      height: 8,
      caps: normalCapabilities,
    });

    expect(editor.focus()).toBe(true);
    expect(paintedCells(frame)).toBeGreaterThan(0);
    controller.dispose();
  });
});

describe('ST-41: repository kitchen-sink integration', () => {
  // The concise story remains registered in the existing shell without changing its architecture.
  test('registers one discoverable Code Editor story with representative guidance', () => {
    expect(STORIES.filter((story) => story.id === codeEditorStory.id)).toEqual([codeEditorStory]);
    expect(codeEditorStory.id).toBe('code-editor');
    expect(codeEditorStory.category).toBe('Text editing');
    expect(codeEditorStory.title).toBe('CodeEditor');
    expect(codeEditorStory.blurb).toMatch(/demo:code-editor/u);
    expect(codeEditorStory.blurb).toMatch(/syntax|line|selection|search|fold|completion|diagnostic/iu);
  });

  // The story supplies a live, focusable and operable editor plus visible state and usage hints.
  test('builds a smoke-safe representative editor surface', () => {
    const view = codeEditorStory.build({
      caps: normalCapabilities,
      width: 72,
      height: 16,
    });
    const editor = view.children.find((child) => child instanceof CodeEditor);

    expect(editor).toBeInstanceOf(CodeEditor);
    expect(editor?.focusable).toBe(true);
    expect(codeEditorStory.stateEcho.trim()).not.toBe('');
    expect(codeEditorStory.interactionHints.length).toBeGreaterThan(0);
    expect(codeEditorStory.representativeCapabilities).toEqual(
      expect.arrayContaining([
        'syntax-highlighting',
        'line-numbers',
        'status',
        'editing',
        'selection',
        'search',
        'folding',
        'completion',
        'diagnostics',
      ]),
    );
  });

  // The real application shell must select a scenario, focus its editor, and expose live state.
  test('selects scenarios through the live shell with editor focus and observable state', () => {
    const showcase = createCodeEditorShowcase(normalCapabilities);
    const targetIndex = CODE_EDITOR_SCENARIOS.findIndex((scenario) => scenario.id === 'language-gallery');
    expect(targetIndex).toBeGreaterThanOrEqual(0);

    showcase.select(targetIndex);
    const editor = showcase.activeEditor();
    const state = editor.controller.publicState;

    expect(showcase.activeScenarioId()).toBe('language-gallery');
    expect(showcase.app.loop.getFocused()).toBe(editor);
    expect(editor.focusable).toBe(true);
    expect(state.language).toBe('postgresql');
    expect(state.line).toBeGreaterThan(0);
    expect(state.visualColumn).toBeGreaterThan(0);
    editor.dispose();
  });

  // Scenario navigation is fixed application chrome, so it must not masquerade as a managed window.
  test('renders the scenario list in a visible borderless left pane between its heading and help footer', () => {
    const showcase = createCodeEditorShowcase(normalCapabilities);
    const pane = showcase.navigator.parent;

    if (pane === null) throw new Error('The scenario navigator must be mounted in a left pane.');
    expect(pane).not.toBeInstanceOf(Window);
    expect(pane.layout.rect).toEqual({
      x: 0,
      y: 0,
      width: Math.min(28, Math.max(18, Math.floor(showcase.app.desktop.bounds.width / 3))),
      height: showcase.app.desktop.bounds.height,
    });
    expect(showcase.navigator.layout.rect).toEqual({
      x: 0,
      y: 1,
      width: pane.layout.rect?.width,
      height: Math.max(1, (pane.layout.rect?.height ?? 0) - 4),
    });
    const renderedPane = showcase.app.loop.renderRoot
      .buffer()
      .rows()
      .slice(showcase.app.desktop.bounds.y)
      .map((row) =>
        row
          .slice(showcase.app.desktop.bounds.x, showcase.app.desktop.bounds.x + (pane.layout.rect?.width ?? 0))
          .map((cell) => cell.char)
          .join(''),
      )
      .join('\n');
    expect(renderedPane).toContain('Code Editor scenarios');
    expect(renderedPane).toContain(CODE_EDITOR_SCENARIOS[0]?.title);
    showcase.activeEditor().dispose();
  });

  // The showcased editor is a real managed window, so its standard move affordance must remain live.
  test('moves the editor window through its title bar and paints a drop shadow', () => {
    const showcase = createCodeEditorShowcase(normalCapabilities);
    const editor = showcase.activeEditor();
    const window = editor.parent;

    expect(window).toBeInstanceOf(CodeEditorWindow);
    if (!(window instanceof CodeEditorWindow) || window.layout.rect === undefined) return;
    const initial = { ...window.layout.rect };
    const desktopX = showcase.app.desktop.bounds.x;
    const desktopY = showcase.app.desktop.bounds.y;
    expect(window.movable).toBe(true);
    expect(window.castsShadow).toBe(true);

    showcase.app.loop.dispatch(mouse('down', desktopX + initial.x + 10, desktopY + initial.y));
    showcase.app.loop.dispatch(mouse('drag', desktopX + initial.x + 5, desktopY + initial.y + 2));
    showcase.app.loop.dispatch(mouse('up', desktopX + initial.x + 5, desktopY + initial.y + 2));

    expect(window.layout.rect).toEqual({ ...initial, x: initial.x - 5, y: initial.y + 2 });
    editor.dispose();
  });

  // Resizing the frame must immediately resize the editor cells and its viewport model.
  test('resizes the editor content and viewport through the real window resize gesture', () => {
    const showcase = createCodeEditorShowcase(normalCapabilities);
    const editor = showcase.activeEditor();
    const window = editor.parent;

    expect(window).toBeInstanceOf(CodeEditorWindow);
    if (!(window instanceof CodeEditorWindow) || window.layout.rect === undefined) return;
    const initial = { ...window.layout.rect };
    const desktopX = showcase.app.desktop.bounds.x;
    const desktopY = showcase.app.desktop.bounds.y;
    const width = initial.width - 8;
    const height = initial.height - 2;
    expect(window.resizable).toBe(true);

    showcase.app.loop.dispatch(
      mouse('down', desktopX + initial.x + initial.width - 1, desktopY + initial.y + initial.height - 1),
    );
    showcase.app.loop.dispatch(mouse('drag', desktopX + initial.x + width - 1, desktopY + initial.y + height - 1));
    showcase.app.loop.dispatch(mouse('up', desktopX + initial.x + width - 1, desktopY + initial.y + height - 1));
    showcase.app.loop.renderRoot.flush();

    expect(window.layout.rect).toEqual({ ...initial, width, height });
    expect(editor.layout.rect).toEqual({ x: 1, y: 1, width: width - 2, height: height - 3 });
    expect(editor.bounds).toMatchObject({ width: width - 2, height: height - 3 });
    expect(editor.viewportMetrics).toMatchObject({ width: width - 2, height: height - 3 });
    editor.dispose();
  });
});

describe('ST-42: public package, documentation, catalog, and release integration', () => {
  // The package manifest exposes the public barrel and the supported language entry points.
  test('declares publishable public exports and is consumable by examples', () => {
    const packageManifest = JSON.parse(repositoryFile('packages/code-editor/package.json')) as {
      files?: readonly string[];
      exports?: Record<string, unknown>;
    };
    const examplesManifest = JSON.parse(repositoryFile('packages/examples/package.json')) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(packageManifest.exports).toEqual(
      expect.objectContaining({
        '.': expect.any(Object),
        './languages/javascript': expect.any(Object),
        './languages/typescript': expect.any(Object),
        './languages/postgresql': expect.any(Object),
        './node': expect.any(Object),
      }),
    );
    expect(packageManifest.files).toEqual(expect.arrayContaining(['dist', 'README.md', 'CHANGELOG.md', 'LICENSE']));
    expect(examplesManifest.dependencies?.['@jsvision/code-editor']).toBeDefined();
    expect(examplesManifest.scripts?.['demo:code-editor']).toBe('tsx code-editor-demo/main.ts');
  });

  // Durable user guidance covers the package, standalone catalog, safe integration, and release.
  test('documents the public editor and standalone scenario catalog', () => {
    const readme = repositoryFile('packages/code-editor/README.md');
    const changelog = repositoryFile('packages/code-editor/CHANGELOG.md');
    const docs = repositoryFile('packages/docs-site/guide/code-editor.md');

    expect(readme).toMatch(/CodeEditorWindow/u);
    expect(readme).toMatch(/LSP|language server/u);
    expect(readme).toMatch(/limit|degrad/iu);
    expect(changelog).toMatch(/CodeEditor/u);
    expect(docs).toMatch(/demo:code-editor/u);
    for (const facet of REQUIRED_FACETS) expect(docs).toContain(facet);
  });

  // The canonical agent-neutral catalog and generated plugin copy both reference the new surface.
  test('keeps canonical and generated plugin references synchronized', () => {
    const canonicalCatalog = repositoryFile('tools/jsvision-skill/references/component-catalog.md');
    const generatedCatalog = repositoryFile('plugins/jsvision-plugin/skills/jsvision/references/component-catalog.md');
    const canonicalApi = repositoryFile('tools/jsvision-skill/references/api/code-editor.md');
    const generatedApi = repositoryFile('plugins/jsvision-plugin/skills/jsvision/references/api/code-editor.md');

    expect(canonicalCatalog).toMatch(/@jsvision\/code-editor/u);
    expect(canonicalCatalog).toMatch(/CodeEditorWindow/u);
    expect(generatedCatalog).toBe(canonicalCatalog);
    expect(generatedApi).toBe(canonicalApi);
    expect(canonicalApi).toMatch(/CodeEditor/u);
  });
});
