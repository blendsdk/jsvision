import {
  CodeEditor,
  CodeEditorWindow,
  classifyDocumentSize,
  classicCodeEditorTheme,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createLanguageScheduler,
  createDocumentModel,
  createInProcessLspSession,
  darkCodeEditorTheme,
  inspectInvisibleCharacters,
  lightCodeEditorTheme,
} from '@jsvision/code-editor';
import type {
  CodeEditorController,
  CodeEditorLanguageId,
  CodeEditorLspCoordinator,
  InProcessLspSession,
  LanguageAdapter,
} from '@jsvision/code-editor';
import { Button, Commands, Group, Text, View, at, signal } from '@jsvision/ui';
import type { Application, DispatchEvent, DrawContext, Signal } from '@jsvision/ui';
import type { ExampleContext } from '../../../examples/_contract.js';
import { demoApp } from '../../demo-shell.js';
import { Template1Dialog } from '../../template1-dialog.js';
import type { Template1DialogSize } from '../../template1-dialog.js';
import { createBoundedLargeDocument, HOSTILE_PROTOCOL_TEXT, sanitizeProtocolText } from './safety.js';

/** Stable identifiers accepted by the shared Code Editor laboratory builder. */
export type CodeEditorLabScenario =
  | 'quick-start'
  | 'document-controller'
  | 'external-changes'
  | 'editing-navigation'
  | 'readonly-clipboard'
  | 'language-gallery'
  | 'syntax-fallback'
  | 'invisibles-line-endings'
  | 'language-folding'
  | 'structural-folding'
  | 'search'
  | 'replace'
  | 'lsp-completion'
  | 'lsp-diagnostics'
  | 'lsp-navigation'
  | 'viewport-mouse'
  | 'large-document-tiers'
  | 'themes'
  | 'theme-fallback'
  | 'safe-terminal-text'
  | 'host-recovery';

/** Descriptive metadata for one focused Code Editor lab. */
export interface CodeEditorLabDefinition {
  /** Scenario controlling document, editor, and focused action behavior. */
  readonly scenario: CodeEditorLabScenario;
  /** Dialog title. */
  readonly title: string;
  /** One-line learning objective shown above the editor. */
  readonly objective: string;
}

/** Primitive state exposed to the visible inspector and specification runner. */
export type CodeEditorLabProbeValue = string | number | boolean;

/**
 * Non-painting controller that exposes public editor state and handles the documented Alt+R check.
 */
export class CodeEditorLabProbe extends View {
  override preProcess = true;
  override focusable = false;
  protected readonly values = new Map<string, CodeEditorLabProbeValue>();
  protected readonly readers = new Map<string, () => CodeEditorLabProbeValue>();
  protected readonly runCheck: () => void;

  /**
   * @param initial Initial observable state.
   * @param runCheck Focused scenario operation driven by the visible Run check control.
   */
  constructor(initial: Readonly<Record<string, CodeEditorLabProbeValue>>, runCheck: () => void) {
    super();
    for (const [name, value] of Object.entries(initial)) this.values.set(name, value);
    this.runCheck = runCheck;
  }

  /** Read one named target-owned value. */
  read(name: string): CodeEditorLabProbeValue | undefined {
    return this.readers.get(name)?.() ?? this.values.get(name);
  }

  /** Publish one value after its public operation completes. */
  set(name: string, value: CodeEditorLabProbeValue): void {
    this.values.set(name, value);
    this.invalidate();
  }

  /** Bind a value directly to a public target getter. */
  bindProbe(name: string, read: () => CodeEditorLabProbeValue): void {
    this.readers.set(name, read);
  }

  /** Intercept the lab-wide Run check accelerator before shell menus consume it. */
  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key' && event.event.alt && event.event.key.toLowerCase() === 'r') {
      this.runCheck();
      event.handled = true;
    }
  }

  /** The probe is intentionally invisible; sibling Text views render its state. */
  override draw(_context: DrawContext): void {}
}

interface LspLab {
  readonly session: InProcessLspSession;
  readonly coordinator: CodeEditorLspCoordinator;
}

interface QuickStartSurfaces {
  readonly direct: CodeEditor;
  readonly windowed: CodeEditorWindow;
}

