import { describe, expect, it } from 'vitest';

import {
  KanbanInvalidPresentationError,
  evaluateKanbanTransition,
  evaluateKanbanWip,
  snapshotKanbanDefinitionOfDone,
} from '../src/index.js';
import type { KanbanObservation, KanbanTransitionContext, KanbanWipPolicy } from '../src/index.js';

/** Builds a complete transition context with focused overrides. */
function transitionContext(replacement: Partial<KanbanTransitionContext> = {}): KanbanTransitionContext {
  return {
    source: { columnId: 'ready', swimlaneId: 'alpha' },
    target: { columnId: 'doing', swimlaneId: 'alpha' },
    cardKeys: [1, '1'],
    sourceRevision: 'source-v1',
    targetRevision: 'target-v1',
    sessionRevision: 'session-v1',
    queryGeneration: 7,
    counts: {
      source: { quality: 'exact', value: 2 },
      target: { quality: 'exact', value: 4 },
    },
    definitionOfDone: snapshotKanbanDefinitionOfDone({
      summary: 'Reviewed',
      details: 'Reviewed by the owning team',
    }),
    ...replacement,
  };
}

/** Evaluates one exact WIP proposal with focused policy/count overrides. */
function evaluate(policy: KanbanWipPolicy, replacement: Partial<Parameters<typeof evaluateKanbanWip>[0]> = {}) {
  return evaluateKanbanWip({
    policy,
    authoritativeCount: { quality: 'exact', value: 4 },
    matchingCount: { quality: 'exact', value: 2 },
    doneCount: { quality: 'exact', value: 1 },
    proposedDelta: 1,
    ...replacement,
  });
}

