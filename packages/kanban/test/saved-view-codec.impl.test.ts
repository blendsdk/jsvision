import { describe, expect, it, vi } from 'vitest';

import { KANBAN_SAVED_VIEW_LIMITS } from '../src/view/saved-view-limits.js';
import { parseKanbanSavedView, serializeKanbanSavedView } from '../src/view/saved-view-codec.js';
import type { KanbanSavedViewV1 } from '../src/view/saved-view-types.js';
import { snapshotKanbanSemanticValue } from '../src/contract/semantic-query.js';

/** Creates one complete current envelope for deterministic boundary mutations. */
function view(replacement: Partial<KanbanSavedViewV1> = {}): KanbanSavedViewV1 {
  return {
    kind: 'jsvision-kanban-view',
    version: 1,
    view: {
      searchPolicy: 'transient',
      filters: [],
      quickFilters: [],
      sort: [],
      columns: { items: [] },
      swimlanes: { items: [] },
      presentation: {
        density: 'comfortable',
        cardFieldIds: [],
        summaryIds: [],
        checklist: 'hidden',
      },
    },
    ...replacement,
  };
}

/** Small deterministic generator used to exercise semantic shapes without a runtime dependency. */
function generatedExtension(seed: number) {
  const astral = String.fromCodePoint(0x10000 + seed);
  return {
    [`key-${seed % 7}`]: seed,
    nested: {
      alpha: seed % 2 === 0,
      [astral]: [seed, -seed, null, `value-${seed}`],
    },
  } as const;
}

describe('Kanban saved-view codec implementation boundaries', () => {
  it('should keep deterministic generated parse-serialize-parse cycles idempotent', () => {
    for (let seed = 0; seed < 128; seed += 1) {
      const input = view({ extensions: { [`app.generated-${seed}`]: generatedExtension(seed) } });

      const first = parseKanbanSavedView(input);
      expect(first.kind).toBe('parsed');
      if (first.kind !== 'parsed') continue;
      const canonical = serializeKanbanSavedView(first.value);
      const second = parseKanbanSavedView(canonical);

      expect(second).toEqual(first);
      expect(second.kind === 'parsed' ? serializeKanbanSavedView(second.value) : '').toBe(canonical);
    }
  });

  it('should accept exact string and extension limits and reject one additional unit', () => {
    const maximumName = 'x'.repeat(KANBAN_SAVED_VIEW_LIMITS.stringBytes);
    expect(parseKanbanSavedView(view({ name: maximumName })).kind).toBe('parsed');
    expect(parseKanbanSavedView(view({ name: `${maximumName}x` }))).toEqual({
      kind: 'rejected',
      diagnostic: { code: 'invalid-view' },
    });

    const extensions = Object.fromEntries(
      Array.from({ length: KANBAN_SAVED_VIEW_LIMITS.extensions }, (_, index) => [`app.limit-${index}`, index]),
    );
    expect(parseKanbanSavedView(view({ extensions })).kind).toBe('parsed');
    expect(parseKanbanSavedView(view({ extensions: { ...extensions, 'app.limit-overflow': true } }))).toEqual({
      kind: 'rejected',
      diagnostic: { code: 'invalid-view' },
    });
  });

  it('should reject accessors without invocation and normalize failing proxy inspection', () => {
    const getter = vi.fn(() => 'secret');
    const accessor = Object.defineProperty(view(), 'name', { enumerable: true, get: getter });

    expect(parseKanbanSavedView(accessor)).toEqual({
      kind: 'rejected',
      diagnostic: { code: 'invalid-view' },
    });
    expect(getter).not.toHaveBeenCalled();

    const proxy = new Proxy(view(), {
      ownKeys: () => {
        throw new Error('classified-proxy-error');
      },
    });
    const result = parseKanbanSavedView(proxy);
    expect(result).toEqual({ kind: 'rejected', diagnostic: { code: 'invalid-view' } });
    expect(JSON.stringify(result)).not.toContain('classified-proxy-error');
  });

  it('should reject sparse, cyclic, and non-finite semantic extension values atomically', () => {
    const sparse = Array.from({ length: 2 });
    delete sparse[0];
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    for (const extension of [sparse, cyclic, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(parseKanbanSavedView({ ...view(), extensions: { 'app.invalid': extension } })).toEqual({
        kind: 'rejected',
        diagnostic: { code: 'invalid-view' },
      });
    }
  });

  it('should reject oversized containers before copying unbounded property descriptors', () => {
    const oversizedArray = new Proxy(new Array(KANBAN_SAVED_VIEW_LIMITS.arrayEntries + 1), {
      ownKeys: () => {
        throw new Error('array-own-keys-should-not-run');
      },
    });
    const descriptorReads = vi.fn(() => undefined);
    const keys = Array.from({ length: KANBAN_SAVED_VIEW_LIMITS.objectKeys + 1 }, (_, index) => `key-${index}`);
    const oversizedRecord = new Proxy(
      {},
      {
        ownKeys: () => keys,
        getOwnPropertyDescriptor: descriptorReads,
      },
    );

    expect(() => snapshotKanbanSemanticValue(oversizedArray)).toThrow();
    expect(() => snapshotKanbanSemanticValue(oversizedRecord)).toThrow();
    expect(descriptorReads).not.toHaveBeenCalled();
  });
});