/** Real host and analysis evidence shared by a focused laboratory action. */
interface CodeEditorLabEvidence {
  clipboardText: string;
  intelligenceKinds: number;
  invisibleWarnings: number;
  languageIndex: number;
  syntaxState: string;
  themeIndex: number;
  hostAuthorized: boolean;
  readonly hostEffects: string[];
}

const DIALOG_WIDTH = 72;
const DIALOG_HEIGHT = 20;
const CONTENT_WIDTH = 68;
const CONTENT_HEIGHT = 16;
const LANGUAGE_GALLERY: readonly CodeEditorLanguageId[] = ['plain', 'javascript', 'typescript', 'postgresql'];
const THEME_GALLERY = [classicCodeEditorTheme, darkCodeEditorTheme, lightCodeEditorTheme] as const;

/** Deterministic failing adapter used to demonstrate the scheduler's real degraded result. */
const failingLanguageAdapter: LanguageAdapter = Object.freeze({
  contractVersion: 1,
  id: 'docs-failing',
  extensions: [],
  syntax: async () => {
    throw new Error('docs-only adapter failure');
  },
});

/** Small deterministic source that remains readable at the compact example size. */
function sourceFor(scenario: CodeEditorLabScenario): string {
  if (scenario === 'readonly-clipboard') return 'SELECT current_user;\n-- selection and copy remain available\n';
  if (scenario === 'invisibles-line-endings') return 'const tab = "\\t";\r\nconst ending = "CRLF";\r\n';
  if (scenario.includes('folding')) {
    return 'export function outer(value: number) {\n  if (value > 0) {\n    return value;\n  }\n}\n';
  }
  if (scenario === 'search' || scenario === 'replace') {
    return 'const message = "first";\nconsole.log(message);\nconst nextMessage = message;\n';
  }
  if (scenario === 'safe-terminal-text') return 'const diagnostic = "inert source";\n';
  return 'interface User { name: string }\nconst message = "Hello, Ada";\nconsole.log(message);\n';
}

/** Initial language and mutability for one lesson. */
function documentOptions(scenario: CodeEditorLabScenario): {
  readonly languageId: CodeEditorLanguageId;
  readonly readOnly: boolean;
} {
  if (scenario === 'language-gallery') return { languageId: 'plain', readOnly: false };
  if (scenario === 'readonly-clipboard') return { languageId: 'postgresql', readOnly: true };
  return { languageId: 'typescript', readOnly: false };
}

/** Create a bounded in-process protocol seam only for lessons that need one. */
function createLspLab(
  scenario: CodeEditorLabScenario,
  document: ReturnType<typeof createDocumentModel>,
  evidence: CodeEditorLabEvidence,
): LspLab | undefined {
  const isLsp =
    scenario === 'lsp-completion' ||
    scenario === 'lsp-diagnostics' ||
    scenario === 'lsp-navigation' ||
    scenario === 'host-recovery';
  if (!isLsp) return undefined;
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      hover: true,
      signatureHelp: true,
      diagnostics: true,
      definition: true,
      documentSymbols: true,
      documentFormatting: true,
    },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: document.uri ?? `memory://docs/${scenario}`,
    languageId: document.languageId,
    limits: { completionItems: 4, diagnostics: 4, contentCharacters: 80 },
    host: async (effect) => {
      evidence.hostEffects.push(effect.kind);
      return true;
    },
  });
  return { session, coordinator };
}

/** Seed the exact requirement-owned state expected before the focused interaction. */
function initialProbeValues(scenario: CodeEditorLabScenario): Record<string, CodeEditorLabProbeValue> {
  const values: Record<string, CodeEditorLabProbeValue> = {
    scenario,
    'surface-kind': 'direct',
    'document-revision': 0,
    language: documentOptions(scenario).languageId,
    'read-only': documentOptions(scenario).readOnly,
    'selection-size': 0,
    'caret-offset': 0,
    'fold-count': 0,
    'invisible-warning-count': 0,
    'search-query': '',
    'service-state': scenario === 'host-recovery' ? 'failed' : scenario.startsWith('lsp-') ? 'idle' : 'plain',
    'diagnostic-count': 0,
    'completion-count': 0,
    'intelligence-kinds': 0,
    'syntax-state': 'idle',
    'host-effects': 'none',
    'large-tier': 'full',
    'theme-name': scenario === 'theme-fallback' ? 'custom-invalid' : 'classic',
    'theme-rejection-count': 0,
    'terminal-safe': true,
    'status-text': 'Ready · Alt+R runs the focused check',
  };
  return values;
}

