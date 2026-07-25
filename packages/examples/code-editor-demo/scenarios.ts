import type { CapabilityProfile } from '@jsvision/core';
import { Commands } from '@jsvision/ui';
import {
  CodeEditor,
  CodeEditorWindow,
  createCodeEditorController,
  createDocumentModel,
  createCodeEditorLspCoordinator,
  createLanguageScheduler,
  darkCodeEditorTheme,
  lightCodeEditorTheme,
  type CodeEditorControllerPublicState,
  type CodeEditorLanguageId,
} from '@jsvision/code-editor';
import { javascriptLanguageAdapter } from '@jsvision/code-editor/languages/javascript';
import { postgresqlLanguageAdapter } from '@jsvision/code-editor/languages/postgresql';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';
import {
  type CodeEditorCapabilityEvidence,
  type CodeEditorDocumentIsolationEvidence,
  type CodeEditorHostDecisionEvidence,
  type CodeEditorIsolationEvidence,
  type CodeEditorProtocolEvidence,
} from './phase-e-evidence.js';
import { createCodeEditorScenarioCatalog } from './scenario-catalog.js';
import { actionsForCodeEditorScenario } from './scenario-actions.js';
import { CODE_EDITOR_CAPABILITY_INVENTORY } from './capability-inventory.js';
import { DemoLspSession } from './demo-lsp-session.js';
import { SharedSessionCodeEditorWindow, createSharedSessionScenarioMount } from './shared-session-window.js';
import { snapshotCodeEditorFixture } from './scenario-fixtures.js';
import { createBoundedDemoEventLog, type BoundedDemoEventLog } from './demo-event-log.js';

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
  readonly evidence?: {
    readonly scenarioId: string;
    readonly interaction: 'scenario-selection' | 'action' | 'native-window';
    readonly action?: CodeEditorDemoAction;
    readonly observable: string;
  };
}

