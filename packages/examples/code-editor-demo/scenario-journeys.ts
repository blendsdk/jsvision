import { resolveCapabilities, type CapabilityProfile } from '@jsvision/core';
import {
  CodeEditor,
  classifyDocumentSize,
  createCodeEditorController,
  createDocumentModel,
  createCodeEditorLspCoordinator,
  createInProcessLspSession,
  createLanguageScheduler,
  type CodeEditorLanguageId,
} from '@jsvision/code-editor';
import { javascriptLanguageAdapter } from '@jsvision/code-editor/languages/javascript';
import { postgresqlLanguageAdapter } from '@jsvision/code-editor/languages/postgresql';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';

import {
  collectCapabilityEvidence,
  collectHostDecisionEvidence,
  collectProtocolEvidence,
  collectSharedSessionEvidence,
  type CodeEditorDocumentIsolationEvidence,
  type CodeEditorHostDecisionEvidence,
  type CodeEditorIsolationEvidence,
  type CodeEditorProtocolEvidence,
} from './phase-e-evidence.js';
import {
  CODE_EDITOR_CAPABILITY_INVENTORY,
  CODE_EDITOR_SCENARIOS,
  disposeCodeEditorScenario,
  inspectCodeEditorScenario,
  runCodeEditorScenarioAction,
  waitForCodeEditorScenario,
  type CodeEditorDemoJourneyEvidence,
} from './scenarios.js';

/**
 * Exercises the public boundaries behind one scenario and returns content-free evidence.
 *
 * The same journey powers the headless walkthrough and test suite, preventing catalog labels from
 * drifting away from the behavior a developer can actually execute.
 */
export async function runCodeEditorScenarioJourney(scenarioId: string): Promise<CodeEditorDemoJourneyEvidence> {
  const scenarioEntry = CODE_EDITOR_SCENARIOS.find((candidate) => candidate.id === scenarioId);
  if (scenarioEntry === undefined) throw new RangeError('Unknown Code Editor scenario.');
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
  let protocolEvidence: readonly CodeEditorProtocolEvidence[] = Object.freeze([]);
  let hostDecisionEvidence: readonly CodeEditorHostDecisionEvidence[] = Object.freeze([]);
  let isolation: CodeEditorIsolationEvidence | undefined;
  let documents: readonly CodeEditorDocumentIsolationEvidence[] | undefined;

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
    try {
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
    } finally {
      await coordinator.close();
    }
    actions.push('completion', 'diagnostics', 'reconnect', 'resynchronize');
    const protocol = await collectProtocolEvidence();
    protocolEvidence = protocol.protocol;
    hostEffects.push(...protocol.hostEffects);
    hostDecisionEvidence = await collectHostDecisionEvidence();
  }

  if (scenarioId === 'shared-session-editors') {
    const shared = await collectSharedSessionEvidence();
    isolation = shared.isolation;
    documents = shared.documents;
    actions.push('shared-session-isolation');
  }

  const controller = createCodeEditorController({
    document,
    host: async (effect) => {
      hostEffects.push(effect.kind);
      return true;
    },
  });
  let terminalSafe = true;
  let safetyEditor: CodeEditor | undefined;
  try {
    if (scenarioId === 'structural-folding' || scenarioId === 'postgresql-folding') {
      const adapter = adapterFor(fixture.languageId);
      if (adapter !== undefined) {
        const analyzed = await createLanguageScheduler().analyze(adapter, document.text, document.identity);
        controller.setLanguageResult(analyzed);
        const original = document.text;
        controller.foldAll();
        actions.push(`parser-folds-${fixture.languageId}`, 'collapse-all');
        controller.unfoldAll();
        if (document.text === original) actions.push('unfold-byte-identical');
      }
    }
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

    if (scenarioId === 'safe-terminal-text') {
      safetyEditor = new CodeEditor({ controller });
      terminalSafe = !safetyEditor
        .project({
          width: 40,
          height: 8,
          caps: resolveDemoCapabilities(),
        })
        .cells.flat()
        .some((cell) => cell.text === '\u001B' || cell.text === '\u0007');
    }
  } finally {
    if (safetyEditor === undefined) controller.dispose();
    else safetyEditor.dispose();
  }
  const requestedSize =
    scenarioId === 'confirmation-document-tier'
      ? { bytes: 10 * 1_048_576 + 1, lines: 1 }
      : scenarioId === 'large-document-tier'
        ? { bytes: fixture.text.length, lines: 50_002 }
        : { bytes: fixture.text.length, lines: Math.max(1, fixture.text.split('\n').length) };
  const classification = classifyDocumentSize(requestedSize);
  const capabilityEvidence = await collectCapabilityEvidence(
    scenarioId,
    CODE_EDITOR_CAPABILITY_INVENTORY,
    CODE_EDITOR_SCENARIOS,
    resolveDemoCapabilities(),
    runCodeEditorScenarioAction,
    waitForCodeEditorScenario,
    inspectCodeEditorScenario,
    disposeCodeEditorScenario,
  );
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
    protocolEvidence,
    hostDecisionEvidence,
    capabilityEvidence,
    ...(isolation === undefined ? {} : { isolation }),
    ...(documents === undefined ? {} : { documents }),
  });
}

function resolveDemoCapabilities(): CapabilityProfile {
  return resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
  }).profile;
}

/** Resolves the demo's built-in adapter while leaving plain text parser-free. */
function adapterFor(languageId: CodeEditorLanguageId) {
  if (languageId === 'postgresql') return postgresqlLanguageAdapter;
  if (languageId === 'javascript') return javascriptLanguageAdapter;
  if (languageId === 'typescript') return typescriptLanguageAdapter;
  return undefined;
}
