/**
 * Implementation hardening for the production-readiness and diagnostic artifacts.
 *
 * These tests extend the immutable course oracle with release isolation, missing and
 * future-dated evidence, warning policy, bounded retention, sanitization, and exact
 * supervisor behavior.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, test } from 'vitest';
import {
  MAX_DIAGNOSTIC_RECORDS,
  collectBoundedDiagnostics,
} from '../src/example-fixtures/in-production/bounded-diagnostics.js';
import {
  REQUIRED_PRODUCTION_CONCERNS,
  assessProductionReadiness,
  type ProductionEvidence,
} from '../src/example-fixtures/in-production/production-readiness.js';

const supervisorPolicyPath = fileURLToPath(
  new URL('../src/example-fixtures/in-production/supervisor-policy.json', import.meta.url),
);

/** Produce one complete evidence set without ambient clock or environment reads. */
function evidenceFor(releaseId: string, recordedAt = 9_000): ProductionEvidence[] {
  return REQUIRED_PRODUCTION_CONCERNS.map((concern) => ({
    concern,
    status: 'pass',
    recordedAt,
    releaseId,
    reason: `${concern} verified`,
  }));
}

describe('In production artifact hardening', () => {
  test('should block a release when one required concern is missing', () => {
    const evidence = evidenceFor('release-1').filter((item) => item.concern !== 'restore');
    const result = assessProductionReadiness('release-1', evidence, { assessedAt: 10_000, maxAgeMs: 2_000 });
    expect(result.decision).toBe('no-go');
    expect(result.checks.find((check) => check.concern === 'restore')).toEqual({
      concern: 'restore',
      status: 'fail',
      freshness: 'missing',
      reason: 'Evidence is missing for this release.',
      warningAccepted: false,
    });
  });

  test('should ignore passing evidence recorded for another release', () => {
    const result = assessProductionReadiness('release-2', evidenceFor('release-1'), {
      assessedAt: 10_000,
      maxAgeMs: 2_000,
    });
    expect(result.decision).toBe('no-go');
    expect(result.checks.every((check) => check.freshness === 'missing')).toBe(true);
  });

  test('should reject future-dated evidence as stale', () => {
    const result = assessProductionReadiness('release-1', evidenceFor('release-1', 10_001), {
      assessedAt: 10_000,
      maxAgeMs: 2_000,
    });
    expect(result.decision).toBe('no-go');
    expect(result.checks.every((check) => check.freshness === 'stale')).toBe(true);
  });

  test('should block an unaccepted warning and ship a named accepted warning', () => {
    const evidence = evidenceFor('release-1').map((item) =>
      item.concern === 'performance'
        ? { ...item, status: 'warn' as const, reason: 'p95 is informational for this fixture' }
        : item,
    );
    const unaccepted = assessProductionReadiness('release-1', evidence, {
      assessedAt: 10_000,
      maxAgeMs: 2_000,
    });
    expect(unaccepted.decision).toBe('no-go');

    const accepted = evidence.map((item) =>
      item.concern === 'performance'
        ? {
            ...item,
            warningAcceptance: { owner: 'release-owner', acceptedAt: 9_500, reason: 'bounded fixture variance' },
          }
        : item,
    );
    const result = assessProductionReadiness('release-1', accepted, { assessedAt: 10_000, maxAgeMs: 2_000 });
    expect(result.decision).toBe('ship');
    expect(result.checks.find((check) => check.concern === 'performance')).toMatchObject({
      status: 'warn',
      freshness: 'fresh',
      warningAccepted: true,
    });
  });

  test('should block a stale warning even when its old acceptance was named', () => {
    const evidence = evidenceFor('release-1', 1_000).map((item) =>
      item.concern === 'support'
        ? {
            ...item,
            status: 'warn' as const,
            warningAcceptance: { owner: 'support-owner', acceptedAt: 1_100, reason: 'bounded support window' },
          }
        : item,
    );
    const result = assessProductionReadiness('release-1', evidence, { assessedAt: 10_000, maxAgeMs: 2_000 });
    expect(result.decision).toBe('no-go');
    expect(result.checks.find((check) => check.concern === 'support')).toMatchObject({
      status: 'fail',
      freshness: 'stale',
      warningAccepted: false,
    });
  });

  test.each([
    ['pass-first', ['pass', 'fail']],
    ['fail-first', ['fail', 'pass']],
  ] as const)('should reject duplicate concern evidence in %s order', (_name, statuses) => {
    const evidence = evidenceFor('release-1');
    const packageEvidence = statuses.map((status): ProductionEvidence => ({
      concern: 'package',
      status,
      recordedAt: 9_000,
      releaseId: 'release-1',
      reason: `${status} duplicate`,
    }));
    const withoutPackage = evidence.filter((item) => item.concern !== 'package');
    const result = assessProductionReadiness('release-1', [...packageEvidence, ...withoutPackage], {
      assessedAt: 10_000,
      maxAgeMs: 2_000,
    });
    expect(result.decision).toBe('no-go');
    expect(result.checks.find((check) => check.concern === 'package')).toMatchObject({
      status: 'fail',
      reason: 'Duplicate evidence makes this concern ambiguous.',
    });
  });

  test('should keep only the configured number of diagnostic records', () => {
    const bundle = collectBoundedDiagnostics({
      releaseId: 'release-1',
      resolution: resolveCapabilities({ env: {}, platform: 'linux' }),
      event: { type: 'key', key: 'x', codepoint: 120, ctrl: false, alt: false, shift: false },
      displayCategory: 'ready',
      size: 1,
    });
    expect(bundle.entries).toHaveLength(1);
    expect(bundle.entries[0]).toMatchObject({ component: 'capabilities' });
    expect(JSON.stringify(bundle.entries)).not.toContain('"x"');
  });

  test('should retain only an allowlisted display category and redacted payload metadata', () => {
    const secret = 'user-secret';
    const bundle = collectBoundedDiagnostics({
      releaseId: 'release-1',
      resolution: resolveCapabilities({ env: {}, platform: 'linux' }),
      event: { type: 'paste', text: secret, truncated: false },
      displayCategory: 'degraded',
      size: 3,
    });
    expect(bundle.safeDisplayLabel).toBe('Degraded');
    expect(bundle.entries[0]?.fields).toEqual({ releaseId: 'release-1' });
    expect(bundle.entries[1]?.fields).toEqual({ type: 'paste', length: secret.length, truncated: false });
    expect(JSON.stringify(bundle)).not.toContain(secret);
  });

  test('should clamp invalid and excessive diagnostic capacities', () => {
    const collect = (size: number) =>
      collectBoundedDiagnostics({
        releaseId: 'release-1',
        resolution: resolveCapabilities({ env: {}, platform: 'linux' }),
        event: { type: 'focus', focused: true },
        displayCategory: 'failed',
        size,
      });
    expect(collect(Number.NaN).entries).toHaveLength(1);
    expect(collect(0.5).entries).toHaveLength(1);
    expect(collect(100_000).entries.length).toBeLessThanOrEqual(MAX_DIAGNOSTIC_RECORDS);
  });

  test('should bind graceful shutdown and forced termination explicitly', () => {
    const policy = JSON.parse(readFileSync(supervisorPolicyPath, 'utf8')) as {
      terminal: { forwardSignals: string[] };
      shutdown: { graceSeconds: number; forceSignal: string };
    };
    expect(policy.terminal.forwardSignals).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP']);
    expect(policy.shutdown).toEqual({ graceSeconds: 15, forceSignal: 'SIGKILL' });
  });

  test('should keep every readiness concern unique and ordered', () => {
    expect(new Set(REQUIRED_PRODUCTION_CONCERNS).size).toBe(REQUIRED_PRODUCTION_CONCERNS.length);
    expect(REQUIRED_PRODUCTION_CONCERNS).toEqual([
      'package',
      'runtime',
      'tty',
      'restore',
      'diagnostics',
      'security',
      'compatibility',
      'performance',
      'support',
    ]);
  });
});
