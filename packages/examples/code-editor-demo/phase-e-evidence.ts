import type { CapabilityProfile } from '@jsvision/core';
import {
  CodeEditor,
  CodeEditorWindow,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
} from '@jsvision/code-editor';

import type { CodeEditorCapabilityInventoryEntry, CodeEditorDemoAction, CodeEditorDemoScenario } from './scenarios.js';
import { SharedSessionCodeEditorWindow } from './shared-session-window.js';

/** Content-free proof that one simulated protocol journey completed visibly. */
export interface CodeEditorProtocolEvidence {
  readonly journey: 'completion' | 'diagnostics' | 'navigation' | 'formatting' | 'cancellation';
  readonly outcome: 'responded' | 'published' | 'cancelled';
  readonly visible: true;
  readonly contentFree: true;
}

/** Content-free proof of one host-owned persistence decision. */
export interface CodeEditorHostDecisionEvidence {
  readonly decision: 'accepted' | 'rejected' | 'version-conflict';
  readonly visible: true;
  readonly contentFree: true;
}

/** Executable proof connecting a capability to a real demo interaction and observable. */
export interface CodeEditorCapabilityEvidence {
  readonly capabilityId: string;
  readonly trigger: 'control' | 'key' | 'native-window';
  readonly observable: 'frame' | 'public-state' | 'host-effect';
  readonly changed: true;
  readonly contentFree: true;
}

/** Per-document proof retained by the shared-session isolation journey. */
export interface CodeEditorDocumentIsolationEvidence {
  readonly uri: string;
  readonly revision: number;
  readonly selection: Readonly<{ anchor: number; head: number }>;
  readonly presentationScope: string;
  readonly cancellationScope: string;
  readonly diagnosticScope: string;
  readonly contentFree: true;
}

/** Aggregate invariants established by the shared-session isolation journey. */
export interface CodeEditorIsolationEvidence {
  readonly editorCount: 2;
  readonly sharedSession: true;
  readonly editorManager: false;
  readonly distinctUris: true;
  readonly distinctRevisions: true;
  readonly distinctSelections: true;
  readonly distinctPresentation: true;
  readonly distinctCancellation: true;
  readonly distinctDiagnostics: true;
  readonly distinctHostEffects: true;
}

/**
 * Runs protocol requests against the deterministic in-process session.
 *
 * Every evidence item describes only an outcome. Source text and protocol payloads stay inside the
 * disposable journey so the inspector can demonstrate behavior without becoming a content log.
 */
export async function collectProtocolEvidence(): Promise<{
  readonly protocol: readonly CodeEditorProtocolEvidence[];
  readonly hostEffects: readonly string[];
}> {
  const document = createDocumentModel({
    uri: 'file:///code-editor-demo/evidence/protocol.ts',
    languageId: 'typescript',
    text: 'const message = greet("terminal");\n',
  });
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      definition: true,
      documentFormatting: true,
    },
  });
  const hostEffects: string[] = [];
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: document.uri ?? 'untitled:///protocol.ts',
    languageId: document.languageId,
    host: async (effect) => {
      hostEffects.push(effect.kind);
      return true;
    },
  });
  const protocol: CodeEditorProtocolEvidence[] = [];

  try {
    await coordinator.open();
    const completion = coordinator.requestCompletion({ line: 0, character: 5 });
    session.respond(completion.requestId, [{ label: 'greet', insertText: 'greet(name)' }]);
    const completionResult = await completion.settled;
    if (completionResult.outcome === 'completed' && (coordinator.presentation.completion?.items.length ?? 0) > 0) {
      protocol.push(outcome('completion', 'responded'));
    }

    session.publishDiagnostics(document.uri ?? '', Number(document.identity.revision), [
      {
        range: { start: { line: 0, character: 6 }, end: { line: 0, character: 13 } },
        message: 'Simulated diagnostic',
        severity: 2,
      },
    ]);
    if (coordinator.presentation.diagnostics.items.length === 1) {
      protocol.push(outcome('diagnostics', 'published'));
    }

    const navigation = coordinator.requestDefinition({ line: 0, character: 1 });
    session.respond(navigation.requestId, {
      uri: 'file:///code-editor-demo/evidence/target.ts',
      range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } },
    });
    await navigation.settled;
    await Promise.resolve();
    if (hostEffects.includes('navigate')) protocol.push(outcome('navigation', 'responded'));

    const revisionBeforeFormatting = Number(document.identity.revision);
    const formatting = coordinator.formatDocument();
    session.respond(formatting.requestId, [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 0 },
        },
        newText: 'const message = greet("formatted");\n',
      },
    ]);
    const formattingResult = await formatting.settled;
    if (formattingResult.outcome === 'completed' && Number(document.identity.revision) > revisionBeforeFormatting) {
      protocol.push(outcome('formatting', 'responded'));
    }

    const cancellation = coordinator.requestHover({ line: 0, character: 1 });
    cancellation.cancel();
    const cancellationResult = await cancellation.settled;
    if (cancellationResult.outcome === 'cancelled' && coordinator.presentation.hover === undefined) {
      protocol.push(outcome('cancellation', 'cancelled'));
    }

    if (protocol.length !== 5) {
      throw new Error('The simulated protocol journey did not produce every visible bounded outcome.');
    }

    return Object.freeze({
      protocol: Object.freeze(protocol),
      hostEffects: Object.freeze(hostEffects),
    });
  } finally {
    await coordinator.close();
  }
}

