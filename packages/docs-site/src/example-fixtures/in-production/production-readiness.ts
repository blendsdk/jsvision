/**
 * The production concerns that must have current evidence before a release ships.
 */
export type ProductionConcern =
  'package' | 'runtime' | 'tty' | 'restore' | 'diagnostics' | 'security' | 'compatibility' | 'performance' | 'support';

/** The outcome recorded by one production check. */
export type ReadinessStatus = 'pass' | 'warn' | 'fail';

/** A named decision accepting one bounded warning for this release. */
export interface WarningAcceptance {
  readonly owner: string;
  readonly acceptedAt: number;
  readonly reason: string;
}

/** Evidence for one production concern, captured for a specific release. */
export interface ProductionEvidence {
  readonly concern: ProductionConcern;
  readonly status: ReadinessStatus;
  readonly recordedAt: number;
  readonly releaseId: string;
  readonly reason: string;
  readonly warningAcceptance?: WarningAcceptance;
}

/** The deterministic clock and freshness policy used for an assessment. */
export interface ReadinessPolicy {
  readonly assessedAt: number;
  readonly maxAgeMs: number;
}

/** The normalized result for one required concern. */
export interface ConcernAssessment {
  readonly concern: ProductionConcern;
  readonly status: ReadinessStatus;
  readonly freshness: 'fresh' | 'stale' | 'missing';
  readonly reason: string;
  readonly warningAccepted: boolean;
}

/** A reproducible go/no-go decision for a release artifact. */
export interface ProductionReadiness {
  readonly releaseId: string;
  readonly assessedAt: number;
  readonly decision: 'ship' | 'no-go';
  readonly checks: readonly ConcernAssessment[];
}

/** The complete set of blocking production concerns, in review order. */
export const REQUIRED_PRODUCTION_CONCERNS: readonly ProductionConcern[] = [
  'package',
  'runtime',
  'tty',
  'restore',
  'diagnostics',
  'security',
  'compatibility',
  'performance',
  'support',
];

/**
 * Assess release evidence without reading the clock, environment, network, or filesystem.
 *
 * A missing, duplicate, failed, or stale concern blocks release. Warnings remain
 * visible and block by default; they ship only with a named, timely acceptance
 * record, so a bounded degradation cannot silently become a pass.
 */
export function assessProductionReadiness(
  releaseId: string,
  evidence: readonly ProductionEvidence[],
  policy: ReadinessPolicy,
): ProductionReadiness {
  const checks = REQUIRED_PRODUCTION_CONCERNS.map((concern): ConcernAssessment => {
    const matches = evidence.filter((candidate) => candidate.concern === concern && candidate.releaseId === releaseId);
    if (matches.length === 0) {
      return {
        concern,
        status: 'fail',
        freshness: 'missing',
        reason: 'Evidence is missing for this release.',
        warningAccepted: false,
      };
    }
    if (matches.length > 1) {
      return {
        concern,
        status: 'fail',
        freshness: 'fresh',
        reason: 'Duplicate evidence makes this concern ambiguous.',
        warningAccepted: false,
      };
    }
    const item = matches[0];
    if (!item) throw new Error('A single evidence match must be present.');
    const age = policy.assessedAt - item.recordedAt;
    if (age < 0 || age > policy.maxAgeMs) {
      return {
        concern,
        status: 'fail',
        freshness: 'stale',
        reason: 'Evidence is outside the maximum age.',
        warningAccepted: false,
      };
    }
    const acceptance = item.warningAcceptance;
    const warningAccepted =
      item.status === 'warn' &&
      acceptance !== undefined &&
      acceptance.owner.trim().length > 0 &&
      acceptance.reason.trim().length > 0 &&
      acceptance.acceptedAt >= item.recordedAt &&
      acceptance.acceptedAt <= policy.assessedAt;
    return { concern, status: item.status, freshness: 'fresh', reason: item.reason, warningAccepted };
  });

  const decision = checks.every(
    (check) => check.status === 'pass' || (check.status === 'warn' && check.warningAccepted),
  )
    ? 'ship'
    : 'no-go';
  return { releaseId, assessedAt: policy.assessedAt, decision, checks };
}
