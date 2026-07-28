import { perfBudgetMode } from '../../core/bench/frame-bench.mjs';

/**
 * Whether CodeEditor wall-clock limits are authoritative in the current process.
 *
 * Ordinary CI and Turbo verification share machines with unrelated work, so they retain functional
 * assertions and report timings without treating scheduler contention as a product regression. The
 * dedicated serial performance command sets the marker that makes the original limits authoritative.
 */
export function enforceCodeEditorPerformanceBudgets(): boolean {
  return perfBudgetMode(process.env) === 'assert';
}

/**
 * Reports one informational timing when the current process is not an authoritative performance run.
 *
 * @param label Stable description of the measured operation.
 * @param measuredMs Observed duration in milliseconds.
 * @param budgetMs Preserved authoritative ceiling in milliseconds.
 */
export function reportCodeEditorPerformance(label: string, measuredMs: number, budgetMs: number): void {
  console.log(`code-editor perf (informational): ${label} ${measuredMs.toFixed(3)}ms; budget ${budgetMs.toFixed(3)}ms`);
}
