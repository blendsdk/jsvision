import { describe, expect, it } from 'vitest';

import {
  buildKanbanScene,
  calculateKanbanSceneDamage,
  createKanbanSparseHeightIndex,
  projectKanbanSceneGeometry,
  projectKanbanSceneHits,
  resolveKanbanSceneWindow,
  validateKanbanLimitOptions,
} from '../src/index.js';

function descriptor(cardKey: string, height: number, revision = `${cardKey}-v1`) {
  return {
    cardKey,
    width: 20,
    measuredHeight: height,
    presentationRevision: revision,
    surfaceRole: 'card.surface',
    borderRole: 'card.border',
    marker: { glyph: '>', role: 'card.focused', cues: ['focused'] },
    rows: Array.from({ length: height }, (_, index) => ({
      section: index === 0 ? 'title' : 'status',
      spans: [{ text: index === 0 ? cardKey : 'Ready', role: 'content.title' }],
    })),
    regions: [{ regionId: 'open', actionId: 'open-card', x: 0, y: 0, width: 8, height: 1 }],
    sections: [],
    degradation: { omittedSections: [] },
  };
}

function sceneInput(cardCount = 3) {
  return {
    revision: 'scene-v1',
    queryGeneration: 7,
    sessionRevision: 'session-v4',
    columns: [
      { columnId: 'ready', label: 'Ready', revision: 'ready-v1' },
      { columnId: 'doing', label: 'Doing', revision: 'doing-v1' },
    ],
    swimlanes: [
      { swimlaneId: 'team-a', label: 'Team A', revision: 'team-a-v1', count: { quality: 'exact', value: 2 } },
      { swimlaneId: 'team-b', label: 'Team B', revision: 'team-b-v1', count: { quality: 'exact', value: 1 } },
    ],
    cells: [
      {
        address: { columnId: 'ready', swimlaneId: 'team-a' },
        cursorRevision: 'ready-team-a-v1',
        state: { kind: 'ready' as const },
        cards: Array.from({ length: cardCount }, (_, index) => ({
          cardKey: `card-${index}`,
          logicalIndex: index,
          entityRevision: `entity-${index}-v1`,
          descriptor: descriptor(`card-${index}`, 2 + (index % 3)),
          interaction: { focused: index === 0, selected: false },
          workflow: { kind: 'allowed' as const },
        })),
      },
      {
        address: { columnId: 'doing', swimlaneId: 'team-b' },
        cursorRevision: 'doing-team-b-v1',
        state: { kind: 'empty' as const },
        cards: [],
      },
    ],
    detached: {
      hidden: [{ kind: 'swimlane' as const, swimlaneId: 'team-hidden' }],
      collapsed: [{ kind: 'column' as const, columnId: 'doing' }],
    },
  };
}

