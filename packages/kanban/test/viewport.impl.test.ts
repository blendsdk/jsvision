import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { onCleanup } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import type { KanbanCardDescriptor } from '../src/index.js';
import { KanbanDescriptorCache } from '../src/board/descriptor-cache.js';
import type { KanbanDescriptorCacheKey } from '../src/board/descriptor-cache.js';
import { calculateKanbanViewportDamage } from '../src/board/viewport-damage.js';
import type { KanbanViewportProjection } from '../src/board/viewport-projector.js';

/** Creates a complete semantic cache key that varies only by card identity. */
function cacheKey(cardKey: number): KanbanDescriptorCacheKey {
  return {
    generation: 1,
    address: { columnId: 'ready' },
    cursorRevision: 1,
    cardKey,
    rendererRevision: 1,
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
