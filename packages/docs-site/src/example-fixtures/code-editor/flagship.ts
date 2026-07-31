import {
  CodeEditor,
  LanguageRegistry,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  createLanguageScheduler,
  offsetToPosition,
} from '@jsvision/code-editor';
import type { CodeEditorController, CodeEditorLspCoordinator, InProcessLspSession } from '@jsvision/code-editor';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';
import { Button, Group, Text, at, signal } from '@jsvision/ui';
import type { Application, Signal } from '@jsvision/ui';
import type { ExampleContext } from '../../../examples/_contract.js';
import { demoApp } from '../../demo-shell.js';
import { Template1Dialog } from '../../template1-dialog.js';
import type { Template1DialogSize } from '../../template1-dialog.js';
import { CodeEditorLabProbe } from './lab.js';

/** Pilot scenarios that establish the flagship Code Editor teaching presentation. */
export type FlagshipCodeEditorScenario = 'lsp-completion' | 'lsp-diagnostics' | 'language-folding';

/** Descriptive content supplied by a focused flagship example module. */
export interface FlagshipCodeEditorDefinition {
  /** Capability-specific scenario implemented by the shared workbench. */
  readonly scenario: FlagshipCodeEditorScenario;
  /** Dialog title shown in the maximized template1 frame. */
  readonly title: string;
  /** Short instruction that tells the reader exactly what to try. */
  readonly instruction: string;
}

/** Scenario-specific source and teaching copy retained by one mounted workbench. */
interface FlagshipScenarioContent {
  /** Substantial bounded TypeScript source shown in the real editor. */
  readonly source: string;
  /** Capability-specific action button label, including its Alt+R accelerator. */
  readonly actionLabel: string;
  /** Side-panel heading. */
  readonly panelTitle: string;
  /** Visible cue the reader should inspect after running the action. */
  readonly lookFor: string;
  /** Caret offset that stages the source at the relevant expression or fold header. */
  readonly caretOffset: number;
}

/** Mutable teaching state shared by the action, result panel, and public test probe. */
interface FlagshipEvidence {
  intelligenceKinds: number;
  readonly result: Signal<string>;
  readonly detail: Signal<string>;
}

/** Optional bounded language-service seam used by completion and diagnostics lessons. */
interface FlagshipLsp {
  readonly session: InProcessLspSession;
  readonly coordinator: CodeEditorLspCoordinator;
}

const DIALOG_WIDTH = 72;
const DIALOG_HEIGHT = 20;
const CONTENT_WIDTH = 68;
const CONTENT_HEIGHT = 16;

const COMPLETION_SOURCE = `interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

const profiles: UserProfile[] = [
  {
    id: 'usr-1042',
    displayName: 'Ada Lovelace',
    email: 'ada@example.test',
    role: 'admin',
  },
];

function formatProfile(profile: UserProfile): string {
  const heading = \`Profile: \${profile.displayName}\`;
  profile.
  return heading;
}

for (const profile of profiles) {
  console.log(formatProfile(profile));
}
`;

const DIAGNOSTICS_SOURCE = `interface Invoice {
  number: string;
  customerId: string;
  total: number;
  paid: boolean;
}

const customerNames = new Map<string, string>([
  ['customer-1', 'Northwind'],
  ['customer-2', 'Contoso'],
]);

function describeInvoice(invoice: Invoice): string {
  const customer = customerNames.get(invoice.customerIdd);
  const state = invoice.paid ? 'paid' : 'open';
  const amount = invoice.total.toFixed(2);

  return \`\${invoice.number} · \${customer} · \${amount} · \${state}\`;
}

const invoice: Invoice = {
  number: 'INV-2048',
  customerId: 'customer-1',
  total: 1840.5,
  paid: false,
};

console.log(describeInvoice(invoice));
`;