/** Immutable source data used to restore a scenario without touching the filesystem. */
export interface CodeEditorDemoFixture {
  readonly text: string;
  readonly languageId: CodeEditorLanguageId;
  readonly readOnly?: boolean;
  readonly title: string;
  /** Declarative traits backed by this resettable fixture and its mounted public state. */
  readonly demonstrates?: readonly string[];
  /** Optional adapter-selection path used instead of directly taking `languageId`. */
  readonly languageSelection?: Readonly<{ explicitId?: string; filename?: string }>;
  /** Complete initial public state used to verify that a labeled fixture mounts truthfully. */
  readonly expectedPublicState?: CodeEditorControllerPublicState;
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
export type CodeEditorDemoAction =
  | 'edit'
  | 'select'
  | 'indent'
  | 'history'
  | 'clipboard'
  | 'readonly-attempt'
  | 'syntax-edit'
  | 'bracket-select'
  | 'peer-edit'
  | 'unicode'
  | 'search'
  | 'fold'
  | 'completion'
  | 'hover'
  | 'signature'
  | 'symbols'
  | 'diagnostic-detail'
  | 'snippet'
  | 'format'
  | 'replace'
  | 'save'
  | 'navigate'
  | 'navigation-back'
  | 'close'
  | 'external-change'
  | 'cancel-recover'
  | 'theme'
  | 'language'
  | 'language-postgresql'
  | 'language-javascript'
  | 'language-typescript'
  | 'language-plain'
  | 'host-accept'
  | 'host-reject'
  | 'host-conflict'
  | 'recover';

/** Content-free live state exposed by the showcase inspector. */
export interface CodeEditorDemoInspection {
  readonly scenarioId: string;
  readonly configuredFeatures: readonly string[];
  readonly hostEffects: readonly string[];
  readonly actions: readonly CodeEditorDemoAction[];
}

interface LiveCodeEditorDemoInspection {
  readonly scenarioId: string;
  readonly configuredFeatures: readonly string[];
  readonly hostEffects: BoundedDemoEventLog;
  readonly actions: readonly CodeEditorDemoAction[];
}

/** Lazy idempotent setup that cleanup can await without starting unused work. */
interface DemoReadiness {
  run(): Promise<void>;
  settleStarted(): Promise<void>;
}

const liveInspections = new WeakMap<CodeEditor | CodeEditorWindow, LiveCodeEditorDemoInspection>();
const liveReadiness = new WeakMap<CodeEditor | CodeEditorWindow, DemoReadiness>();
const liveCustomActions = new WeakMap<
  CodeEditor | CodeEditorWindow,
  ReadonlyMap<CodeEditorDemoAction, () => Promise<void>>
>();
const liveCleanup = new WeakMap<CodeEditor | CodeEditorWindow, () => Promise<void>>();

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
  readonly protocolEvidence: readonly CodeEditorProtocolEvidence[];
  readonly hostDecisionEvidence: readonly CodeEditorHostDecisionEvidence[];
  readonly capabilityEvidence: readonly CodeEditorCapabilityEvidence[];
  readonly isolation?: CodeEditorIsolationEvidence;
  readonly documents?: readonly CodeEditorDocumentIsolationEvidence[];
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
  let retainedFixture: CodeEditorDemoFixture | undefined;
  const fixture = (): CodeEditorDemoFixture => {
    retainedFixture ??= snapshotCodeEditorFixture(fixtureValue);
    return Object.freeze({
      ...retainedFixture,
      ...(retainedFixture.demonstrates === undefined
        ? {}
        : { demonstrates: Object.freeze([...retainedFixture.demonstrates]) }),
      ...(retainedFixture.languageSelection === undefined
        ? {}
        : { languageSelection: Object.freeze({ ...retainedFixture.languageSelection }) }),
    });
  };
  return Object.freeze({
    ...metadata,
    actions: actionsForCodeEditorScenario(metadata.id),
    fixture,
    mount: (context: CodeEditorDemoMountContext) => {
      const mountedFixture = fixture();
      if (metadata.id === 'shared-session-editors') {
        return registerSharedSessionScenario(metadata.id, mountedFixture, context);
      }
      const document = createDocumentModel({
        text: mountedFixture.text,
        languageId: mountedFixture.languageId,
        readOnly: mountedFixture.readOnly,
        uri: `memory://code-editor-demo/${metadata.id}`,
        confirmLargeDocument: () => true,
      });
      const hostEffects = createBoundedDemoEventLog();
      const configuredFeatures: string[] = ['document', 'selection', 'search', 'history', 'line-status'];
      let hostDecision: 'accepted' | 'rejected' | 'version-conflict' = 'accepted';
      let disposed = false;
      let session: DemoLspSession | undefined;
      let coordinator: ReturnType<typeof createCodeEditorLspCoordinator> | undefined;
      if (metadata.id === 'language-intelligence') {
        session = new DemoLspSession();
        coordinator = createCodeEditorLspCoordinator({
          document,
          session,
          uri: `file:///code-editor-demo/${metadata.id}.ts`,
          languageId: document.languageId,
          formatOnSave: true,
          host: async (effect) => {
            hostEffects.record(effect.kind);
            return hostDecision !== 'rejected';
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
          hostEffects.record(effect.kind);
          if (effect.kind === 'save') hostEffects.record(`decision:${hostDecision}`);
          if (effect.kind === 'save' && hostDecision === 'version-conflict') {
            document.setSelection({ anchor: document.text.length, head: document.text.length });
            controller.replaceSelection('// concurrent edit\n');
          }
          return hostDecision !== 'rejected';
        },
      });
      const scheduler = createLanguageScheduler();
      const analyzeCurrentDocument = (): Promise<void> => {
        if (
          metadata.id !== 'language-gallery' &&
          metadata.id !== 'typescript-window' &&
          metadata.id !== 'line-number-gutter' &&
          metadata.id !== 'themes-and-fallbacks' &&
          metadata.id !== 'structural-folding' &&
          metadata.id !== 'postgresql-folding'
        )
          return Promise.resolve();
        const adapter = adapterFor(document.languageId);
        if (adapter === undefined) {
          if (disposed) return Promise.resolve();
          controller.setLanguageResult(undefined);
          editor.invalidate();
          return Promise.resolve();
        }
        return scheduler.analyze(adapter, document.text, document.identity).then((result) => {
          if (disposed) return;
          controller.setLanguageResult(result);
          editor.invalidate();
        });
      };
      const onDocumentChange = mountedFixture.languageId === 'plain' ? undefined : analyzeCurrentDocument;
      const surface = windowed
        ? new CodeEditorWindow({
            controller,
            title: mountedFixture.title,
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
        metadata.id === 'structural-folding' ||
        metadata.id === 'postgresql-folding'
      ) {
        configuredFeatures.push('syntax', 'folds', 'brackets', 'language-switching');
      }
      if (metadata.id === 'structural-folding') {
        configuredFeatures.push('syntax', 'folds', 'brackets', 'fold-markers', 'visible-row-navigation');
      }
      if (metadata.id === 'postgresql-folding') {
        configuredFeatures.push('syntax', 'folds', 'brackets', 'fold-markers', 'postgresql-structure');
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
          actions: actionsForCodeEditorScenario(metadata.id),
        }),
      );
      const customActions = new Map<CodeEditorDemoAction, () => Promise<void>>();
      if (metadata.id === 'language-intelligence' && session !== undefined && coordinator !== undefined) {
        customActions.set('hover', async () => {
          editor.execute('hover');
          await editor.whenIdle();
        });
        customActions.set('signature', async () => {
          editor.routeKey({ key: '(', text: '(' });
          await Promise.resolve();
          await Promise.resolve();
          await editor.whenIdle();
        });
        customActions.set('symbols', async () => {
          editor.execute('symbols');
          await editor.whenIdle();
        });
        customActions.set('diagnostic-detail', async () => {
          document.setSelection({ anchor: document.text.length, head: document.text.length });
          await coordinator.synchronize();
          session.publishDiagnostic(`file:///code-editor-demo/${metadata.id}.ts`, Number(document.identity.revision));
          await Promise.resolve();
          if (controller.navigateDiagnostic(1)) hostEffects.record('diagnostic-detail');
          editor.invalidate();
        });
        customActions.set('snippet', async () => {
          editor.startSnippet([
            { from: 0, to: 5 },
            { from: 6, to: 13 },
          ]);
          editor.routeKey({ key: 'Tab' });
        });
        customActions.set('replace', async () => {
          document.setSelection({ anchor: document.text.length, head: document.text.length });
          editor.insertText('\ndemoReplaceToken');
          editor.execute('search.replaceOpen');
          editor.setSearchQuery('demoReplaceToken');
          editor.setReplacementText('demoReplacementApplied');
          editor.execute('search.replaceAll');
          await editor.whenIdle();
        });
        customActions.set('navigation-back', async () => {
          document.setSelection({ anchor: 5, head: 5 });
          const symbols = coordinator.requestDocumentSymbols();
          await symbols.settled;
          coordinator.chooseDocumentSymbol(0);
          coordinator.navigateBack();
          editor.invalidate();
        });
        customActions.set('close', async () => {
          await controller.requestClose();
          editor.invalidate();
        });
        customActions.set('external-change', async () => {
          await controller.resolveExternalChange({
            text: 'const message = greet(\"external\");\n',
            decision: 'compare',
          });
          editor.invalidate();
        });
        customActions.set('cancel-recover', async () => {
          const hover = coordinator.requestHover({ line: 0, character: 0 });
          hover.cancel();
          const outcome = await hover.settled;
          if (outcome.outcome === 'cancelled') hostEffects.record('request-cancelled');
          session.reconnect();
          await coordinator.resynchronize();
          if (coordinator.serviceState === 'ready') hostEffects.record('service-recovered');
          editor.invalidate();
        });
        for (const decision of ['accepted', 'rejected', 'version-conflict'] as const) {
          const action =
            decision === 'accepted' ? 'host-accept' : decision === 'rejected' ? 'host-reject' : 'host-conflict';
          customActions.set(action, async () => {
            hostDecision = decision;
            document.setSelection({ anchor: document.text.length, head: document.text.length });
            controller.replaceSelection(`// ${decision}\n`);
            await controller.hostAction('save');
            editor.invalidate();
          });
        }
      }
      if (metadata.id === 'language-gallery') {
        const languages = [
          { languageId: 'postgresql' as const, text: 'SELECT id\nFROM users;' },
          { languageId: 'javascript' as const, text: 'export const value = 1;' },
          { languageId: 'typescript' as const, text: 'export const value: number = 1;' },
          { languageId: 'plain' as const, text: 'plain terminal text' },
        ];
        let languageIndex = 0;
        const selectLanguage = async (nextIndex: number): Promise<void> => {
          languageIndex = nextIndex;
          const next = languages[nextIndex];
          if (next === undefined) return;
          document.replaceDocument({
            text: next.text,
            languageId: next.languageId,
            uri: `memory://code-editor-demo/${metadata.id}`,
            confirmLargeDocument: () => true,
          });
          await analyzeCurrentDocument();
          editor.resizeViewport(context.width, context.height);
          editor.invalidate();
        };
        customActions.set('language', async () => selectLanguage((languageIndex + 1) % languages.length));
        customActions.set('language-postgresql', async () => {
          if (document.languageId === 'postgresql') await selectLanguage(1);
          await selectLanguage(0);
        });
        customActions.set('language-javascript', async () => selectLanguage(1));
        customActions.set('language-typescript', async () => selectLanguage(2));
        customActions.set('language-plain', async () => selectLanguage(3));
        customActions.set('syntax-edit', async () => {
          await selectLanguage(2);
          editor.insertText('\nconst highlighted: boolean = true;');
          await analyzeCurrentDocument();
        });
      }
      liveCustomActions.set(surface, customActions);
      const readiness = createOnceAsync(async () => {
        await analyzeCurrentDocument();
        if (session === undefined || coordinator === undefined || disposed) return;
        await coordinator.open();
        if (disposed) return;
        session.publishDiagnostic(`file:///code-editor-demo/${metadata.id}.ts`, Number(document.identity.revision));
        editor.invalidate();
      });
      liveReadiness.set(surface, readiness);
      liveCleanup.set(surface, async () => {
        disposed = true;
        await readiness.settleStarted().catch(() => undefined);
        if (coordinator !== undefined) await coordinator.close();
        session?.dispose();
        editor.dispose();
        liveReadiness.delete(surface);
        liveCustomActions.delete(surface);
        liveInspections.delete(surface);
      });
      return surface;
    },
  });
}