describe('WIP policy boundaries', () => {
  it.each([
    ['informational', 'allowed'],
    ['advisory', 'warning'],
    ['blocking', 'blocked'],
  ] as const)('maps an exact maximum violation in %s mode to %s advice', (mode, kind) => {
    const result = evaluate({ maximum: 4, mode, countDone: 'include' });

    expect(result.kind).toBe(kind);
    if (result.kind === 'allowed') {
      expect(result.violation).toEqual({
        boundary: 'maximum',
        authoritativeCount: 4,
        matchingCount: 2,
        proposedCount: 5,
        limit: 4,
      });
    } else {
      expect(result).toMatchObject({ code: 'wip-maximum-exceeded' });
    }
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('evaluates minimum and maximum against the count after excluding done cards', () => {
    const minimum = evaluate({ minimum: 3, mode: 'blocking', countDone: 'exclude' }, { proposedDelta: -1 });
    const maximum = evaluate({ maximum: 3, mode: 'blocking', countDone: 'exclude' }, { proposedDelta: 1 });

    expect(minimum).toEqual({ kind: 'blocked', code: 'wip-minimum-not-met' });
    expect(maximum).toEqual({ kind: 'blocked', code: 'wip-maximum-exceeded' });
  });

  it.each([
    ['informational', { kind: 'allowed' }],
    ['advisory', { kind: 'allowed' }],
    ['blocking', { kind: 'unavailable', code: 'wip-count-unavailable', retryable: true }],
  ] as const)('does not infer %s advice from matching counts when authority is unknown', (mode, expected) => {
    const result = evaluate(
      { maximum: 4, mode, countDone: 'include' },
      { authoritativeCount: { quality: 'unknown' }, matchingCount: { quality: 'exact', value: 99 } },
    );

    expect(result).toEqual(expected);
  });

  it.each([
    { minimum: -1, mode: 'blocking', countDone: 'include' },
    { minimum: 5, maximum: 4, mode: 'blocking', countDone: 'include' },
    { maximum: 4, mode: 'invalid', countDone: 'include' },
  ])('rejects malformed policy %# without mutating caller input', (policy) => {
    const before = JSON.stringify(policy);

    expect(() => evaluate(policy as KanbanWipPolicy)).toThrow(KanbanInvalidPresentationError);
    expect(JSON.stringify(policy)).toBe(before);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects a non-safe proposed delta %s',
    (proposedDelta) => {
      expect(() => evaluate({ maximum: 10, mode: 'blocking', countDone: 'include' }, { proposedDelta })).toThrow(
        KanbanInvalidPresentationError,
      );
    },
  );
});

describe('definition-of-done snapshots', () => {
  it('removes terminal and bidirectional controls while retaining compact and complete evidence', () => {
    const source = {
      summary: '\u001b[31mReviewed\u001b[0m\u202e',
      details: 'Tests\tpass\nand release approval is recorded',
    };
    const snapshot = snapshotKanbanDefinitionOfDone(source);

    expect(snapshot).toEqual({
      summary: 'Reviewed',
      details: 'Tests pass and release approval is recorded',
      indicator: 'configured',
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(source.summary).toContain('\u001b');
  });

  it.each([
    { summary: '' },
    { summary: '\u001b[31m\u001b[0m' },
    { summary: 'Ready', indicator: 'unknown' },
    { summary: 'Ready', extra: 'not accepted' },
  ])('rejects malformed definition input %#', (value) => {
    expect(() => snapshotKanbanDefinitionOfDone(value)).toThrow(KanbanInvalidPresentationError);
  });
});

describe('application-owned transition advice', () => {
  it('passes a deeply detached frozen snapshot without changing application data', () => {
    const context = transitionContext();
    const originalKeys = context.cardKeys;
    let received: KanbanTransitionContext | undefined;

    const result = evaluateKanbanTransition(context, (snapshot) => {
      received = snapshot;
      expect(
        [
          snapshot,
          snapshot.source,
          snapshot.target,
          snapshot.cardKeys,
          snapshot.counts,
          snapshot.counts.source,
          snapshot.counts.target,
          snapshot.definitionOfDone,
        ].every(Object.isFrozen),
      ).toBe(true);
      return { kind: 'allowed' };
    });

    expect(result).toEqual({ kind: 'allowed' });
    expect(received).not.toBe(context);
    expect(received?.cardKeys).not.toBe(originalKeys);
    expect(received?.cardKeys).toEqual([1, '1']);
    expect(context.cardKeys).toBe(originalKeys);
  });

  it.each([
    { kind: 'warning', code: 'review-required', label: '\u001b[31mReview\u001b[0m\u202e now' },
    { kind: 'blocked', code: 'approval-required', label: 'Approval\nrequired' },
    { kind: 'unavailable', code: 'policy-offline', retryable: true },
  ] as const)('validates and sanitizes arbitrary application advice %#', (advice) => {
    const result = evaluateKanbanTransition(transitionContext(), () => advice);

    if (result.kind === 'warning') expect(result.label).toBe('Review now');
    if (result.kind === 'blocked') expect(result.label).toBe('Approval required');
    if (result.kind === 'unavailable') expect(result.retryable).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    { kind: 'allowed', code: 'unexpected' },
    { kind: 'blocked', code: 'Not Safe' },
    { kind: 'unavailable', code: 'offline' },
    { kind: 'warning', code: 'warning', retryable: true },
  ])('fails closed for malformed resolver advice %#', (advice) => {
    const result = evaluateKanbanTransition(transitionContext(), () => advice as never);

    expect(result).toEqual({ kind: 'unavailable', code: 'transition-resolver-failed', retryable: false });
  });

  it('contains resolver and diagnostic failures as one payload-free observation', () => {
    const observations: KanbanObservation[] = [];
    const result = evaluateKanbanTransition(
      transitionContext(),
      () => {
        throw new Error('resolver-secret\u001b[31m');
      },
      (observation) => {
        observations.push(observation);
        throw new Error('observer-secret');
      },
    );

    expect(result).toEqual({ kind: 'unavailable', code: 'transition-resolver-failed', retryable: false });
    expect(observations).toEqual([{ code: 'transition-resolver-failed', scope: 'request' }]);
    expect(JSON.stringify(observations)).not.toMatch(/resolver-secret|observer-secret|\u001b/u);
  });

  it('rejects malformed context before invoking application code', () => {
    let calls = 0;
    const context = transitionContext({ cardKeys: [1, 1] });

    expect(() =>
      evaluateKanbanTransition(context, () => {
        calls += 1;
        return { kind: 'allowed' };
      }),
    ).toThrow(KanbanInvalidPresentationError);
    expect(calls).toBe(0);
  });
});
