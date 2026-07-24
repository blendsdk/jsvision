import { pathToFileURL } from 'node:url';

import { runHeadlessCompatibilityProbe } from './feasibility.js';

/**
 * Injectable boundaries used by the command-line probe runner.
 */
export interface FeasibilityProbeRunnerOptions {
  readonly runProbe?: typeof runHeadlessCompatibilityProbe;
  readonly writeOutput?: (value: string) => void;
  readonly writeError?: (value: string) => void;
}

/**
 * Runs the headless feasibility probe and writes one machine-readable result.
 *
 * @example
 * ```ts
 * const exitCode = await runFeasibilityProbeCli();
 * ```
 */
export async function runFeasibilityProbeCli(options: FeasibilityProbeRunnerOptions = {}): Promise<number> {
  const runProbe = options.runProbe ?? runHeadlessCompatibilityProbe;
  const writeOutput = options.writeOutput ?? ((value: string) => process.stdout.write(value));
  const writeError = options.writeError ?? ((value: string) => process.stderr.write(value));

  try {
    const result = await runProbe();
    writeOutput(`${JSON.stringify(result)}\n`);
    return result.compatible ? 0 : 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown probe failure';
    writeError(`${JSON.stringify({ error: message })}\n`);
    return 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await runFeasibilityProbeCli();
}
