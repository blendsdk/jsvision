import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, test } from 'vitest';
import { collectBoundedDiagnostics } from '../src/example-fixtures/in-production/bounded-diagnostics.js';
import {
  REQUIRED_PRODUCTION_CONCERNS,
  assessProductionReadiness,
  type ProductionEvidence,
} from '../src/example-fixtures/in-production/production-readiness.js';
import {
  decideSupervisorAction,
  type SupervisorRestartPolicy,
} from '../src/example-fixtures/in-production/supervisor-decision.js';

const supervisorPolicyPath = fileURLToPath(
  new URL('../src/example-fixtures/in-production/supervisor-policy.json', import.meta.url),
);

function passingEvidence(releaseId: string, recordedAt: number): ProductionEvidence[] {
  return REQUIRED_PRODUCTION_CONCERNS.map((concern) => ({
    concern,
    status: 'pass',
    recordedAt,
    releaseId,
    reason: `${concern} control passed`,
  }));
}

describe('In production operational artifacts', () => {
  test('should ship only when every artifact and startup control passes', () => {
    const evidence = passingEvidence('release-1', 9_900);
    const ready = assessProductionReadiness('release-1', evidence, { assessedAt: 10_000, maxAgeMs: 1_000 });
    expect(ready.decision).toBe('ship');

    const failedStartup = evidence.map((item) =>
      item.concern === 'tty' ? { ...item, status: 'fail' as const, reason: 'non-TTY artifact startup' } : item,
    );
    expect(
      assessProductionReadiness('release-1', failedStartup, { assessedAt: 10_000, maxAgeMs: 1_000 }).decision,
    ).toBe('no-go');
  });

  test('should stop a bounded crash loop when maxAttempts opens the breaker', () => {
    const supervisor = JSON.parse(readFileSync(supervisorPolicyPath, 'utf8')) as {
      restart: SupervisorRestartPolicy;
    };
    const first = decideSupervisorAction(supervisor.restart, {
      exit: 'failure',
      observedAt: 10_000,
      previousFailureTimes: [],
    });
    const third = decideSupervisorAction(supervisor.restart, {
      exit: 'failure',
      observedAt: 30_000,
      previousFailureTimes: [10_000, 20_000],
    });
    const open = decideSupervisorAction(supervisor.restart, {
      exit: 'failure',
      observedAt: 40_000,
      previousFailureTimes: [10_000, 20_000, 30_000],
    });
    expect(first).toEqual({ action: 'restart', attempt: 1, delaySeconds: 1 });
    expect(third).toEqual({ action: 'restart', attempt: 3, delaySeconds: 15 });
    expect(open).toMatchObject({ action: 'breaker-open', attempt: 4 });
  });

  test('should not restart clean or permanent startup exits', () => {
    const supervisor = JSON.parse(readFileSync(supervisorPolicyPath, 'utf8')) as {
      restart: SupervisorRestartPolicy;
    };
    expect(
      decideSupervisorAction(supervisor.restart, {
        exit: 'clean',
        observedAt: 10_000,
        previousFailureTimes: [],
      }),
    ).toMatchObject({ action: 'stopped-clean' });
    expect(
      decideSupervisorAction(supervisor.restart, {
        exit: 'permanent-startup',
        observedAt: 10_000,
        previousFailureTimes: [],
      }),
    ).toMatchObject({ action: 'stopped-manual' });
  });

  test('should redact input payloads and keep diagnostic retention bounded', () => {
    const secret = 'token=production-secret';
    const resolution = resolveCapabilities({ env: {}, platform: 'linux' });
    const bundle = collectBoundedDiagnostics({
      releaseId: 'release-1',
      resolution,
      event: { type: 'paste', text: secret, truncated: false },
      displayCategory: 'ready',
      size: 2,
    });
    expect(bundle.entries).toHaveLength(2);
    expect(JSON.stringify(bundle)).not.toContain(secret);
    expect(bundle.safeDisplayLabel).toBe('Ready');
  });

  test('should block stale evidence using an injected freshness policy', () => {
    const stale = passingEvidence('release-1', 1_000);
    const result = assessProductionReadiness('release-1', stale, { assessedAt: 5_000, maxAgeMs: 1_000 });
    expect(result.decision).toBe('no-go');
    expect(result.checks.every((check) => check.freshness === 'stale' && check.status === 'fail')).toBe(true);
  });
});
