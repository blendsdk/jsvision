/**
 * Specification oracle for mixed-height viewport stability across real mounted interactions.
 *
 * The sequence deliberately uses one realistic fixture so later geometry, damage, and pointer assertions
 * observe the same source identities instead of hiding disagreements behind smaller isolated fixtures.
 */
import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createStandardKanbanCardAdapter } from '../src/index.js';
import type { KanbanLayoutRegion, KanbanQuery, KanbanViewportInspection } from '../src/index.js';
import {
  createKanbanStabilizationFixture,
  type KanbanStabilizationCard,
  type KanbanStabilizationCardData,
} from '../src/testing.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [], viewRevision: 'stabilization-view-r1' });
const CARD = createStandardKanbanCardAdapter<string, KanbanStabilizationCardData>({
  fields: {
    type: { label: 'Type', priority: 1 },
    priority: { label: 'Priority', priority: 2 },
    labels: { label: 'Labels', priority: 3 },
    assignees: { label: 'Assignees', priority: 4 },
    estimate: { label: 'Estimate', priority: 5 },
  },
  summaries: [
    { fieldId: 'repository', label: 'Repo', priority: 1 },
    { fieldId: 'reference', label: 'Item', priority: 2 },
    { fieldId: 'milestone', label: 'Milestone', priority: 3 },
    { fieldId: 'team', label: 'Team', priority: 4 },
  ],
});
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Mounts the canonical fixture in a complete event loop at the standard terminal size. */
function mountedFixture(): {
  readonly application: Application;
  readonly board: KanbanBoard<KanbanStabilizationCard>;
} {
  const fixture = createKanbanStabilizationFixture();
  const source = createEagerKanbanDataSource(() => fixture.cards, {
    columns: () => fixture.columns,
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({ source, query: () => QUERY, card: CARD, presentation: () => 'spacious' });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 80, height: 24 }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return Object.freeze({ application, board });
}

/** Converts one viewport-local action point to event-loop coordinates. */
function absoluteCardPoint(
  application: Application,
  board: KanbanBoard<KanbanStabilizationCard>,
  cardKey: string,
): { readonly x: number; readonly y: number } {
  const target = board
    .inspection()
    .actionTargets.find((candidate) => candidate.kind === 'card' && candidate.cardKey === cardKey);
  const origin = application.loop.renderRoot.originOf(board.viewport);
  if (target === undefined || origin === null) throw new Error(`Expected mounted geometry for ${cardKey}.`);
  return Object.freeze({ x: origin.x + target.x + 1, y: origin.y + target.y + 1 });
}

/** Returns the visible card rectangles ordered by source identity within each workflow column. */
function cardRegionsByColumn(
  inspection: KanbanViewportInspection,
  cards: readonly KanbanStabilizationCard[],
): ReadonlyMap<string, readonly KanbanLayoutRegion[]> {
  const sourceByKey = new Map(cards.map((card, index) => [card.key, { card, index }] as const));
  const grouped = new Map<string, KanbanLayoutRegion[]>();
  for (const region of inspection.regions) {
    if (region.kind !== 'card' || region.cardKey === undefined) continue;
    const source = sourceByKey.get(region.cardKey);
    if (source === undefined) throw new Error(`Unexpected visible card identity ${String(region.cardKey)}.`);
    const current = grouped.get(source.card.columnId) ?? [];
    current.push(region);
    grouped.set(source.card.columnId, current);
  }
  for (const regions of grouped.values()) {
    regions.sort((left, right) => {
      const leftIndex = sourceByKey.get(left.cardKey ?? '')?.index ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = sourceByKey.get(right.cardKey ?? '')?.index ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
  }
  return grouped;
}

/** Asserts that final painted card rectangles and whole-card hit targets are exactly identical. */
function expectGeometryIntegrity(
  inspection: KanbanViewportInspection,
  cards: readonly KanbanStabilizationCard[],
): void {
  const cardRegions = inspection.regions.filter((region) => region.kind === 'card');
  const identities = cardRegions.map(({ cardKey }) => cardKey);
  expect(new Set(identities).size).toBe(identities.length);

  for (const region of cardRegions) {
    expect(Number.isFinite(region.x)).toBe(true);
    expect(Number.isFinite(region.y)).toBe(true);
    expect(Number.isFinite(region.width)).toBe(true);
    expect(Number.isFinite(region.height)).toBe(true);
    expect(region.width).toBeGreaterThan(0);
    expect(region.height).toBeGreaterThan(0);
    const target = inspection.actionTargets.find(
      (candidate) => candidate.kind === 'card' && candidate.cardKey === region.cardKey,
    );
    expect(target).toMatchObject({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });
  }

  for (const regions of cardRegionsByColumn(inspection, cards).values()) {
    for (let index = 1; index < regions.length; index += 1) {
      const previous = regions[index - 1];
      const current = regions[index];
      if (previous === undefined || current === undefined) continue;
      expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height + 1);
    }
  }
}

describe('mounted mixed-height viewport sequence', () => {
  // Click, two-axis scrolling, shrink/grow, and restore must remain one continuous usable board session.
  it('should remain operable through click, wheel, horizontal scroll, resize, and restore', () => {
    const { application, board } = mountedFixture();
    const fixture = createKanbanStabilizationFixture();
    const point = absoluteCardPoint(application, board, fixture.named.short);

    application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...point });
    application.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...point });
    for (let index = 0; index < 5; index += 1) {
      application.loop.dispatch({
        type: 'wheel',
        dir: 'down',
        x: point.x,
        y: point.y,
        shift: false,
        alt: false,
        ctrl: false,
      });
    }
    for (let index = 0; index < 3; index += 1) {
      application.loop.dispatch({
        type: 'wheel',
        dir: 'up',
        x: point.x,
        y: point.y,
        shift: false,
        alt: false,
        ctrl: false,
      });
    }
    board.scrollBy({ x: 18 });
    application.loop.renderRoot.flush();
    application.loop.resize({ width: 54, height: 16 });
    application.loop.resize({ width: 104, height: 30 });
    application.loop.resize({ width: 80, height: 24 });

    const inspection = board.inspection();
    const metrics = board.viewport.metrics();
    expect(metrics.mode).toBe('board');
    expect(metrics.assignedRect).toEqual({ x: 0, y: 0, width: 80, height: 24 });
    expect(metrics.offsets.x).toBeGreaterThan(0);
    expect(metrics.offsets.y).toBeGreaterThan(0);
    expect(inspection.visibleCards.length).toBeGreaterThan(0);
    expect(inspection.actionTargets.some(({ kind }) => kind === 'card')).toBe(true);
  });

  // Every completed frame must preserve source order, the one-cell gap, and exact paint/hit parity.
  it('should keep every visible card rectangle finite, ordered, separated, unique, and actionable', () => {
    const { application, board } = mountedFixture();
    const fixture = createKanbanStabilizationFixture();
    const inspect = (): void => expectGeometryIntegrity(board.inspection(), fixture.cards);

    inspect();
    for (let index = 0; index < 7; index += 1) {
      board.scrollBy({ y: 3 });
      application.loop.renderRoot.flush();
      inspect();
    }
    for (let index = 0; index < 7; index += 1) {
      board.scrollBy({ y: -3 });
      application.loop.renderRoot.flush();
      inspect();
    }
    application.loop.resize({ width: 54, height: 16 });
    inspect();
    application.loop.resize({ width: 104, height: 30 });
    inspect();
    application.loop.resize({ width: 80, height: 24 });
    inspect();
  });
});
