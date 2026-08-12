import { readFileSync } from 'node:fs';

import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createEagerKanbanDataSource,
  KanbanViewport,
  renderStandardKanbanCard,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  KanbanCardAdapter,
  KanbanCardRenderContext,
  KanbanCardRenderer,
  KanbanColumnMeta,
  KanbanQuery,
} from '../src/index.js';
import {
  createKanbanStabilizationFixture,
  createWindowedKanbanFixture,
  inspectKanbanViewportOperations,
  inspectKanbanViewportScale,
  observeKanbanViewportOperations,
} from '../src/testing.js';

interface ScaleCard {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly detailRows?: number;
}

const QUERY: KanbanQuery = { filters: [], sort: [] };
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: KanbanCardAdapter<ScaleCard> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const VARIABLE_RENDERER: KanbanCardRenderer<ScaleCard> = Object.freeze({
  render: (card: ScaleCard, context: KanbanCardRenderContext) => {
    const descriptor = renderStandardKanbanCard(card, CARD, context);
    const extraRows = Math.min(card.detailRows ?? 0, Math.max(0, context.rowBudget - descriptor.measuredHeight));
    if (extraRows === 0) return descriptor;
    return Object.freeze({
      ...descriptor,
      measuredHeight: descriptor.measuredHeight + extraRows,
      rows: Object.freeze([
        ...descriptor.rows,
        ...Array.from({ length: extraRows }, (_, index) =>
          Object.freeze({
            section: 'custom' as const,
            spans: Object.freeze([
              Object.freeze({ column: 0, text: `detail ${index + 1}`, role: 'content.metadata' as const }),
            ]),
          }),
        ),
      ]),
      sections: Object.freeze([
        ...descriptor.sections,
        Object.freeze({
          id: 'scale-detail',
          kind: 'custom' as const,
          startRow: descriptor.measuredHeight,
          rowCount: extraRows,
          priority: 2,
        }),
      ]),
    });
  },
});

/** Creates deterministic metadata for a bounded horizontal scale fixture. */
function columns(count: number): readonly KanbanColumnMeta[] {
  return Array.from({ length: count }, (_, index) => ({
    columnId: `column-${index}`,
    label: `Column ${index}`,
    revision: 1,
  }));
}

