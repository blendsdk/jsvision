import { classicTheme } from '@jsvision/core';
import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, renderStandardKanbanCard } from '../src/index.js';
import type {
  KanbanBoardCounts,
  KanbanCapabilities,
  KanbanCardAdapter,
  KanbanCardDensity,
  KanbanCardRenderContext,
  KanbanCellCounts,
  KanbanCellCursor,
  KanbanDataSource,
  KanbanQuery,
  KanbanQuerySession,
  KanbanRequest,
} from '../src/index.js';
import { createKanbanTheme } from '../src/index.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const QUERY: KanbanQuery = { filters: [], sort: [] };
const ADAPTER: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const UNKNOWN = Object.freeze({ quality: 'unknown' as const });
const UNKNOWN_BOARD_COUNTS: KanbanBoardCounts = Object.freeze({
  total: UNKNOWN,
  matching: UNKNOWN,
  loaded: UNKNOWN,
  visible: UNKNOWN,
  selected: UNKNOWN,
  wip: UNKNOWN,
});
const UNKNOWN_CELL_COUNTS: KanbanCellCounts = Object.freeze({ total: UNKNOWN, matching: UNKNOWN, loaded: UNKNOWN });

/** Creates one validated request with application-owned semantic payload. */
function request(operationId: string): KanbanRequest {
  return {
    kind: 'extension',
    extensionId: 'example.edit',
    operationId,
    expected: {},
    payload: null,
    signal: new AbortController().signal,
  };
}

