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
import type { KanbanQuery } from '../src/index.js';
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
});
