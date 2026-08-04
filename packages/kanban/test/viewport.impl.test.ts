import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { onCleanup } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import type {
  KanbanBoardCounts,
  KanbanCardAdapter,
  KanbanCardDescriptor,
  KanbanCellCounts,
  KanbanCellCursor,
  KanbanDataSource,
  KanbanKnownLength,
  KanbanQuerySession,
} from '../src/index.js';
import { KanbanDescriptorCache } from '../src/board/descriptor-cache.js';
import type { KanbanDescriptorCacheKey } from '../src/board/descriptor-cache.js';
import { calculateKanbanViewportDamage } from '../src/board/viewport-damage.js';
import { createKanbanViewportMetrics } from '../src/board/viewport-metrics.js';
import type { KanbanViewportProjection } from '../src/board/viewport-projector.js';
import { KanbanViewportSource } from '../src/board/viewport-source.js';

/** Creates a complete semantic cache key that varies only by card identity. */
function cacheKey(cardKey: number): KanbanDescriptorCacheKey {
  return {
    generation: 1,
    address: { columnId: 'ready' },
    cursorRevision: 1,
    cardKey,
    rendererRevision: 1,
    presentationPolicyRevision: 1,
    presentationSelectionFingerprint: 'mandatory-only',
    width: 18,
    rowBudget: 6,
    density: 'compact',
    themeRevision: 1,
    capabilityRevision: 1,
    interactionRevision: 1,
  };
}

/** Creates a frozen minimal descriptor suitable for cache-ownership tests. */
function descriptor(cardKey: number): KanbanCardDescriptor {
  return Object.freeze({
    cardKey,
    width: 18,
    measuredHeight: 1,
    surfaceRole: 'card.normal',
    borderRole: 'card.normal',
    marker: Object.freeze({ row: 0, column: 0, glyph: ' ', role: 'content.status', cues: Object.freeze([]) }),
    rows: Object.freeze([]),
    sections: Object.freeze([]),
    actions: Object.freeze([]),
    regions: Object.freeze([]),
    degradation: Object.freeze({ level: 'none', omittedSections: Object.freeze([]) }),
  });
}

/** Creates one immutable projection with optional card rectangles. */
function projection(cards: KanbanViewportProjection['cards'] = Object.freeze([])): KanbanViewportProjection {
  return Object.freeze({
    columns: Object.freeze([]),
    cards: Object.freeze(cards),
    regions: Object.freeze([]),
    actionTargets: Object.freeze([]),
    states: Object.freeze([]),
  });
}

describe('viewport descriptor cache and damage implementation', () => {
  it('evicts the least-recently-used scope and disposes every surviving scope exactly once', () => {
    const cache = new KanbanDescriptorCache(2);
    const disposed: number[] = [];
    const create = (key: number): KanbanCardDescriptor =>
      cache.getOrCreate(cacheKey(key), () => {
        onCleanup(() => disposed.push(key));
        return descriptor(key);
      });

    const first = create(1);
    create(2);
    expect(create(1)).toBe(first);
    create(3);
    expect(disposed).toEqual([2]);
    expect(cache.size).toBe(2);
    cache.retain([cacheKey(3)]);
    expect(disposed).toEqual([2, 1]);
    cache.dispose();
    cache.dispose();
    expect(disposed).toEqual([2, 1, 3]);
  });

  it('clips descriptor damage and uses one bounded scroll-exposed region', () => {
    const card = Object.freeze({
      columnId: 'ready',
      index: 0,
      descriptor: descriptor(1),
      descriptorColumnOffset: 0,
      descriptorRowOffset: 0,
      rect: Object.freeze({ x: -5, y: 2, width: 20, height: 4 }),
    });
    const bounds = { x: 0, y: 0, width: 10, height: 5 };
    const changed = calculateKanbanViewportDamage({
      previous: projection(),
      current: projection([card]),
      bounds,
      previousOffsets: { x: 0, y: 0 },
      currentOffsets: { x: 0, y: 0 },
    });
    expect(changed).toEqual([{ kind: 'descriptor', x: 0, y: 2, width: 10, height: 3 }]);

    const scrolled = calculateKanbanViewportDamage({
      previous: projection([card]),
      current: projection([card]),
      bounds,
      previousOffsets: { x: 0, y: 0 },
      currentOffsets: { x: 0, y: 1 },
    });
    expect(scrolled).toEqual([{ kind: 'scroll-exposed', ...bounds }]);
  });
});