describe('Kanban canonical scene and variable-height geometry', () => {
  it('keeps sparse height storage bounded for one hundred thousand logical cards', () => {
    const index = createKanbanSparseHeightIndex({
      logicalLength: 100_000,
      estimatedHeight: 3,
      maximumAnchors: 8,
      maximumRuns: 12,
      sourceRevision: 'source-v1',
      cursorRevision: 'cursor-v1',
      presentationRevision: 'presentation-v1',
    });
    for (let logicalIndex = 0; logicalIndex < 100_000; logicalIndex += 4_997) {
      index.measure({ cardKey: `card-${logicalIndex}`, logicalIndex, height: 2 + (logicalIndex % 17) });
    }
    const snapshot = index.snapshot();

    expect(snapshot.logicalLength).toBe(100_000);
    expect(snapshot.retainedAnchors).toBeLessThanOrEqual(8);
    expect(snapshot.retainedRuns).toBeLessThanOrEqual(12);
    expect(snapshot.allocatedEntries).toBeLessThan(100);
    expect(index.rowAt(99_999).value).toBeGreaterThan(0);
    expect(index.indexAt(index.rowAt(50_000).value).logicalIndex).toBeLessThanOrEqual(50_000);
    expect(Object.isFrozen(snapshot)).toBe(true);
    index.dispose();
  });

  it('preserves a growing visible anchor with at most one correction pass', () => {
    const index = createKanbanSparseHeightIndex({
      logicalLength: 1_000,
      estimatedHeight: 3,
      maximumAnchors: 16,
      maximumRuns: 16,
      sourceRevision: 'source-v1',
      cursorRevision: 'cursor-v1',
      presentationRevision: 'presentation-v1',
    });
    const before = index.anchor({ cardKey: 'card-500', logicalIndex: 500, viewportRow: 6 });
    const correction = index.measure({ cardKey: 'card-500', logicalIndex: 500, height: 12, anchor: before });

    expect(correction).toEqual({
      kind: 'corrected',
      cardKey: 'card-500',
      logicalIndex: 500,
      viewportRow: 6,
      passes: 1,
    });
    expect(index.anchorFor('card-500')).toMatchObject({ cardKey: 'card-500', viewportRow: 6, height: 12 });
    index.dispose();
  });

  it('invalidates incompatible measurements while unload retains interaction identity', () => {
    const index = createKanbanSparseHeightIndex({
      logicalLength: 20,
      estimatedHeight: 3,
      maximumAnchors: 8,
      maximumRuns: 8,
      sourceRevision: 'source-v1',
      cursorRevision: 'cursor-v1',
      presentationRevision: 'presentation-v1',
    });
    index.measure({ cardKey: 'card-5', logicalIndex: 5, height: 8 });
    index.unload('card-5');
    expect(index.interactionIdentity('card-5')).toEqual({ cardKey: 'card-5', logicalIndex: 5 });

    index.measure({ cardKey: 'card-5', logicalIndex: 5, height: 8 });
    index.reconcile({ kind: 'reorder', cardKey: 'card-5', logicalIndex: 9, sourceRevision: 'source-v2' });
    expect(index.anchorFor('card-5')).toMatchObject({ cardKey: 'card-5', logicalIndex: 9, quality: 'estimated' });
    index.reconcile({ kind: 'delete', cardKey: 'card-5', sourceRevision: 'source-v3' });
    expect(index.anchorFor('card-5')).toBeUndefined();
    expect(index.interactionIdentity('card-5')).toBeUndefined();
    index.dispose();
  });

  it('builds a frozen source-ordered sparse scene without Cartesian cells or terminal rectangles', () => {
    const input = sceneInput();
    const scene = buildKanbanScene({ ...input, descriptorLimit: 8 });

    expect(scene.columns.map(({ columnId }: { readonly columnId: string }) => columnId)).toEqual(['ready', 'doing']);
    expect(scene.swimlanes.map(({ swimlaneId }: { readonly swimlaneId: string }) => swimlaneId)).toEqual([
      'team-a',
      'team-b',
    ]);
    expect(scene.cells).toHaveLength(2);
    expect(scene.cells.map(({ address }: { readonly address: unknown }) => address)).toEqual(
      input.cells.map(({ address }) => address),
    );
    expect(scene.cards.map(({ cardKey }) => cardKey)).toEqual(['card-0', 'card-1', 'card-2']);
    expect(scene.detached).toEqual(input.detached);
    expect(JSON.stringify(scene)).not.toMatch(/"rect"\s*:/u);
    expect(
      [scene, scene.columns, scene.swimlanes, scene.cells, scene.cards, scene.detached].every(Object.isFrozen),
    ).toBe(true);
  });

  it('uses compatible layout hints without opening a Cartesian matrix and fails honest without hints', () => {
    const opened: unknown[] = [];
    const openCell = (address: unknown) => opened.push(address);
    const hinted = resolveKanbanSceneWindow({
      queryGeneration: 7,
      sessionRevision: 'session-v4',
      requestedSwimlaneRange: { start: 900, end: 903 },
      visibleColumnIds: ['ready', 'doing'],
      overscan: { rows: 1, columns: 0 },
      layoutHint: {
        queryGeneration: 7,
        sessionRevision: 'session-v4',
        rows: [{ start: 899, end: 904, extent: 18, quality: 'lower-bound' }],
      },
      openCell,
    });

    expect(hinted.kind).toBe('available');
    if (hinted.kind !== 'available') throw new Error('Expected the compatible scene window to be available.');
    expect(opened.length).toBeLessThanOrEqual(10);
    expect(opened.length).toBe(hinted.requestedCells.length);
    const withoutHints = resolveKanbanSceneWindow({
      queryGeneration: 7,
      sessionRevision: 'session-v4',
      requestedSwimlaneRange: { start: 900, end: 903 },
      visibleColumnIds: ['ready', 'doing'],
      overscan: { rows: 1, columns: 0 },
      openCell,
    });
    expect(withoutHints).toEqual({ kind: 'unavailable', code: 'distant-layout-unknown', retryable: true });
  });

  it('clips descriptor demand deterministically to a non-actionable partial scene state', () => {
    const limits = validateKanbanLimitOptions({ class: 'safe', values: { retainedDescriptors: 3 } });
    const scene = buildKanbanScene({
      ...sceneInput(limits.retainedDescriptors + 1),
      descriptorLimit: limits.retainedDescriptors,
    });

    expect(scene.cards.map(({ cardKey }) => cardKey)).toEqual(['card-0', 'card-1', 'card-2']);
    expect(scene.states).toContainEqual({
      code: 'descriptor-limit',
      scope: { kind: 'cell', address: { columnId: 'ready', swimlaneId: 'team-a' } },
      actionable: false,
      omittedCount: 1,
    });
    const geometry = projectKanbanSceneGeometry(scene, {
      bounds: { x: 0, y: 0, width: 80, height: 24 },
      variant: 'hybrid',
      offsets: { x: 0, y: 0 },
      minimumColumnWidth: 18,
    });
    const hits = projectKanbanSceneHits(scene, geometry, { maximumTargets: 32 });
    expect(hits.targets.some(({ cardKey }) => cardKey === 'card-3')).toBe(false);
  });

  it('pins workflow and active swimlane chrome without allowing cards to paint over it', () => {
    const scene = buildKanbanScene({ ...sceneInput(), descriptorLimit: 8 });
    for (const variant of ['hybrid', 'separator', 'band', 'rail'] as const) {
      const geometry = projectKanbanSceneGeometry(scene, {
        bounds: { x: 0, y: 0, width: 80, height: 24 },
        variant,
        offsets: { x: 8, y: 9 },
        activeSwimlaneId: 'team-a',
        minimumColumnWidth: 18,
      });
      expect(geometry.workflowHeaders.every(({ y }: { readonly y: number }) => y === 1)).toBe(true);
      expect(
        geometry.swimlaneChrome.find(({ swimlaneId }: { readonly swimlaneId: string }) => swimlaneId === 'team-a')
          ?.sticky,
      ).toBe(true);
      for (const card of geometry.cards as readonly { readonly y: number }[]) {
        expect(card.y).toBeGreaterThanOrEqual(geometry.contentOrigin.y);
      }
      expect(
        geometry.regions.every(
          ({ width, height }: { readonly width: number; readonly height: number }) => width > 0 && height > 0,
        ),
      ).toBe(true);
    }
  });

  it('preserves an eligible resize anchor and degrades then restores rail deterministically', () => {
    const scene = buildKanbanScene({ ...sceneInput(), descriptorLimit: 8 });
    const wide = projectKanbanSceneGeometry(scene, {
      bounds: { x: 0, y: 0, width: 80, height: 24 },
      variant: 'rail',
      offsets: { x: 0, y: 5 },
      anchor: { cardKey: 'card-1', preferredRow: 7 },
      minimumColumnWidth: 18,
    });
    const narrow = projectKanbanSceneGeometry(scene, {
      bounds: { x: 0, y: 0, width: 38, height: 18 },
      variant: 'rail',
      focusedColumnId: 'ready',
      offsets: wide.offsets,
      anchor: wide.anchor,
      minimumColumnWidth: 18,
    });
    const restored = projectKanbanSceneGeometry(scene, {
      bounds: { x: 0, y: 0, width: 80, height: 24 },
      variant: 'rail',
      offsets: narrow.offsets,
      anchor: narrow.anchor,
      minimumColumnWidth: 18,
    });

    expect(wide.resolvedVariant).toBe('rail');
    expect(narrow).toMatchObject({ resolvedVariant: 'hybrid', visibleColumnIds: ['ready'] });
    expect(restored.resolvedVariant).toBe('rail');
    expect([wide, narrow, restored].map(({ anchor }) => anchor)).toEqual([
      { cardKey: 'card-1', preferredRow: 7 },
      { cardKey: 'card-1', preferredRow: 7 },
      { cardKey: 'card-1', preferredRow: 7 },
    ]);
    expect([wide, narrow, restored].every(({ offsets }) => offsets.x >= 0 && offsets.y >= 0)).toBe(true);
  });

  it('prioritizes clipped descriptor actions and exposes no deferred interaction targets', () => {
    const scene = buildKanbanScene({ ...sceneInput(), descriptorLimit: 8 });
    const geometry = projectKanbanSceneGeometry(scene, {
      bounds: { x: 0, y: 0, width: 24, height: 10 },
      variant: 'hybrid',
      offsets: { x: 0, y: 0 },
      minimumColumnWidth: 18,
    });
    const hits = projectKanbanSceneHits(scene, geometry, { maximumTargets: 32 });
    const action = hits.targets.find(({ kind }: { readonly kind: string }) => kind === 'card-action');
    const card = hits.targets.find(({ kind }: { readonly kind: string }) => kind === 'card');

    expect(action?.zIndex).toBeGreaterThan(card?.zIndex ?? -1);
    expect(
      hits.targets.every(
        ({ width, height }: { readonly width: number; readonly height: number }) => width > 0 && height > 0,
      ),
    ).toBe(true);
    expect(hits.targets.map(({ kind }: { readonly kind: string }) => kind)).not.toEqual(
      expect.arrayContaining(['insertion', 'drop', 'ghost', 'drag', 'drag-hover']),
    );
    expect(
      hits.targets.some(({ kind }: { readonly kind: string }) => kind === 'card-gap' || kind === 'separator'),
    ).toBe(false);
  });

  it('returns card-local damage and falls back to whole viewport at the finite region ceiling', () => {
    const scene = buildKanbanScene({ ...sceneInput(), descriptorLimit: 8 });
    const geometry = projectKanbanSceneGeometry(scene, {
      bounds: { x: 0, y: 0, width: 80, height: 24 },
      variant: 'hybrid',
      offsets: { x: 0, y: 0 },
      minimumColumnWidth: 18,
    });
    const changedCard = buildKanbanScene({
      ...sceneInput(),
      descriptorLimit: 8,
      cells: sceneInput().cells.map((cell, cellIndex) => ({
        ...cell,
        cards: cell.cards.map((card, cardIndex) =>
          cellIndex === 0 && cardIndex === 1
            ? { ...card, descriptor: descriptor('card-1', 3, 'card-1-style-v2') }
            : card,
        ),
      })),
    });
    const cardDamage = calculateKanbanSceneDamage({
      previousScene: scene,
      currentScene: changedCard,
      previousGeometry: geometry,
      currentGeometry: geometry,
      bounds: { x: 0, y: 0, width: 80, height: 24 },
      maximumRegions: 256,
    });

    expect(cardDamage).toHaveLength(1);
    expect(cardDamage[0]).toMatchObject({ kind: 'descriptor', cardKey: 'card-1' });
    const whole = calculateKanbanSceneDamage({
      previousScene: scene,
      currentScene: { ...scene, revision: 'scene-structural-v2' },
      previousGeometry: geometry,
      currentGeometry: {
        ...geometry,
        revision: 'geometry-structural-v2',
        changedRegions: Array.from({ length: 300 }, (_, index) => ({
          x: index % 80,
          y: Math.floor(index / 80) % 24,
          width: 1,
          height: 1,
        })),
      },
      bounds: { x: 0, y: 0, width: 80, height: 24 },
      maximumRegions: 256,
    });
    expect(whole).toEqual([{ kind: 'whole-viewport', x: 0, y: 0, width: 80, height: 24 }]);
  });
});
