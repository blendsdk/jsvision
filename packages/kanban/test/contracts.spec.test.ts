import { describe, expect, it, vi } from 'vitest';

import {
  KANBAN_LIMITS,
  KanbanInvalidIdentityError,
  KanbanInvalidLimitError,
  KanbanInvalidSemanticValueError,
  createKanbanChecklistId,
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanFieldId,
  createKanbanOperationId,
  createKanbanSwimlaneId,
  createKanbanViewId,
  createPlacementToken,
  fingerprintKanbanSemanticValue,
  snapshotKanbanSemanticValue,
  validateKanbanLimitOptions,
  validateKanbanUniqueIds,
} from '../src/index.js';
import type { KanbanLimitManifest, KanbanSemanticValue } from '../src/index.js';

/** Public identity factories that share the structural identity safety contract. */
const ID_FACTORIES = [
  createKanbanColumnId,
  createKanbanSwimlaneId,
  createKanbanFieldId,
  createKanbanViewId,
  createKanbanChecklistId,
  createKanbanExtensionId,
  createKanbanOperationId,
] as const;

/** Exact durable resource ceilings exposed by the package limits manifest. */
const EXPECTED_LIMITS: KanbanLimitManifest = {
  idBytes: { safe: 256, standard: 256, absolute: 256 },
  tokenBytes: { safe: 2_048, standard: 2_048, absolute: 2_048 },
  semanticEncodedBytes: { safe: 262_144, standard: 1_048_576, absolute: 4_194_304 },
  semanticDepth: { safe: 16, standard: 32, absolute: 64 },
  semanticArrayEntries: { safe: 4_096, standard: 16_384, absolute: 65_536 },
  semanticObjectKeys: { safe: 256, standard: 1_024, absolute: 4_096 },
  semanticStringBytes: { safe: 16_384, standard: 65_536, absolute: 262_144 },
  columns: { safe: 64, standard: 256, absolute: 1_024 },
  swimlanes: { safe: 128, standard: 512, absolute: 2_048 },
  retainedCursors: { safe: 64, standard: 256, absolute: 1_024 },
  ensureRangeCards: { safe: 256, standard: 2_048, absolute: 8_192 },
  retainedDescriptors: { safe: 256, standard: 2_048, absolute: 8_192 },
  cardFields: { safe: 64, standard: 128, absolute: 256 },
  summarySections: { safe: 16, standard: 32, absolute: 64 },
  checklistGroups: { safe: 32, standard: 64, absolute: 128 },
  checklistItemsPerGroup: { safe: 1_024, standard: 4_096, absolute: 16_384 },
  cardRowsCompact: { safe: 6, standard: 6, absolute: 6 },
  cardRowsComfortable: { safe: 12, standard: 12, absolute: 12 },
  cardRowsSpacious: { safe: 18, standard: 18, absolute: 18 },
  descriptorRows: { safe: 32, standard: 32, absolute: 32 },
  selectedKeys: { safe: 10_000, standard: 50_000, absolute: 100_000 },
  concurrentCellLoads: { safe: 8, standard: 16, absolute: 64 },
  concurrentValidators: { safe: 4, standard: 16, absolute: 32 },
  pendingOperations: { safe: 32, standard: 128, absolute: 512 },
  retainedOperationIds: { safe: 1_024, standard: 8_192, absolute: 32_768 },
  retainedUndoDescriptors: { safe: 256, standard: 2_048, absolute: 8_192 },
  retainedObservations: { safe: 256, standard: 2_048, absolute: 8_192 },
  verticalOverscan: { safe: 1, standard: 4, absolute: 8 },
  horizontalOverscan: { safe: 1, standard: 4, absolute: 8 },
};

