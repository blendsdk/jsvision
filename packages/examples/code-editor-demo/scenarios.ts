import { resolveCapabilities, type CapabilityProfile } from '@jsvision/core';
import {
  CodeEditor,
  CodeEditorWindow,
  classifyDocumentSize,
  createCodeEditorController,
  createDocumentModel,
  createCodeEditorLspCoordinator,
  createInProcessLspSession,
  createLanguageScheduler,
  darkCodeEditorTheme,
  lightCodeEditorTheme,
  type CodeEditorLanguageId,
} from '@jsvision/code-editor';
import { javascriptLanguageAdapter } from '@jsvision/code-editor/languages/javascript';
import { postgresqlLanguageAdapter } from '@jsvision/code-editor/languages/postgresql';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';

/**
 * Stable capability groups used to prove that the showcase covers the complete editor surface.
 */
export type CodeEditorDemoFacet =
  | 'editor-and-window'
  | 'editing-lifecycle'
  | 'languages-sql-javascript-typescript-plain'
  | 'local-language-features'
  | 'lsp-intelligence'
  | 'host-authorization'
  | 'hostile-and-unicode-text'
  | 'themes-and-capabilities'
  | 'accessibility-and-resize'
  | 'full-document-tier'
  | 'large-document-tier'
  | 'confirmation-document-tier';

/** Immutable source data used to restore a scenario without touching the filesystem. */
export interface CodeEditorDemoFixture {
  readonly text: string;
  readonly languageId: CodeEditorLanguageId;
  readonly readOnly?: boolean;
  readonly title: string;
}

/** Viewport and terminal capabilities supplied when a scenario is mounted. */
export interface CodeEditorDemoMountContext {
  readonly capabilities: CapabilityProfile;
  readonly width: number;
  readonly height: number;
}

/** Public contract for one discoverable, deterministic showcase scenario. */
export interface CodeEditorDemoScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly capabilities: readonly CodeEditorDemoFacet[];
  readonly actions: readonly CodeEditorDemoAction[];
  fixture(): CodeEditorDemoFixture;
  mount(context: CodeEditorDemoMountContext): CodeEditor | CodeEditorWindow;
}

/** Interactive actions the live shell can apply to the active scenario. */
export type CodeEditorDemoAction = 'edit' | 'search' | 'fold' | 'completion' | 'format' | 'save' | 'navigate' | 'theme';

/** Content-free live state exposed by the showcase inspector. */
export interface CodeEditorDemoInspection {
  readonly scenarioId: string;
  readonly configuredFeatures: readonly string[];
  readonly hostEffects: readonly string[];
  readonly actions: readonly CodeEditorDemoAction[];
}

const liveInspections = new WeakMap<CodeEditor | CodeEditorWindow, CodeEditorDemoInspection>();

/** Observable results produced by exercising a real scenario journey. */
export interface CodeEditorDemoJourneyEvidence {
  readonly scenarioId: string;
  readonly actions: readonly string[];
  readonly syntaxSpans: number;
  readonly diagnostics: number;
  readonly completions: number;
  readonly hostEffects: readonly string[];
  readonly documentMode: 'full' | 'large' | 'reduced';
  readonly confirmationRequired: boolean;
  readonly terminalSafe: boolean;
}

/** Complete version-one facet manifest displayed and checked by the showcase. */
export const CODE_EDITOR_DEMO_FACETS: readonly CodeEditorDemoFacet[] = Object.freeze([
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
]);

