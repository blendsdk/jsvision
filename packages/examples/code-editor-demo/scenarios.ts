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

/** Evidence state for one capability in the standalone showcase. */
export type CodeEditorCapabilityStatus = 'interactive' | 'automated-only' | 'unsupported';

/** Fine-grained inventory entry used by the showcase and coverage tests. */
export interface CodeEditorCapabilityInventoryEntry {
  readonly id: string;
  readonly title: string;
  readonly status: CodeEditorCapabilityStatus;
  readonly scenarioIds: readonly string[];
  readonly reason?: string;
}

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
const liveReadiness = new WeakMap<CodeEditor | CodeEditorWindow, Promise<void>>();

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

/**
 * Capability-level showcase inventory.
 *
 * Broad facets remain useful navigation labels, while this list is the honest evidence boundary:
 * an interactive entry must name a reachable scenario; automated-only and unsupported entries
 * must explain why no interactive claim is made.
 */
export const CODE_EDITOR_CAPABILITY_INVENTORY: readonly CodeEditorCapabilityInventoryEntry[] = Object.freeze([
  interactive('surface.direct-editor', 'Direct embedded editor', 'direct-editor'),
  interactive('surface.windowed-editor', 'Window-hosted editor', 'typescript-window'),
  interactive('window.move', 'Move an editor window', 'viewport-and-mouse'),
  interactive('window.resize', 'Resize an editor window', 'viewport-and-mouse'),
  interactive('window.maximize-restore', 'Maximize and restore an editor window', 'viewport-and-mouse'),
  interactive('editing.text-input', 'Source text input', 'direct-editor'),
  interactive('editing.selection', 'Keyboard and mouse selection', 'modern-keyboard-editing'),
  interactive('editing.modern-keyboard', 'Modern indentation and navigation keys', 'modern-keyboard-editing'),
  interactive('editing.search', 'In-document search', 'typescript-window'),
  interactive('editing.history', 'Undo and redo', 'modern-keyboard-editing'),
  interactive('editing.clipboard', 'Copy, cut, and paste commands', 'modern-keyboard-editing'),
  interactive('editing.read-only', 'Read-only document behavior', 'read-only-editor'),
  interactive('gutter.line-numbers', 'Optional line-number gutter', 'line-number-gutter'),
  interactive('language.postgresql', 'PostgreSQL source', 'language-gallery'),
  interactive('language.javascript', 'JavaScript source', 'language-gallery'),
  interactive('language.typescript', 'TypeScript source', 'language-gallery'),
  interactive('language.plain-text', 'Plain text source', 'language-gallery'),
  interactive('language.syntax-highlighting', 'Parser-backed syntax highlighting', 'language-gallery'),
  interactive('language.brackets', 'Bracket matching', 'structural-folding'),
  interactive('language.folding', 'Structural code folding', 'structural-folding'),
  interactive('language.switching', 'Language adapter switching', 'language-gallery'),
  interactive('lsp.completion', 'Completion assistance', 'language-intelligence'),
  interactive('lsp.diagnostics', 'Diagnostics', 'language-intelligence'),
  interactive('lsp.navigation', 'Authorized definition navigation', 'language-intelligence'),
  interactive('lsp.formatting', 'Document formatting', 'language-intelligence'),
  interactive('host.authorization', 'Host-authorized effects', 'language-intelligence'),
  interactive('theme.hybrid', 'Independent editor themes', 'themes-and-fallbacks'),
  interactive('terminal.unicode', 'Unicode terminal profile', 'themes-and-fallbacks'),
  interactive('terminal.ascii', 'ASCII glyph fallback', 'themes-and-fallbacks'),
  interactive('terminal.monochrome', 'Monochrome non-color cues', 'themes-and-fallbacks'),
  interactive('terminal.hostile-text', 'Hostile terminal text sanitization', 'safe-terminal-text'),
  interactive('document.full-tier', 'Full document tier', 'full-document-tier'),
  interactive('document.large-tier', 'Large degradable document tier', 'large-document-tier'),
  interactive('document.confirmation-tier', 'Confirmation-required document tier', 'confirmation-document-tier'),
  automatedOnly(
    'lsp.external-process',
    'External language-server process transport',
    'The deterministic showcase cannot start or trust an external process; package integration tests cover the transport.',
  ),
  automatedOnly(
    'lsp.cancellation-and-stale-results',
    'Cancellation and stale-result rejection',
    'Timing-sensitive protocol races are verified by deterministic automated tests instead of a misleading menu action.',
  ),
  unsupported(
    'window.minimize',
    'Taskbar-style window minimization',
    'The JSVision window manager supports maximize and restore but has no minimized-window state.',
  ),
  unsupported(
    'folding.multi-chord-keymap',
    'Multi-chord folding shortcuts',
    'The terminal keymap cannot represent the complete desktop-editor chord set reliably.',
  ),
]);

