import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { KanbanViewport, createEagerKanbanDataSource } from '../src/index.js';
import type {
  KanbanCardAdapter,
  KanbanColumnMeta,
  KanbanQuery,
  KanbanViewportInspection,
  KanbanViewportMetrics,
} from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

interface WorkItem {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly status: string;
}

interface InspectedCell {
  readonly address: { readonly columnId: string };
  readonly state: unknown;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: KanbanCardAdapter<WorkItem> = {
  keyOf: (item) => item.id,
  titleOf: (item) => item.title,
  statusOf: (item) => item.status,
};
const QUERY: KanbanQuery = { filters: [], sort: [] };

/** Creates deterministic workflow-column metadata. */
function columns(count: number): readonly KanbanColumnMeta[] {
  return Array.from({ length: count }, (_, index) => ({
    columnId: `column-${index}`,
    label: `Column ${index}`,
    revision: 1,
  }));
}

/** Mounts one standalone viewport at an exact terminal-cell rectangle. */
function mountViewport(viewport: KanbanViewport<WorkItem>, width = 80, height = 24) {
  viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const host = new Group();
  host.add(viewport);
  const render = createRenderRoot({ width, height }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

describe('Kanban viewport bounded projection', () => {
  it('should read only visible plus finite-overscan ranges from 100,000 logical cards', () => {
    // The first 80×24 frame is request-proportional and never scans logical length.
    const fixture = createWindowedKanbanFixture<WorkItem>({
      logicalCardCount: 100_000,
      columns: columns(8),
      materialize: ({ address, start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: address.columnId,
          title: `Card ${start + offset}`,
          status: 'Ready',
        })),
      keyOf: (item) => item.id,
    });
    const viewport = new KanbanViewport({
      source: fixture.source,
      query: () => QUERY,
      card: CARD,
      overscan: { vertical: 1, horizontal: 1 },
    });
    const render = mountViewport(viewport);
    const metrics: KanbanViewportMetrics = viewport.metrics();
    const sourceMetrics = fixture.metrics();

    expect(metrics.assignedRect).toEqual({ x: 0, y: 0, width: 80, height: 24 });
    expect(sourceMetrics.openedSessions).toBe(1);
    expect(sourceMetrics.createdCursors).toBeGreaterThan(0);
    expect(sourceMetrics.createdCursors).toBeLessThanOrEqual(metrics.visibleColumnIds.length + 2);
    expect(sourceMetrics.ensureRangeCalls).toBe(sourceMetrics.requestedRanges.length);
    expect(sourceMetrics.requestedRanges.every((range) => range.end - range.start <= 25)).toBe(true);
    expect(sourceMetrics.materializedCards).toBe(0);
    expect(sourceMetrics.cardAtReads).toBeLessThan(100_000);

    render.unmount();
    fixture.dispose();
  });

  it('should create zero cursors for hidden, collapsed, and unprefetched addresses', () => {
    // Query visibility and projection retention are applied before any source cell is requested.
    const allColumns = columns(8);
    const fixture = createWindowedKanbanFixture<WorkItem>({
      logicalCardCount: 100_000,
      columns: allColumns,
      materialize: () => [],
      keyOf: (item) => item.id,
    });
    const visibleQuery: KanbanQuery = { ...QUERY, visibleColumnIds: ['column-0', 'column-1'] };
    const viewport = new KanbanViewport({
      source: fixture.source,
      query: () => visibleQuery,
      card: CARD,
      overscan: { vertical: 1, horizontal: 0 },
      collapsedColumnIds: () => ['column-1'],
    });
    const render = mountViewport(viewport, 24, 12);

    expect(viewport.metrics().visibleColumnIds).toEqual(['column-0']);
    expect(fixture.metrics().createdCursors).toBe(1);
    expect(fixture.metrics().requestedRanges.every((range) => range.address.columnId === 'column-0')).toBe(true);

    render.unmount();
    fixture.dispose();
  });

  it('should isolate one errored cell while preserving a ready neighboring cell', async () => {
    // A range failure remains scoped to its semantic address and exposes an independent retry state.
    const fixture = createWindowedKanbanFixture<WorkItem>({
      logicalCardCount: 100,
      columns: columns(2),
      materialize: ({ address, start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: (address.columnId === 'column-0' ? 0 : 1_000) + start + offset,
          columnId: address.columnId,
          title: `Card ${start + offset}`,
          status: 'Ready',
        })),
      keyOf: (item) => item.id,
    });
    const viewport = new KanbanViewport({ source: fixture.source, query: () => QUERY, card: CARD });
    const render = mountViewport(viewport, 80, 12);
    const pending = fixture.controller.pendingRanges();
    const failing = pending.find((range) => range.address.columnId === 'column-0');
    const ready = pending.find((range) => range.address.columnId === 'column-1');
    if (failing === undefined || ready === undefined) throw new Error('both visible source ranges must be requested');

    fixture.controller.rejectRange(failing.requestId, { code: 'range-failed', label: 'Retry range' });
    fixture.controller.resolveRange(ready.requestId);
    await Promise.resolve();
    render.flush();
    const inspection: KanbanViewportInspection = viewport.inspection();

    expect(inspection.cells.find((cell: InspectedCell) => cell.address.columnId === 'column-0')).toMatchObject({
      state: { kind: 'error', code: 'range-failed', retry: 'available' },
    });
    expect(inspection.cells.find((cell: InspectedCell) => cell.address.columnId === 'column-1')).toMatchObject({
      state: { kind: 'ready' },
    });

    render.unmount();
    fixture.dispose();
  });

  it('should clamp both offsets after live columns and cards disappear', () => {
    // Scroll state is revalidated against current extents after every authoritative publication.
    const liveColumns = signal<readonly KanbanColumnMeta[]>(columns(6));
    const liveCards = signal<readonly WorkItem[]>(
      Array.from({ length: 120 }, (_, index) => ({
        id: index,
        columnId: `column-${index % 6}`,
        title: `Card ${index}`,
        status: 'Ready',
      })),
    );
    const source = createEagerKanbanDataSource(liveCards, {
      columns: liveColumns,
      keyOf: (item) => item.id,
      columnOf: (item) => item.columnId,
    });
    const viewport = new KanbanViewport({ source, query: () => QUERY, card: CARD });
    const render = mountViewport(viewport, 40, 10);

    viewport.scrollTo({ x: 10_000, y: 10_000 });
    render.flush();
    liveColumns.set(columns(1));
    liveCards.set(
      liveCards()
        .slice(0, 1)
        .map((item) => ({ ...item, columnId: 'column-0' })),
    );
    render.flush();
    const metrics = viewport.metrics();

    expect(metrics.offsets.x).toBeGreaterThanOrEqual(0);
    expect(metrics.offsets.y).toBeGreaterThanOrEqual(0);
    expect(metrics.offsets.x).toBeLessThanOrEqual(metrics.extents.x);
    expect(metrics.offsets.y).toBeLessThanOrEqual(metrics.extents.y);
    expect(metrics.offsets).toEqual({ x: 0, y: 0 });

    render.unmount();
  });

  it('should dispose one standalone session exactly once', () => {
    // Standalone ownership creates and tears down one coordinator/session boundary idempotently.
    const fixture = createWindowedKanbanFixture<WorkItem>({
      logicalCardCount: 10,
      columns: columns(1),
      materialize: () => [],
      keyOf: (item) => item.id,
    });
    const viewport = new KanbanViewport({ source: fixture.source, query: () => QUERY, card: CARD });
    const render = mountViewport(viewport, 24, 10);

    expect(fixture.metrics().openedSessions).toBe(1);
    render.unmount();
    render.unmount();
    viewport.dispose();
    viewport.dispose();

    expect(fixture.metrics().disposedSessions).toBe(1);
    expect(fixture.metrics().disposedCursors).toBe(fixture.metrics().createdCursors);
    fixture.dispose();
  });
});

describe('Kanban absolute-placement boundary', () => {
  it('should keep raw absolute placement out of ordinary board and dialog source', () => {
    // Only the documented exact-cell viewport modules may contain raw absolute placement.
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const sourceRoot = join(packageRoot, 'src');
    const candidates: string[] = [];
    for (const directory of ['board', 'dialogs']) {
      const root = join(sourceRoot, directory);
      try {
        const pending = [root];
        while (pending.length > 0) {
          const current = pending.pop()!;
          for (const entry of readdirSync(current, { withFileTypes: true })) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) pending.push(path);
            else if (extname(path) === '.ts') candidates.push(path);
          }
        }
      } catch {
        // A not-yet-created optional directory contributes no violation.
      }
    }

    const violations = candidates
      .filter((path) => !/(?:^|\/)(?:kanban-viewport|viewport-[^/]+)\.ts$/u.test(path))
      .filter((path) => /position\s*:\s*['"]absolute['"]/u.test(readFileSync(path, 'utf8')))
      .map((path) => relative(packageRoot, path));

    expect(violations).toEqual([]);
  });
});
