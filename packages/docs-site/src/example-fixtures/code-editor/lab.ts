import {
  CodeEditor,
  CodeEditorWindow,
  LanguageRegistry,
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
  offsetToPosition,
} from '@jsvision/code-editor';
import type {
  CodeEditorController,
  CodeEditorLanguageId,
  CodeEditorLspCoordinator,
  InProcessLspSession,
  LanguageAdapter,
} from '@jsvision/code-editor';
import { javascriptLanguageAdapter } from '@jsvision/code-editor/languages/javascript';
import { postgresqlLanguageAdapter } from '@jsvision/code-editor/languages/postgresql';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';
import { Button, Commands, Group, Text, View, at, signal } from '@jsvision/ui';
import type { Application, Signal } from '@jsvision/ui';
import type { ExampleContext } from '../../../examples/_contract.js';
import { demoApp } from '../../demo-shell.js';
import { Template1Dialog } from '../../template1-dialog.js';
import type { Template1DialogSize } from '../../template1-dialog.js';
import { codeEditorLesson, languageGallerySource } from './lessons.js';
import type { CodeEditorLesson, CodeEditorLessonScenario } from './lessons.js';
import { CodeEditorLabProbe } from './probe.js';
import type { CodeEditorLabProbeValue } from './probe.js';
import { createBoundedLargeDocument, HOSTILE_PROTOCOL_TEXT, sanitizeProtocolText } from './safety.js';

export { CodeEditorLabProbe } from './probe.js';
export type { CodeEditorLabProbeValue } from './probe.js';

/** Stable identifiers accepted by the shared Code Editor laboratory builder. */
export type CodeEditorLabScenario = CodeEditorLessonScenario;