/** Registers specialized shared-session resources with the common scenario lifecycle maps. */
function registerSharedSessionScenario(
  scenarioId: string,
  fixture: CodeEditorDemoFixture,
  context: CodeEditorDemoMountContext,
): SharedSessionCodeEditorWindow {
  const mounted = createSharedSessionScenarioMount(scenarioId, fixture, context);
  const surface = mounted.surface;
  const hostEffects: BoundedDemoEventLog = Object.freeze({
    record: () => undefined,
    snapshot: mounted.hostEffects,
  });
  liveInspections.set(
    surface,
    Object.freeze({
      scenarioId,
      configuredFeatures: Object.freeze([
        'two-editors',
        'shared-transport',
        'isolated-documents',
        'isolated-diagnostics',
        'isolated-host-effects',
      ]),
      hostEffects,
      actions: Object.freeze(['peer-edit'] as const),
    }),
  );
  liveCustomActions.set(surface, mounted.actions);
  const readiness = createOnceAsync(mounted.ready);
  liveReadiness.set(surface, readiness);
  liveCleanup.set(surface, async () => {
    await readiness.settleStarted().catch(() => undefined);
    await mounted.dispose();
    liveReadiness.delete(surface);
    liveCustomActions.delete(surface);
    liveInspections.delete(surface);
  });
  return surface;
}