const FOLDING_SOURCE = `interface Release {
  version: string;
  channel: 'stable' | 'preview';
  features: readonly string[];
}

function summarizeRelease(release: Release): string {
  const heading = \`\${release.version} [\${release.channel}]\`;
  const features = release.features
    .map((feature, index) => \`  \${index + 1}. \${feature}\`)
    .join('\\n');

  if (features.length === 0) {
    return \`\${heading}\\n  No visible changes\`;
  }

  return \`\${heading}\\n\${features}\`;
}

const nextRelease: Release = {
  version: '1.4.0',
  channel: 'preview',
  features: [
    'Syntax-aware examples',
    'Responsive editor workspaces',
    'Visible language intelligence',
  ],
};

console.log(summarizeRelease(nextRelease));
`;

/** Return the complete bounded source and visible teaching copy for one pilot. */
function scenarioContent(scenario: FlagshipCodeEditorScenario): FlagshipScenarioContent {
  if (scenario === 'lsp-completion') {
    return {
      source: COMPLETION_SOURCE,
      actionLabel: '~R~equest suggestions',
      panelTitle: 'SMART COMPLETION',
      lookFor: 'A real suggestion popup plus bounded hover and signature evidence.',
      caretOffset: COMPLETION_SOURCE.indexOf('profile.\n') + 'profile.'.length,
    };
  }
  if (scenario === 'lsp-diagnostics') {
    return {
      source: DIAGNOSTICS_SOURCE,
      actionLabel: '~R~eveal diagnostics',
      panelTitle: 'DIAGNOSTICS',
      lookFor: 'The error marker beside customerIdd and a safe, readable explanation.',
      caretOffset: DIAGNOSTICS_SOURCE.indexOf('customerIdd') + 'customerIdd'.length,
    };
  }
  return {
    source: FOLDING_SOURCE,
    actionLabel: 'Fold ~r~egion',
    panelTitle: 'CODE FOLDING',
    lookFor: 'Fold arrows in the gutter and a shorter, easier-to-scan document.',
    caretOffset: FOLDING_SOURCE.indexOf('function summarizeRelease'),
  };
}

/** Create the in-process protocol seam only for lessons that actually use language services. */
function createFlagshipLsp(
  scenario: FlagshipCodeEditorScenario,
  document: ReturnType<typeof createDocumentModel>,
): FlagshipLsp | undefined {
  if (scenario === 'language-folding') return undefined;
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      hover: true,
      signatureHelp: true,
      diagnostics: true,
    },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: document.uri ?? `file:///docs/${scenario}.ts`,
    languageId: 'typescript',
    limits: { completionItems: 6, diagnostics: 4, contentCharacters: 120 },
  });
  return { session, coordinator };
}

/** Seed the probe values required by the existing objective contracts and the new teaching panel. */
function initialProbeValues(scenario: FlagshipCodeEditorScenario): Record<string, string | number | boolean> {
  return {
    scenario,
    language: 'typescript',
    'document-revision': 0,
    'selection-size': 0,
    'caret-offset': 0,
    'fold-count': 0,
    'completion-count': 0,
    'diagnostic-count': 0,
    'intelligence-kinds': 0,
    'service-state': scenario === 'language-folding' ? 'plain' : 'ready',
    'syntax-state': 'loading',
    'terminal-safe': true,
    'status-text': 'Ready',
  };
}

/** Install direct readers for public controller and protocol state. */
function bindFlagshipProbes(
  probe: CodeEditorLabProbe,
  controller: CodeEditorController,
  lsp: FlagshipLsp | undefined,
  evidence: FlagshipEvidence,
): void {
  probe.bindProbe('language', () => controller.document.languageId);
  probe.bindProbe('document-revision', () => Number(controller.document.identity.revision));
  probe.bindProbe('selection-size', () => controller.publicState.selectionSize);
  probe.bindProbe('caret-offset', () => Number(controller.document.selection.head));
  probe.bindProbe('fold-count', () => controller.retainedState.folds);
  probe.bindProbe('intelligence-kinds', () => evidence.intelligenceKinds);
  if (lsp !== undefined) {
    probe.bindProbe('completion-count', () => lsp.coordinator.presentation.completion?.items.length ?? 0);
    probe.bindProbe('diagnostic-count', () => lsp.coordinator.presentation.diagnostics.items.length);
    probe.bindProbe('service-state', () => lsp.coordinator.serviceState);
    probe.bindProbe('request-line', () => {
      const position = requestPosition(lsp.session, 'textDocument/completion');
      return typeof position?.line === 'number' ? position.line : -1;
    });
    probe.bindProbe('request-character', () => {
      const position = requestPosition(lsp.session, 'textDocument/completion');
      return typeof position?.character === 'number' ? position.character : -1;
    });
  }
}