describe('viewport source metric and ownership implementation', () => {
  it('reports mixed cursor knowledge as a lower bound and disposes each raw cursor once', () => {
    const unknownCount = Object.freeze({ quality: 'unknown' as const });
    const boardCounts: KanbanBoardCounts = Object.freeze({
      total: unknownCount,
      matching: unknownCount,
      loaded: unknownCount,
      visible: unknownCount,
      selected: unknownCount,
      wip: unknownCount,
    });
    const cellCounts: KanbanCellCounts = Object.freeze({
      total: unknownCount,
      matching: unknownCount,
      loaded: unknownCount,
    });
    const disposeCalls = new Map<string, number>();
    const lifecycle: string[] = [];
    const cursor = (columnId: string, length: KanbanKnownLength): KanbanCellCursor<{ readonly id: number }> => ({
      state: () => ({ kind: 'ready' }),
      counts: () => cellCounts,
      length: () => length,
      cardAt: () => undefined,
      ensureRange: async () => undefined,
      revision: () => 1,
      placementAt: () => ({ kind: 'unavailable', code: 'not-loaded', cursorRevision: 1 }),
      retry: () => undefined,
      dispose: () => {
        lifecycle.push(`cursor:${columnId}`);
        disposeCalls.set(columnId, (disposeCalls.get(columnId) ?? 0) + 1);
        if (columnId === 'exact') throw new Error('application cursor cleanup failed');
      },
    });
    const session: KanbanQuerySession<{ readonly id: number }> = {
      state: () => ({ kind: 'ready' }),
      revision: () => 1,
      columns: () => [
        { columnId: 'exact', label: 'Exact', revision: 1 },
        { columnId: 'unknown', label: 'Unknown', revision: 1 },
      ],
      swimlanes: () => [],
      counts: () => boardCounts,
      headers: () => ({
        revision: 1,
        columns: [
          { columnId: 'exact', label: 'Exact' },
          { columnId: 'unknown', label: 'Unknown' },
        ],
        swimlanes: [],
      }),
      identityChanges: () => ({ revision: 1, changes: [] }),
      cell: (address) =>
        cursor(address.columnId, address.columnId === 'exact' ? { kind: 'exact', value: 2 } : { kind: 'unknown' }),
      dispose: () => {
        lifecycle.push('session');
        throw new Error('application session cleanup failed');
      },
    };
    const source: KanbanDataSource<{ readonly id: number }> = {
      openQuery: (_query, options) => {
        options?.signal?.addEventListener('abort', () => lifecycle.push('abort'), { once: true });
        return session;
      },
    };
    const card: KanbanCardAdapter<{ readonly id: number }> = {
      keyOf: (value) => value.id,
      titleOf: (value) => String(value.id),
      statusOf: () => 'Ready',
    };
    const viewportSource = new KanbanViewportSource({
      source,
      query: { filters: [], sort: [] },
      card,
      beforeCursorDispose: (address) => lifecycle.push(`scope:${address.columnId}`),
    });
    const snapshot = viewportSource.refresh({
      width: 80,
      height: 4,
      horizontalOffset: 0,
      verticalOffset: 0,
      cardStride: 3,
    });

    const metrics = createKanbanViewportMetrics({
      bounds: { x: 0, y: 0, width: 80, height: 4 },
      source: snapshot,
      offsets: { x: 0, y: 0 },
      density: 'comfortable',
      overscan: { x: 0, y: 0 },
      minimumVerticalExtent: 40,
    });
    expect(metrics.extentQuality.y).toBe('lower-bound');
    expect(metrics.extents.y).toBe(40);
    const unknownOnlySnapshot = Object.freeze({
      ...snapshot,
      cells: Object.freeze(snapshot.cells.filter((cell) => cell.address.columnId === 'unknown')),
    });
    const locatorBoundMetrics = createKanbanViewportMetrics({
      bounds: { x: 0, y: 0, width: 80, height: 4 },
      source: unknownOnlySnapshot,
      offsets: { x: 0, y: 0 },
      density: 'comfortable',
      overscan: { x: 0, y: 0 },
      minimumVerticalExtent: 40,
    });
    expect(locatorBoundMetrics.extentQuality.y).toBe('lower-bound');
    expect(locatorBoundMetrics.extents.y).toBe(40);
    viewportSource.dispose();
    viewportSource.dispose();
    expect(disposeCalls).toEqual(
      new Map([
        ['exact', 1],
        ['unknown', 1],
      ]),
    );
    expect(lifecycle).toEqual(['abort', 'scope:exact', 'cursor:exact', 'scope:unknown', 'cursor:unknown', 'session']);
  });
});

describe('absolute placement source guard', () => {
  it('allows raw absolute geometry only in the exact-cell viewport implementation family', () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const candidates: string[] = [];
    for (const directory of ['board', 'dialogs']) {
      const root = join(packageRoot, 'src', directory);
      try {
        const pending = [root];
        while (pending.length > 0) {
          const current = pending.pop();
          if (current === undefined) break;
          for (const entry of readdirSync(current, { withFileTypes: true })) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) pending.push(path);
            else if (extname(path) === '.ts') candidates.push(path);
          }
        }
      } catch {
        // Optional dialog source is absent in the foundation package.
      }
    }
    const violations = candidates
      .filter((path) => !/(?:^|\/)(?:kanban-viewport|viewport-[^/]+)\.ts$/u.test(path))
      .filter((path) => /position\s*:\s*['"]absolute['"]/u.test(readFileSync(path, 'utf8')))
      .map((path) => relative(packageRoot, path));
    expect(violations).toEqual([]);
  });
});