/** Mounts a board as ordinary responsive fill content. */
function mount(board: KanbanBoard<Card>) {
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const render = createRenderRoot({ width: 24, height: 8 }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

describe('board authority and lifecycle implementation', () => {
  it('keeps pending authority metadata bounded and replaces duplicate operation identities', async () => {
    const dispatcher = vi.fn((value: KanbanRequest) => ({
      kind: 'accepted' as const,
      operationId: value.operationId,
      publication: {
        operationId: value.operationId,
        subjects: [{ kind: 'card' as const, cardKey: 1, baselineRevision: 1, expectedRevision: 2 }],
      },
    }));
    const source = createEagerKanbanDataSource<Card>(() => [], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER, dispatcher });
    const render = mount(board);
    for (let index = 0; index < 40; index += 1) await board.request(request(`operation-${index}`));
    await board.request(request('operation-39'));

    const pending = board.inspection().pendingOperations;
    expect(dispatcher).toHaveBeenCalledTimes(41);
    expect(pending).toHaveLength(32);
    expect(new Set(pending.map((entry) => entry.operationId)).size).toBe(32);
    render.unmount();
    const afterUnmount = await board.request(request('after-unmount'));
    expect(afterUnmount).toMatchObject({ kind: 'rejected', code: 'dispatcher-unavailable' });
    expect(dispatcher).toHaveBeenCalledTimes(41);
    expect(board.inspection().pendingOperations).toEqual([]);
  });

  it('delegates scrolling to its sole viewport and leaves disposal idempotent', () => {
    const cards = Array.from({ length: 50 }, (_, id) => ({ id, columnId: 'ready', title: `Card ${id}` }));
    const source = createEagerKanbanDataSource<Card>(() => cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER });
    const render = mount(board);
    board.scrollTo({ y: 10 });
    expect(board.viewport.metrics().offsets.y).toBe(10);
    board.scrollBy({ y: -3 });
    expect(board.viewport.metrics().offsets.y).toBe(7);
    render.unmount();
    board.dispose();
    board.dispose();
    expect(board.inspection().pendingOperations).toEqual([]);
  });

  it('publishes one atomic mounted minimum-size state with no scrollable or partial content', () => {
    const source = createEagerKanbanDataSource<Card>(() => [], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER });
    const render = mount(board);
    render.resize({ width: 10, height: 2 });
    render.flush();
    const inspection = board.inspection();

    expect(board.focusable).toBe(true);
    expect(board.viewport.metrics()).toMatchObject({
      mode: 'minimum-size',
      offsets: { x: 0, y: 0 },
      extents: { x: 0, y: 0 },
      extentQuality: { x: 'exact', y: 'exact' },
    });
    expect(inspection.state).toMatchObject({ kind: 'minimum-size' });
    expect(inspection.visibleColumns).toEqual([]);
    expect(inspection.visibleCards).toEqual([]);
    expect(inspection.regions).toEqual([]);
    expect(inspection.actionTargets).toEqual([]);
    render.unmount();
  });

  it('reserves mandatory focused chrome and stays atomically minimum-size at four total rows', () => {
    const source = createEagerKanbanDataSource<Card>(() => [], {
      columns: () => [
        { columnId: 'ready', label: 'Ready', revision: 1 },
        { columnId: 'doing', label: 'Doing', revision: 1 },
      ],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER });
    const render = mount(board);
    render.resize({ width: 24, height: 4 });
    for (let pass = 0; pass < 4; pass += 1) render.flush();
    const reflows = board.inspection().layoutReflows;
    render.flush();

    expect(board.viewport.metrics().mode).toBe('minimum-size');
    expect(board.inspection().state.kind).toBe('minimum-size');
    expect(board.inspection().state.label).toContain('18 × 5');
    expect(board.inspection().navigator.visible).toBe(false);
    expect(board.inspection().layoutReflows).toBe(reflows);
    render.unmount();
  });

  it('rejects remount after terminal board resource disposal', () => {
    const source = createEagerKanbanDataSource<Card>(() => [], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER });
    const render = mount(board);
    render.unmount();
    expect(() => render.mount(board)).toThrow();
  });

  it('reacquires clamped content immediately after an authoritative source shrink', () => {
    const cards = signal<readonly Card[]>(
      Array.from({ length: 80 }, (_, id) => ({ id, columnId: 'ready', title: `Card ${id}` })),
    );
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER });
    const render = mount(board);
    board.scrollTo({ y: 120 });
    render.flush();
    expect(board.inspection().visibleCards.length).toBeGreaterThan(0);

    cards.set([{ id: 0, columnId: 'ready', title: 'Only card' }]);
    render.flush();
    expect(board.viewport.metrics().offsets.y).toBe(0);
    expect(board.inspection().visibleCards.map((card) => card.cardKey)).toEqual([0]);
    render.unmount();
  });

  it('preserves a focused card row when source insertion and resize change geometry', () => {
    const cards = signal<readonly Card[]>(
      Array.from({ length: 8 }, (_, id) => ({ id, columnId: 'ready', title: `Card ${id}` })),
    );
    const identity = signal({ selectedCardKeys: [2] as readonly number[], focusedCardKey: 2 });
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER, identity });
    const render = mount(board);
    board.scrollTo({ y: 3 });
    render.flush();
    const before = board.inspection().regions.find((region) => region.kind === 'card' && region.cardKey === 2)?.y;

    cards.set([{ id: 99, columnId: 'ready', title: 'Inserted' }, ...cards()]);
    render.resize({ width: 30, height: 9 });
    render.flush();
    const after = board.inspection().regions.find((region) => region.kind === 'card' && region.cardKey === 2)?.y;
    expect(after).toBe(before);
    render.unmount();
  });

  it('uses legacy identity once and lets source deletion reconcile controller ownership', async () => {
    const cards = signal<readonly Card[]>([
      { id: 1, columnId: 'ready', title: 'First' },
      { id: 2, columnId: 'ready', title: 'Seeded' },
    ]);
    const identity = signal({ selectedCardKeys: [2] as readonly number[], focusedCardKey: 2 });
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER, identity });
    const render = mount(board);

    expect(board.interaction().snapshot()).toMatchObject({
      focused: { kind: 'card', cardKey: 2 },
      selectedCardKeys: [2],
    });
    identity.set({ selectedCardKeys: [1], focusedCardKey: 1 });
    render.flush();
    expect(board.interaction().snapshot()).toMatchObject({
      focused: { kind: 'card', cardKey: 2 },
      selectedCardKeys: [2],
    });

    cards.set(cards().filter((card) => card.id !== 2));
    render.flush();
    await vi.waitFor(() => {
      expect(board.interaction().snapshot()).toMatchObject({
        focused: { kind: 'card', cardKey: 1 },
        selectedCardKeys: [],
      });
    });
    render.unmount();
  });

  it('relocates a focused anchor when a source reorder moves it outside the retained range', async () => {
    const cards = signal<readonly Card[]>(
      Array.from({ length: 40 }, (_, id) => ({ id, columnId: 'ready', title: `Card ${id}` })),
    );
    const identity = signal({ selectedCardKeys: [2] as readonly number[], focusedCardKey: 2 });
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER, identity });
    const render = mount(board);
    board.scrollTo({ y: 3 });
    render.flush();
    const before = board.inspection().regions.find((region) => region.kind === 'card' && region.cardKey === 2)?.y;

    const reordered = [...cards()];
    const [focused] = reordered.splice(2, 1);
    if (focused === undefined) throw new Error('Focused fixture card is missing.');
    reordered.splice(30, 0, focused);
    cards.set(reordered);
    render.flush();
    await vi.waitFor(() => {
      render.flush();
      expect(board.viewport.metrics().offsets.y).toBeGreaterThan(80);
    });

    const after = board.inspection().regions.find((region) => region.kind === 'card' && region.cardKey === 2)?.y;
    expect(after).toBe(before);
    render.unmount();
  });

  it('automatically reconciles a focused card address after a source move', async () => {
    const cards = signal<readonly Card[]>([{ id: 1, columnId: 'ready', title: 'Moving card' }]);
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [
        { columnId: 'ready', label: 'Ready', revision: 1 },
        { columnId: 'doing', label: 'Doing', revision: 1 },
      ],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER });
    const render = mount(board);
    await board.interaction().transition({
      kind: 'focus',
      target: { kind: 'card', cardKey: 1, address: { columnId: 'ready' } },
    });

    cards.set([{ id: 1, columnId: 'doing', title: 'Moving card' }]);
    for (let index = 0; index < 20; index += 1) {
      render.flush();
      await Promise.resolve();
    }
    expect(board.interaction().snapshot().focused).toEqual({
      kind: 'card',
      cardKey: 1,
      address: { columnId: 'doing' },
    });
    render.unmount();
  });

  it('does not let a pending reorder locator overwrite newer imperative scrolling', async () => {
    const cards = signal<readonly Card[]>(
      Array.from({ length: 40 }, (_, id) => ({ id, columnId: 'ready', title: `Card ${id}` })),
    );
    const identity = signal({ selectedCardKeys: [2] as readonly number[], focusedCardKey: 2 });
    const source = createEagerKanbanDataSource(cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: ADAPTER, identity });
    const render = mount(board);
    board.scrollTo({ y: 3 });
    render.flush();
    const reordered = [...cards()];
    const [focused] = reordered.splice(2, 1);
    if (focused === undefined) throw new Error('Focused fixture card is missing.');
    reordered.splice(30, 0, focused);
    cards.set(reordered);
    render.flush();

    board.scrollTo({ y: 0 });
    await Promise.resolve();
    render.flush();
    expect(board.viewport.metrics().offsets.y).toBe(0);
    render.unmount();
  });

  it('drops locator lower bounds when a replacement query reuses the same source revision', async () => {
    const query = signal<KanbanQuery>({ viewRevision: 1 });
    const cursor = (): KanbanCellCursor<Card> => ({
      state: () => ({ kind: 'partial' }),
      counts: () => UNKNOWN_CELL_COUNTS,
      length: () => ({ kind: 'unknown' }),
      cardAt: () => undefined,
      ensureRange: async () => undefined,
      revision: () => 1,
      placementAt: () => ({ kind: 'unavailable', code: 'unloaded', cursorRevision: 1 }),
      retry: () => undefined,
      dispose: () => undefined,
    });
    const source: KanbanDataSource<Card> = {
      openQuery: (openedQuery): KanbanQuerySession<Card> => ({
        state: () => ({ kind: 'partial' }),
        revision: () => 1,
        columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
        swimlanes: () => [],
        counts: () => UNKNOWN_BOARD_COUNTS,
        headers: () => ({ revision: 1, columns: [{ columnId: 'ready', label: 'Ready' }], swimlanes: [] }),
        identityChanges: () => ({ revision: 1, changes: [] }),
        cell: cursor,
        locateCard: () => ({
          kind: 'unloaded',
          address: { columnId: 'ready' },
          index: openedQuery.viewRevision === 1 ? 30 : 0,
          sessionRevision: 1,
        }),
        dispose: () => undefined,
      }),
    };
    const board = new KanbanBoard({ source, query, card: ADAPTER });
    const render = mount(board);
    await board.revealCard(1, 'start');
    render.flush();
    expect(board.viewport.metrics()).toMatchObject({
      offsets: { y: 90 },
      extentQuality: { y: 'lower-bound' },
    });

    query.set({ viewRevision: 2 });
    render.flush();
    expect(board.viewport.metrics()).toMatchObject({ offsets: { y: 0 }, extents: { y: 0 } });
    render.unmount();
  });

  it('reflows reactive density, theme, and capability replacements while retaining focused identity', () => {
    const cards = Array.from({ length: 8 }, (_, id) => ({ id, columnId: 'ready', title: `Card ${id}` }));
    const density = signal<KanbanCardDensity>('comfortable');
    const theme = signal(createKanbanTheme(classicTheme));
    const capabilities = signal<KanbanCapabilities>({});
    const identity = signal({ selectedCardKeys: [2] as readonly number[], focusedCardKey: 2 });
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({
      source,
      query: () => QUERY,
      card: ADAPTER,
      density,
      theme,
      capabilities,
      identity,
    });
    const render = mount(board);
    board.scrollTo({ y: 3 });
    render.flush();
    const beforeReflows = board.inspection().layoutReflows;

    density.set('compact');
    theme.set(createKanbanTheme(classicTheme));
    capabilities.set({ extensions: { 'example.edit': { state: 'disabled', reasonCode: 'read-only' } } });
    render.flush();

    expect(board.inspection().identity.focusedCardKey).toBe(2);
    expect(board.inspection().layoutReflows).toBeGreaterThan(beforeReflows);
    expect(board.inspection().visibleCards).toContainEqual(expect.objectContaining({ cardKey: 2 }));
    render.unmount();
  });

  it('forwards rich viewport options and repaints signal-only custom descriptor changes', () => {
    const customTitle = signal('Custom alpha');
    const cards = [{ id: 1, columnId: 'ready', title: 'Source title' }];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card: Card) => card.id,
      columnOf: (card: Card) => card.columnId,
    });
    const board = new KanbanBoard({
      source,
      query: () => QUERY,
      card: ADAPTER,
      presentation: () => ({
        revision: 'board-presentation-v1',
        cardRows: 4,
        cardGap: 0,
        metadataFields: 0,
        labelRows: 0,
        summarySections: 0,
        checklistMode: 'hidden',
        checklistPreviewItems: 0,
      }),
      formatting: () => ({ locale: 'board-locale', formatNumber: String, formatDate: () => undefined }),
      cardPresentation: () => ({
        visualState: {
          focused: true,
          selected: false,
          rangeAnchor: false,
          readOnly: false,
          invalid: false,
          operation: 'idle',
        },
      }),
      rendererRevision: () => 'board-renderer-v1',
      renderer: () => ({
        render: (card: Card, context: KanbanCardRenderContext) =>
          renderStandardKanbanCard(
            {
              ...card,
              title: `${customTitle()}|${context.formatting.locale}|${context.focused}|${context.rowBudget}`,
            },
            ADAPTER,
            context,
          ),
      }),
    });
    const render = mount(board);
    const text = () => board.inspection().visibleCards[0]?.title;
    expect(text()).toContain('Custom alpha');

    customTitle.set('Custom beta');
    render.flush();
    expect(text()).toContain('Custom beta');
    render.unmount();
  });
});
