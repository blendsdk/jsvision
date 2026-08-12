/** Implementation coverage for the public deterministic Phase C testing helpers. */
import { createApplication, resolveCapabilities } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createKanbanOperationId } from '../src/index.js';
import type { KanbanCardAdapter, KanbanQuery } from '../src/index.js';
import {
  createKanbanDispatcherHarness,
  createKanbanDragHarness,
  createKanbanFakeClock,
  createKanbanOperationLifecycleHarness,
  inspectKanbanDragFrame,
  projectKanbanCardDropMap,
} from '../src/testing.js';

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
const applications: ReturnType<typeof createApplication>[] = [];

afterEach(() => {
  for (const application of applications.splice(0)) application.loop.dispose();
});

/** Mounts a small board with a caller-controlled dispatcher. */
function mountedBoard(dispatcher: ReturnType<typeof createKanbanDispatcherHarness>) {
  const source = createEagerKanbanDataSource<Card>(
    () => [
      { id: 1, columnId: 'ready', title: 'Source card' },
      { id: 2, columnId: 'ready', title: 'Placement anchor' },
    ],
    {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'ready-r1' }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    },
  );
  const board = new KanbanBoard({
    source,
    query: () => QUERY,
    card: CARD,
    dispatcher: dispatcher.dispatcher,
    operationEligibility: () => ({ kind: 'allowed' }),
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 40, height: 14 }, caps: CAPS });
  applications.push(application);
  application.loop.renderRoot.flush();
  return Object.freeze({ application, board });
}

describe('deterministic testing helper behavior', () => {
  it('runs fake-clock callbacks in deadline then insertion order and releases completed entries', () => {
    const clock = createKanbanFakeClock();
    const delivered: string[] = [];
    clock.schedule(20, () => delivered.push('late'));
    clock.schedule(10, () => delivered.push('first'));
    const cancelled = clock.schedule(10, () => delivered.push('cancelled'));
    cancelled.cancel();

    clock.advance(10);
    expect(delivered).toEqual(['first']);
    expect(clock.pending()).toBe(1);
    clock.advance(10);
    expect(delivered).toEqual(['first', 'late']);
    expect(clock.pending()).toBe(0);
  });

  it('defers recursively scheduled zero-delay callbacks to a later explicit advance', () => {
    const clock = createKanbanFakeClock();
    let delivered = 0;
    const recur = (): void => {
      delivered += 1;
      clock.schedule(0, recur);
    };
    clock.schedule(0, recur);

    clock.advance(0);
    expect(delivered).toBe(1);
    expect(clock.pending()).toBe(1);
    clock.advance(0);
    expect(delivered).toBe(2);
    clock.dispose();
  });

  it('releases a due callback immediately when that callback throws', () => {
    const clock = createKanbanFakeClock();
    clock.schedule(0, () => {
      throw new Error('expected test failure');
    });

    expect(() => clock.advance(0)).toThrow('expected test failure');
    expect(clock.pending()).toBe(0);
  });

  it('drops payload-bearing decoded input instead of retaining pasted or typed text', () => {
    const harness = createKanbanDragHarness();
    harness.accept({ type: 'paste', text: 'private'.repeat(100_000), truncated: false });
    harness.accept({ type: 'key', key: 'secret', ctrl: false, alt: false, shift: false });
    harness.accept({ type: 'focus', focused: false });

    expect(harness.events()).toEqual([{ type: 'focus', focused: false }]);
    harness.dispose();
  });

  it('projects a bounded semantic drop map without retaining application records', () => {
    const map = projectKanbanCardDropMap({
      density: 'comfortable',
      geometryGeneration: 7,
      cells: [
        {
          address: { columnId: 'ready' },
          content: { x: 0, y: 1, width: 12, height: 5 },
          header: { x: 0, y: 0, width: 12, height: 1 },
          cards: [],
          gutters: [],
          complete: { leading: true, trailing: true, empty: true },
          leading: {
            rect: { x: 0, y: 1, width: 12, height: 5 },
            position: { kind: 'start', cursorRevision: 'ready-r1' },
          },
        },
      ],
    });

    expect(map.geometryGeneration).toBe(7);
    expect(map.targetAt({ x: 2, y: 3 })).toMatchObject({
      kind: 'empty-cell',
      address: { columnId: 'ready' },
      position: { kind: 'start' },
    });
  });

  it('records payload-free dispatcher and lifecycle evidence around a real mounted drag', async () => {
    const dispatcher = createKanbanDispatcherHarness();
    const lifecycle = createKanbanOperationLifecycleHarness();
    const { application, board } = mountedBoard(dispatcher);
    const unsubscribe = board.subscribeOperations((snapshot) => lifecycle.accept(snapshot));
    const targets = board.inspection().actionTargets.filter(({ kind }) => kind === 'card');
    const source = targets[0];
    const destination = targets[1];
    const origin = application.loop.renderRoot.originOf(board.viewport);
    if (source === undefined || destination === undefined || origin === null) {
      throw new Error('Expected mounted testing-helper drag geometry.');
    }
    const point = (x: number, y: number) => ({ x: origin.x + x + 1, y: origin.y + y + 1 });
    application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...point(source.x + 1, source.y + 1) });
    application.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, ...point(source.x + 3, source.y + 1) });
    application.loop.dispatch({
      type: 'mouse',
      kind: 'drag',
      button: 0,
      ...point(destination.x + 1, destination.y + 1),
    });
    application.loop.renderRoot.flush();
    expect(inspectKanbanDragFrame(board.viewport).transientOverlayMembers).toBeGreaterThan(0);
    application.loop.dispatch({
      type: 'mouse',
      kind: 'up',
      button: 0,
      ...point(destination.x + 1, destination.y + 1),
    });
    for (let index = 0; index < 12; index += 1) await Promise.resolve();

    expect(dispatcher.calls()).toEqual([expect.objectContaining({ kind: 'card-move', aborted: false })]);
    expect(lifecycle.records().map(({ state }) => state)).toEqual(['proposed', 'pending']);
    expect(lifecycle.metrics()).toEqual({
      retainedOperationIds: 1,
      concurrentOperations: 1,
      maximumConcurrentOperations: 1,
      retainedRecords: 2,
    });
    const call = dispatcher.calls()[0];
    if (call === undefined) throw new Error('Expected one dispatcher call.');
    expect(
      dispatcher.settleNext({ kind: 'rejected', operationId: createKanbanOperationId(call.operationId), code: 'done' }),
    ).toBe(true);
    unsubscribe();
    lifecycle.dispose();
    dispatcher.dispose();
  });
});
