import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';

import { CodeEditorWindow, type CodeEditor } from '@jsvision/code-editor';

import {
  CODE_EDITOR_CAPABILITY_INVENTORY,
  CODE_EDITOR_SCENARIOS,
  disposeCodeEditorScenario,
  inspectCodeEditorScenario,
  runCodeEditorScenarioAction,
  runCodeEditorScenarioJourney,
  waitForCodeEditorScenario,
} from './scenarios.js';
import { SharedSessionCodeEditorWindow } from './shared-session-window.js';

const capabilities = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** LSP journeys that the standalone showcase advertises as executable evidence. */
const REQUIRED_LSP_JOURNEYS = Object.freeze(['completion', 'diagnostics', 'navigation', 'formatting', 'cancellation']);

/** Features deliberately excluded from the editor must remain discoverable as unsupported. */
const REQUIRED_DEFERRED_CAPABILITIES = Object.freeze([
  'navigation.page',
  'editing.word-deletion',
  'navigation.go-to-line',
  'indentation.structural-auto',
  'layout.word-wrap',
  'editing.multicaret',
  'lsp.rename',
  'lsp.code-actions',
  'lsp.semantic-tokens',
  'lsp.workspace-symbols',
  'lsp.mouse-hover',
  'window.minimize',
  'lsp.bundled-server',
]);

/** Implemented user-facing controls that must not disappear from the exhaustive inventory. */
const REQUIRED_IMPLEMENTED_CAPABILITIES = Object.freeze([
  'editing.replace',
  'lifecycle.close',
  'lifecycle.external-change',
  'lsp.hover',
  'lsp.signature',
  'lsp.symbols',
  'lsp.navigation-back',
  'lsp.snippet-traversal',
  'lsp.cancellation-and-recovery',
]);

/** Safely reads an own data property from future evidence without invoking accessors. */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

/** Reads a bounded array of record-shaped evidence values. */
function evidenceRecords(value: object, key: string): readonly object[] {
  const candidate = ownValue(value, key);
  if (!Array.isArray(candidate) || candidate.length > 256) return [];
  return candidate.filter((entry): entry is object => typeof entry === 'object' && entry !== null);
}

/** Reads a string field from a content-free evidence record. */
function evidenceString(value: object, key: string): string {
  const candidate = ownValue(value, key);
  return typeof candidate === 'string' ? candidate : '';
}

/** Reads a boolean field from a content-free evidence record. */
function evidenceBoolean(value: object, key: string): boolean {
  return ownValue(value, key) === true;
}

describe('deterministic live language-service evidence', () => {
  test('responds to every advertised LSP journey and exposes only content-free outcomes', async () => {
    // Completion, diagnostics, navigation, formatting, and cancellation must be real simulated
    // protocol journeys whose result is visible without echoing source text.
    const journey = await runCodeEditorScenarioJourney('language-intelligence');
    const protocol = evidenceRecords(journey, 'protocolEvidence');

    expect(protocol.map((entry) => evidenceString(entry, 'journey')).sort()).toEqual([...REQUIRED_LSP_JOURNEYS].sort());
    for (const entry of protocol) {
      expect(evidenceString(entry, 'outcome')).toMatch(/^(responded|published|cancelled)$/u);
      expect(evidenceBoolean(entry, 'visible')).toBe(true);
      expect(evidenceBoolean(entry, 'contentFree')).toBe(true);
      expect(ownValue(entry, 'text')).toBeUndefined();
    }
  });

  test('makes host acceptance, rejection, and version conflict visibly distinguishable', async () => {
    // Host-owned mutations need separate accept, reject, and stale-version controls so the demo
    // cannot imply that all requests succeed.
    const journey = await runCodeEditorScenarioJourney('language-intelligence');
    const decisions = evidenceRecords(journey, 'hostDecisionEvidence');

    expect(decisions.map((entry) => evidenceString(entry, 'decision')).sort()).toEqual([
      'accepted',
      'rejected',
      'version-conflict',
    ]);
    for (const decision of decisions) {
      expect(evidenceBoolean(decision, 'visible')).toBe(true);
      expect(evidenceBoolean(decision, 'contentFree')).toBe(true);
      expect(ownValue(decision, 'text')).toBeUndefined();
    }
  });
});