/** Install real public-state readers while preserving scenario-owned service simulations. */
function bindPublicProbes(
  probe: CodeEditorLabProbe,
  scenario: CodeEditorLabScenario,
  controller: CodeEditorController,
  editor: CodeEditor,
  lsp: LspLab | undefined,
  evidence: CodeEditorLabEvidence,
): void {
  probe.bindProbe('document-revision', () => Number(controller.document.identity.revision));
  probe.bindProbe('language', () => controller.document.languageId);
  probe.bindProbe('read-only', () => controller.document.readOnly);
  probe.bindProbe('selection-size', () => controller.publicState.selectionSize);
  probe.bindProbe('caret-offset', () => Number(controller.document.selection.head));
  probe.bindProbe('fold-count', () => controller.retainedState.folds);
  probe.bindProbe('search-query', () => editor.searchState.query);
  probe.bindProbe('intelligence-kinds', () => evidence.intelligenceKinds);
  probe.bindProbe('invisible-warning-count', () => evidence.invisibleWarnings);
  probe.bindProbe('syntax-state', () => evidence.syntaxState);
  probe.bindProbe('theme-name', () => editor.themeInspection.fallbackSource);
  probe.bindProbe('theme-rejection-count', () => editor.themeInspection.rejected.length);
  if (scenario === 'readonly-clipboard') {
    probe.bindProbe('host-effects', () => (evidence.clipboardText === 'SELECT' ? 'copied selection' : 'none'));
  }
  if (scenario === 'host-recovery') {
    probe.bindProbe(
      'host-callback-state',
      () =>
        controller.degradation.snapshot().features.find((feature) => feature.feature === 'hostCallback')?.status ??
        'enabled',
    );
    probe.bindProbe('host-effects', () => evidence.hostEffects.join(', ') || 'none');
  }
  if (lsp !== undefined) {
    probe.bindProbe('diagnostic-count', () => lsp.coordinator.presentation.diagnostics.items.length);
    probe.bindProbe('completion-count', () => lsp.coordinator.presentation.completion?.items.length ?? 0);
    probe.bindProbe('service-state', () => lsp.coordinator.serviceState);
  }
}

/** Resolve one mounted view's application-relative origin for genuine mouse dispatch. */
function absoluteOrigin(view: View): { readonly x: number; readonly y: number } {
  let x = view.bounds.x;
  let y = view.bounds.y;
  let parent = view.parent;
  while (parent !== null) {
    x += parent.bounds.x;
    y += parent.bounds.y;
    parent = parent.parent;
  }
  return { x, y };
}

