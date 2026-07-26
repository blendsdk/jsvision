import { describe, expect, it, vi } from 'vitest';

import { classifyDocumentSize, createDegradationState } from './index.js';

/** Invokes a versioned degradation transition without weakening the public oracle's runtime checks. */
function transition(state: object, method: string, ...parameters: readonly unknown[]): void {
  const candidate = Reflect.get(state, method);
  expect(candidate, `degradation state must expose ${method}()`).toBeTypeOf('function');
  Reflect.apply(candidate, state, parameters);
}

/** Reads one public feature inspection record from a degradation snapshot. */
function featureInspection(snapshot: object, feature: string): unknown {
  const features = Reflect.get(snapshot, 'features');
  expect(features).toBeInstanceOf(Array);
  return (features as readonly unknown[]).find(
    (entry) => typeof entry === 'object' && entry !== null && Reflect.get(entry, 'feature') === feature,
  );
}

describe('visible code-editor degradation and recovery', () => {
  it('should identify parser failure, retry pending state, and recovery while preserving core actions', () => {
    // Parser lifecycle state must remain non-modal and must never disable core document operations.
    const state = createDegradationState();
    state.fail('parser');

    const failed = state.snapshot();
    expect(featureInspection(failed, 'parser')).toMatchObject({
      feature: 'parser',
      status: 'degraded',
      reason: expect.any(String),
    });
    expect(failed.availableActions).toEqual(expect.arrayContaining(['edit', 'search', 'save', 'close']));
    expect(failed.notices.every((notice) => notice.nonModal)).toBe(true);

    transition(state, 'pending', 'parser', { reason: 'retry' });
    expect(featureInspection(state.snapshot(), 'parser')).toMatchObject({
      status: 'pending',
      reason: expect.any(String),
    });

    state.recover('parser');
    expect(featureInspection(state.snapshot(), 'parser')).toMatchObject({
      status: 'enabled',
      reason: expect.any(String),
    });
    expect(state.snapshot().mode).toBe('ready');
  });

  it('should distinguish a missing adapter and language-service degradation from recovery', () => {
    // Independent optional services must explain their own state without making local editing unavailable.
    const state = createDegradationState();
    transition(state, 'suspend', 'languageAdapter', { reason: 'missing-adapter' });
    state.fail('languageService');

    const degraded = state.snapshot();
    expect(featureInspection(degraded, 'languageAdapter')).toMatchObject({
      status: 'suspended',
      reason: 'missing-adapter',
    });
    expect(featureInspection(degraded, 'languageService')).toMatchObject({
      status: 'degraded',
      reason: expect.any(String),
    });
    expect(degraded.availableActions).toEqual(expect.arrayContaining(['edit', 'search', 'save', 'close']));

    state.recover('languageService');
    expect(featureInspection(state.snapshot(), 'languageService')).toMatchObject({ status: 'enabled' });
    expect(featureInspection(state.snapshot(), 'languageAdapter')).toMatchObject({ status: 'suspended' });
  });

  it('should expose suspended and truncated limits with bounded immutable counts', () => {
    // A zero-discard limit is suspended; discarded results are explicitly truncated with safe counts.
    const state = createDegradationState();
    state.suspend('symbols', { reason: 'limit', presented: 0, discarded: 0 });
    state.suspend('diagnostics', {
      reason: 'limit',
      presented: Number.MAX_SAFE_INTEGER,
      discarded: Number.MAX_SAFE_INTEGER,
    });

    const snapshot = state.snapshot();
    expect(featureInspection(snapshot, 'symbols')).toMatchObject({
      status: 'suspended',
      reason: 'limit',
    });
    expect(featureInspection(snapshot, 'diagnostics')).toMatchObject({
      status: 'truncated',
      reason: 'limit',
      presented: 1_000_000_000,
      discarded: 1_000_000_000,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.notices)).toBe(true);
    expect(Object.isFrozen(snapshot.affectedFeatures)).toBe(true);
    expect(Object.isFrozen(Reflect.get(snapshot, 'features'))).toBe(true);
  });

  it('should sanitize hostile labels and errors without executing accessors or terminal controls', () => {
    // Host-provided failure details are untrusted terminal input and may not leak into visible notices.
    const getter = vi.fn(() => '\u001b[2Jstolen source');
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'message', { enumerable: true, get: getter });
    Object.defineProperty(hostile, 'label', { enumerable: true, get: getter });
    const state = createDegradationState();

    state.fail('parser', hostile);
    transition(state, 'pending', 'languageService', hostile);
    const serialized = JSON.stringify(state.snapshot());

    expect(getter).not.toHaveBeenCalled();
    expect(serialized).not.toContain('\u001b');
    expect(serialized).not.toContain('stolen source');
    expect(serialized.length).toBeLessThan(8_192);
  });
});

describe('visible code-editor document tiers', () => {
  it('should identify full, large, and confirmation-required tiers with feature status and rationale', () => {
    // Every document tier must expose why optional features are enabled, suspended, or truncated.
    const full = classifyDocumentSize({ bytes: 4_096, lines: 100 });
    const large = classifyDocumentSize({ bytes: 2 * 1_048_576, lines: 20_000 });
    const confirmation = classifyDocumentSize({ bytes: 11 * 1_048_576, lines: 100_000 });

    expect(full).toMatchObject({
      mode: 'full',
      confirmationRequired: false,
      featureStates: expect.arrayContaining([
        expect.objectContaining({ feature: 'parser', status: 'enabled', reason: expect.any(String) }),
      ]),
    });
    expect(large).toMatchObject({
      mode: 'large',
      confirmationRequired: false,
      featureStates: expect.arrayContaining([
        expect.objectContaining({
          status: expect.stringMatching(/^(enabled|suspended|truncated)$/),
          reason: expect.any(String),
        }),
      ]),
    });
    expect(confirmation).toMatchObject({
      mode: 'reduced',
      confirmationRequired: true,
      featureStates: expect.arrayContaining([
        expect.objectContaining({ feature: 'edit', status: 'enabled', reason: expect.any(String) }),
        expect.objectContaining({ feature: 'parser', status: 'suspended', reason: expect.any(String) }),
      ]),
    });
    expect(Object.isFrozen(Reflect.get(full, 'featureStates'))).toBe(true);
    expect(Object.isFrozen(Reflect.get(large, 'featureStates'))).toBe(true);
    expect(Object.isFrozen(Reflect.get(confirmation, 'featureStates'))).toBe(true);
  });
});
