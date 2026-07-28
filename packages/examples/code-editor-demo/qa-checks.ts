import { CodeEditor, CodeEditorWindow } from '@jsvision/code-editor';

import {
  inspectCodeEditorScenario,
  runCodeEditorScenarioAction,
  type CodeEditorDemoAction,
  type CodeEditorQaGuide,
} from './scenarios.js';

/** Lifecycle state shown beside one manually invokable QA check. */
export type CodeEditorQaCheckStatus = 'ready' | 'running' | 'passed' | 'failed' | 'not-applicable';

/** Content-free outcome shown to a tester after invoking the scenario's primary check. */
export interface CodeEditorQaCheckResult {
  readonly status: CodeEditorQaCheckStatus;
  readonly action?: CodeEditorDemoAction;
  readonly observed: string;
}

/** Creates the initial result shown whenever a scenario is selected or reset. */
export function readyCodeEditorQaResult(guide: CodeEditorQaGuide | undefined): CodeEditorQaCheckResult {
  if (guide === undefined) return Object.freeze({ status: 'not-applicable', observed: 'Use the editor normally.' });
  return Object.freeze({ status: 'ready', action: guide.action, observed: 'Press F5 to run this check.' });
}

/**
 * Runs one scenario's primary control and evaluates its public, content-free outcome.
 *
 * The result is intentionally derived from editor presentation, document revision, or bounded
 * host events. A resolved promise alone is not considered a passing QA check.
 */
export async function runCodeEditorQaCheck(
  surface: CodeEditor | CodeEditorWindow,
  guide: CodeEditorQaGuide,
): Promise<CodeEditorQaCheckResult> {
  const editor = surface instanceof CodeEditorWindow ? surface.editor : surface;
  const beforeRevision = Number(editor.controller.document.identity.revision);
  try {
    await runCodeEditorScenarioAction(surface, guide.action);
  } catch {
    return Object.freeze({ status: 'failed', action: guide.action, observed: 'The check raised a safe error.' });
  }

  const inspection = inspectCodeEditorScenario(surface);
  const assistance = editor.controller.presentation.assistance;
  const effects = inspection.hostEffects;
  const afterRevision = Number(editor.controller.document.identity.revision);
  const evaluation = evaluateQaOutcome(guide.action, {
    completionLabels: assistance.completion?.items.map((item) => item.label) ?? [],
    overlayKind: assistance.overlay?.kind,
    effects,
    beforeRevision,
    afterRevision,
    modified: editor.controller.publicState.modified,
  });
  return Object.freeze({
    status: evaluation.passed ? 'passed' : 'failed',
    action: guide.action,
    observed: evaluation.observed,
  });
}

interface QaOutcomeSnapshot {
  readonly completionLabels: readonly string[];
  readonly overlayKind?: string;
  readonly effects: readonly string[];
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly modified: boolean;
}

/** Evaluates only the stable public signal named by each dedicated QA scenario. */
function evaluateQaOutcome(
  action: CodeEditorDemoAction,
  snapshot: QaOutcomeSnapshot,
): { readonly passed: boolean; readonly observed: string } {
  if (action === 'completion') {
    const labels = snapshot.completionLabels.slice(0, 3).join(', ') || 'none';
    return { passed: snapshot.completionLabels.includes('greet'), observed: `completion items: ${labels}` };
  }
  if (action === 'hover') return overlayOutcome(snapshot, 'hover');
  if (action === 'signature') return overlayOutcome(snapshot, 'signature');
  if (action === 'symbols') return overlayOutcome(snapshot, 'symbols');
  if (action === 'format') {
    return {
      passed: snapshot.afterRevision > snapshot.beforeRevision && snapshot.modified,
      observed: `revision ${snapshot.beforeRevision}->${snapshot.afterRevision}; modified=${snapshot.modified}`,
    };
  }
  if (action === 'navigate') return effectOutcome(snapshot.effects, 'navigate');
  if (action === 'diagnostic-detail') return effectOutcome(snapshot.effects, 'diagnostic-detail');
  if (action === 'cancel-recover') {
    const passed = snapshot.effects.includes('request-cancelled') && snapshot.effects.includes('service-recovered');
    return {
      passed,
      observed: passed ? 'request-cancelled; service-recovered' : 'cancellation/recovery evidence missing',
    };
  }
  if (action === 'host-accept') return effectOutcome(snapshot.effects, 'decision:accepted');
  if (action === 'host-reject') return effectOutcome(snapshot.effects, 'decision:rejected');
  if (action === 'host-conflict') return effectOutcome(snapshot.effects, 'decision:version-conflict');
  return { passed: false, observed: 'No QA oracle is registered for this action.' };
}

/** Checks one assistance overlay without exposing its possibly source-derived contents. */
function overlayOutcome(
  snapshot: QaOutcomeSnapshot,
  expected: string,
): { readonly passed: boolean; readonly observed: string } {
  const actual = snapshot.overlayKind ?? 'none';
  return { passed: actual === expected, observed: `overlay: ${actual}` };
}

/** Checks one allowlisted host event and reports only its fixed event name. */
function effectOutcome(
  effects: readonly string[],
  expected: string,
): { readonly passed: boolean; readonly observed: string } {
  const passed = effects.includes(expected);
  return { passed, observed: passed ? `host: ${expected}` : `host event missing: ${expected}` };
}
