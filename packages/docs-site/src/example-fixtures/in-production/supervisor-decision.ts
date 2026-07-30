/** Restart policy fields consumed by the deterministic supervisor evaluator. */
export interface SupervisorRestartPolicy {
  readonly mode: 'on-failure';
  readonly maxAttempts: number;
  readonly windowSeconds: number;
  readonly backoffSeconds: readonly number[];
}

/** Exit categories with materially different restart behavior. */
export type SupervisedExit = 'clean' | 'failure' | 'permanent-startup';

/** Deterministic process observation supplied by a launcher or test harness. */
export interface SupervisorObservation {
  readonly exit: SupervisedExit;
  readonly observedAt: number;
  readonly previousFailureTimes: readonly number[];
}

/** Action selected from the restart policy and bounded failure history. */
export type SupervisorAction =
  | { readonly action: 'stopped-clean'; readonly reason: string }
  | { readonly action: 'stopped-manual'; readonly reason: string }
  | { readonly action: 'breaker-open'; readonly attempt: number; readonly reason: string }
  | { readonly action: 'restart'; readonly attempt: number; readonly delaySeconds: number };

/**
 * Evaluate one child exit without sleeping, starting a process, or reading ambient time.
 *
 * Clean exits never restart. Permanent startup failures require operator correction.
 * Other failures restart only while their rolling-window attempt number is within the
 * configured limit; the selected delay is clamped to the last backoff entry.
 */
export function decideSupervisorAction(
  policy: SupervisorRestartPolicy,
  observation: SupervisorObservation,
): SupervisorAction {
  if (observation.exit === 'clean') {
    return { action: 'stopped-clean', reason: 'The process exited normally.' };
  }
  if (observation.exit === 'permanent-startup') {
    return { action: 'stopped-manual', reason: 'Startup requires an operator correction.' };
  }

  const windowStart = observation.observedAt - policy.windowSeconds * 1_000;
  const recentFailures = observation.previousFailureTimes.filter(
    (time) => time >= windowStart && time <= observation.observedAt,
  );
  const attempt = recentFailures.length + 1;
  if (attempt > policy.maxAttempts) {
    return { action: 'breaker-open', attempt, reason: 'The bounded crash-loop limit was exceeded.' };
  }

  const delayIndex = Math.min(attempt - 1, Math.max(0, policy.backoffSeconds.length - 1));
  const delaySeconds = policy.backoffSeconds[delayIndex] ?? 0;
  return { action: 'restart', attempt, delaySeconds };
}