describe('Kanban identity and limits contracts', () => {
  it.each(['', '\u0000hidden', 'escape\u001b[31m', 'delete\u007f', 'control\u0085'])(
    'should reject unsafe identity input %j with a sanitized typed error',
    (input) => {
      for (const createId of ID_FACTORIES) {
        expect(() => createId(input)).toThrow(KanbanInvalidIdentityError);
        try {
          createId(input);
        } catch (error) {
          expect(error).toMatchObject({ code: 'invalid-identity' });
          if (input.length > 0) expect(String(error)).not.toContain(input);
        }
      }
    },
  );

  it('should enforce UTF-8 byte bounds rather than JavaScript character counts', () => {
    const exactly256Bytes = 'é'.repeat(128);
    const over256Bytes = `${exactly256Bytes}a`;

    expect(createKanbanColumnId(exactly256Bytes)).toBe(exactly256Bytes);
    expect(() => createKanbanColumnId(over256Bytes)).toThrow(KanbanInvalidIdentityError);
    expect(createPlacementToken('t'.repeat(2_048))).toBe('t'.repeat(2_048));
    expect(() => createPlacementToken('t'.repeat(2_049))).toThrow(KanbanInvalidIdentityError);
  });

  it.each(['review', '.review', 'review.', 'example..review', 'Example.review', 'jsvision.kanban.private'])(
    'should reject invalid extension namespace %j',
    (extensionId) => {
      expect(() => createKanbanExtensionId(extensionId)).toThrow(KanbanInvalidIdentityError);
    },
  );

  it('should reject duplicate structural identities atomically within one semantic namespace', () => {
    const published: string[] = [];

    expect(() =>
      validateKanbanUniqueIds('column', ['ready', 'doing', 'ready'], (ids) => published.push(...ids)),
    ).toThrow(KanbanInvalidIdentityError);
    expect(published).toEqual([]);
  });

  it('should publish every classified limit in a deeply immutable manifest', () => {
    expect(KANBAN_LIMITS).toEqual(EXPECTED_LIMITS);
    expect(Object.isFrozen(KANBAN_LIMITS)).toBe(true);

    for (const row of Object.values(KANBAN_LIMITS)) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(row.safe).toBeLessThanOrEqual(row.standard);
      expect(row.standard).toBeLessThanOrEqual(row.absolute);
    }
  });

  // Committed undo descriptors retain application callbacks or opaque tokens, so their whole-entry
  // capacity is independently configurable instead of borrowing an unrelated renderer limit.
  it('should publish an independently bounded retained undo descriptor limit', () => {
    expect(Object.entries(KANBAN_LIMITS)).toContainEqual([
      'retainedUndoDescriptors',
      { safe: 256, standard: 2_048, absolute: 8_192 },
    ]);
  });

  it.each([
    { class: 'safe', values: { columns: -1 } },
    { class: 'safe', values: { columns: 1.5 } },
    { class: 'safe', values: { columns: Number.MAX_SAFE_INTEGER + 1 } },
    { class: 'safe', values: { columns: 65 } },
    { class: 'standard', values: { columns: 257 } },
    { class: 'advanced', values: { columns: 1_025 } },
  ] as const)('should reject invalid limit selection %# before using it', (options) => {
    const onAccepted = vi.fn();
    const useLimits = () => {
      const limits = validateKanbanLimitOptions(options);
      onAccepted(limits);
    };

    expect(useLimits).toThrow(KanbanInvalidLimitError);
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('should validate retained descriptor capacity at standard and absolute boundaries', () => {
    expect(
      validateKanbanLimitOptions({
        class: 'standard',
        values: { retainedDescriptors: KANBAN_LIMITS.retainedDescriptors.standard },
      }).retainedDescriptors,
    ).toBe(2_048);
    expect(
      validateKanbanLimitOptions({
        class: 'advanced',
        values: { retainedDescriptors: KANBAN_LIMITS.retainedDescriptors.absolute },
      }).retainedDescriptors,
    ).toBe(8_192);
    expect(() => validateKanbanLimitOptions({ class: 'standard', values: { retainedDescriptors: 2_049 } })).toThrow(
      KanbanInvalidLimitError,
    );
    expect(() => validateKanbanLimitOptions({ class: 'advanced', values: { retainedDescriptors: 8_193 } })).toThrow(
      KanbanInvalidLimitError,
    );
  });
});

describe('Kanban semantic value contract', () => {
  it.each([null, true, 42, 'text', [null, false, 1, 'two'], { value: 'plain' }])(
    'should accept supported semantic value %#',
    (value) => {
      expect(snapshotKanbanSemanticValue(value)).toEqual(value);
    },
  );

  it('should create a sorted deeply frozen snapshot and normalize negative zero', () => {
    const input = { zebra: [-0, true, null], alpha: { value: 'ok' } };

    const snapshot = snapshotKanbanSemanticValue(input);

    if (snapshot === null || Array.isArray(snapshot) || typeof snapshot !== 'object') {
      throw new Error('the object input must produce an object snapshot');
    }
    const alpha = snapshot.alpha;
    const zebra = snapshot.zebra;
    if (alpha === null || Array.isArray(alpha) || typeof alpha !== 'object') {
      throw new Error('the nested object must remain an object');
    }
    if (!Array.isArray(zebra)) throw new Error('the nested array must remain an array');

    expect(Object.keys(snapshot)).toEqual(['alpha', 'zebra']);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(alpha)).toBe(true);
    expect(Object.isFrozen(zebra)).toBe(true);
    expect(Object.is(zebra[0], -0)).toBe(false);
    expect(zebra[0]).toBe(0);
    expect(snapshot).not.toBe(input);
  });

  it('should derive the same fingerprint for equivalent insertion orders', () => {
    const first: KanbanSemanticValue = { beta: 2, alpha: 1 };
    const second: KanbanSemanticValue = { alpha: 1, beta: 2 };

    expect(fingerprintKanbanSemanticValue(first)).toBe(fingerprintKanbanSemanticValue(second));
  });

  it.each([NaN, Number.POSITIVE_INFINITY, undefined, 1n, Symbol('unsafe'), () => 'unsafe', new Date(), Array(2)])(
    'should reject unsupported semantic value %#',
    (value) => {
      expect(() => snapshotKanbanSemanticValue(value)).toThrow(KanbanInvalidSemanticValueError);
    },
  );

  it('should reject cycles, accessors, and unsafe object keys without invoking user code', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const getter = () => {
      throw new Error('accessor must not run');
    };
    const withAccessor = Object.defineProperty({}, 'secret', { enumerable: true, get: getter });
    const unsafeKey = Object.defineProperty({}, '__proto__', {
      enumerable: true,
      value: { polluted: true },
    });

    expect(() => snapshotKanbanSemanticValue(cyclic)).toThrow(KanbanInvalidSemanticValueError);
    expect(() => snapshotKanbanSemanticValue(withAccessor)).toThrow(KanbanInvalidSemanticValueError);
    expect(() => snapshotKanbanSemanticValue(unsafeKey)).toThrow(KanbanInvalidSemanticValueError);
  });

  it('should enforce active semantic bounds during the single snapshot walk', () => {
    const tooDeep: { value: unknown } = { value: null };
    let cursor = tooDeep;
    for (let depth = 0; depth < 17; depth += 1) {
      const next: { value: unknown } = { value: null };
      cursor.value = next;
      cursor = next;
    }
    const tooManyKeys = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`key-${index}`, null]));
    const tooManyEncodedBytes = Array.from({ length: 17 }, () => 'x'.repeat(16_000));

    expect(() => snapshotKanbanSemanticValue('x'.repeat(16_385))).toThrow(KanbanInvalidSemanticValueError);
    expect(() => snapshotKanbanSemanticValue(Array.from({ length: 4_097 }, () => null))).toThrow(
      KanbanInvalidSemanticValueError,
    );
    expect(() => snapshotKanbanSemanticValue(tooDeep)).toThrow(KanbanInvalidSemanticValueError);
    expect(() => snapshotKanbanSemanticValue(tooManyKeys)).toThrow(KanbanInvalidSemanticValueError);
    expect(() => snapshotKanbanSemanticValue(tooManyEncodedBytes)).toThrow(KanbanInvalidSemanticValueError);
  });
});