describe('viewport scale implementation', () => {
  it('reports measured-versus-estimated quality for every projection pass in the completed frame', () => {
    const fixture = createKanbanStabilizationFixture();
    const source = createEagerKanbanDataSource(() => fixture.cards, {
      columns: () => fixture.columns,
      keyOf: (card) => card.key,
      columnOf: (card) => card.columnId,
    });
    const viewport = new KanbanViewport({
      source,
      query: () => QUERY,
      card: {
        keyOf: (card) => card.key,
        titleOf: (card) => card.title,
        statusOf: (card) => card.status,
      },
    });
    viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 80, height: 24 } });
    const host = new Group();
    host.add(viewport);
    const render = createRenderRoot({ width: 80, height: 24 }, { caps: CAPS });
    render.mount(host);
    expect(inspectKanbanViewportOperations(viewport)).toEqual({ projectionPasses: [] });
    const observation = observeKanbanViewportOperations(viewport, 'projection-pass-1');
    expect(() => observeKanbanViewportOperations(viewport, 'overlap')).toThrow(
      'An operation observation is already active.',
    );
    render.flush();

    const passes = observation.snapshot().projectionPasses;
    expect(observation.snapshot().operationId).toBe('projection-pass-1');
    expect(observation.snapshot().work).toMatchObject({
      residentDescriptors: 80,
      residentGroupingVisits: 80,
      residentCellLookups: 100,
      heightMeasurements: 80,
    });
    expect(passes).toEqual([
      { ordinal: 1, heightQuality: 'measured', measuredRows: 40, estimatedRows: 0 },
      { ordinal: 2, heightQuality: 'measured', measuredRows: 40, estimatedRows: 0 },
    ]);
    observation.dispose();
    expect(inspectKanbanViewportOperations(viewport)).toEqual({ projectionPasses: [] });
    render.unmount();
  });

  it('materializes and reads only settled visible-plus-overscan ranges from 100,000 cards', async () => {
    const fixture = createWindowedKanbanFixture<ScaleCard>({
      logicalCardCount: 100_000,
      columns: columns(8),
      materialize: ({ address, start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: Number(address.columnId.slice('column-'.length)) * 100_000 + start + offset,
          columnId: address.columnId,
          title: `Card ${start + offset}`,
          detailRows: (start + offset) % 3,
        })),
      keyOf: (card) => card.id,
    });
    const viewport = new KanbanViewport({
      source: fixture.source,
      query: () => QUERY,
      card: CARD,
      renderer: () => VARIABLE_RENDERER,
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
    // Mount, settlement, descriptor publication, height correction, and the record-identity reuse guard may
    // read the same bounded window. The multiplier remains independent of the 100,000-card logical length.
    expect(metrics.cardAtReads).toBeLessThanOrEqual(requestedCards * 6);
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
    expect(
      new Set(viewport.inspection().visibleCards.map(({ descriptor }) => descriptor.measuredHeight)).size,
    ).toBeGreaterThan(1);

    const steadyMetrics = fixture.metrics();
    const operation = observeKanbanViewportOperations(viewport, 'windowed-100k-steady');
    viewport.invalidate();
    render.flush();
    const work = operation.snapshot().work;
    operation.dispose();
    const afterSteady = fixture.metrics();
    expect(work.residentDescriptors).toBeLessThan(100_000);
    expect(work.residentDescriptors).toBeLessThanOrEqual(scale.retainedDescriptors * 2);
    expect(work.residentGroupingVisits).toBe(work.residentDescriptors);
    expect(work.heightMeasurements).toBeLessThanOrEqual(scale.retainedDescriptors * 2);
    expect(afterSteady.cardAtReads - steadyMetrics.cardAtReads).toBeLessThanOrEqual(scale.retainedDescriptors * 4);

    for (let step = 0; step < 12; step += 1) {
      viewport.scrollBy({ y: 60 });
      render.flush();
      for (const request of fixture.controller.pendingRanges()) fixture.controller.resolveRange(request.requestId);
      await Promise.resolve();
      render.flush();
      if (viewport.metrics().visibleCardRanges.some(({ start }) => start > 0)) break;
    }
    await vi.waitFor(() => {
      render.flush();
      expect(viewport.metrics().visibleCardRanges.some(({ start }) => start > 0)).toBe(true);
    });
    render.unmount();
    fixture.dispose();
  });

  it('keeps a 5,000-card eager board bounded by occupied retained addresses and descriptors', async () => {
    const cards = Array.from({ length: 5_000 }, (_, id) => ({
      id,
      columnId: `column-${id % 8}`,
      title: `Card ${id}`,
      detailRows: id % 3,
    }));
    const keyOf = vi.fn((card: ScaleCard) => card.id);
    const columnOf = vi.fn((card: ScaleCard) => card.columnId);
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => columns(8),
      keyOf,
      columnOf,
    });
    const viewport = new KanbanViewport({
      source,
      query: () => QUERY,
      card: CARD,
      renderer: () => VARIABLE_RENDERER,
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
    expect(
      new Set(viewport.inspection().visibleCards.map(({ descriptor }) => descriptor.measuredHeight)).size,
    ).toBeGreaterThan(1);

    const keyReads = keyOf.mock.calls.length;
    const columnReads = columnOf.mock.calls.length;
    const operation = observeKanbanViewportOperations(viewport, 'eager-5000-steady');
    viewport.invalidate();
    render.flush();
    const work = operation.snapshot().work;
    operation.dispose();
    expect(work.residentDescriptors).toBeLessThan(cards.length);
    expect(work.residentDescriptors).toBeLessThanOrEqual(scale.retainedDescriptors * 2);
    expect(work.residentGroupingVisits).toBe(work.residentDescriptors);
    expect(work.residentCellLookups).toBeLessThanOrEqual(scale.retainedCursors * 2);
    expect(work.heightMeasurements).toBeLessThanOrEqual(scale.retainedDescriptors * 2);
    expect(keyOf.mock.calls.length - keyReads).toBe(0);
    expect(columnOf.mock.calls.length - columnReads).toBe(0);
    render.unmount();
  });

  it('keeps the reusable resident index free of per-cell full-resident filtering', () => {
    const source = readFileSync(new URL('../src/board/viewport-projector.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/projected\.residents\.filter/u);
    expect(source).toContain('const residentsFor =');
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
