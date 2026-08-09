import { describe, expect, it } from 'vitest';

import {
  buildKanbanScene,
  calculateKanbanSceneDamage,
  projectKanbanSceneGeometry,
  projectKanbanSceneHits,
} from '../src/index.js';

/** Creates the semantic descriptor subset consumed by scene, hit, and damage projection. */
function descriptor(cardKey: string, revision = `${cardKey}-v1`) {
  return {
    cardKey,
    width: 20,
    measuredHeight: 3,
    presentationRevision: revision,
    regions: [{ regionId: 'primary:open', actionId: 'application.open-card', x: 1, y: 1, width: 8, height: 1 }],
  };
}

/** Creates one sparse two-dimensional scene input with a configurable resident-card count. */
function input(cardCount = 4) {
  return {
    revision: 'scene-v1',
    queryGeneration: 3,
    sessionRevision: 'session-v1',
    columns: [
      { columnId: 'ready', label: 'Ready', revision: 'ready-v1' },
      { columnId: 'doing', label: 'Doing', revision: 'doing-v1' },
    ],
    swimlanes: [
      { swimlaneId: 'alpha', label: 'Alpha', revision: 'alpha-v1' },
      { swimlaneId: 'beta', label: 'Beta', revision: 'beta-v1' },
    ],
    cells: [
      {
        address: { columnId: 'ready', swimlaneId: 'alpha' },
        cursorRevision: 'ready-alpha-v1',
        state: { kind: 'ready' as const },
        cards: Array.from({ length: cardCount }, (_, logicalIndex) => ({
          cardKey: `card-${logicalIndex}`,
          logicalIndex,
          entityRevision: `entity-${logicalIndex}-v1`,
          descriptor: descriptor(`card-${logicalIndex}`),
          interaction: { focused: logicalIndex === 0 },
          workflow: { allowed: true },
        })),
      },
      {
        address: { columnId: 'doing', swimlaneId: 'beta' },
        cursorRevision: 'doing-beta-v1',
        state: { kind: 'empty' as const },
        cards: [],
      },
    ],
    detached: { hidden: ['archived'], collapsed: ['beta'] },
  };
}

/** Projects a standard wide geometry suitable for target and damage assertions. */
function geometry(scene: ReturnType<typeof buildKanbanScene>) {
  return projectKanbanSceneGeometry(scene, {
    bounds: { x: 0, y: 0, width: 80, height: 24 },
    variant: 'hybrid',
    offsets: { x: 0, y: 0 },
    minimumColumnWidth: 18,
  });
}

describe('scene projector implementation', () => {
  it('clips global descriptor retention in source order without synthesizing Cartesian cells', () => {
    const scene = buildKanbanScene({ ...input(10), descriptorLimit: 3 });

    expect(scene.cards.map(({ cardKey }) => cardKey)).toEqual(['card-0', 'card-1', 'card-2']);
    expect(scene.cells).toHaveLength(2);
    expect(scene.states).toEqual([
      {
        code: 'descriptor-limit',
        scope: { kind: 'cell', address: { columnId: 'ready', swimlaneId: 'alpha' } },
        actionable: false,
        omittedCount: 7,
      },
    ]);
    expect(Object.isFrozen(scene.detached)).toBe(true);
  });

  it('keeps semantic card identity and cell placement invariant across built-in variants', () => {
    const scene = buildKanbanScene({ ...input(), descriptorLimit: 16 });
    const variants = ['hybrid', 'separator', 'band', 'rail'] as const;
    const projections = variants.map((variant) =>
      projectKanbanSceneGeometry(scene, {
        bounds: { x: 0, y: 0, width: 100, height: 24 },
        variant,
        offsets: { x: 0, y: 0 },
        minimumColumnWidth: 18,
        railWidth: 10,
      }),
    );

    const identities = projections.map((projection) =>
      projection.cards.map(({ cardKey, address, logicalIndex }) => ({ cardKey, address, logicalIndex })),
    );
    expect(identities.every((value) => JSON.stringify(value) === JSON.stringify(identities[0]))).toBe(true);
    expect(projections.map(({ resolvedVariant }) => resolvedVariant)).toEqual(variants);
    expect(
      projections.every((projection) => projection.regions.every(({ width, height }) => width > 0 && height > 0)),
    ).toBe(true);
  });

  it('retains only the highest-priority clipped targets at the finite ceiling', () => {
    const scene = buildKanbanScene({ ...input(), descriptorLimit: 16 });
    const hits = projectKanbanSceneHits(scene, geometry(scene), { maximumTargets: 2 });

    expect(hits.targets).toHaveLength(2);
    expect(hits.targets.map(({ kind }) => kind)).toEqual(['card-action', 'card-action']);
    expect(hits.targets.every(({ zIndex }) => zIndex === 500)).toBe(true);
    expect(hits.targets.every(({ width, height }) => width > 0 && height > 0)).toBe(true);
  });

  it('returns no damage for semantic equality and bounds structural fallback evidence', () => {
    const scene = buildKanbanScene({ ...input(), descriptorLimit: 16 });
    const projected = geometry(scene);
    const bounds = { x: 0, y: 0, width: 80, height: 24 };

    expect(
      calculateKanbanSceneDamage({
        previousScene: scene,
        currentScene: scene,
        previousGeometry: projected,
        currentGeometry: projected,
        bounds,
        maximumRegions: 4,
      }),
    ).toEqual([]);

    const structural = calculateKanbanSceneDamage({
      previousScene: scene,
      currentScene: { ...scene, revision: 'scene-v2' },
      previousGeometry: projected,
      currentGeometry: { ...projected, revision: 'geometry-v2', changedRegions: [{ x: 2, y: 3, width: 4, height: 2 }] },
      bounds,
      maximumRegions: 4,
    });
    expect(structural).toEqual([{ kind: 'sticky', x: 2, y: 3, width: 4, height: 2 }]);

    const whole = calculateKanbanSceneDamage({
      previousScene: scene,
      currentScene: { ...scene, revision: 'scene-v3' },
      previousGeometry: projected,
      currentGeometry: {
        ...projected,
        revision: 'geometry-v3',
        changedRegions: Array.from({ length: 5 }, (_, x) => ({ x, y: 0, width: 1, height: 1 })),
      },
      bounds,
      maximumRegions: 4,
    });
    expect(whole).toEqual([{ kind: 'whole-viewport', ...bounds }]);
  });
});