/** Run one focused public interaction and update only content-free teaching state. */
function runScenario(
  scenario: CodeEditorLabScenario,
  editor: CodeEditor,
  controller: CodeEditorController,
  probe: CodeEditorLabProbe,
  status: Signal<string>,
  quickStart: QuickStartSurfaces | undefined,
  lsp: LspLab | undefined,
  app: Application,
  evidence: CodeEditorLabEvidence,
): void {
  const finish = (message: string): void => {
    status.set(message);
    probe.set('status-text', message);
    editor.invalidate();
  };

  switch (scenario) {
    case 'quick-start':
      if (quickStart !== undefined) {
        quickStart.direct.state.visible = false;
        quickStart.windowed.state.visible = true;
        probe.set('surface-kind', 'windowed');
      }
      finish('window chrome · title, scrollbars, and status share the controller');
      return;
    case 'document-controller':
      controller.applyMutation({
        edits: [
          {
            range: { from: controller.document.text.length, to: controller.document.text.length },
            text: '// revision\n',
          },
        ],
        origin: 'typing',
      });
      finish(`revision ${Number(controller.document.identity.revision)} · one document transaction`);
      return;
    case 'external-changes':
      void controller
        .resolveExternalChange({
          text: `// externally reloaded\n${controller.document.text}`,
          decision: 'reload',
        })
        .then((outcome) => {
          probe.set('host-effects', `external-change ${outcome}`);
          finish(`${outcome} external change · save outcome: preserved LF`);
        });
      return;
    case 'editing-navigation':
      app.loop.focusView(editor);
      for (const character of 'export ') {
        app.loop.dispatch({
          type: 'key',
          key: character,
          codepoint: character.codePointAt(0),
          ctrl: false,
          alt: false,
          shift: false,
        });
      }
      app.loop.dispatch({ type: 'key', key: 'ArrowRight', ctrl: true, alt: false, shift: true });
      finish('edit + selection + navigation share one revision');
      return;
    case 'readonly-clipboard':
      controller.document.setSelection({ anchor: 0, head: 6 });
      app.loop.focusView(editor);
      app.loop.dispatch({ type: 'command', command: Commands.copy });
      finish('copied selection · read-only revision unchanged');
      return;
    case 'language-gallery':
      evidence.languageIndex = (evidence.languageIndex + 1) % LANGUAGE_GALLERY.length;
      {
        const languageId = LANGUAGE_GALLERY[evidence.languageIndex] ?? 'plain';
        const source =
          languageId === 'postgresql'
            ? 'SELECT current_user;\n'
            : languageId === 'plain'
              ? 'plain source\n'
              : 'export const typed = 42;\n';
        controller.document.replaceDocument({
          text: source,
          uri: 'memory://docs/language-gallery',
          languageId,
        });
        finish(`${languageId} adapter selected · ${evidence.languageIndex + 1}/4 · run again`);
      }
      return;
    case 'syntax-fallback': {
      const scheduler = createLanguageScheduler({ maxResults: 32, schedule: (work) => work() });
      void scheduler
        .analyze(failingLanguageAdapter, controller.document.text, controller.document.identity)
        .then((result) => {
          controller.setLanguageResult(result);
          evidence.syntaxState = result.state;
          if (result.state === 'degraded') {
            controller.document.replaceDocument({
              text: controller.document.text,
              uri: 'memory://docs/syntax-fallback',
              languageId: 'plain',
            });
          }
          finish(`${result.state} adapter · fallback to plain · invalid source preserved`);
        });
      return;
    }
    case 'invisibles-line-endings':
      evidence.invisibleWarnings = inspectInvisibleCharacters(controller.document.text).length;
      finish(`CRLF · ${evidence.invisibleWarnings} invisible characters inspected`);
      return;
    case 'language-folding':
    case 'structural-folding': {
      controller.setLanguageResult({
        syntax: [],
        folds: [{ from: 0, to: controller.document.text.length - 1 }],
        brackets: [],
        identity: controller.document.identity,
        adapterId: scenario === 'language-folding' ? 'typescript' : 'structural',
        generation: 1,
        state: 'ready',
      });
      controller.foldAll();
      finish(scenario === 'language-folding' ? 'language fold collapsed' : 'structural fold collapsed');
      return;
    }
    case 'search': {
      editor.execute('search.open');
      editor.setSearchQuery('message');
      editor.execute('search.next');
      finish('message · next match selected');
      return;
    }
    case 'replace': {
      const match = controller.document.search('first')[0];
      if (match !== undefined) {
        controller.applyMutation({
          edits: [{ range: { from: Number(match.from), to: Number(match.to) }, text: 'updated' }],
          origin: 'search',
        });
      }
      finish('replacement applied · revision advanced');
      return;
    }
    case 'lsp-completion': {
      const completion = lsp?.coordinator.requestCompletion({ line: 1, character: 5 });
      lsp?.session.respond(completion?.requestId, {
        items: [
          { label: 'message', insertText: 'message' },
          { label: 'map', insertText: 'map' },
        ],
      });
      const hover = lsp?.coordinator.requestHover({ line: 1, character: 5 }, { width: 40, height: 4 });
      lsp?.session.respond(hover?.requestId, { contents: { kind: 'markdown', value: '**message** value' } });
      const signature = lsp?.coordinator.requestSignature({ line: 1, character: 5 });
      lsp?.session.respond(signature?.requestId, {
        signatures: [{ label: 'log(message)', parameters: [{ label: 'message' }] }],
        activeSignature: 0,
        activeParameter: 0,
      });
      evidence.intelligenceKinds = [
        lsp?.coordinator.presentation.completion,
        lsp?.coordinator.presentation.hover,
        lsp?.coordinator.presentation.signature,
      ].filter((value) => value !== undefined).length;
      finish('completion + hover + signature bounded · service ready');
      return;
    }
    case 'lsp-diagnostics':
      lsp?.session.publishDiagnostics(
        controller.document.uri ?? 'memory://docs/lsp-diagnostics',
        Number(controller.document.identity.revision),
        [
          {
            range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
            severity: 1,
            message: sanitizeProtocolText(HOSTILE_PROTOCOL_TEXT),
          },
        ],
      );
      finish('1 diagnostic · terminal-safe overlay');
      return;
    case 'lsp-navigation': {
      const operation = lsp?.coordinator.requestDefinition({ line: 0, character: 1 });
      lsp?.session.respond(operation?.requestId, [
        {
          uri: controller.document.uri ?? 'file:///docs/lsp-navigation.ts',
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
        },
      ]);
      finish('definition revealed · formatting availability reported');
      return;
    }
    case 'viewport-mouse': {
      app.loop.resize({ width: 96, height: 30 });
      app.loop.renderRoot.flush();
      const origin = absoluteOrigin(editor);
      app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: origin.x + 4, y: origin.y + 2 });
      app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, x: origin.x + 12, y: origin.y + 3 });
      app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, x: origin.x + 12, y: origin.y + 3 });
      finish('viewport selection · resize keeps caret projection bounded');
      return;
    }
    case 'large-document-tiers': {
      const large = createBoundedLargeDocument(2_000);
      const classification = classifyDocumentSize({ bytes: 2_000_000, lines: large.split('\n').length });
      probe.set('large-tier', classification.mode);
      finish(`${classification.mode} · degraded work is explicit and bounded`);
      return;
    }
    case 'themes':
      evidence.themeIndex = (evidence.themeIndex + 1) % THEME_GALLERY.length;
      {
        const theme = THEME_GALLERY[evidence.themeIndex] ?? classicCodeEditorTheme;
        editor.setTheme(theme);
        finish(`${theme.name} theme · ${evidence.themeIndex + 1}/3 · run again`);
      }
      return;
    case 'theme-fallback':
      editor.setThemeSource({ kind: 'application', overrides: { surfaces: { editor: 'invalid' } } });
      app.loop.renderRoot.flush();
      finish('safe fallback retained · invalid override reported');
      return;
    case 'safe-terminal-text': {
      const safe = sanitizeProtocolText(HOSTILE_PROTOCOL_TEXT);
      probe.set(
        'terminal-safe',
        !/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u.test(safe) &&
          safe.length <= 80,
      );
      finish(safe);
      return;
    }
    case 'host-recovery':
      evidence.hostAuthorized = true;
      lsp?.session.reconnect();
      lsp?.session.markReady();
      void lsp?.coordinator.resynchronize();
      void controller.hostAction('navigate');
      controller.degradation.recover('hostCallback');
      finish('authorized recovery · failed work disposed before restart');
      return;
  }
}

