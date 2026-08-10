import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import type { DispatchEvent, View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoard, KanbanViewport, createEagerKanbanDataSource } from '../src/index.js';
import type { KanbanCardAdapter, KanbanQuery, KanbanRequest, KanbanRequestResult } from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};

/** Mounts one responsive view at an explicit terminal geometry. */
function mount(view: View, width = 40, height = 12) {
  view.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(view);
  const render = createRenderRoot({ width, height }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

/** Delivers one local wheel event and returns the framework handled envelope. */
function wheel(viewport: KanbanViewport<Card>): DispatchEvent {
  const event: DispatchEvent = {
    event: { type: 'wheel', dir: 'down', x: 1, y: 1, ctrl: false, alt: false, shift: false },
    handled: false,
  };
  viewport.onEvent(event);
  return event;
}

/** Creates one harmless request used to observe authority availability during teardown. */
function request(operationId: string): KanbanRequest {
  return {
    kind: 'extension',
    extensionId: 'test.lifecycle',
    operationId,
    expected: {},
    payload: null,
    signal: new AbortController().signal,
  };
}

describe('Phase B lifecycle gate ordering', () => {
  it('leaves wheel input unhandled at minimum geometry and after lifecycle disposal', () => {
    const cards = Array.from({ length: 40 }, (_, id) => ({ id, columnId: 'ready', title: `Card ${id}` }));
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const minimum = new KanbanViewport({ source, query: () => QUERY, card: CARD });
    const minimumRender = mount(minimum, 12, 3);
    const minimumOffsets = minimum.metrics().offsets;

    expect(minimum.metrics().mode).toBe('minimum-size');
    expect(wheel(minimum).handled).toBe(false);
    expect(minimum.metrics().offsets).toEqual(minimumOffsets);
    minimumRender.unmount();

    const active = new KanbanViewport({ source, query: () => QUERY, card: CARD });
    const activeRender = mount(active);
    expect(wheel(active).handled).toBe(true);
    const disposedOffsets = active.metrics().offsets;
    active.dispose();

    expect(wheel(active).handled).toBe(false);
    expect(active.metrics().offsets).toEqual(disposedOffsets);
    activeRender.unmount();
  });

  it('releases the source session before disabling application request authority', async () => {
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 20,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    let duringSessionDispose: Promise<KanbanRequestResult> | undefined;
    const dispatcher = vi.fn((value: KanbanRequest) => ({ kind: 'accepted' as const, operationId: value.operationId }));
    const source = {
      openQuery(query: KanbanQuery, options?: { readonly signal?: AbortSignal }) {
        const session = fixture.source.openQuery(query, options);
        return new Proxy(session, {
          get(target, property, receiver) {
            if (property !== 'dispose') {
              const value = Reflect.get(target, property, receiver);
              return typeof value === 'function' ? value.bind(target) : value;
            }
            return () => {
              duringSessionDispose = board.request(request('during-session-dispose'));
              target.dispose();
            };
          },
        });
      },
    };
    const board = new KanbanBoard({ source, query: () => QUERY, card: CARD, dispatcher });
    const render = mount(board);

    board.dispose();
    expect(duringSessionDispose).toBeDefined();
    await expect(duringSessionDispose).resolves.toMatchObject({ kind: 'accepted' });
    await expect(board.request(request('after-board-dispose'))).resolves.toMatchObject({
      kind: 'rejected',
      code: 'dispatcher-unavailable',
    });
    expect(dispatcher).toHaveBeenCalledOnce();

    render.unmount();
    fixture.dispose();
  });
});