/** Read the position recorded by the real in-process protocol session without trusting unknown payload shapes. */
function requestPosition(session: InProcessLspSession, method: string): Readonly<Record<string, unknown>> | undefined {
  for (let index = session.requests.length - 1; index >= 0; index -= 1) {
    const request = session.requests[index];
    if (request?.method !== method) continue;
    const position = request.params.position;
    return typeof position === 'object' && position !== null
      ? (position as Readonly<Record<string, unknown>>)
      : undefined;
  }
  return undefined;
}

/** Convert the authoritative document selection into the zero-based UTF-16 coordinates used by LSP. */
function caretProtocolPosition(controller: CodeEditorController): {
  readonly line: number;
  readonly character: number;
} {
  const position = offsetToPosition(controller.document.snapshot, Number(controller.document.selection.head));
  return { line: Number(position.line), character: Number(position.character) };
}

/** Run the focused public capability and update the human-readable result panel. */
function runFlagshipScenario(
  scenario: FlagshipCodeEditorScenario,
  controller: CodeEditorController,
  editor: CodeEditor,
  probe: CodeEditorLabProbe,
  evidence: FlagshipEvidence,
  lsp: FlagshipLsp | undefined,
  languageReady: Promise<void>,
  mayApplyDeferredAction: () => boolean,
): void {
  if (scenario === 'lsp-completion') {
    const position = caretProtocolPosition(controller);
    const completion = lsp?.coordinator.requestCompletion(position);
    lsp?.session.respond(completion?.requestId, {
      items: [
        { label: 'displayName', detail: 'UserProfile.displayName', insertText: 'displayName' },
        { label: 'email', detail: 'UserProfile.email', insertText: 'email' },
        { label: 'role', detail: 'UserProfile.role', insertText: 'role' },
      ],
    });
    const hover = lsp?.coordinator.requestHover(position, { width: 36, height: 5 });
    lsp?.session.respond(hover?.requestId, {
      contents: { kind: 'plaintext', value: 'profile: UserProfile' },
    });
    const signature = lsp?.coordinator.requestSignature(position);
    lsp?.session.respond(signature?.requestId, {
      signatures: [{ label: 'formatProfile(profile: UserProfile): string' }],
      activeSignature: 0,
      activeParameter: 0,
    });
    evidence.intelligenceKinds = 3;
    evidence.result.set('Suggestions ready');
    evidence.detail.set('3 bounded items\nHover: UserProfile\nSignature: formatProfile(…)');
    probe.set('status-text', 'completion + hover + signature bounded · service ready');
    editor.invalidate();
    return;
  }

  if (scenario === 'lsp-diagnostics') {
    const diagnosticStart = controller.document.text.indexOf('customerIdd');
    if (diagnosticStart < 0) {
      evidence.result.set('Diagnostic target changed');
      evidence.detail.set('Reset the lesson to restore the intentional customerIdd typo.');
      probe.set('status-text', 'diagnostic target unavailable');
      editor.invalidate();
      return;
    }
    const start = offsetToPosition(controller.document.snapshot, diagnosticStart);
    const end = offsetToPosition(controller.document.snapshot, diagnosticStart + 'customerIdd'.length);
    lsp?.session.publishDiagnostics(
      controller.document.uri ?? 'file:///docs/lsp-diagnostics.ts',
      Number(controller.document.identity.revision),
      [
        {
          range: {
            start: { line: Number(start.line), character: Number(start.character) },
            end: { line: Number(end.line), character: Number(end.character) },
          },
          severity: 1,
          message: "Property 'customerIdd' does not exist on type 'Invoice'. Did you mean 'customerId'?",
        },
      ],
    );
    evidence.result.set('Diagnostic revealed');
    evidence.detail.set('ERROR · line 14\nUnknown property: customerIdd\nSuggestion: customerId');
    probe.set('status-text', '1 diagnostic · terminal-safe overlay');
    editor.invalidate();
    return;
  }

  void languageReady.then(() => {
    if (!mayApplyDeferredAction()) return;
    controller.foldAll();
    editor.scroll.y.set(0);
    const count = controller.folds.length;
    evidence.result.set('Folded regions');
    evidence.detail.set(`${count} validated regions collapsed\nSource text remains unchanged`);
    probe.set('status-text', 'language fold collapsed');
    editor.invalidate();
  });
}