function interactive(id: string, title: string, ...scenarioIds: string[]): CodeEditorCapabilityInventoryEntry {
  return Object.freeze({ id, title, status: 'interactive', scenarioIds: Object.freeze(scenarioIds) });
}

function automatedOnly(id: string, title: string, reason: string): CodeEditorCapabilityInventoryEntry {
  return Object.freeze({ id, title, status: 'automated-only', scenarioIds: Object.freeze([]), reason });
}

function unsupported(id: string, title: string, reason: string): CodeEditorCapabilityInventoryEntry {
  return Object.freeze({ id, title, status: 'unsupported', scenarioIds: Object.freeze([]), reason });
}

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
      const analyzeCurrentDocument = (): Promise<void> => {
        if (
          metadata.id !== 'language-gallery' &&
          metadata.id !== 'typescript-window' &&
          metadata.id !== 'line-number-gutter' &&
          metadata.id !== 'themes-and-fallbacks' &&
          metadata.id !== 'structural-folding'
        )
          return Promise.resolve();
        return scheduler.analyze(adapter, document.text, document.identity).then((result) => {
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
        metadata.id === 'themes-and-fallbacks' ||
        metadata.id === 'structural-folding'
      ) {
        configuredFeatures.push('syntax', 'folds', 'brackets', 'language-switching');
      }
      if (metadata.id === 'structural-folding') {
        configuredFeatures.push('syntax', 'folds', 'brackets', 'fold-markers', 'visible-row-navigation');
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
      liveReadiness.set(surface, analyzeCurrentDocument());
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
  await liveReadiness.get(surface);
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
  if (id === 'structural-folding') return Object.freeze(['fold', 'search']);
  return Object.freeze(['edit', 'search']);
}

const GENERATED_LARGE_TEXT = `${'x\n'.repeat(50_001)}// generated at runtime`;
const CAPABILITY_INVENTORY_TEXT = CODE_EDITOR_CAPABILITY_INVENTORY.map(
  (entry) => `[${entry.status}] ${entry.id} — ${entry.title}${entry.reason === undefined ? '' : `: ${entry.reason}`}`,
).join('\n');

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
      id: 'direct-editor',
      title: 'Direct embedded editor',
      description: 'Use the borderless CodeEditor surface without window chrome.',
      capabilities: ['editor-and-window', 'editing-lifecycle'],
    },
    {
      title: 'embedded.ts',
      languageId: 'typescript',
      text: 'export const embedded = true;\n',
    },
    false,
    'dark',
  ),
  scenario(
    {
      id: 'capability-inventory',
      title: 'Capability inventory',
      description: 'Review every interactive, automated-only, and unsupported showcase capability.',
      capabilities: ['editor-and-window', 'accessibility-and-resize'],
    },
    {
      title: 'capabilities.txt',
      languageId: 'plain',
      text: CAPABILITY_INVENTORY_TEXT,
      readOnly: true,
    },
    true,
    'light',
    true,
  ),
  scenario(
    {
      id: 'read-only-editor',
      title: 'Read-only document',
      description: 'Inspect navigation and selection while source mutations remain blocked.',
      capabilities: ['editing-lifecycle', 'full-document-tier'],
    },
    {
      title: 'locked.sql',
      languageId: 'postgresql',
      text: 'SELECT current_user;\n',
      readOnly: true,
    },
    true,
    'dark',
    true,
  ),
  scenario(
    {
      id: 'structural-folding',
      title: 'Structural code folding',
      description: 'Fold and unfold real nested TypeScript parser ranges from the gutter or action menu.',
      capabilities: ['local-language-features', 'accessibility-and-resize'],
    },
    {
      title: 'folding.ts',
      languageId: 'typescript',
      text: [
        'export function outer(value: number) {',
        '  if (value > 0) {',
        '    return value;',
        '  }',
        '  return 0;',
        '}',
        'console.log(outer(1));',
      ].join('\n'),
    },
    true,
    'dark',
    true,
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
      id: 'viewport-and-mouse',
      title: 'Viewport and mouse interaction',
      description: 'Resize, wheel-scroll, drag-select, double-click source runs, and watch both scrollbars.',
      capabilities: ['editor-and-window', 'editing-lifecycle', 'accessibility-and-resize'],
    },
    {
      title: 'viewport.ts',
      languageId: 'typescript',
      text: [
        'export function describeViewport(width: number, height: number) {',
        '  const terminalColumns = Math.max(1, width);',
        '  const terminalRows = Math.max(1, height);',
        '  return { terminalColumns, terminalRows, interaction: "mouse-and-wheel" };',
        '}',
        '',
        '// Continue typing below to observe caret-follow scrolling.',
        'const first = describeViewport(80, 24);',
        'const second = describeViewport(44, 12);',
        'console.log(first, second);',
      ].join('\n'),
    },
    true,
    'dark',
    true,
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
