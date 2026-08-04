import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type { KanbanCardAdapter, KanbanQuery, KanbanRequest } from '../src/index.js';

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
    board.dispose();
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
});