/** Reflow the editor, action rail, inspector, and help while preserving the one-cell content inset. */
function reflowLab(
  size: Template1DialogSize,
  content: Group,
  editor: CodeEditor,
  windowed: CodeEditorWindow | undefined,
  buttons: readonly Button[],
  objective: Text,
  inspector: Text,
  instructions: Text,
): void {
  const width = size.width - 4;
  const height = size.height - 4;
  const actionWidth = 17;
  const editorWidth = Math.max(28, width - actionWidth - 2);
  const editorHeight = Math.max(6, height - 6);
  content.setLayout({ rect: { x: 1, y: 1, width, height } });
  objective.setLayout({ rect: { x: 0, y: 0, width, height: 2 } });
  editor.setLayout({ rect: { x: 0, y: 2, width: editorWidth, height: editorHeight } });
  editor.resizeViewport(editorWidth, editorHeight);
  if (windowed !== undefined) {
    windowed.setLayout({ rect: { x: 0, y: 2, width: editorWidth, height: editorHeight } });
    windowed.onResized();
  }
  buttons.forEach((button, index) => {
    button.setLayout({ rect: { x: editorWidth + 2, y: 2 + index * 3, width: actionWidth, height: 2 } });
  });
  inspector.setLayout({ rect: { x: 0, y: height - 3, width, height: 2 } });
  instructions.setLayout({ rect: { x: 0, y: height - 1, width, height: 1 } });
}

/**
 * Build one centered, responsive Classic-theme Code Editor laboratory.
 *
 * Every scenario owns a real public document/controller/editor surface. Focused controls change
 * only the capability being taught, while the inspector exposes content-free state.
 */