describe('shared-session editor isolation', () => {
  test('keeps every document-owned concern isolated without introducing an editor manager', async () => {
    // Multiple files mean two independent CodeEditor instances sharing transport only. Their
    // document, presentation, cancellation, diagnostics, and host scopes must never leak.
    const scenario = CODE_EDITOR_SCENARIOS.find((candidate) => candidate.id === 'shared-session-editors');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;

    const surface = scenario.mount({ capabilities, width: 80, height: 24 });
    expect(surface).toBeInstanceOf(SharedSessionCodeEditorWindow);
    if (!(surface instanceof SharedSessionCodeEditorWindow)) return;
    expect(surface.editor).not.toBe(surface.secondaryEditor);
    expect(surface.editor.controller).not.toBe(surface.secondaryEditor.controller);
    expect(surface.editor.controller.document.uri).not.toBe(surface.secondaryEditor.controller.document.uri);
    surface.editor.insertText('a');
    surface.secondaryEditor.insertText('b');
    surface.secondaryEditor.insertText('c');
    expect(surface.editor.controller.document.identity.revision).not.toBe(
      surface.secondaryEditor.controller.document.identity.revision,
    );
    expect(surface.editor.controller.document.text).not.toContain('bc');
    expect(surface.secondaryEditor.controller.document.text).not.toContain('a');

    const journey = await runCodeEditorScenarioJourney(scenario.id);
    expect(ownValue(journey, 'isolation')).toEqual({
      editorCount: 2,
      sharedSession: true,
      editorManager: false,
      distinctUris: true,
      distinctRevisions: true,
      distinctSelections: true,
      distinctPresentation: true,
      distinctCancellation: true,
      distinctDiagnostics: true,
      distinctHostEffects: true,
    });

    const documents = evidenceRecords(journey, 'documents');
    expect(documents).toHaveLength(2);
    for (const key of ['uri', 'revision', 'selection', 'presentationScope', 'cancellationScope', 'diagnosticScope']) {
      expect(new Set(documents.map((entry) => JSON.stringify(ownValue(entry, key)))).size, key).toBe(2);
    }
    expect(documents.every((entry) => evidenceBoolean(entry, 'contentFree'))).toBe(true);
    await disposeCodeEditorScenario(surface);
  });
});

describe('executable capability inventory', () => {
  test('backs every interactive entry with an executed visible transition', async () => {
    // An interactive label is truthful only when its scenario journey executes a control or key
    // and observes a changed frame, public state, or host effect.
    const interactive = CODE_EDITOR_CAPABILITY_INVENTORY.filter((entry) => entry.status === 'interactive');
    const scenarioIds = new Set(interactive.flatMap((entry) => entry.scenarioIds));
    const allEvidence: object[] = [];

    for (const scenarioId of scenarioIds) {
      const scenario = CODE_EDITOR_SCENARIOS.find((candidate) => candidate.id === scenarioId);
      expect(scenario, `missing scenario "${scenarioId}"`).toBeDefined();
      if (scenario === undefined) continue;
      const journey = await runCodeEditorScenarioJourney(scenarioId);
      allEvidence.push(...evidenceRecords(journey, 'capabilityEvidence'));
    }

    for (const entry of interactive) {
      const evidence = allEvidence.find((candidate) => evidenceString(candidate, 'capabilityId') === entry.id);
      expect(evidence, `${entry.id} has no executed capability evidence`).toBeDefined();
      if (evidence === undefined) continue;
      expect(evidenceString(evidence, 'trigger')).toMatch(/^(control|key|native-window)$/u);
      expect(evidenceString(evidence, 'observable')).toMatch(/^(frame|public-state|host-effect)$/u);
      expect(evidenceBoolean(evidence, 'changed')).toBe(true);
      expect(evidenceBoolean(evidence, 'contentFree')).toBe(true);

      const scenario = CODE_EDITOR_SCENARIOS.find((candidate) => candidate.id === entry.evidence?.scenarioId);
      expect(scenario).toBeDefined();
      if (scenario === undefined || entry.evidence === undefined) continue;
      const surface = scenario.mount({ capabilities, width: 64, height: 12 });
      try {
        await waitForCodeEditorScenario(surface);
        const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
        if (entry.evidence.interaction === 'action' && entry.evidence.action !== undefined) {
          const before = declaredObservable(
            entry.evidence.observable,
            editor,
            surface,
            inspectCodeEditorScenario(surface).hostEffects,
          );
          await runCodeEditorScenarioAction(surface, entry.evidence.action);
          const after = declaredObservable(
            entry.evidence.observable,
            editor,
            surface,
            inspectCodeEditorScenario(surface).hostEffects,
          );
          expect(actionObserved(entry.evidence.action, before, after), `${entry.id} was not observed`).toBe(true);
        } else if (entry.evidence.interaction === 'native-window') {
          expect(surface).toBeInstanceOf(CodeEditorWindow);
          if (surface instanceof CodeEditorWindow) {
            const before = JSON.stringify(surface.layout.rect);
            surface.setLayout({ rect: { x: 3, y: 2, width: 50, height: 11 } });
            surface.onResized();
            expect(JSON.stringify(surface.layout.rect)).not.toBe(before);
          }
        } else {
          expect(staticCapabilityObserved(entry.id, editor, surface), entry.id).toBe(true);
        }
      } finally {
        await disposeCodeEditorScenario(surface);
      }
    }
  });

  test('names profile-bound automation and every deferred behavior honestly', () => {
    // Unsafe live integrations and terminal-profile-owned behavior remain automated-only, while
    // explicitly deferred editor features remain named instead of silently disappearing.
    const byId = new Map(CODE_EDITOR_CAPABILITY_INVENTORY.map((entry) => [entry.id, entry]));
    for (const id of ['terminal.ascii', 'terminal.monochrome', 'lsp.external-process']) {
      expect(byId.get(id)).toMatchObject({ id, status: 'automated-only', scenarioIds: [] });
    }
    for (const id of REQUIRED_DEFERRED_CAPABILITIES) {
      expect(byId.get(id)).toMatchObject({ id, status: 'unsupported', scenarioIds: [] });
    }
    for (const id of REQUIRED_IMPLEMENTED_CAPABILITIES) {
      expect(byId.get(id)).toMatchObject({ id, status: 'interactive' });
    }
  });
});