/** Runs accepted, rejected, and stale-revision save decisions through real controllers. */
export async function collectHostDecisionEvidence(): Promise<readonly CodeEditorHostDecisionEvidence[]> {
  const evidence: CodeEditorHostDecisionEvidence[] = [];
  for (const decision of ['accepted', 'rejected', 'version-conflict'] as const) {
    const document = createDocumentModel({
      uri: `memory://code-editor-demo/host/${decision}.ts`,
      languageId: 'typescript',
      text: 'const saved = false;\n',
    });
    const controller = createCodeEditorController({
      document,
      host: async (effect) => {
        if (effect.kind !== 'save') return true;
        if (decision === 'rejected') return false;
        if (decision === 'version-conflict') {
          document.setSelection({ anchor: document.text.length, head: document.text.length });
          controller.replaceSelection('// concurrent edit\n');
        }
        return true;
      },
    });
    try {
      document.setSelection({ anchor: document.text.length, head: document.text.length });
      controller.replaceSelection('// pending save\n');
      const submittedRevision = Number(document.identity.revision);
      const accepted = await controller.hostAction('save');
      const visible =
        decision === 'accepted'
          ? accepted && !document.modified
          : decision === 'rejected'
            ? !accepted && document.modified
            : Number(document.identity.revision) > submittedRevision && document.modified;
      if (visible) evidence.push(Object.freeze({ decision, visible: true, contentFree: true }));
    } finally {
      controller.dispose();
    }
  }
  return Object.freeze(evidence);
}

/** Runs two document-scoped coordinators over one transport and verifies their state stays separate. */
export async function collectSharedSessionEvidence(): Promise<{
  readonly isolation: CodeEditorIsolationEvidence;
  readonly documents: readonly CodeEditorDocumentIsolationEvidence[];
}> {
  const session = createInProcessLspSession({
    capabilities: { hover: true, diagnostics: true, definition: true },
  });
  const first = await createIsolatedDocument('first', session);
  const second = await createIsolatedDocument('second', session);

  try {
    first.controller.replaceSelection('a');
    second.controller.replaceSelection('b');
    second.controller.replaceSelection('c');
    first.document.setSelection({ anchor: 0, head: 1 });
    second.document.setSelection({ anchor: 1, head: 2 });
    await Promise.all([first.coordinator.synchronize(), second.coordinator.synchronize()]);

    const firstHover = first.coordinator.requestHover({ line: 0, character: 0 });
    const secondHover = second.coordinator.requestHover({ line: 0, character: 1 });
    firstHover.cancel();
    session.respond(secondHover.requestId, { contents: 'second document' });
    const [firstHoverResult, secondHoverResult] = await Promise.all([firstHover.settled, secondHover.settled]);

    session.publishDiagnostics(first.uri, Number(first.document.identity.revision), [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        message: 'first diagnostic',
        severity: 2,
      },
    ]);
    session.publishDiagnostics(second.uri, Number(second.document.identity.revision), [
      {
        range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
        message: 'second diagnostic',
        severity: 3,
      },
    ]);

    await requestExternalNavigation(first, session, 'first-target.ts');
    await requestExternalNavigation(second, session, 'second-target.ts');
    const documents = Object.freeze([
      documentEvidence(first, firstHoverResult.outcome),
      documentEvidence(second, secondHoverResult.outcome),
    ]);
    const firstDiagnostics = first.coordinator.presentation.diagnostics.items;
    const secondDiagnostics = second.coordinator.presentation.diagnostics.items;
    const firstPresentation = first.coordinator.presentation.hover;
    const secondPresentation = second.coordinator.presentation.hover;
    const isolation = Object.freeze({
      editorCount: 2,
      sharedSession: true,
      editorManager: false,
      distinctUris: requireDistinct(documents, (entry) => entry.uri),
      distinctRevisions: requireDistinct(documents, (entry) => entry.revision),
      distinctSelections: requireDistinct(documents, (entry) => JSON.stringify(entry.selection)),
      distinctPresentation: requireTrue(
        firstPresentation === undefined &&
          secondPresentation !== undefined &&
          !JSON.stringify(secondPresentation).includes(first.uri),
      ),
      distinctCancellation: requireTrue(
        firstHoverResult.outcome === 'cancelled' && secondHoverResult.outcome === 'completed',
      ),
      distinctDiagnostics: requireTrue(
        firstDiagnostics.length === 1 &&
          secondDiagnostics.length === 1 &&
          firstDiagnostics[0]?.message === 'first diagnostic' &&
          secondDiagnostics[0]?.message === 'second diagnostic',
      ),
      distinctHostEffects: requireTrue(
        first.hostEffects.join(',') === 'first:navigate' && second.hostEffects.join(',') === 'second:navigate',
      ),
    }) satisfies CodeEditorIsolationEvidence;

    return Object.freeze({ isolation, documents });
  } finally {
    await Promise.all([first.coordinator.close(), second.coordinator.close()]);
    first.editor.dispose();
    second.editor.dispose();
  }
}