function scenario(
  metadata: Omit<CodeEditorDemoScenario, 'fixture' | 'mount' | 'actions'>,
  fixtureValue: CodeEditorDemoFixture,
  windowed = true,
  theme: 'dark' | 'light' | undefined = undefined,
  lineNumbers = false,
): CodeEditorDemoScenario {
  return Object.freeze({
    ...metadata,
    actions: actionsFor(metadata.id),
    fixture: () => Object.freeze({ ...fixtureValue }),
    mount: (context: CodeEditorDemoMountContext) => {
      const document = createDocumentModel({
        text: fixtureValue.text,
        languageId: fixtureValue.languageId,
        readOnly: fixtureValue.readOnly,
        uri: `memory://code-editor-demo/${metadata.id}`,
        confirmLargeDocument: () => true,
      });
      const hostEffects: string[] = [];
      const configuredFeatures: string[] = ['document', 'selection', 'search', 'history', 'line-status'];
      let session: ReturnType<typeof createInProcessLspSession> | undefined;
      let coordinator: ReturnType<typeof createCodeEditorLspCoordinator> | undefined;
      if (metadata.id === 'language-intelligence') {
        session = createInProcessLspSession({
          capabilities: {
            completion: true,
            hover: true,
            signatureHelp: true,
            diagnostics: true,
            definition: true,
            documentSymbols: true,
            documentFormatting: true,
            rangeFormatting: true,
          },
        });
        coordinator = createCodeEditorLspCoordinator({
          document,
          session,
          uri: `file:///code-editor-demo/${metadata.id}.ts`,
          languageId: document.languageId,
          formatOnSave: true,
          host: async (effect) => {
            hostEffects.push(effect.kind);
            return true;
          },
        });
        configuredFeatures.push(
          'completion',
          'hover',
          'signature',
          'diagnostics',
          'definition',
          'symbols',
          'formatting',
          'reconnect',
        );
      }
      const controller = createCodeEditorController({
        document,
        lsp: coordinator,
        host: async (effect) => {
          hostEffects.push(effect.kind);
          return true;
        },
      });
      const adapter =
        fixtureValue.languageId === 'postgresql'
          ? postgresqlLanguageAdapter
          : fixtureValue.languageId === 'javascript'
            ? javascriptLanguageAdapter
            : typescriptLanguageAdapter;
      const scheduler = createLanguageScheduler();
      const analyzeCurrentDocument = (): void => {
        if (
          metadata.id !== 'language-gallery' &&
          metadata.id !== 'typescript-window' &&
          metadata.id !== 'line-number-gutter' &&
          metadata.id !== 'themes-and-fallbacks'
        )
          return;
        void scheduler.analyze(adapter, document.text, document.identity).then((result) => {
          controller.setLanguageResult(result);
          editor.invalidate();
        });
      };
      const onDocumentChange = fixtureValue.languageId === 'plain' ? undefined : analyzeCurrentDocument;
      const surface = windowed
        ? new CodeEditorWindow({
            controller,
            title: fixtureValue.title,
            lineNumbers,
            ...(onDocumentChange === undefined ? {} : { onDocumentChange }),
          })
        : new CodeEditor({
            controller,
            lineNumbers,
            ...(onDocumentChange === undefined ? {} : { onDocumentChange }),
          });
      const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
      editor.setLayout({ rect: { x: 0, y: 0, width: context.width, height: context.height } });
      if (theme !== undefined || metadata.id === 'themes-and-fallbacks') {
        editor.setTheme(theme === 'dark' ? darkCodeEditorTheme : lightCodeEditorTheme);
        configuredFeatures.push(
          'hybrid-theme',
          context.capabilities.colorDepth,
          context.capabilities.unicode.utf8 ? 'unicode' : 'ascii',
        );
      }
      if (
        metadata.id === 'language-gallery' ||
        metadata.id === 'typescript-window' ||
        metadata.id === 'line-number-gutter' ||
        metadata.id === 'themes-and-fallbacks'
      ) {
        analyzeCurrentDocument();
        configuredFeatures.push('syntax', 'folds', 'brackets', 'language-switching');
      }
      if (session !== undefined && coordinator !== undefined) {
        void coordinator.open().then(() => {
          session?.publishDiagnostics(document.uri ?? '', Number(document.identity.revision), [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
              message: 'Simulated live diagnostic',
              severity: 2,
            },
          ]);
          editor.openCompletion([{ label: 'greet', insertText: 'greet(name)' }]);
          editor.invalidate();
        });
      }
      if (metadata.id === 'safe-terminal-text')
        configuredFeatures.push('hostile-text', 'unicode', 'terminal-sanitization');
      if (metadata.id.includes('document-tier')) configuredFeatures.push('size-classification', document.sizeMode);
      if (lineNumbers) configuredFeatures.push('line-number-gutter', 'active-line-cue', 'narrow-gutter-fallback');
      if (metadata.id === 'modern-keyboard-editing')
        configuredFeatures.push(
          'selected-line-indent',
          'smart-tab-stops',
          'word-navigation',
          'selection-extension',
          'undo-redo',
          'clipboard',
          'line-comments',
        );
      if (surface instanceof CodeEditorWindow) {
        surface.setLayout({ rect: { x: 0, y: 0, width: context.width, height: context.height } });
      }
      liveInspections.set(
        surface,
        Object.freeze({
          scenarioId: metadata.id,
          configuredFeatures: Object.freeze(configuredFeatures),
          hostEffects,
          actions: actionsFor(metadata.id),
        }),
      );
      return surface;
    },
  });
}