/** Restore the focused lesson without rebuilding or replacing its authoritative document. */
function resetFlagshipScenario(
  scenario: FlagshipCodeEditorScenario,
  content: FlagshipScenarioContent,
  controller: CodeEditorController,
  editor: CodeEditor,
  probe: CodeEditorLabProbe,
  evidence: FlagshipEvidence,
  lsp: FlagshipLsp | undefined,
): void {
  if (scenario === 'lsp-completion') {
    lsp?.coordinator.dismissTransientAssistance();
    controller.dismissAssistance();
    evidence.intelligenceKinds = 0;
  } else if (scenario === 'lsp-diagnostics') {
    lsp?.session.publishDiagnostics(
      controller.document.uri ?? 'file:///docs/lsp-diagnostics.ts',
      Number(controller.document.identity.revision),
      [],
    );
  } else {
    controller.unfoldAll();
  }
  controller.document.setSelection({ anchor: content.caretOffset, head: content.caretOffset });
  evidence.result.set('Ready');
  evidence.detail.set('Use the highlighted source and the focused action below.');
  probe.set('status-text', 'Ready');
  editor.invalidate();
}

/** Reflow the editor and teaching rail while retaining template1's one-cell content padding. */
function reflowFlagship(
  size: Template1DialogSize,
  content: Group,
  editor: CodeEditor,
  instruction: Text,
  lesson: Text,
  action: Button,
  reset: Button,
  help: Text,
): void {
  const width = size.width - 4;
  const height = size.height - 4;
  const railWidth = Math.min(24, Math.max(20, Math.floor(width * 0.3)));
  const editorWidth = Math.max(36, width - railWidth - 2);
  const editorHeight = Math.max(10, height - 3);
  const railX = editorWidth + 2;
  const actionY = Math.max(8, height - 6);
  const resetY = Math.max(11, height - 3);

  content.setLayout({ rect: { x: 1, y: 1, width, height } });
  instruction.setLayout({ rect: { x: 0, y: 0, width, height: 2 } });
  editor.setLayout({ rect: { x: 0, y: 2, width: editorWidth, height: editorHeight } });
  editor.resizeViewport(editorWidth, editorHeight);
  lesson.setLayout({ rect: { x: railX, y: 2, width: railWidth, height: Math.max(5, actionY - 2) } });
  action.setLayout({ rect: { x: railX, y: actionY, width: railWidth, height: 2 } });
  reset.setLayout({ rect: { x: railX, y: resetY, width: railWidth, height: 2 } });
  help.setLayout({ rect: { x: 0, y: height - 1, width, height: 1 } });
}

/**
 * Build one maximized, syntax-aware flagship Code Editor teaching workbench.
 *
 * The editor uses the shipped TypeScript adapter and public controller/LSP APIs. The adjacent rail
 * explains what the reader should notice without disguising docs-only teaching copy as native
 * editor chrome.
 */
