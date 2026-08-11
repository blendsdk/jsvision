/** Implementation coverage for Phase C setup rollback, cancellation, and reactive ownership. */
import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KANBAN_NEUTRAL_INTERACTION_SNAPSHOT, KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type { KanbanCardAdapter, KanbanInteractionController, KanbanQuery, KanbanRequestResult } from '../src/index.js';
import { createKanbanBoardSetupHarness, createKanbanDeferred } from '../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = Object.freeze({
  keyOf: (card: Card) => card.id,
  titleOf: (card: Card) => card.title,
  statusOf: (card: Card) => card.columnId,
});

/** Creates one eager source with complete move placement evidence. */
function source() {
  return createEagerKanbanDataSource(
    () => [
      { id: 1, columnId: 'ready', title: 'One' },
      { id: 2, columnId: 'doing', title: 'Two' },
    ],
    {
      columns: () => [
        { columnId: 'ready', label: 'Ready', revision: 1 },
        { columnId: 'doing', label: 'Doing', revision: 1 },
      ],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    },
  );
}

/** Mounts one responsive owner and flushes its first complete projection. */
function mount(view: View) {
  view.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(view);
  const render = createRenderRoot({ width: 50, height: 14 }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

/** Creates one tracked controller without retaining viewport or source objects. */
function trackedController(unsubscribe: () => void, dispose: () => void): KanbanInteractionController {
  return {
    snapshot: () => KANBAN_NEUTRAL_INTERACTION_SNAPSHOT,
    transition: () => Object.freeze({ kind: 'unchanged', snapshot: KANBAN_NEUTRAL_INTERACTION_SNAPSHOT }),
    subscribe: () => unsubscribe,
    dispose,
  };
}

describe('Phase C board lifecycle implementation', () => {
  it.each(['coordinator', 'viewport', 'controller', 'input'] as const)(
    'rolls the deterministic setup transaction back from %s',
    (failAt) => {
      const harness = createKanbanBoardSetupHarness({ failAt });
      expect(() => harness.mount()).toThrow();
      expect(harness.snapshot()).toEqual({
        inputEnabled: false,
        liveResources: [],
        captureLeases: 0,
        timers: 0,
        subscriptions: 0,
      });
    },
  );

  it('rejects invalid failure injection before acquiring a setup resource', () => {
    expect(() => Reflect.apply(createKanbanBoardSetupHarness, undefined, [{ failAt: 'invalid' }])).toThrow(RangeError);
  });

  it('cancels pending work before releasing controller and reactive owners', async () => {
    const completion = createKanbanDeferred<KanbanRequestResult>();
    const unsubscribe = vi.fn();
    const dispose = vi.fn();
    const dispatcher = vi.fn(() => completion.promise);
    const density = signal<'comfortable' | 'compact'>('comfortable');
    const structure = signal({ revision: 1, columns: [] });
    const board = new KanbanBoard({
      source: source(),
      query: () => QUERY,
      card: CARD,
      dispatcher,
      operationEligibility: () => ({ kind: 'allowed' }),
      density,
      structure,
      interactionFactory: () => trackedController(unsubscribe, dispose),
    });
    const render = mount(board);
    const move = board.interaction().moveCard({
      cardKey: 1,
      target: { columnId: 'doing' },
      position: { kind: 'end' },
    });
    await Promise.resolve();
    expect(dispatcher).toHaveBeenCalledOnce();
    expect(board.operationSnapshot()).toHaveLength(1);

    density.set('compact');
    structure.set({ revision: 2, columns: [] });
    render.flush();
    board.dispose();
    board.dispose();
    completion.resolve({ kind: 'accepted', operationId: board.operationSnapshot()[0]?.operationId ?? 'late' });
    await move;

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    expect(board.operationSnapshot()).toEqual([]);
    expect(dispatcher).toHaveBeenCalledOnce();
    expect(() => render.mount(board)).toThrow();
    render.unmount();
  });
});