/** Reads the content-free live configuration displayed by the showcase inspector. */
export function inspectCodeEditorScenario(surface: CodeEditor | CodeEditorWindow): CodeEditorDemoInspection {
  return (
    liveInspections.get(surface) ??
    Object.freeze({ scenarioId: 'unknown', configuredFeatures: [], hostEffects: [], actions: [] })
  );
}

/** Applies one advertised action through the active editor's public command boundary. */
export async function runCodeEditorScenarioAction(
  surface: CodeEditor | CodeEditorWindow,
  action: CodeEditorDemoAction,
): Promise<void> {
  const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
  if (action === 'edit') editor.insertText('// live edit\n');
  else if (action === 'search') {
    editor.setSearchQuery('const');
    editor.execute('search.next');
  } else if (action === 'fold') editor.execute('fold.toggle');
  else if (action === 'completion') editor.execute('assist');
  else if (action === 'format') editor.execute('format');
  else if (action === 'save' || action === 'navigate') editor.execute(action);
  else editor.setTheme(darkCodeEditorTheme);
  await editor.whenIdle();
}

function actionsFor(id: string): readonly CodeEditorDemoAction[] {
  if (id === 'language-intelligence') return Object.freeze(['completion', 'format', 'navigate', 'save']);
  if (id === 'themes-and-fallbacks') return Object.freeze(['theme', 'edit', 'search']);
  if (id === 'typescript-window') return Object.freeze(['edit', 'search', 'fold', 'save']);
  return Object.freeze(['edit', 'search']);
}

const GENERATED_LARGE_TEXT = `${'x\n'.repeat(50_001)}// generated at runtime`;