/** Reads the content-free live configuration displayed by the showcase inspector. */
export function inspectCodeEditorScenario(surface: CodeEditor | CodeEditorWindow): CodeEditorDemoInspection {
  const inspection = liveInspections.get(surface);
  if (inspection === undefined) {
    return Object.freeze({ scenarioId: 'unknown', configuredFeatures: [], hostEffects: [], actions: [] });
  }
  return Object.freeze({
    scenarioId: inspection.scenarioId,
    configuredFeatures: inspection.configuredFeatures,
    hostEffects: inspection.hostEffects.snapshot(),
    actions: inspection.actions,
  });
}

/** Applies one advertised action through the active editor's public command boundary. */
export async function runCodeEditorScenarioAction(
  surface: CodeEditor | CodeEditorWindow,
  action: CodeEditorDemoAction,
): Promise<void> {
  if (!liveInspections.has(surface)) return;
  await liveReadiness.get(surface)?.run();
  const custom = liveCustomActions.get(surface)?.get(action);
  if (custom !== undefined) {
    await custom();
    return;
  }
  const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
  if (action === 'edit') editor.insertText('// live edit\n');
  else if (action === 'select') {
    editor.controller.document.setSelection({ anchor: 0, head: Math.min(8, editor.controller.document.text.length) });
    editor.invalidate();
  } else if (action === 'indent') {
    editor.controller.document.setSelection({ anchor: 0, head: editor.controller.document.text.length });
    editor.routeKey({ key: 'Tab' });
  } else if (action === 'history') {
    editor.insertText('x');
    editor.routeKey({ key: 'z', ctrl: true });
  } else if (action === 'clipboard') {
    editor.controller.document.setSelection({ anchor: 0, head: Math.min(5, editor.controller.document.text.length) });
    editor.onEvent({
      event: { type: 'command', command: Commands.cut },
      handled: false,
      setClipboard: () => undefined,
    });
  } else if (action === 'readonly-attempt') {
    if (!editor.insertText('blocked')) {
      const inspection = liveInspections.get(surface);
      inspection?.hostEffects.record('readonly-blocked');
    }
  } else if (action === 'syntax-edit') editor.insertText('const highlighted = true;\n');
  else if (action === 'unicode') editor.insertText('λ');
  else if (action === 'bracket-select') {
    const bracket = editor.controller.document.text.indexOf('{');
    if (bracket >= 0) editor.controller.document.setSelection({ anchor: bracket, head: bracket + 1 });
    editor.invalidate();
  } else if (action === 'search') {
    editor.setSearchQuery('const');
    editor.execute('search.next');
  } else if (action === 'fold') editor.execute('fold.toggle');
  else if (action === 'completion') editor.execute('assist');
  else if (action === 'format') editor.execute('format');
  else if (action === 'save' || action === 'navigate') editor.execute(action);
  else editor.setTheme(darkCodeEditorTheme);
  await editor.whenIdle();
}

