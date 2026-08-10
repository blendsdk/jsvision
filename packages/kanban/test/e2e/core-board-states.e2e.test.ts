import { createApplication, resolveCapabilities, signal } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../../src/index.js';
import type {
  KanbanBoardCounts,
  KanbanCardAdapter,
  KanbanCellCounts,
  KanbanCellState,
  KanbanDataSource,
  KanbanInteractionIntent,
  KanbanQuery,
  KanbanSourceState,
} from '../../src/index.js';
import { createWindowedKanbanFixture } from '../../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const UNKNOWN = Object.freeze({ quality: 'unknown' as const });
const ZERO = Object.freeze({ quality: 'exact' as const, value: 0 });
const ONE = Object.freeze({ quality: 'exact' as const, value: 1 });
const TWO = Object.freeze({ quality: 'exact' as const, value: 2 });
const BOARD_COUNTS: KanbanBoardCounts = Object.freeze({
  total: ONE,
  matching: ONE,
  loaded: ZERO,
  visible: UNKNOWN,
  selected: UNKNOWN,
  wip: UNKNOWN,
});
const CELL_COUNTS: KanbanCellCounts = Object.freeze({ total: ONE, matching: ONE, loaded: ZERO });
const RESIDENT_CELL_COUNTS: KanbanCellCounts = Object.freeze({ total: TWO, matching: TWO, loaded: ONE });
const apps: Application[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.loop.dispose();
});

/** Creates one deterministic source that holds a visible lifecycle state until application replacement. */
function stateSource(
  sourceState: KanbanSourceState,
  cellState: KanbanCellState,
  retry: () => void = () => undefined,
  residentCard?: Card,
): KanbanDataSource<Card> {
  return {
    openQuery: () => ({
      state: () => sourceState,
      revision: () => 1,
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      swimlanes: () => [],
      counts: () => BOARD_COUNTS,
      headers: () => ({ revision: 1, columns: [{ columnId: 'ready', label: 'Ready' }], swimlanes: [] }),
      identityChanges: () => ({ revision: 1, changes: [] }),
      cell: () => ({
        state: () => cellState,
        counts: () => (residentCard === undefined ? CELL_COUNTS : RESIDENT_CELL_COUNTS),
        length: () => ({ kind: 'exact', value: residentCard === undefined ? 1 : 2 }),
        cardAt: (index) => (index === 0 ? residentCard : undefined),
        ensureRange: async () => undefined,
        revision: () => 1,
        placementAt: () => ({ kind: 'unavailable', code: 'not-loaded', cursorRevision: 1 }),
        retry,
        dispose: () => undefined,
      }),
      dispose: () => undefined,
    }),
  };
}

/** Mounts one board through the real application event loop. */
function mount(instance: KanbanBoard<Card>, width = 40, height = 12): Application {
  instance.setLayout({ position: 'fill' });
  const app = createApplication({ content: instance, viewport: { width, height }, caps: CAPS });
  apps.push(app);
  app.loop.renderRoot.flush();
  return app;
}

/** Converts one viewport-local action point to an absolute application coordinate. */
function absolute(app: Application, instance: KanbanBoard<Card>, point: { readonly x: number; readonly y: number }) {
  const origin = app.loop.renderRoot.originOf(instance.viewport);
  if (origin === null) throw new Error('Expected a mounted viewport origin.');
  return { x: origin.x + point.x + 1, y: origin.y + point.y + 1 };
}

/** Finds a cell owned by one target that is not shadowed by a higher-priority action. */
function actionablePoint(
  targets: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[],
  target: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
) {
  for (let y = target.y; y < target.y + target.height; y += 1) {
    for (let x = target.x; x < target.x + target.width; x += 1) {
      const active = targets.find(
        (candidate) =>
          x >= candidate.x &&
          y >= candidate.y &&
          x < candidate.x + candidate.width &&
          y < candidate.y + candidate.height,
      );
      if (active === target) return { x, y };
    }
  }
  throw new Error('Expected an unobscured target cell.');
}

/** Completes facade serialization and source retry work queued by a real event dispatch. */
async function settle(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe('Kanban real-loop source-state matrix rows', () => {
  it('row 11 exposes loading, partial, filtered, and retryable error behavior without application mutation', async () => {
    for (const kind of ['loading', 'partial'] as const) {
      const instance = new KanbanBoard({
        source: stateSource({ kind }, { kind }),
        query: () => QUERY,
        card: CARD,
      });
      mount(instance);
      expect(instance.inspection().cells[0]?.state).toEqual({ kind });
      expect(instance.inspection().actionTargets.some(({ kind: targetKind }) => targetKind === 'retry')).toBe(false);
    }

    const query = signal<KanbanQuery>({ search: 'missing', filters: [], sort: [] });
    const queryBefore = query();
    const intents: KanbanInteractionIntent[] = [];
    const filteredSource = createEagerKanbanDataSource(() => [{ id: 1, columnId: 'ready', title: 'Card' }], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      search: (card, term) => card.title.includes(term),
    });
    const filtered = new KanbanBoard({
      source: filteredSource,
      query,
      card: CARD,
      onInteraction: (intent) => intents.push(intent),
    });
    const filteredApp = mount(filtered);
    const clear = filtered.inspection().actionTargets.find(({ kind }) => kind === 'state-action');
    if (clear === undefined) throw new Error('Expected filtered state action.');
    const clearPoint = absolute(filteredApp, filtered, clear);
    filteredApp.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...clearPoint });
    filteredApp.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...clearPoint });
    await settle();
    expect(intents[0]).toMatchObject({ kind: 'scoped-action', actionId: 'clear-filters' });
    expect(query()).toBe(queryBefore);

    const retry = vi.fn();
    const errored = new KanbanBoard({
      source: stateSource({ kind: 'partial' }, { kind: 'error', code: 'range-failed', retry: 'available' }, retry, {
        id: 1,
        columnId: 'ready',
        title: 'Retained during range error',
      }),
      query: () => QUERY,
      card: CARD,
    });
    const errorApp = mount(errored);
    const errorTargets = errored.inspection().actionTargets;
    const retryTarget = errorTargets.find(({ kind }) => kind === 'retry');
    if (retryTarget === undefined) throw new Error('Expected retryable error target.');
    const retryPoint = absolute(errorApp, errored, actionablePoint(errorTargets, retryTarget));
    errorApp.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...retryPoint });
    errorApp.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...retryPoint });
    await settle();
    expect(retry).toHaveBeenCalledOnce();
    expect(errored.inspection().cells[0]?.state).toMatchObject({ kind: 'error', retry: 'available' });
  });

  it('row 12 cancels active windowed work before releasing the real host', () => {
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 10_000,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const instance = new KanbanBoard({ source: fixture.source, query: () => QUERY, card: CARD });
    mount(instance);
    expect(fixture.controller.pendingRanges().length).toBeGreaterThan(0);
    instance.dispose();
    expect(fixture.metrics()).toMatchObject({ disposedSessions: 1 });
    expect(fixture.metrics().disposedCursors).toBe(fixture.metrics().createdCursors);
    expect(fixture.metrics().abortedRequests).toBeGreaterThan(0);
    fixture.dispose();
  });
});