/** Ordered registry used by both the live application and headless verification. */
export const CODE_EDITOR_SCENARIOS: readonly CodeEditorDemoScenario[] = Object.freeze([
  scenario(
    {
      id: 'typescript-window',
      title: 'TypeScript editor window',
      description: 'Edit, select, search, fold, undo, save, and inspect line/column state.',
      capabilities: ['editor-and-window', 'editing-lifecycle', 'local-language-features', 'full-document-tier'],
    },
    {
      title: 'main.ts',
      languageId: 'typescript',
      text: 'interface User { name: string; }\nconst user: User = { name: "Ada" };\nconsole.log(user.name);\n',
    },
    true,
    'dark',
  ),
  scenario(
    {
      id: 'modern-keyboard-editing',
      title: 'Modern keyboard editing',
      description: 'Try selection-aware Tab, navigation, history, clipboard, and Ctrl+/ comments.',
      capabilities: ['editing-lifecycle', 'local-language-features'],
    },
    {
      title: 'keyboard.ts',
      languageId: 'typescript',
      text: 'function greet(name: string) {\n  return `Hello ${name}`;\n}\n',
    },
    true,
    'dark',
  ),
  scenario(
    {
      id: 'line-number-gutter',
      title: 'Optional line-number gutter',
      description: 'Inspect fixed one-based line numbers, the active-line cue, scrolling, and narrow fallback.',
      capabilities: ['local-language-features', 'accessibility-and-resize'],
    },
    {
      title: 'numbered.ts',
      languageId: 'typescript',
      text: Array.from({ length: 14 }, (_, index) => `const line${index + 1} = ${index + 1};`).join('\n'),
    },
    true,
    'dark',
    true,
  ),
  scenario(
    {
      id: 'language-gallery',
      title: 'SQL, JavaScript, TypeScript, and plain text',
      description: 'Switch language adapters and inspect partial highlighting for incomplete source.',
      capabilities: ['languages-sql-javascript-typescript-plain', 'local-language-features'],
    },
    {
      title: 'query.sql',
      languageId: 'postgresql',
      text: 'SELECT u.id, u.display_name\nFROM app_user AS u\nWHERE u.active = TRUE;\n',
    },
  ),
  scenario(
    {
      id: 'language-intelligence',
      title: 'Deterministic language intelligence',
      description: 'Exercise simulated completion, diagnostics, navigation, formatting, cancellation, and recovery.',
      capabilities: ['lsp-intelligence', 'host-authorization'],
    },
    {
      title: 'service.ts',
      languageId: 'typescript',
      text: 'const message = greet("terminal");\n',
    },
  ),
  scenario(
    {
      id: 'safe-terminal-text',
      title: 'Unicode and hostile terminal text',
      description: 'Render tabs, combining marks, wide glyphs, bidi controls, and escape bytes safely.',
      capabilities: ['hostile-and-unicode-text', 'accessibility-and-resize'],
    },
    {
      title: 'hostile.txt',
      languageId: 'plain',
      text: 'tab\tcolumn\ncombining: e\u0301\nwide: 界🙂\nbidi: \u202Etxt\u202C\ncontrol: \u001B[31mnot-red\u0007\n',
    },
  ),
  scenario(
    {
      id: 'themes-and-fallbacks',
      title: 'Hybrid themes and terminal fallbacks',
      description: 'Compare independent palettes, monochrome indicators, ASCII glyphs, and a narrow viewport.',
      capabilities: ['themes-and-capabilities', 'accessibility-and-resize'],
    },
    {
      title: 'theme.js',
      languageId: 'javascript',
      text: 'export function visibleState(value) {\n  return value ?? "fallback";\n}\n',
    },
    true,
    'light',
  ),
  scenario(
    {
      id: 'full-document-tier',
      title: 'Full-feature document tier',
      description: 'Inspect the complete feature set on a bounded source document.',
      capabilities: ['full-document-tier'],
    },
    { title: 'full.ts', languageId: 'typescript', text: 'const tier = "full";\n' },
  ),
  scenario(
    {
      id: 'large-document-tier',
      title: 'Large degradable document tier',
      description: 'Generate more than fifty thousand lines and inspect bounded feature degradation.',
      capabilities: ['large-document-tier'],
    },
    {
      title: 'generated-large.ts',
      languageId: 'typescript',
      text: GENERATED_LARGE_TEXT,
      readOnly: true,
    },
  ),
  scenario(
    {
      id: 'confirmation-document-tier',
      title: 'Confirmation-required document tier',
      description: 'Inspect the preflight classification used before opening source above ten MiB.',
      capabilities: ['confirmation-document-tier'],
    },
    {
      title: 'generated-confirmation.txt',
      languageId: 'plain',
      text: 'Preview intentionally stays compact; generate the confirmed payload only on explicit request.\n',
      readOnly: true,
    },
  ),
]);

/**
 * Exercises the real public boundaries behind one scenario and returns content-free evidence.
 *
 * This is shared by the live inspector and tests, so facet claims cannot drift into inert labels.
 */