/** Descriptive metadata for one focused Code Editor lab. */
export interface CodeEditorLabDefinition {
  /** Scenario controlling document, editor, and focused action behavior. */
  readonly scenario: CodeEditorLabScenario;
  /** Dialog title. */
  readonly title: string;
  /** One-line learning objective shown above the editor. */
  readonly objective: string;
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

/** Create a bounded in-process protocol seam only for lessons that need one. */
function createLspLab(
  scenario: CodeEditorLabScenario,
  document: ReturnType<typeof createDocumentModel>,
  evidence: CodeEditorLabEvidence,
): LspLab | undefined {
  const isLsp = scenario === 'lsp-navigation' || scenario === 'safe-terminal-text' || scenario === 'host-recovery';
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
function initialProbeValues(lesson: CodeEditorLesson): Record<string, CodeEditorLabProbeValue> {
  const { scenario } = lesson;
  const values: Record<string, CodeEditorLabProbeValue> = {
    scenario,
    'surface-kind': 'direct',
    'document-revision': 0,
    language: lesson.languageId,
    'read-only': lesson.readOnly,
    'selection-size': 0,
    'caret-offset': 0,
    'fold-count': 0,
    'invisible-warning-count': 0,
    'search-query': '',
    'service-state':
      scenario === 'host-recovery'
        ? 'failed'
        : scenario === 'lsp-navigation' || scenario === 'safe-terminal-text'
          ? 'idle'
          : 'plain',
    'diagnostic-count': 0,
    'completion-count': 0,
    'intelligence-kinds': 0,
    'syntax-state': 'idle',
    'host-effects': 'none',
    'large-tier': 'full',
    'theme-name': scenario === 'theme-fallback' ? 'custom-invalid' : 'classic',
    'theme-rejection-count': 0,
    'terminal-safe': true,
    'status-text': 'Ready',
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
  lesson: CodeEditorLesson,
  editor: CodeEditor,
  controller: CodeEditorController,
  probe: CodeEditorLabProbe,
  status: Signal<string>,
  quickStart: QuickStartSurfaces | undefined,
  lsp: LspLab | undefined,
  app: Application,
  evidence: CodeEditorLabEvidence,
  languageReady: Promise<void>,
  analyzeDocument: () => Promise<void>,
  hostRecoveryReady: Promise<void>,
  isCurrent: () => boolean,
): void {
  const { scenario } = lesson;
  const finish = (message: string): void => {
    if (!isCurrent()) return;
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
            text: '\n// Transaction committed by the document controller.\n',
          },
        ],
        origin: 'typing',
      });
      void analyzeDocument();
      finish(`revision ${Number(controller.document.identity.revision)} · one document transaction`);
      return;
    case 'external-changes':
      void controller
        .resolveExternalChange({
          text: `// externally reloaded\n${controller.document.text}`,
          decision: 'reload',
        })
        .then((outcome) => {
          if (!isCurrent()) return;
          probe.set('host-effects', `external-change ${outcome}`);
          void analyzeDocument();
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
    case 'readonly-clipboard': {
      const selectionStart = Math.max(0, controller.document.text.indexOf('SELECT'));
      controller.document.setSelection({ anchor: selectionStart, head: selectionStart + 'SELECT'.length });
      app.loop.focusView(editor);
      app.loop.dispatch({ type: 'command', command: Commands.copy });
      finish('copied selection · read-only revision unchanged');
      return;
    }
    case 'language-gallery':
      evidence.languageIndex = (evidence.languageIndex + 1) % LANGUAGE_GALLERY.length;
      {
        const languageId = LANGUAGE_GALLERY[evidence.languageIndex] ?? 'plain';
        controller.document.replaceDocument({
          text: languageGallerySource(languageId),
          uri: 'memory://docs/language-gallery',
          languageId,
        });
        void analyzeDocument();
        finish(`${languageId} adapter selected · ${evidence.languageIndex + 1}/4 · run again`);
      }
      return;
    case 'syntax-fallback': {
      const scheduler = createLanguageScheduler({ maxResults: 32, schedule: (work) => work() });
      void scheduler
        .analyze(failingLanguageAdapter, controller.document.text, controller.document.identity)
        .then((result) => {
          if (!isCurrent()) return;
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
    case 'invisibles-line-endings': {
      evidence.invisibleWarnings = inspectInvisibleCharacters(controller.document.text).length;
      const tab = Math.max(0, controller.document.text.indexOf('\t'));
      controller.document.setSelection({ anchor: tab, head: tab + 1 });
      finish(`CRLF · ${evidence.invisibleWarnings} invisible characters inspected`);
      return;
    }
    case 'structural-folding': {
      void languageReady.then(() => {
        if (!isCurrent()) return;
        const currentLanguageResult = controller.languageResult;
        const foldFrom = controller.document.text.indexOf('const componentTopics');
        const foldEnd = controller.document.text.indexOf('];', foldFrom);
        if (foldFrom < 0 || foldEnd < 0) {
          finish('structural range unavailable · reset the lesson source');
          return;
        }
        controller.setLanguageResult({
          syntax: currentLanguageResult?.syntax ?? [],
          folds: [{ from: foldFrom, to: foldEnd + 2 }],
          brackets: currentLanguageResult?.brackets ?? [],
          identity: controller.document.identity,
          adapterId: 'docs-structural',
          generation: (currentLanguageResult?.generation ?? 0) + 1,
          state: 'ready',
        });
        controller.foldAll();
        finish('structural fold collapsed · nested rows are hidden');
      });
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
        void analyzeDocument();
      }
      finish('replacement applied · revision advanced');
      return;
    }
    case 'lsp-navigation': {
      const referenceOffset = Math.max(0, controller.document.text.lastIndexOf('formatCustomer'));
      const definitionOffset = Math.max(0, controller.document.text.indexOf('formatCustomer'));
      const requestPosition = offsetToPosition(controller.document.snapshot, referenceOffset);
      const definitionStart = offsetToPosition(controller.document.snapshot, definitionOffset);
      const definitionEnd = offsetToPosition(controller.document.snapshot, definitionOffset + 'formatCustomer'.length);
      const operation = lsp?.coordinator.requestDefinition(requestPosition);
      lsp?.session.respond(operation?.requestId, [
        {
          uri: controller.document.uri ?? 'file:///docs/lsp-navigation.ts',
          range: { start: definitionStart, end: definitionEnd },
        },
      ]);
      controller.document.setSelection({
        anchor: definitionOffset,
        head: definitionOffset + 'formatCustomer'.length,
      });
      finish('definition revealed · same-document target selected');
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
      const large = createBoundedLargeDocument(120);
      controller.document.replaceDocument({
        text: large,
        uri: 'memory://docs/large-document-tiers',
        languageId: 'typescript',
      });
      void analyzeDocument();
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
      const target = Math.max(0, controller.document.text.indexOf('Untrusted protocol text'));
      const start = offsetToPosition(controller.document.snapshot, target);
      const end = offsetToPosition(controller.document.snapshot, target + 'Untrusted protocol text'.length);
      lsp?.session.publishDiagnostics(
        controller.document.uri ?? 'file:///docs/safe-terminal-text.ts',
        Number(controller.document.identity.revision),
        [{ range: { start, end }, severity: 1, message: safe }],
      );
      probe.set(
        'terminal-safe',
        !/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u.test(safe) &&
          safe.length <= 80,
      );
      finish('safe diagnostic shown · hostile controls stripped');
      return;
    }
    case 'host-recovery':
      void hostRecoveryReady.then(() => {
        if (!isCurrent()) return;
        evidence.hostAuthorized = true;
        lsp?.session.reconnect();
        lsp?.session.markReady();
        void lsp?.coordinator.resynchronize();
        void controller.hostAction('navigate');
        controller.degradation.recover('hostCallback');
        const recoveryOffset = Math.max(0, controller.document.text.indexOf('Reconnect service'));
        controller.document.setSelection({
          anchor: recoveryOffset,
          head: recoveryOffset + 'Reconnect service'.length,
        });
        finish('authorized recovery · failed work disposed before restart');
      });
      return;
  }
}

/** Reflow the editor and teaching rail while preserving template1's one-cell content inset. */
function reflowLab(
  size: Template1DialogSize,
  content: Group,
  editor: CodeEditor,
  windowed: CodeEditorWindow | undefined,
  instruction: Text,
  lesson: Text,
  action: Button,
  reset: Button,
  help: Text,
): void {
  const width = size.width - 4;
  const height = size.height - 4;
  const railWidth = Math.min(28, Math.max(26, Math.floor(width * 0.32)));
  const editorWidth = Math.max(36, width - railWidth - 2);
  const editorHeight = Math.max(10, height - 3);
  const railX = editorWidth + 2;
  const actionY = Math.max(9, height - 5);
  const resetY = Math.max(11, height - 3);
  const editorRect = { x: 0, y: 2, width: editorWidth, height: editorHeight };

  content.setLayout({ rect: { x: 1, y: 1, width, height } });
  instruction.setLayout({ rect: { x: 0, y: 0, width: editorWidth, height: 2 } });
  editor.setLayout({ rect: editorRect });
  // The UI layout pass intentionally skips hidden views. Keep the inactive quick-start surface's
  // cached bounds inside the restored dialog so switching surfaces never resurrects maximized
  // geometry or violates the padded content boundary.
  if (!editor.state.visible) editor.bounds = editorRect;
  editor.resizeViewport(editorWidth, editorHeight);
  if (windowed !== undefined) {
    windowed.setLayout({ rect: editorRect });
    if (!windowed.state.visible) windowed.bounds = editorRect;
    windowed.onResized();
  }
  lesson.setLayout({ rect: { x: railX, y: 0, width: railWidth, height: Math.max(7, actionY) } });
  action.setLayout({ rect: { x: railX, y: actionY, width: railWidth, height: 2 } });
  reset.setLayout({ rect: { x: railX, y: resetY, width: railWidth, height: 2 } });
  help.setLayout({ rect: { x: 0, y: height - 1, width, height: 1 } });
}

/**
 * Build one maximized, syntax-aware Code Editor teaching workbench.
 *
 * Every scenario owns distinct realistic source, one capability-specific action, and native
 * editor evidence. The shared teaching rail explains the result without pretending to be editor
 * chrome, and reset always restores the initial lesson document.
 */
export function buildCodeEditorLab(ctx: ExampleContext, definition: CodeEditorLabDefinition): Application {
  const app = demoApp(ctx, { themeMenu: true });
  const lessonDefinition = codeEditorLesson(definition.scenario);
  const usesProtocolUri =
    definition.scenario === 'lsp-navigation' ||
    definition.scenario === 'safe-terminal-text' ||
    definition.scenario === 'host-recovery';
  const document = createDocumentModel({
    text: lessonDefinition.source,
    uri: usesProtocolUri ? `file:///docs/${definition.scenario}.ts` : `memory://docs/${definition.scenario}`,
    languageId: lessonDefinition.languageId,
    readOnly: lessonDefinition.readOnly,
  });
  const evidence: CodeEditorLabEvidence = {
    clipboardText: '',
    intelligenceKinds: 0,
    invisibleWarnings: 0,
    languageIndex: 0,
    syntaxState: 'loading',
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

  const registry = new LanguageRegistry([
    javascriptLanguageAdapter,
    typescriptLanguageAdapter,
    postgresqlLanguageAdapter,
  ]);
  const scheduler = createLanguageScheduler({ maxResults: 10_000, schedule: (work) => work() });
  const languageAbort = new AbortController();
  let previousLanguageResult: Awaited<ReturnType<typeof scheduler.analyze>> | undefined;
  let disposed = false;
  let lessonGeneration = 0;
  let hostResetGeneration = 0;
  let hostRecoveryReady: Promise<void> = Promise.resolve();
  let languageReady: Promise<void> = Promise.resolve();
  const editor = new CodeEditor({
    controller,
    lineNumbers: true,
    onDocumentChange: () => {
      languageReady = analyzeCurrentDocument();
    },
  });
  app.loop.writeClipboardText = (text) => {
    evidence.clipboardText = text;
  };
  const status = signal('Ready');
  let quickStart: QuickStartSurfaces | undefined;
  let resetLesson = (): void => {};
  const run = (): void => {
    lessonGeneration += 1;
    const actionGeneration = lessonGeneration;
    runScenario(
      lessonDefinition,
      editor,
      controller,
      probe,
      status,
      quickStart,
      lsp,
      app,
      evidence,
      languageReady,
      analyzeCurrentDocument,
      hostRecoveryReady,
      () => !disposed && lessonGeneration === actionGeneration,
    );
  };
  const probe = new CodeEditorLabProbe(initialProbeValues(lessonDefinition), run, () => resetLesson());
  bindPublicProbes(probe, definition.scenario, controller, editor, lsp, evidence);

  function analyzeCurrentDocument(): Promise<void> {
    const adapter = registry.get(document.languageId);
    const compatiblePreviousResult =
      previousLanguageResult?.adapterId === adapter.id ? previousLanguageResult : undefined;
    const analysis = scheduler.analyze(adapter, document.text, document.identity, compatiblePreviousResult, {
      signal: languageAbort.signal,
    });
    return analysis.then((result) => {
      const currentIdentity = document.identity;
      if (
        disposed ||
        languageAbort.signal.aborted ||
        result.identity.lineage !== currentIdentity.lineage ||
        Number(result.identity.revision) !== Number(currentIdentity.revision)
      ) {
        return;
      }
      controller.setLanguageResult(result);
      previousLanguageResult = result;
      evidence.syntaxState = result.state;
      probe.set('syntax-state', result.state);
      editor.invalidate();
    });
  }
  languageReady = analyzeCurrentDocument();

  const content = new Group();
  const instruction = new Text(`Try: ${definition.objective}`);
  content.add(at(instruction, 0, 0, 44, 2));
  content.add(at(probe, 0, 0, 0, 0));
  content.add(at(editor, 0, 2, 44, 13));

  if (definition.scenario === 'quick-start') {
    const windowed = new CodeEditorWindow({
      controller,
      title: 'main.ts',
      lineNumbers: true,
    });
    windowed.state.visible = false;
    content.add(at(windowed, 0, 2, 44, 13));
    quickStart = { direct: editor, windowed };
    probe.bindProbe('surface-kind', () => (windowed.state.visible ? 'windowed' : 'direct'));
  }

  resetLesson = (): void => {
    lessonGeneration += 1;
    controller.dismissAssistance();
    controller.unfoldAll();
    editor.setSearchQuery('');
    editor.execute('search.dismiss');
    lsp?.session.publishDiagnostics(
      document.uri ?? `memory://docs/${definition.scenario}`,
      Number(document.identity.revision),
      [],
    );
    document.replaceDocument({
      text: lessonDefinition.source,
      uri: usesProtocolUri ? `file:///docs/${definition.scenario}.ts` : `memory://docs/${definition.scenario}`,
      languageId: lessonDefinition.languageId,
      readOnly: lessonDefinition.readOnly,
    });
    document.setSelection({ anchor: 0, head: 0 });
    editor.setTheme(classicCodeEditorTheme);
    if (quickStart !== undefined) {
      quickStart.direct.state.visible = true;
      quickStart.windowed.state.visible = false;
      probe.set('surface-kind', 'direct');
    }
    evidence.clipboardText = '';
    evidence.intelligenceKinds = 0;
    evidence.invisibleWarnings = 0;
    evidence.languageIndex = 0;
    evidence.syntaxState = 'loading';
    evidence.themeIndex = 0;
    evidence.hostAuthorized = definition.scenario !== 'host-recovery';
    evidence.hostEffects.length = 0;
    probe.set('host-effects', 'none');
    if (definition.scenario === 'host-recovery' && lsp !== undefined) {
      hostResetGeneration += 1;
      const resetGeneration = hostResetGeneration;
      controller.degradation.fail('hostCallback');
      lsp.session.reconnect();
      hostRecoveryReady = lsp.coordinator.resynchronize().then(() => {
        if (disposed || hostResetGeneration !== resetGeneration) return;
        const failedOperation = lsp.coordinator.requestCompletion({ line: 0, character: 1 });
        lsp.session.fail(failedOperation.requestId, new Error('docs-only service failure'));
      });
    }
    probe.set('large-tier', 'full');
    probe.set('terminal-safe', true);
    status.set('Ready');
    probe.set('status-text', 'Ready');
    languageReady = analyzeCurrentDocument();
    editor.invalidate();
  };

  const lesson = new Text(
    () => `${lessonDefinition.panelTitle}\n\n` + `Result: ${status()}\n\n` + `Look for: ${lessonDefinition.lookFor}`,
  );
  const action = new Button(lessonDefinition.actionLabel, { onClick: run });
  const reset = new Button('~C~lear & reset', { onClick: resetLesson });
  const help = new Text('Alt+R action · Alt+C reset · click to edit · F2 zoom');
  content.add(at(lesson, 46, 0, 22, 10));
  content.add(at(action, 46, 10, 22, 2));
  content.add(at(reset, 46, 13, 22, 2));
  content.add(at(help, 0, 15, CONTENT_WIDTH, 1));

  const dialog = new Template1Dialog({
    title: ` ${definition.title} `,
    width: DIALOG_WIDTH,
    height: DIALOG_HEIGHT,
    startMaximized: true,
    onResize: (size) =>
      reflowLab(size, content, editor, quickStart?.windowed, instruction, lesson, action, reset, help),
  });
  dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
  app.desktop.addWindow(dialog);
  app.loop.focusView(editor);
  const disposeWorkbench = (): void => {
    if (disposed) return;
    disposed = true;
    lessonGeneration += 1;
    hostResetGeneration += 1;
    languageAbort.abort();
    void lsp?.coordinator.close();
    quickStart?.windowed.editor.dispose();
    editor.dispose();
  };
  editor.onMount(() => editor.onCleanup(disposeWorkbench));
  ctx.onCleanup?.(disposeWorkbench);
  void languageReady;
  return app;
}