/** Waits until parser and language-service setup for a mounted scenario has settled. */
export async function waitForCodeEditorScenario(surface: CodeEditor | CodeEditorWindow): Promise<void> {
  await liveReadiness.get(surface)?.run();
  const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
  await editor.whenIdle();
}

/** Releases every resource owned by a mounted showcase scenario. */
export async function disposeCodeEditorScenario(surface: CodeEditor | CodeEditorWindow): Promise<void> {
  const cleanup = liveCleanup.get(surface);
  if (cleanup !== undefined) {
    liveCleanup.delete(surface);
    await cleanup();
    return;
  }
  const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
  editor.dispose();
}

/** Ordered registry used by both the live application and headless verification. */
export const CODE_EDITOR_SCENARIOS: readonly CodeEditorDemoScenario[] = createCodeEditorScenarioCatalog(
  scenario,
  CODE_EDITOR_CAPABILITY_INVENTORY,
);

export { CODE_EDITOR_CAPABILITY_INVENTORY };

export { runCodeEditorScenarioJourney } from './scenario-journeys.js';

/** Resolves the demo's built-in adapter while leaving plain text parser-free. */
function adapterFor(languageId: CodeEditorLanguageId) {
  if (languageId === 'postgresql') return postgresqlLanguageAdapter;
  if (languageId === 'javascript') return javascriptLanguageAdapter;
  if (languageId === 'typescript') return typescriptLanguageAdapter;
  return undefined;
}

/** Converts asynchronous setup into an idempotent lazy operation. */
function createOnceAsync(operation: () => Promise<void>): DemoReadiness {
  let retained: Promise<void> | undefined;
  return Object.freeze({
    run() {
      retained ??= operation();
      return retained;
    },
    settleStarted() {
      return retained ?? Promise.resolve();
    },
  });
}