/**
 * Executes the interaction declared by every interactive capability owned by one scenario.
 *
 * Scenario selection is itself a reachable control: mounting it must paint a non-empty frame.
 * Action and native-window evidence additionally compare public state or geometry.
 */
export async function collectCapabilityEvidence(
  scenarioId: string,
  inventory: readonly CodeEditorCapabilityInventoryEntry[],
  scenarios: readonly CodeEditorDemoScenario[],
  capabilities: CapabilityProfile,
  runAction: (surface: CodeEditor | CodeEditorWindow, action: CodeEditorDemoAction) => Promise<void>,
  waitForSurface: (surface: CodeEditor | CodeEditorWindow) => Promise<void>,
  inspectSurface: (surface: CodeEditor | CodeEditorWindow) => { readonly hostEffects: readonly string[] },
  disposeSurface: (surface: CodeEditor | CodeEditorWindow) => Promise<void>,
): Promise<readonly CodeEditorCapabilityEvidence[]> {
  const evidence: CodeEditorCapabilityEvidence[] = [];
  const entries = inventory.filter(
    (entry) => entry.status === 'interactive' && entry.evidence?.scenarioId === scenarioId,
  );
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
  if (scenario === undefined || entries.length === 0) return Object.freeze(evidence);
  const surface = scenario.mount({ capabilities, width: 64, height: 12 });
  const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
  try {
    await waitForSurface(surface);
    for (const entry of entries) {
      if (entry.evidence === undefined) continue;
      let changed = false;
      let trigger: CodeEditorCapabilityEvidence['trigger'] = 'control';
      let observable: CodeEditorCapabilityEvidence['observable'] = 'frame';

      if (entry.evidence.interaction === 'action' && entry.evidence.action !== undefined) {
        const before = captureDeclaredObservable(
          entry.evidence.observable,
          editor,
          surface,
          inspectSurface(surface).hostEffects,
          capabilities,
        );
        await runAction(surface, entry.evidence.action);
        const after = captureDeclaredObservable(
          entry.evidence.observable,
          editor,
          surface,
          inspectSurface(surface).hostEffects,
          capabilities,
        );
        changed = capabilityActionObserved(entry.evidence.action, before, after);
        observable = entry.evidence.observable.startsWith('host') ? 'host-effect' : 'public-state';
      } else if (entry.evidence.interaction === 'native-window' && surface instanceof CodeEditorWindow) {
        trigger = 'native-window';
        const before = JSON.stringify(surface.layout.rect);
        const rect =
          entry.id === 'window.move'
            ? { x: 2, y: 1, width: 64, height: 12 }
            : entry.id === 'window.resize'
              ? { x: 2, y: 1, width: 48, height: 10 }
              : { x: 0, y: 0, width: 64, height: 12 };
        surface.setLayout({ rect });
        surface.onResized();
        changed = JSON.stringify(surface.layout.rect) !== before;
        observable = 'frame';
      } else {
        changed = staticCapabilityObserved(entry.id, editor, surface, capabilities);
      }

      if (changed) {
        evidence.push(
          Object.freeze({
            capabilityId: entry.id,
            trigger,
            observable,
            changed: true,
            contentFree: true,
          }),
        );
      }
    }
  } finally {
    await disposeSurface(surface);
  }
  return Object.freeze(evidence);
}

function outcome(
  journey: CodeEditorProtocolEvidence['journey'],
  result: CodeEditorProtocolEvidence['outcome'],
): CodeEditorProtocolEvidence {
  return Object.freeze({ journey, outcome: result, visible: true, contentFree: true });
}

