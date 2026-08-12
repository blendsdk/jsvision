import { createApplication, resolveCapabilities } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createStandardKanbanCardAdapter } from '../src/index.js';
import type { KanbanCardFormattingContext, KanbanQuery } from '../src/index.js';
import {
  createKanbanStabilizationFixture,
  setKanbanViewportProjectionPassLimitForTesting,
  type KanbanStabilizationCard,
  type KanbanStabilizationCardData,
} from '../src/testing.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [], viewRevision: 'containment-view-r1' });
const CARD = createStandardKanbanCardAdapter<string, KanbanStabilizationCardData>({
  fields: { labels: { label: 'Labels', priority: 1 } },
  summaries: [{ fieldId: 'repository', label: 'Repo', priority: 1 }],
});
const applications: Application[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Mounts a real mixed-height board so containment is exercised through draw and inspection. */
function mountedBoard(): {
  readonly application: Application;
  readonly board: KanbanBoard<KanbanStabilizationCard>;
  readonly observationCodes: string[];
  readonly replaceFormatting: () => void;
} {
  const fixture = createKanbanStabilizationFixture();
  const source = createEagerKanbanDataSource(() => fixture.cards, {
    columns: () => fixture.columns,
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  const observationCodes: string[] = [];
  let formatting: KanbanCardFormattingContext = Object.freeze({
    locale: 'en',
    formatNumber: (value: number | bigint) => String(value),
    formatDate: () => undefined,
  });
  const board = new KanbanBoard({
    source,
    query: () => QUERY,
    card: CARD,
    presentation: () => 'spacious',
    formatting: () => formatting,
    observe: (observation) => observationCodes.push(observation.code),
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 80, height: 24 }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return Object.freeze({
    application,
    board,
    observationCodes,
    replaceFormatting: () => {
      formatting = Object.freeze({
        locale: 'nl',
        formatNumber: (value: number | bigint) => `nl:${String(value)}`,
        formatDate: () => undefined,
      });
    },
  });
}

describe('mounted viewport convergence containment', () => {
  it('reuses only a compatible completed frame and clears interaction after formatting changes', () => {
    const { application, board, observationCodes, replaceFormatting } = mountedBoard();
    const completed = board.inspection();
    expect(completed.visibleCards.length).toBeGreaterThan(0);
    expect(completed.actionTargets.some(({ kind }) => kind === 'card')).toBe(true);
    observationCodes.length = 0;

    setKanbanViewportProjectionPassLimitForTesting(board.viewport, 0);
    board.viewport.invalidate();
    application.loop.renderRoot.flush();
    const compatible = board.inspection();
    expect(compatible.visibleCards.map(({ cardKey }) => cardKey)).toEqual(
      completed.visibleCards.map(({ cardKey }) => cardKey),
    );
    expect(compatible.actionTargets.some(({ kind }) => kind === 'card')).toBe(true);
    expect(observationCodes.filter((code) => code === 'projection-convergence-failed')).toEqual([]);

    replaceFormatting();
    board.viewport.invalidate();
    application.loop.renderRoot.flush();
    const incompatible = board.inspection();
    expect(incompatible.visibleCards).toEqual([]);
    expect(incompatible.actionTargets).toEqual([]);
    expect(incompatible.regions.some(({ kind }) => kind === 'card' || kind === 'cell')).toBe(false);
    expect(observationCodes.filter((code) => code === 'projection-convergence-failed')).toHaveLength(1);
  });
});
