import { resolveCapabilities } from '@jsvision/core';
import { projectCodeEditor } from '@jsvision/code-editor';
import { CODE_EDITOR_SCENARIOS, runCodeEditorScenarioJourney } from './scenarios.js';
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
  const language = await runCodeEditorScenarioJourney('language-gallery');
  const intelligence = await runCodeEditorScenarioJourney('language-intelligence');
  const hostile = await runCodeEditorScenarioJourney('safe-terminal-text');
  const large = await runCodeEditorScenarioJourney('large-document-tier');
  const confirmation = await runCodeEditorScenarioJourney('confirmation-document-tier');
  process.stdout.write(
    [
      `Frame 2 — local languages: syntax spans=${language.syntaxSpans} actions=${language.actions.join(',')}`,
      `Frame 3 — simulated intelligence: completion=${intelligence.completions} diagnostics=${intelligence.diagnostics} actions=${intelligence.actions.join(',')}`,
      `Frame 4 — degradation and recovery: ${intelligence.actions.filter((action) => action.includes('re')).join(',')}`,
      `Frame 5 — host authorization: effects=${intelligence.hostEffects.join(',')}`,
      `Frame 6 — safe hostile text: terminalSafe=${hostile.terminalSafe}`,
      `Frame 7 — document tiers: ${large.documentMode}/${confirmation.documentMode} confirmation=${confirmation.confirmationRequired}`,
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
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
} else {
  runHeadless().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
