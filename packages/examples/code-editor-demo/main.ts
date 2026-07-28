import { resolveCapabilities } from '@jsvision/core';
import { projectCodeEditor } from '@jsvision/code-editor';
import {
  CODE_EDITOR_CAPABILITY_INVENTORY,
  CODE_EDITOR_SCENARIOS,
  disposeCodeEditorScenario,
  runCodeEditorScenarioJourney,
  type CodeEditorDemoJourneyEvidence,
} from './scenarios.js';
import { createCodeEditorDemoSession } from './session.js';
import { createCodeEditorShowcase } from './shell.js';

const capabilities = resolveCapabilities({
  override: {
    mouse: { sgr: true, drag: true, wheel: true },
    unicode: { utf8: true },
  },
}).profile;

/** Prints a bounded frame without emitting source-owned terminal control bytes. */
function printFrame(title: string, rows: readonly (readonly { readonly text: string }[])[]): void {
  const width = rows[0]?.length ?? 0;
  process.stdout.write(`\n${title}\n+${'-'.repeat(width)}+\n`);
  for (const row of rows) process.stdout.write(`|${row.map((cell) => cell.text).join('')}|\n`);
  process.stdout.write(`+${'-'.repeat(width)}+\n`);
}

/** Runs the deterministic non-TTY walkthrough used by CI and redirected terminals. */
async function runHeadless(): Promise<void> {
  const session = createCodeEditorDemoSession({ capabilities, width: 64, height: 12 });
  session.start();
  const surface = session.surface;
  const editor = 'editor' in surface ? surface.editor : surface;
  const initial = projectCodeEditor({ controller: editor.controller, width: 64, height: 8, caps: capabilities });
  printFrame('Frame 1 — edit and local language state', initial.cells);
  session.interact({ kind: 'insert', text: '// demo edit\n' });
  session.interact({ kind: 'next-scenario' });
  session.resize({ width: 42, height: 10 });
  session.interact({ kind: 'next-scenario' });
  session.interact({ kind: 'next-scenario' });
  session.interact({ kind: 'next-scenario' });
  session.interact({ kind: 'next-scenario' });
  session.interact({ kind: 'reset' });
  session.exit();
  const journeys = new Map<string, CodeEditorDemoJourneyEvidence>();
  const journey = async (scenarioId: string): Promise<CodeEditorDemoJourneyEvidence> => {
    const retained = journeys.get(scenarioId);
    if (retained !== undefined) return retained;
    const completed = await runCodeEditorScenarioJourney(scenarioId);
    journeys.set(scenarioId, completed);
    return completed;
  };
  const language = await journey('language-gallery');
  const intelligence = await journey('language-intelligence');
  const shared = await journey('shared-session-editors');
  const hostile = await journey('safe-terminal-text');
  const large = await journey('large-document-tier');
  const confirmation = await journey('confirmation-document-tier');
  const interactiveCapabilities = CODE_EDITOR_CAPABILITY_INVENTORY.filter((entry) => entry.status === 'interactive');
  const capabilityIds = new Set<string>();
  const capabilityScenarioIds = new Set(interactiveCapabilities.flatMap((entry) => entry.scenarioIds));
  for (const scenarioId of capabilityScenarioIds) {
    const completed = await journey(scenarioId);
    for (const evidence of completed.capabilityEvidence) capabilityIds.add(evidence.capabilityId);
  }
  const keyboardScenario = CODE_EDITOR_SCENARIOS.find((scenario) => scenario.id === 'modern-keyboard-editing');
  const keyboardSurface = keyboardScenario?.mount({ capabilities, width: 64, height: 12 });
  const keyboardEditor =
    keyboardSurface === undefined ? undefined : 'editor' in keyboardSurface ? keyboardSurface.editor : keyboardSurface;
  const keyboardBefore = keyboardEditor?.controller.document.text;
  if (keyboardEditor !== undefined) {
    keyboardEditor.controller.document.setSelection({
      anchor: 0,
      head: keyboardEditor.controller.document.text.length,
    });
    keyboardEditor.routeKey({ key: 'Tab' });
  }
  const keyboardJourney = keyboardEditor !== undefined && keyboardEditor.controller.document.text !== keyboardBefore;
  if (keyboardSurface !== undefined) await disposeCodeEditorScenario(keyboardSurface);
  process.stdout.write(
    [
      `Frame 2 — local languages: syntax spans=${language.syntaxSpans} actions=${language.actions.join(',')}`,
      `Frame 3 — simulated intelligence: completion=${intelligence.completions} diagnostics=${intelligence.diagnostics} actions=${intelligence.actions.join(',')}`,
      `Frame 4 — degradation and recovery: ${intelligence.actions.filter((action) => action.includes('re')).join(',')}`,
      `Frame 5 — host authorization: effects=${intelligence.hostEffects.join(',')}`,
      `Frame 6 — safe hostile text: terminalSafe=${hostile.terminalSafe}`,
      `Frame 7 — document tiers: ${large.documentMode}/${confirmation.documentMode} confirmation=${confirmation.confirmationRequired}`,
      `Evidence — live requests=${intelligence.protocolEvidence.map((entry) => entry.journey).join(',')}`,
      `Evidence — host decisions=${intelligence.hostDecisionEvidence.map((entry) => entry.decision).join(',')}`,
      `Evidence — multi-editor isolation=${
        shared.isolation !== undefined &&
        shared.isolation.editorCount === 2 &&
        shared.isolation.sharedSession &&
        !shared.isolation.editorManager &&
        shared.isolation.distinctUris &&
        shared.isolation.distinctRevisions &&
        shared.isolation.distinctSelections &&
        shared.isolation.distinctPresentation &&
        shared.isolation.distinctCancellation &&
        shared.isolation.distinctDiagnostics &&
        shared.isolation.distinctHostEffects
      }`,
      `Evidence — capability journeys=${capabilityIds.size}/${interactiveCapabilities.length} complete`,
      `Evidence — keyboard journey=${keyboardJourney}`,
      `Scenarios: ${CODE_EDITOR_SCENARIOS.map((scenario) => scenario.id).join(', ')}`,
      `Narration: ${session.snapshot().narration.join(' -> ')}`,
      'Done — CodeEditor showcase exited cleanly with no external services.',
      '',
    ].join('\n'),
  );
}

if (process.stdout.isTTY === true && process.stdin.isTTY === true) {
  createCodeEditorShowcase(capabilities)
    .run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((_error: unknown) => {
      process.stderr.write('Code Editor showcase failed.\n');
      process.exitCode = 1;
    });
} else {
  runHeadless().catch((_error: unknown) => {
    process.stderr.write('Code Editor showcase failed.\n');
    process.exitCode = 1;
  });
}