export function buildCodeEditorLab(ctx: ExampleContext, definition: CodeEditorLabDefinition): Application {
  const app = demoApp(ctx, { themeMenu: true });
  const options = documentOptions(definition.scenario);
  const usesProtocolUri = definition.scenario.startsWith('lsp-') || definition.scenario === 'host-recovery';
  const document = createDocumentModel({
    text: sourceFor(definition.scenario),
    uri: usesProtocolUri ? `file:///docs/${definition.scenario}.ts` : `memory://docs/${definition.scenario}`,
    languageId: options.languageId,
    readOnly: options.readOnly,
  });
  const evidence: CodeEditorLabEvidence = {
    clipboardText: '',
    intelligenceKinds: 0,
    invisibleWarnings: 0,
    languageIndex: 0,
    syntaxState: 'idle',
    themeIndex: 0,
    hostAuthorized: definition.scenario !== 'host-recovery',
    hostEffects: [],
  };
  const lsp = createLspLab(definition.scenario, document, evidence);
  const controller = createCodeEditorController({
    document,
    ...(lsp === undefined ? {} : { lsp: lsp.coordinator }),
    host: async (effect) => {
      const accepted = evidence.hostAuthorized;
      evidence.hostEffects.push(`${accepted ? 'authorized' : 'denied'} ${effect.kind}`);
      return accepted;
    },
  });
  if (definition.scenario === 'host-recovery') {
    controller.degradation.fail('hostCallback');
    const failedOperation = lsp?.coordinator.requestCompletion({ line: 0, character: 1 });
    lsp?.session.fail(failedOperation?.requestId, new Error('docs-only service failure'));
  }
  const editor = new CodeEditor({ controller, lineNumbers: true });
  app.loop.writeClipboardText = (text) => {
    evidence.clipboardText = text;
  };
  const status = signal('Ready · Alt+R runs the focused check');
  let quickStart: QuickStartSurfaces | undefined;
  const run = (): void =>
    runScenario(definition.scenario, editor, controller, probe, status, quickStart, lsp, app, evidence);
  const probe = new CodeEditorLabProbe(initialProbeValues(definition.scenario), run);
  bindPublicProbes(probe, definition.scenario, controller, editor, lsp, evidence);

  const content = new Group();
  const objective = new Text(definition.objective);
  content.add(at(objective, 0, 0, CONTENT_WIDTH, 2));
  content.add(at(probe, 0, 0, 0, 0));
  content.add(at(editor, 0, 2, 49, 10));

  if (definition.scenario === 'quick-start') {
    const windowed = new CodeEditorWindow({
      controller,
      title: 'main.ts',
      lineNumbers: true,
    });
    windowed.state.visible = false;
    content.add(at(windowed, 0, 2, 49, 10));
    quickStart = { direct: editor, windowed };
    probe.bindProbe('surface-kind', () => (windowed.state.visible ? 'windowed' : 'direct'));
    ctx.onCleanup?.(() => windowed.editor.dispose());
  }

  const runButton = new Button('~R~un check', { onClick: run });
  const focusButton = new Button('~F~ocus editor', { onClick: () => app.loop.focusView(editor) });
  const buttons = [runButton, focusButton];
  content.add(at(runButton, 51, 2, 17, 2));
  content.add(at(focusButton, 51, 5, 17, 2));
  const inspector = new Text(
    () =>
      `State: ${status()}\n` +
      `lang=${String(probe.read('language'))} rev=${String(probe.read('document-revision'))} ` +
      `selection=${String(probe.read('selection-size'))}`,
  );
  const instructions = new Text('Alt+R run · Alt+F focus · Ctrl+F search · resize/maximize/restore');
  content.add(at(inspector, 0, 13, CONTENT_WIDTH, 2));
  content.add(at(instructions, 0, 15, CONTENT_WIDTH, 1));

  const dialog = new Template1Dialog({
    title: ` ${definition.title} `,
    width: DIALOG_WIDTH,
    height: DIALOG_HEIGHT,
    startMaximized: true,
    onResize: (size) =>
      reflowLab(size, content, editor, quickStart?.windowed, buttons, objective, inspector, instructions),
  });
  dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
  app.desktop.addWindow(dialog);
  app.loop.focusView(editor);
  ctx.onCleanup?.(() => {
    void lsp?.coordinator.close();
    editor.dispose();
  });
  return app;
}