export async function runCodeEditorScenarioJourney(scenarioId: string): Promise<CodeEditorDemoJourneyEvidence> {
  const scenarioEntry = CODE_EDITOR_SCENARIOS.find((candidate) => candidate.id === scenarioId);
  if (scenarioEntry === undefined) throw new RangeError(`Unknown Code Editor scenario: ${scenarioId}`);
  const fixture = scenarioEntry.fixture();
  const document = createDocumentModel({
    text: fixture.text,
    languageId: fixture.languageId,
    readOnly: fixture.readOnly,
    uri: `file:///code-editor-demo/journey/${scenarioId}.ts`,
    confirmLargeDocument: () => true,
  });
  const actions: string[] = [];
  const hostEffects: string[] = [];
  let syntaxSpans = 0;
  let diagnostics = 0;
  let completions = 0;

  if (scenarioId === 'language-gallery' || scenarioId === 'typescript-window') {
    const scheduler = createLanguageScheduler();
    for (const [adapter, text] of [
      [postgresqlLanguageAdapter, 'SELECT id FROM users;'],
      [javascriptLanguageAdapter, 'const value = 1;'],
      [typescriptLanguageAdapter, 'const value: number = 1;'],
    ] as const) {
      const result = await scheduler.analyze(adapter, text, document.identity);
      syntaxSpans += result.syntax.length;
    }
    actions.push('analyzed-postgresql', 'analyzed-javascript', 'analyzed-typescript');
  }

  if (scenarioId === 'language-intelligence') {
    const session = createInProcessLspSession({
      capabilities: { completion: true, diagnostics: true, definition: true, documentFormatting: true },
    });
    const coordinator = createCodeEditorLspCoordinator({
      document,
      session,
      uri: document.uri ?? 'memory://code-editor-demo/intelligence.ts',
      languageId: document.languageId,
      host: async (effect) => {
        hostEffects.push(effect.kind);
        return true;
      },
    });
    await coordinator.open();
    session.publishDiagnostics(document.uri ?? '', Number(document.identity.revision), [
      {
        range: { start: { line: 0, character: 6 }, end: { line: 0, character: 13 } },
        message: 'Simulated diagnostic',
        severity: 2,
      },
    ]);
    const completion = coordinator.requestCompletion({ line: 0, character: 5 });
    session.respond(completion.requestId, [{ label: 'greet', insertText: 'greet(${1:name})' }]);
    await completion.settled;
    diagnostics = coordinator.presentation.diagnostics.items.length;
    completions = coordinator.presentation.completion?.items.length ?? 0;
    session.reconnect();
    await coordinator.resynchronize();
    await coordinator.close();
    actions.push('completion', 'diagnostics', 'reconnect', 'resynchronize');
  }

  const controller = createCodeEditorController({
    document,
    host: async (effect) => {
      hostEffects.push(effect.kind);
      return true;
    },
  });
  if (!document.readOnly) {
    controller.document.setSelection({ anchor: document.text.length, head: document.text.length });
    controller.replaceSelection('// edited\n');
    controller.document.undo();
    controller.document.redo();
    await controller.hostAction('save');
    actions.push('edit', 'undo', 'redo', 'save');
  }
  if (scenarioId === 'language-intelligence') {
    await controller.hostAction('navigate');
    actions.push('authorize-navigation');
  }

  const requestedSize =
    scenarioId === 'confirmation-document-tier'
      ? { bytes: 10 * 1_048_576 + 1, lines: 1 }
      : scenarioId === 'large-document-tier'
        ? { bytes: fixture.text.length, lines: 50_002 }
        : { bytes: fixture.text.length, lines: Math.max(1, fixture.text.split('\n').length) };
  const classification = classifyDocumentSize(requestedSize);
  const terminalSafe =
    scenarioId !== 'safe-terminal-text' ||
    !new CodeEditor({ controller })
      .project({
        width: 40,
        height: 8,
        caps: resolveDemoCapabilities(),
      })
      .cells.flat()
      .some((cell) => cell.text === '\u001B' || cell.text === '\u0007');
  controller.dispose();
  return Object.freeze({
    scenarioId,
    actions: Object.freeze(actions),
    syntaxSpans,
    diagnostics,
    completions,
    hostEffects: Object.freeze(hostEffects),
    documentMode: classification.mode,
    confirmationRequired: classification.confirmationRequired,
    terminalSafe,
  });
}

function resolveDemoCapabilities(): CapabilityProfile {
  return resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
  }).profile;
}