async function createIsolatedDocument(
  name: string,
  session: ReturnType<typeof createInProcessLspSession>,
): Promise<{
  readonly uri: string;
  readonly document: ReturnType<typeof createDocumentModel>;
  readonly coordinator: ReturnType<typeof createCodeEditorLspCoordinator>;
  readonly controller: ReturnType<typeof createCodeEditorController>;
  readonly editor: CodeEditor;
  readonly hostEffects: string[];
}> {
  const uri = `file:///code-editor-demo/shared/${name}.ts`;
  const document = createDocumentModel({ uri, languageId: 'typescript', text: `const ${name} = 1;\n` });
  const hostEffects: string[] = [];
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri,
    languageId: document.languageId,
    host: async (effect) => {
      hostEffects.push(`${name}:${effect.kind}`);
      return true;
    },
  });
  const controller = createCodeEditorController({ document, lsp: coordinator });
  const editor = new CodeEditor({ controller });
  await coordinator.open();
  return { uri, document, coordinator, controller, editor, hostEffects };
}

async function requestExternalNavigation(
  target: Awaited<ReturnType<typeof createIsolatedDocument>>,
  session: ReturnType<typeof createInProcessLspSession>,
  filename: string,
): Promise<void> {
  const operation = target.coordinator.requestDefinition({ line: 0, character: 0 });
  session.respond(operation.requestId, {
    uri: `file:///code-editor-demo/shared/${filename}`,
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
  });
  await operation.settled;
  await Promise.resolve();
}

function documentEvidence(
  target: Awaited<ReturnType<typeof createIsolatedDocument>>,
  cancellationScope: string,
): CodeEditorDocumentIsolationEvidence {
  return Object.freeze({
    uri: target.uri,
    revision: Number(target.document.identity.revision),
    selection: Object.freeze({
      anchor: Number(target.document.selection.anchor),
      head: Number(target.document.selection.head),
    }),
    presentationScope: target.coordinator.presentation.hover === undefined ? 'empty' : 'present',
    cancellationScope,
    diagnosticScope: target.coordinator.presentation.diagnostics.items[0]?.severity ?? 'none',
    contentFree: true,
  });
}

function requireDistinct<T>(items: readonly T[], select: (item: T) => unknown): true {
  if (new Set(items.map(select)).size !== items.length) {
    throw new Error('The shared-session evidence did not preserve a document-owned scope.');
  }
  return true;
}

function requireTrue(value: boolean): true {
  if (!value) throw new Error('The shared-session evidence did not preserve peer exclusion.');
  return true;
}

/** Captures only the inventory-declared public observable for one capability. */
function captureDeclaredObservable(
  observable: string,
  editor: CodeEditor,
  surface: CodeEditor | CodeEditorWindow,
  hostEffects: readonly string[],
  capabilities: CapabilityProfile,
): string {
  const state = editor.controller.publicState;
  const assistance = editor.controller.presentation.assistance;
  if (observable === 'publicState.language') return state.language;
  if (observable === 'publicState.selection') return JSON.stringify(editor.controller.document.selection);
  if (observable === 'publicState.modified') return String(state.modified);
  if (observable === 'publicState.service') return state.serviceState;
  if (observable === 'document.revision') return String(editor.controller.document.identity.revision);
  if (observable === 'document.unicode') return String(editor.controller.document.text.includes('λ'));
  if (observable === 'replace.result') {
    return `${editor.controller.document.text.includes('demoReplacementApplied')}:${editor.controller.document.text.includes('demoReplaceToken')}`;
  }
  if (observable === 'document.selection') return JSON.stringify(editor.controller.document.selection);
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
  throw new Error('The capability inventory named an unsupported observable.');
}

/** Applies action-specific success semantics without consulting self-reported evidence booleans. */
function capabilityActionObserved(action: CodeEditorDemoAction, before: string, after: string): boolean {
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

/** Verifies static scenario-selection claims against their specific public surface. */
function staticCapabilityObserved(
  capabilityId: string,
  editor: CodeEditor,
  surface: CodeEditor | CodeEditorWindow,
  capabilities: CapabilityProfile,
): boolean {
  if (capabilityId === 'surface.direct-editor') return !(surface instanceof CodeEditorWindow);
  if (capabilityId === 'surface.windowed-editor') return surface instanceof CodeEditorWindow;
  if (capabilityId === 'gutter.line-numbers') {
    const firstRow = editor
      .project({ width: 32, height: 4, caps: capabilities })
      .cells[0]?.map((cell) => cell.text)
      .join('');
    return firstRow?.trimStart().startsWith('1') === true;
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
