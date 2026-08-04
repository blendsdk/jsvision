import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanViewport } from '../src/index.js';
import type { KanbanCardAdapter, KanbanColumnMeta, KanbanQuery } from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

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
    const requestedCards = requests.reduce((total, range) => total + range.end - range.start, 0);
    expect(metrics.materializedCards).toBe(requestedCards);
    expect(metrics.materializedCards).toBeLessThan(100_000);
    expect(metrics.cardAtReads).toBeGreaterThan(0);
    // Mount, settlement, and descriptor publication may each read the same bounded retained window.
    expect(metrics.cardAtReads).toBeLessThanOrEqual(requestedCards * 3);
    render.unmount();
    fixture.dispose();
  });
});