export function buildFlagshipCodeEditorLab(ctx: ExampleContext, definition: FlagshipCodeEditorDefinition): Application {
  const app = demoApp(ctx, { themeMenu: true });
  const contentDefinition = scenarioContent(definition.scenario);
  const document = createDocumentModel({
    text: contentDefinition.source,
    uri: `file:///docs/${definition.scenario}.ts`,
    languageId: 'typescript',
  });
  document.setSelection({ anchor: contentDefinition.caretOffset, head: contentDefinition.caretOffset });
  const lsp = createFlagshipLsp(definition.scenario, document);
  const controller = createCodeEditorController({
    document,
    ...(lsp === undefined ? {} : { lsp: lsp.coordinator }),
  });
  const evidence: FlagshipEvidence = {
    intelligenceKinds: 0,
    result: signal('Ready'),
    detail: signal('Use the highlighted source and the focused action below.'),
  };

  let languageReady: Promise<void> = Promise.resolve();
  const registry = new LanguageRegistry([typescriptLanguageAdapter]);
  const scheduler = createLanguageScheduler({ maxResults: 10_000, schedule: (work) => work() });
  const languageAbort = new AbortController();
  let previousLanguageResult: Awaited<ReturnType<typeof scheduler.analyze>> | undefined;
  let disposed = false;
  let lessonGeneration = 0;
  const editor = new CodeEditor({
    controller,
    lineNumbers: true,
    onDocumentChange: () => {
      languageReady = analyzeCurrentDocument();
    },
  });
  const run = (): void => {
    lessonGeneration += 1;
    const actionGeneration = lessonGeneration;
    runFlagshipScenario(
      definition.scenario,
      controller,
      editor,
      probe,
      evidence,
      lsp,
      languageReady,
      () => !disposed && lessonGeneration === actionGeneration,
    );
  };
  const probe = new CodeEditorLabProbe(initialProbeValues(definition.scenario), run);
  bindFlagshipProbes(probe, controller, lsp, evidence);

  function analyzeCurrentDocument(): Promise<void> {
    const analysis = scheduler.analyze(
      registry.get('typescript'),
      document.text,
      document.identity,
      previousLanguageResult,
      { signal: languageAbort.signal },
    );
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
      const appliedResult = controller.languageResult;
      if (
        appliedResult === undefined ||
        appliedResult.identity.lineage !== result.identity.lineage ||
        Number(appliedResult.identity.revision) !== Number(result.identity.revision)
      ) {
        return;
      }
      previousLanguageResult = result;
      probe.set('syntax-state', result.state);
      if (result.state !== 'ready') {
        evidence.result.set('Syntax unavailable');
        evidence.detail.set('The source remains editable using safe plain presentation.');
      }
      editor.invalidate();
    });
  }
  languageReady = analyzeCurrentDocument();
  const disposeWorkbench = (): void => {
    if (disposed) return;
    disposed = true;
    lessonGeneration += 1;
    languageAbort.abort();
    void lsp?.coordinator.close();
    editor.dispose();
  };
  editor.onMount(() => editor.onCleanup(disposeWorkbench));
  ctx.onCleanup?.(disposeWorkbench);

  const resetLesson = (): void => {
    lessonGeneration += 1;
    resetFlagshipScenario(definition.scenario, contentDefinition, controller, editor, probe, evidence, lsp);
  };
  const instruction = new Text(`Try: ${definition.instruction}`);
  const lesson = new Text(
    () =>
      `${contentDefinition.panelTitle}\n\n` +
      `Result: ${evidence.result()}\n${evidence.detail()}\n\n` +
      `Look for: ${contentDefinition.lookFor}`,
  );
  const action = new Button(contentDefinition.actionLabel, { onClick: run });
  const reset = new Button('~C~lear & reset', { onClick: resetLesson });
  const help = new Text('Alt+R action · Alt+C reset · click source to edit · F2 maximize/restore');
  const content = new Group();
  content.add(at(probe, 0, 0, 0, 0));
  content.add(at(instruction, 0, 0, CONTENT_WIDTH, 2));
  content.add(at(editor, 0, 2, 44, 13));
  content.add(at(lesson, 46, 2, 22, 8));
  content.add(at(action, 46, 10, 22, 2));
  content.add(at(reset, 46, 13, 22, 2));
  content.add(at(help, 0, 15, CONTENT_WIDTH, 1));

  const dialog = new Template1Dialog({
    title: ` ${definition.title} `,
    width: DIALOG_WIDTH,
    height: DIALOG_HEIGHT,
    startMaximized: true,
    onResize: (size) => reflowFlagship(size, content, editor, instruction, lesson, action, reset, help),
  });
  dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
  app.desktop.addWindow(dialog);
  app.loop.focusView(editor);
  return app;
}
