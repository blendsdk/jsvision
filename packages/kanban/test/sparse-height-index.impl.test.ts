import { describe, expect, it } from 'vitest';

import { createKanbanSparseHeightIndex, KanbanDisposedResourceError } from '../src/index.js';

/** Creates one deterministic index with small budgets suitable for run-shape assertions. */
function index(options: { readonly logicalLength?: number; readonly anchors?: number; readonly runs?: number } = {}) {
  return createKanbanSparseHeightIndex({
    logicalLength: options.logicalLength ?? 32,
    estimatedHeight: 3,
    maximumAnchors: options.anchors ?? 16,
    maximumRuns: options.runs ?? 16,
    sourceRevision: 'source-v1',
    cursorRevision: 'cursor-v1',
    presentationRevision: 'presentation-v1',
  });
}

describe('sparse height index implementation', () => {
  it('splits and merges measured runs without allocating unloaded positions', () => {
    const heights = index();
    heights.measure({ cardKey: 'one', logicalIndex: 1, height: 4 });
    heights.measure({ cardKey: 'three', logicalIndex: 3, height: 7 });
    expect(heights.snapshot()).toMatchObject({ retainedAnchors: 2, retainedRuns: 2, allocatedEntries: 6 });

    heights.measure({ cardKey: 'two', logicalIndex: 2, height: 5 });
    expect(heights.snapshot()).toMatchObject({ retainedAnchors: 3, retainedRuns: 1, allocatedEntries: 7 });

    heights.measure({ cardKey: 'two', logicalIndex: 8, height: 5 });
    expect(heights.snapshot()).toMatchObject({ retainedAnchors: 3, retainedRuns: 3, allocatedEntries: 9 });
    heights.dispose();
  });

  it('evicts oldest exact measurements until both anchor and run ceilings hold', () => {
    const heights = index({ anchors: 3, runs: 2 });
    for (const logicalIndex of [0, 4, 8, 12, 16]) {
      heights.measure({ cardKey: `card-${logicalIndex}`, logicalIndex, height: 4 });
    }

    const snapshot = heights.snapshot();
    expect(snapshot.retainedAnchors).toBeLessThanOrEqual(3);
    expect(snapshot.retainedRuns).toBeLessThanOrEqual(2);
    expect(snapshot.allocatedEntries).toBeLessThanOrEqual(7);
    expect(heights.anchorFor('card-0')).toBeUndefined();
    expect(heights.anchorFor('card-16')).toMatchObject({ logicalIndex: 16, height: 4, quality: 'exact' });
    heights.dispose();
  });

  it('projects only retained source-ordered identities inside a logical range', () => {
    const heights = index();
    heights.measure({ cardKey: 'card-9', logicalIndex: 9, height: 5 });
    heights.measure({ cardKey: 'card-3', logicalIndex: 3, height: 7 });
    heights.measure({ cardKey: 'card-6', logicalIndex: 6, height: 4 });

    expect(heights.identitiesInRange(4, 10)).toEqual([
      { cardKey: 'card-6', logicalIndex: 6 },
      { cardKey: 'card-9', logicalIndex: 9 },
    ]);
    expect(heights.identitiesInRange(10, 20)).toEqual([]);
    heights.dispose();
  });

  it('replaces stale retained identity when a revised card occupies the same logical index', () => {
    const heights = index();
    heights.measure({ cardKey: 'old-card', logicalIndex: 5, height: 4 });
    heights.invalidateRevisions({
      sourceRevision: 'source-v2',
      cursorRevision: 'cursor-v2',
      presentationRevision: 'presentation-v1',
    });
    heights.measure({ cardKey: 'new-card', logicalIndex: 5, height: 7 });

    expect(heights.identitiesInRange(0, 10)).toEqual([{ cardKey: 'new-card', logicalIndex: 5 }]);
    expect(heights.interactionIdentity('old-card')).toBeUndefined();
    heights.dispose();
  });

  it('matches a naive bounded prefix model across deterministic measurement patterns', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const logicalLength = 64;
      const heights = index({ logicalLength, anchors: 64, runs: 64 });
      const measured = new Map<number, number>();
      let state = seed;
      for (let sample = 0; sample < 24; sample += 1) {
        state = (state * 48_271) % 2_147_483_647;
        const logicalIndex = state % logicalLength;
        const height = 1 + (state % 12);
        measured.set(logicalIndex, height);
        heights.measure({ cardKey: `card-${logicalIndex}`, logicalIndex, height });
      }

      for (let boundary = 0; boundary <= logicalLength; boundary += 1) {
        let expected = boundary * 3;
        for (const [logicalIndex, height] of measured) {
          if (logicalIndex < boundary) expected += height - 3;
        }
        expect(heights.rowAt(boundary).value).toBe(expected);
      }
      for (let logicalIndex = 0; logicalIndex < logicalLength; logicalIndex += 1) {
        expect(heights.indexAt(heights.rowAt(logicalIndex).value).logicalIndex).toBe(logicalIndex);
      }
      heights.dispose();
    }
  });

  it('saturates impractical extents while preserving exact integer coordinates', () => {
    const heights = index({ logicalLength: Number.MAX_SAFE_INTEGER, anchors: 2, runs: 2 });
    expect(heights.rowAt(Number.MAX_SAFE_INTEGER).value).toBe(Number.MAX_SAFE_INTEGER);
    expect(heights.indexAt(Number.MAX_SAFE_INTEGER).logicalIndex).toBeGreaterThan(0);
    expect(heights.snapshot().allocatedEntries).toBe(0);
    heights.dispose();
  });

  it('invalidates incompatible exact runs and rejects every operation after disposal', () => {
    const heights = index();
    heights.measure({ cardKey: 'card-4', logicalIndex: 4, height: 9 });
    heights.measure({ cardKey: 'card-5', logicalIndex: 5, height: 8 });
    expect(
      heights.invalidateRevisions({
        sourceRevision: 'source-v1',
        cursorRevision: 'cursor-v2',
        presentationRevision: 'presentation-v1',
      }),
    ).toBe(2);
    expect(heights.snapshot()).toMatchObject({ retainedAnchors: 0, retainedRuns: 0 });

    heights.dispose();
    expect(() => heights.snapshot()).toThrow(KanbanDisposedResourceError);
    expect(() => heights.rowAt(0)).toThrow(KanbanDisposedResourceError);
    expect(() => heights.measure({ cardKey: 'late', logicalIndex: 0, height: 2 })).toThrow(KanbanDisposedResourceError);
  });
});