/** Reads only the capability's declared public observable. */
function declaredObservable(
  observable: string,
  editor: CodeEditor,
  surface: CodeEditor | CodeEditorWindow,
  hostEffects: readonly string[],
): string {
  const state = editor.controller.publicState;
  const assistance = editor.controller.presentation.assistance;
  if (observable === 'publicState.language') return state.language;
  if (observable === 'publicState.selection' || observable === 'document.selection') {
    return JSON.stringify(editor.controller.document.selection);
  }
  if (observable === 'publicState.modified') return String(state.modified);
  if (observable === 'publicState.service') return state.serviceState;
  if (observable === 'document.revision') return String(editor.controller.document.identity.revision);
  if (observable === 'document.unicode') return String(editor.controller.document.text.includes('λ'));
  if (observable === 'replace.result') {
    return `${editor.controller.document.text.includes('demoReplacementApplied')}:${editor.controller.document.text.includes('demoReplaceToken')}`;
  }
  if (observable === 'language.syntax') return String(editor.controller.languageResult?.syntax.length ?? 0);
  if (observable === 'language.folds') return String(editor.controller.folds.length);
  if (observable === 'presentation.completion') return String(assistance.completion?.items.length ?? 0);
  if (observable === 'presentation.overlay') return assistance.overlay?.kind ?? 'none';
  if (observable === 'peer.revision') {
    return surface instanceof SharedSessionCodeEditorWindow
      ? String(surface.secondaryEditor.controller.document.identity.revision)
      : 'unavailable';
  }
  if (observable === 'theme.palette') {
    return JSON.stringify(
      editor
        .project({ width: 24, height: 4, caps: capabilities })
        .cells.flat()
        .map((cell) => cell.style),
    );
  }
  if (observable.startsWith('host.')) return JSON.stringify(hostEffects);
  throw new Error('The specification encountered an unsupported capability observable.');
}

function actionObserved(action: string, before: string, after: string): boolean {
  if (action === 'language-postgresql') return after === 'postgresql';
  if (action === 'language-javascript') return after === 'javascript';
  if (action === 'language-typescript') return after === 'typescript';
  if (action === 'language-plain') return after === 'plain';
  if (action === 'readonly-attempt') return after.includes('readonly-blocked');
  if (action === 'diagnostic-detail') return after.includes('diagnostic-detail');
  if (action === 'replace') return after === 'true:false';
  if (action === 'unicode') return after === 'true';
  if (action === 'cancel-recover') {
    return after.includes('request-cancelled') && after.includes('service-recovered');
  }
  return after !== before;
}

function staticCapabilityObserved(
  capabilityId: string,
  editor: CodeEditor,
  surface: CodeEditor | CodeEditorWindow,
): boolean {
  if (capabilityId === 'surface.direct-editor') return !(surface instanceof CodeEditorWindow);
  if (capabilityId === 'surface.windowed-editor') return surface instanceof CodeEditorWindow;
  if (capabilityId === 'gutter.line-numbers') {
    const row = editor
      .project({ width: 32, height: 4, caps: capabilities })
      .cells[0]?.map((cell) => cell.text)
      .join('');
    return row?.trimStart().startsWith('1') === true;
  }
  if (capabilityId === 'terminal.hostile-text') {
    return !editor
      .project({ width: 32, height: 6, caps: capabilities })
      .cells.flat()
      .some((cell) => /[\u001B\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(cell.text));
  }
  if (capabilityId === 'document.full-tier') return editor.controller.document.sizeMode === 'full';
  if (capabilityId === 'document.large-tier') return editor.controller.document.sizeMode === 'bounded';
  return false;
}
