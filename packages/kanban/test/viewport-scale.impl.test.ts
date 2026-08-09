import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { createEagerKanbanDataSource, KanbanViewport, validateKanbanLimitOptions } from '../src/index.js';
import type { KanbanCardAdapter, KanbanColumnMeta, KanbanQuery } from '../src/index.js';
import { createWindowedKanbanFixture, inspectKanbanViewportScale } from '../src/testing.js';

interface ScaleCard {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const QUERY: KanbanQuery = { filters: [], sort: [] };
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: KanbanCardAdapter<ScaleCard> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};

/** Creates deterministic metadata for a bounded horizontal scale fixture. */
function columns(count: number): readonly KanbanColumnMeta[] {
  return Array.from({ length: count }, (_, index) => ({
    columnId: `column-${index}`,
    label: `Column ${index}`,
    revision: 1,
  }));
}

describe('viewport scale implementation', () => {
  it('materializes and reads only settled visible-plus-overscan ranges from 100,000 cards', async () => {
    const fixture = createWindowedKanbanFixture<ScaleCard>({
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
    viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 80, height: 24 } });
    const host = new Group();
    host.add(viewport);
    const render = createRenderRoot({ width: 80, height: 24 }, { caps: CAPS });
    render.mount(host);
    render.flush();
    const requests = fixture.controller.pendingRanges();

    for (const request of requests) fixture.controller.resolveRange(request.requestId);
    await vi.waitFor(() => {
      render.flush();
      expect(viewport.inspection().visibleCards.length).toBeGreaterThan(0);
    });

    const metrics = fixture.metrics();
    const scale = inspectKanbanViewportScale(viewport);
    const limits = validateKanbanLimitOptions({ class: 'standard' });
    const requestedCards = requests.reduce((total, range) => total + range.end - range.start, 0);
    expect(metrics.materializedCards).toBe(requestedCards);
    expect(metrics.materializedCards).toBeLessThan(100_000);
    expect(metrics.cardAtReads).toBeGreaterThan(0);
    // Mount, settlement, and descriptor publication may each read the same bounded retained window.
    expect(metrics.cardAtReads).toBeLessThanOrEqual(requestedCards * 3);
    expect(metrics.ensureRangeCalls).toBe(requests.length);
    expect(metrics.createdCursors).toBeLessThanOrEqual(limits.retainedCursors);
    expect(metrics.requestedRanges.every(({ start, end }) => end - start <= limits.ensureRangeCards)).toBe(true);
    expect(scale.retainedCursors).toBeLessThanOrEqual(limits.retainedCursors);
    expect(scale.retainedAddresses).toBe(scale.retainedCursors);
    expect(scale.retainedDescriptors).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.reactiveComputations).toBe(scale.retainedDescriptors);
    expect(scale.heightAnchors).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.heightRuns).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.heightAllocatedEntries).toBeLessThanOrEqual(limits.retainedDescriptors * 3);
    expect(scale.damageRegions).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.sceneWindowCells).toBe(0);
    render.unmount();
    fixture.dispose();
  });

  it('keeps a 5,000-card eager board bounded by occupied retained addresses and descriptors', async () => {
    const cards = Array.from({ length: 5_000 }, (_, id) => ({
      id,
      columnId: `column-${id % 8}`,
      title: `Card ${id}`,
    }));
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => columns(8),
      keyOf: (card: ScaleCard) => card.id,
      columnOf: (card: ScaleCard) => card.columnId,
    });
    const viewport = new KanbanViewport({
      source,
      query: () => QUERY,
      card: CARD,
      overscan: { horizontal: 1, vertical: 1 },
    });
    viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 80, height: 24 } });
    const host = new Group();
    host.add(viewport);
    const render = createRenderRoot({ width: 80, height: 24 }, { caps: CAPS });
    render.mount(host);
    await vi.waitFor(() => {
      render.flush();
      expect(viewport.inspection().visibleCards.length).toBeGreaterThan(0);
    });

    const scale = inspectKanbanViewportScale(viewport);
    const limits = validateKanbanLimitOptions({ class: 'standard' });
    expect(scale.retainedCursors).toBeLessThanOrEqual(limits.retainedCursors);
    expect(scale.retainedAddresses).toBe(scale.retainedCursors);
    expect(scale.retainedDescriptors).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.reactiveComputations).toBe(scale.retainedDescriptors);
    expect(scale.heightAnchors).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.heightRuns).toBeLessThanOrEqual(scale.retainedCursors);
    expect(scale.damageRegions).toBeLessThanOrEqual(limits.retainedDescriptors);
    expect(scale.retainedDescriptors).toBeLessThan(cards.length);
    render.unmount();
  });

  it('honors a lowered mounted descriptor ceiling and reports exact omitted demand', async () => {
    const cards = Array.from({ length: 20 }, (_, id) => ({ id, columnId: 'column-0', title: `Card ${id}` }));
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => columns(1),
      keyOf: (card: ScaleCard) => card.id,
      columnOf: (card: ScaleCard) => card.columnId,
    });
    const viewport = new KanbanViewport({
      source,
      query: () => QUERY,
      card: CARD,
      limits: { values: { retainedDescriptors: 2 } },
    });
    viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 12 } });
    const host = new Group();
    host.add(viewport);
    const render = createRenderRoot({ width: 40, height: 12 }, { caps: CAPS });
    render.mount(host);
    await vi.waitFor(() => {
      render.flush();
      expect(viewport.inspection().visibleCards).toHaveLength(2);
    });

    const range = viewport.metrics().visibleCardRanges[0];
    if (range === undefined) throw new Error('Expected one retained card range.');
    expect(inspectKanbanViewportScale(viewport)).toMatchObject({
      retainedDescriptors: 2,
      reactiveComputations: 2,
      descriptorOmissions: range.end - range.start - 2,
    });
    render.unmount();
  });
});
