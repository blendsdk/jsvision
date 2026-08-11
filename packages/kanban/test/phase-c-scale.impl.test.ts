/** Implementation coverage for Phase C projection and operation counters at scale. */
import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoard, KanbanViewport, createEagerKanbanDataSource, validateKanbanLimitOptions } from '../src/index.js';
import type { KanbanCardAdapter, KanbanColumnMeta, KanbanQuery, KanbanRequestResult } from '../src/index.js';
import { createKanbanDeferred, createWindowedKanbanFixture, inspectKanbanViewportScale } from '../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: KanbanCardAdapter<Card> = Object.freeze({
  keyOf: (card: Card) => card.id,
  titleOf: (card: Card) => card.title,
  statusOf: (card: Card) => card.columnId,
});

/** Creates deterministic workflow metadata. */
function columns(count: number): readonly KanbanColumnMeta[] {
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({ columnId: `column-${index}`, label: `Column ${index}`, revision: 1 }),
    ),
  );
}

/** Mounts one view at the standard bounded scale-test geometry. */
function mount(view: View) {
  view.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(view);
  const render = createRenderRoot({ width: 80, height: 24 }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

describe('Phase C scale counters', () => {
  it('bounds card, target, and pending-operation projection for 5,000 eager cards', async () => {
    const cards = Object.freeze(
      Array.from({ length: 5_000 }, (_, id) =>
        Object.freeze({ id, columnId: `column-${id % 8}`, title: `Card ${id}` }),
      ),
    );
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => columns(8),
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const completion = createKanbanDeferred<KanbanRequestResult>();
    const board = new KanbanBoard({
      source,
      query: () => QUERY,
      card: CARD,
      dispatcher: () => completion.promise,
      operationEligibility: () => ({ kind: 'allowed' }),
    });
    const render = mount(board);
    await vi.waitFor(() => {
      render.flush();
      expect(board.inspection().visibleCards.length).toBeGreaterThan(0);
    });
    const move = board.interaction().moveCard({
      cardKey: 0,
      target: { columnId: 'column-1' },
      position: { kind: 'end' },
    });
    await vi.waitFor(() => {
      render.flush();
      expect(board.operationSnapshot()).toHaveLength(1);
    });

    const scale = inspectKanbanViewportScale(board.viewport);
    const limits = validateKanbanLimitOptions({ class: 'standard' });
    expect(scale.projectedCards).toBeGreaterThan(0);
    expect(scale.projectedCards).toBeLessThan(cards.length);
    expect(scale.projectedCards).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.actionTargets).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.operationOverlays).toBeLessThanOrEqual(limits.pendingOperations);
    expect(scale.transientOverlayMembers).toBe(0);

    const operationId = board.operationSnapshot()[0]?.operationId;
    if (operationId === undefined) throw new Error('Expected one active operation identity.');
    board.cancelOperation(operationId);
    completion.resolve({ kind: 'cancelled', operationId });
    await move;
    render.unmount();
  });

  it('bounds visible and overscan projection for 100,000 logical cards', async () => {
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 100_000,
      columns: columns(8),
      materialize: ({ address, start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: Number(address.columnId.slice('column-'.length)) * 100_000 + start + offset,
          columnId: address.columnId,
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    const viewport = new KanbanViewport({
      source: fixture.source,
      query: () => QUERY,
      card: CARD,
      overscan: { horizontal: 1, vertical: 1 },
    });
    const render = mount(viewport);
    for (const request of fixture.controller.pendingRanges()) fixture.controller.resolveRange(request.requestId);
    await vi.waitFor(() => {
      render.flush();
      expect(viewport.inspection().visibleCards.length).toBeGreaterThan(0);
    });

    const scale = inspectKanbanViewportScale(viewport);
    const limits = validateKanbanLimitOptions({ class: 'standard' });
    expect(scale.projectedCards).toBeGreaterThan(0);
    expect(scale.projectedCards).toBeLessThan(100_000);
    expect(scale.projectedCards).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.actionTargets).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.operationOverlays).toBe(0);
    expect(scale.transientOverlayMembers).toBe(0);

    render.unmount();
    fixture.dispose();
  });
});
