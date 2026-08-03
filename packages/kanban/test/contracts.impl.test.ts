import { describe, expect, it, vi } from 'vitest';

import {
  KANBAN_LIMITS,
  KanbanInvalidIdentityError,
  KanbanInvalidLimitError,
  KanbanInvalidSemanticValueError,
  KanbanObservationBuffer,
  createKanbanColumnId,
  createPlacementToken,
  createKanbanObservation,
  fingerprintKanbanSemanticValue,
  snapshotKanbanSemanticValue,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type { KanbanObservationInput } from '../src/index.js';

/** Fixed seed reported by deterministic insertion-order property coverage. */
const PROPERTY_SEED = 0x4b_41_4e_42;

/** Returns a deterministic pseudo-random sequence without global state. */
function sequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
}

/** Produces one deterministic shuffled copy for canonical-order property checks. */
function shuffled<T>(values: readonly T[], next: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = next() % (index + 1);
    [result[index], result[target]] = [result[target] as T, result[index] as T];
  }
  return result;
}

describe('identity and limit implementation boundaries', () => {
  it('uses encoded bytes at the exact identity boundary', () => {
    const exact = 'é'.repeat(128);
    expect(createKanbanColumnId(exact)).toBe(exact);
    expect(() => createKanbanColumnId(`${exact}a`)).toThrow(KanbanInvalidIdentityError);
  });

  it('rejects oversized identities and tokens before encoded-size work', () => {
    const oversizedIdentity = 'x'.repeat(KANBAN_LIMITS.idBytes.absolute + 1);
    const oversizedToken = 'x'.repeat(KANBAN_LIMITS.tokenBytes.absolute + 1);

    expect(() => createKanbanColumnId(oversizedIdentity)).toThrow(KanbanInvalidIdentityError);
    expect(() => createPlacementToken(oversizedToken)).toThrow(KanbanInvalidIdentityError);
    expect(createKanbanObservation({ code: 'large-id', scope: 'card', cardKey: oversizedIdentity })).toEqual({
      code: 'large-id',
      scope: 'card',
    });
  });

  it('keeps advanced defaults conservative and accepts only explicit absolute-range increases', () => {
    const defaults = validateKanbanLimitOptions({ class: 'advanced' });
    const explicit = validateKanbanLimitOptions({ class: 'advanced', values: { columns: 1_024 } });

    expect(defaults.columns).toBe(KANBAN_LIMITS.columns.safe);
    expect(explicit.columns).toBe(KANBAN_LIMITS.columns.absolute);
    expect(Object.isFrozen(explicit)).toBe(true);
    expect(() =>
      validateKanbanLimitOptions({ class: 'advanced', values: { columns: KANBAN_LIMITS.columns.absolute + 1 } }),
    ).toThrow(KanbanInvalidLimitError);
  });
});

describe('semantic snapshot implementation', () => {
  it('detaches nested caller data and preserves canonical sorted keys after mutation', () => {
    const input = { zebra: [{ value: 'before' }], alpha: 1 };
    const snapshot = snapshotKanbanSemanticValue(input);
    input.zebra[0]!.value = 'after';
    input.zebra.push({ value: 'later' });

    expect(Object.keys(snapshot)).toEqual(['alpha', 'zebra']);
    expect(snapshot.zebra).toEqual([{ value: 'before' }]);
    expect(Object.isFrozen(snapshot.zebra)).toBe(true);
    expect(Object.isFrozen(snapshot.zebra[0])).toBe(true);
  });

  it('rejects custom prototypes, accessors, sparse arrays, and revoked proxies without invoking user code', () => {
    const getter = vi.fn(() => 'secret');
    const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: getter });
    const customPrototype = Object.create({ inherited: true });
    const sparse = Array(2);
    const extraIndex = Object.assign([1], { 4_294_967_295: 'outside-length' });
    const revocable = Proxy.revocable({ value: 1 }, {});
    revocable.revoke();

    for (const hostile of [accessor, customPrototype, sparse, extraIndex, revocable.proxy]) {
      expect(() => snapshotKanbanSemanticValue(hostile)).toThrow(KanbanInvalidSemanticValueError);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it(`derives one fingerprint across deterministic insertion orders (seed ${PROPERTY_SEED})`, () => {
    const entries = [
      ['alpha', 1],
      ['beta', true],
      ['gamma', 'three'],
      ['delta', null],
    ] as const;
    const next = sequence(PROPERTY_SEED);
    const expected = fingerprintKanbanSemanticValue(Object.fromEntries(entries));

    for (let iteration = 0; iteration < 64; iteration += 1) {
      expect(fingerprintKanbanSemanticValue(Object.fromEntries(shuffled(entries, next)))).toBe(expected);
    }
  });

  it('rejects repeated shared subgraphs before their expanded snapshot exceeds the global byte budget', () => {
    const shared = { value: 'x'.repeat(16_000) };
    const amplified = Array.from({ length: 64 }, () => shared);

    expect(() => snapshotKanbanSemanticValue(amplified)).toThrow(KanbanInvalidSemanticValueError);
  });
});

describe('observation implementation', () => {
  it('accepts the absolute observation capacity and rejects any larger buffer', () => {
    expect(() => new KanbanObservationBuffer(KANBAN_LIMITS.retainedObservations.absolute)).not.toThrow();
    let failure: unknown;
    try {
      new KanbanObservationBuffer(KANBAN_LIMITS.retainedObservations.absolute + 1);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(KanbanInvalidLimitError);
    expect(failure).toMatchObject({ code: 'invalid-limit' });
  });

  it('detaches counters, redacts raw failures, bounds labels, and evicts oldest entries', () => {
    const buffer = new KanbanObservationBuffer(2);
    const counts = { failures: 1 };
    const first = createKanbanObservation({
      code: 'first',
      scope: 'source',
      counts,
      error: new Error('private-record-value'),
      message: `safe${'x'.repeat(1_000)}\u001b]52;c;unsafe\u0007`,
    });
    buffer.push(first);
    counts.failures = 99;
    buffer.push({ code: 'second', scope: 'card', cardKey: 1 });
    buffer.push({ code: 'third', scope: 'card', cardKey: '1' });

    const retained = buffer.values();
    expect(retained.map(({ code }) => code)).toEqual(['second', 'third']);
    expect(retained.map(({ cardKey }) => cardKey)).toEqual([1, '1']);
    expect(JSON.stringify(first)).not.toContain('private-record-value');
    expect(first.message?.length).toBeLessThanOrEqual(512);
    expect(first.message).not.toContain('\u001b');
    expect(first.counts).toEqual({ failures: 1 });
    expect(Object.isFrozen(first.counts)).toBe(true);
    expect(Object.isFrozen(retained)).toBe(true);
  });

  it('does not invoke accessors while degrading malformed diagnostic input', () => {
    const getter = vi.fn(() => 'private-value');
    const input: KanbanObservationInput = Object.defineProperty(
      { code: 'getter-input', scope: 'board' as const },
      'message',
      { enumerable: true, get: getter },
    );

    expect(createKanbanObservation(input)).toEqual({
      code: 'invalid-observation',
      scope: 'board',
    });
    expect(getter).not.toHaveBeenCalled();
  });
});
