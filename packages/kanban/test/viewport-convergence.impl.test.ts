import { describe, expect, it } from 'vitest';

import { resolveKanbanProjectionConvergenceFailure } from '../src/board/viewport-convergence.js';
import type { KanbanViewportProjection } from '../src/board/viewport-projector.js';

/** Creates minimal authoritative geometry containing chrome plus interactive card/cell regions. */
function projection(): KanbanViewportProjection {
  const address = Object.freeze({ columnId: 'ready' });
  const header = Object.freeze({
    kind: 'workflow-header' as const,
    x: 0,
    y: 0,
    width: 20,
    height: 1,
    columnId: 'ready',
    actionable: false as const,
  });
  const card = Object.freeze({
    kind: 'card' as const,
    x: 1,
    y: 2,
    width: 18,
    height: 4,
    columnId: 'ready',
    cardKey: 1,
    actionable: false as const,
  });
  return Object.freeze({
    scene: Object.freeze({
      revision: 'scene-v1',
      queryGeneration: 1,
      sessionRevision: 'session-v1',
      columns: Object.freeze([]),
      swimlanes: Object.freeze([]),
      cells: Object.freeze([
        Object.freeze({
          address,
          cursorRevision: 'cursor-v1',
          state: Object.freeze({ kind: 'ready' as const }),
          cards: Object.freeze([]),
        }),
      ]),
      cards: Object.freeze([]),
      states: Object.freeze([]),
      detached: Object.freeze({}),
    }),
    geometry: Object.freeze({
      revision: 'geometry-v1',
      requestedVariant: 'hybrid',
      resolvedVariant: 'hybrid',
      visibleColumnIds: Object.freeze(['ready']),
      offsets: Object.freeze({ x: 0, y: 0 }),
      extents: Object.freeze({ x: 0, y: 10 }),
      contentOrigin: Object.freeze({ x: 0, y: 2 }),
      workflowHeaders: Object.freeze([]),
      swimlaneChrome: Object.freeze([]),
      cells: Object.freeze([
        Object.freeze({ address: Object.freeze({ columnId: 'ready' }), x: 0, y: 2, width: 20, height: 8 }),
      ]),
      cards: Object.freeze([
        Object.freeze({
          cardKey: 1,
          address: Object.freeze({ columnId: 'ready' }),
          logicalIndex: 0,
          descriptorColumnOffset: 0,
          descriptorRowOffset: 0,
          x: 1,
          y: 2,
          width: 18,
          height: 4,
        }),
      ]),
      regions: Object.freeze([header, card]),
      changedRegions: Object.freeze([]),
    }),
    columns: Object.freeze([]),
    cards: Object.freeze([]),
    regions: Object.freeze([header, card]),
    actionTargets: Object.freeze([]),
    states: Object.freeze([]),
  });
}

describe('viewport convergence containment', () => {
  it('reuses a completed projection only for a complete matching fingerprint', () => {
    const completed = projection();
    const result = resolveKanbanProjectionConvergenceFailure({
      fingerprint: 'compatible',
      completedFingerprint: 'compatible',
      completed,
      latest: projection(),
      bounds: { x: 0, y: 0, width: 20, height: 10 },
    });

    expect(result).toEqual({ projection: completed, reusedCompleted: true });
    expect(result.projection).toBe(completed);
  });

  it('publishes current-bounds chrome without interactive geometry for an incompatible generation', () => {
    const result = resolveKanbanProjectionConvergenceFailure({
      fingerprint: 'current-generation',
      completedFingerprint: 'previous-generation',
      completed: projection(),
      latest: projection(),
      bounds: { x: 0, y: 0, width: 32, height: 12 },
    });

    expect(result.reusedCompleted).toBe(false);
    expect(result.projection.cards).toEqual([]);
    expect(result.projection.actionTargets).toEqual([]);
    expect(result.projection.regions.map(({ kind }) => kind)).toEqual(['workflow-header']);
    expect(result.projection.geometry?.cards).toEqual([]);
    expect(result.projection.geometry?.cells).toEqual([]);
    expect(result.projection.scene?.cards).toEqual([]);
    expect(result.projection.scene?.cells).toEqual([]);
    expect(result.projection.geometry?.changedRegions).toEqual([{ x: 0, y: 0, width: 32, height: 12 }]);
  });
});
