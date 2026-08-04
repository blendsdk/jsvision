import { KanbanInvalidPresentationError } from '../contract/error.js';
import { snapshotKanbanCount } from '../source/counts.js';
import type { KanbanCount } from '../source/counts.js';
import type { KanbanWipPolicy } from '../source/types.js';

/** Immutable evidence retained when an exact WIP boundary is violated. */
export interface KanbanWorkflowViolationEvidence {
  /** Boundary crossed by the proposed authoritative count. */
  readonly boundary: 'minimum' | 'maximum';
  /** Exact authoritative WIP count before the proposal. */
  readonly authoritativeCount: number;
  /** Separately qualified exact count matching the active query, when known. */
  readonly matchingCount?: number;
  /** Exact authoritative WIP count after the proposed delta. */
  readonly proposedCount: number;
  /** Configured boundary that the proposal violates. */
  readonly limit: number;
}

/** Pure presentation advice shared by WIP and arbitrary transition evaluators. */
export type KanbanWorkflowEvaluation =
  | { readonly kind: 'allowed'; readonly violation?: KanbanWorkflowViolationEvidence }
  | { readonly kind: 'warning'; readonly code: string; readonly label?: string; readonly violation?: never }
  | { readonly kind: 'blocked'; readonly code: string; readonly label?: string; readonly violation?: never }
  | { readonly kind: 'unavailable'; readonly code: string; readonly retryable: boolean; readonly violation?: never };

/** Complete immutable input to one pure WIP policy evaluation. */
export interface EvaluateKanbanWipInput {
  /** Validated min/max workflow policy. */
  readonly policy: KanbanWipPolicy;
  /** Authoritative count unaffected by the active query filter. */
  readonly authoritativeCount: KanbanCount;
  /** Separately qualified count matching the active query. */
  readonly matchingCount: KanbanCount;
  /** Authoritative completed-card count used only when done cards are excluded. */
  readonly doneCount: KanbanCount;
  /** Signed count change represented by the proposed operation. */
  readonly proposedDelta: number;
}

/** Shared deeply frozen allowed result for policies with no proven violation. */
const ALLOWED: KanbanWorkflowEvaluation = Object.freeze({ kind: 'allowed' });

/** Raises a payload-free configuration error for malformed evaluator input. */
function invalidWip(): never {
  throw new KanbanInvalidPresentationError();
}

/** Returns an exact count or no value when authority is incomplete. */
function exactCount(count: KanbanCount): number | undefined {
  return count.quality === 'exact' ? count.value : undefined;
}

/** Validates the min/max relationship independently of the policy snapshot helper. */
function validatePolicy(policy: KanbanWipPolicy): void {
  const minimum = policy.minimum;
  const maximum = policy.maximum;
  if (
    (minimum !== undefined && (!Number.isSafeInteger(minimum) || minimum < 0)) ||
    (maximum !== undefined && (!Number.isSafeInteger(maximum) || maximum < 0)) ||
    (minimum !== undefined && maximum !== undefined && minimum > maximum) ||
    (policy.mode !== 'informational' && policy.mode !== 'advisory' && policy.mode !== 'blocking') ||
    (policy.countDone !== 'include' && policy.countDone !== 'exclude')
  ) {
    invalidWip();
  }
}

/** Creates exact frozen evidence while keeping matching authority separately qualified. */
function violationEvidence(
  boundary: 'minimum' | 'maximum',
  authoritativeCount: number,
  matchingCount: number | undefined,
  proposedCount: number,
  limit: number,
): KanbanWorkflowViolationEvidence {
  return Object.freeze({
    boundary,
    authoritativeCount,
    ...(matchingCount === undefined ? {} : { matchingCount }),
    proposedCount,
    limit,
  });
}

/** Maps one exact violation to the configured presentation/advice mode. */
function evaluateViolation(
  mode: KanbanWipPolicy['mode'],
  evidence: KanbanWorkflowViolationEvidence,
): KanbanWorkflowEvaluation {
  if (mode === 'informational') return Object.freeze({ kind: 'allowed', violation: evidence });
  const code = evidence.boundary === 'maximum' ? 'wip-maximum-exceeded' : 'wip-minimum-not-met';
  return Object.freeze({ kind: mode === 'advisory' ? 'warning' : 'blocked', code });
}

/**
 * Evaluates WIP advice from authoritative counts without dispatching or mutating application data.
 *
 * Matching/filter counts are retained only as separately qualified evidence and never substitute for
 * missing authoritative counts. Blocking policy therefore fails closed when exact authority is absent.
 *
 * @example
 * ```ts
 * const result = evaluateKanbanWip({
 *   policy: { maximum: 8, mode: 'blocking', countDone: 'include' },
 *   authoritativeCount: { quality: 'exact', value: 8 },
 *   matchingCount: { quality: 'exact', value: 4 },
 *   doneCount: { quality: 'unknown' },
 *   proposedDelta: 1,
 * });
 * ```
 */
export function evaluateKanbanWip(input: EvaluateKanbanWipInput): KanbanWorkflowEvaluation {
  try {
    validatePolicy(input.policy);
    if (!Number.isSafeInteger(input.proposedDelta)) return invalidWip();
    const authoritative = exactCount(snapshotKanbanCount(input.authoritativeCount));
    const matching = exactCount(snapshotKanbanCount(input.matchingCount));
    const done = exactCount(snapshotKanbanCount(input.doneCount));
    if (authoritative === undefined || (input.policy.countDone === 'exclude' && done === undefined)) {
      return input.policy.mode === 'blocking'
        ? Object.freeze({ kind: 'unavailable', code: 'wip-count-unavailable', retryable: true })
        : ALLOWED;
    }
    const effectiveCount = input.policy.countDone === 'exclude' ? authoritative - done! : authoritative;
    const proposedCount = effectiveCount + input.proposedDelta;
    if (
      !Number.isSafeInteger(effectiveCount) ||
      effectiveCount < 0 ||
      !Number.isSafeInteger(proposedCount) ||
      proposedCount < 0
    ) {
      return invalidWip();
    }
    if (input.policy.minimum !== undefined && proposedCount < input.policy.minimum) {
      return evaluateViolation(
        input.policy.mode,
        violationEvidence('minimum', effectiveCount, matching, proposedCount, input.policy.minimum),
      );
    }
    if (input.policy.maximum !== undefined && proposedCount > input.policy.maximum) {
      return evaluateViolation(
        input.policy.mode,
        violationEvidence('maximum', effectiveCount, matching, proposedCount, input.policy.maximum),
      );
    }
    return ALLOWED;
  } catch (error) {
    if (error instanceof KanbanInvalidPresentationError) throw error;
    return invalidWip();
  }
}
