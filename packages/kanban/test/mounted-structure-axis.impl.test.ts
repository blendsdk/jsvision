import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KanbanViewport, createEagerKanbanDataSource } from '../src/index.js';
import type { KanbanCardAdapter, KanbanQuery, KanbanStructurePolicy } from '../src/index.js';

interface GroupedCard {
  readonly id: number;
  readonly columnId: string;
  readonly team: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: KanbanCardAdapter<GroupedCard> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};

/** Mounts one grouped viewport at a deterministic terminal size. */
function mount(viewport: KanbanViewport<GroupedCard>, width = 80, height = 24) {
  viewport.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const host = new Group();
  host.add(viewport);
  const render = createRenderRoot({ width, height }, { caps: CAPS });
  render.mount(host);
  return render;
}

describe('mounted structure and grouped-axis implementation', () => {
  it('applies visible, collapsed, width, order, and band policy before opening card regions', async () => {
    const cards: readonly GroupedCard[] = [
      { id: 1, columnId: 'ready', team: 'team-b', title: 'Ready B' },
      { id: 2, columnId: 'doing', team: 'team-b', title: 'Doing B' },
      { id: 3, columnId: 'done', team: 'team-b', title: 'Done B' },
      { id: 4, columnId: 'done', team: 'team-a', title: 'Done A' },
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [
        { columnId: 'ready', label: 'Ready', revision: 1 },
        { columnId: 'doing', label: 'Doing', revision: 1 },
        { columnId: 'done', label: 'Done', revision: 1 },
      ],
      swimlanes: () => [
        { swimlaneId: 'team-a', label: 'Team A', revision: 1 },
        { swimlaneId: 'team-b', label: 'Team B', revision: 1 },
      ],
      keyOf: (card: GroupedCard) => card.id,
      columnOf: (card: GroupedCard) => card.columnId,
      groupingFields: [{ id: 'team', swimlaneOf: (card: GroupedCard) => card.team }],
    });
    const query: KanbanQuery = { filters: [], sort: [], groupBy: 'team' };
    const structure: KanbanStructurePolicy<GroupedCard> = {
      revision: 'mounted-structure-v1',
      columns: [
        { columnId: 'ready', visible: false },
        { columnId: 'doing', collapsed: true },
        { columnId: 'done', width: { minimumWidth: 18, preferredWidth: 30, maximumWidth: 32 } },
      ],
      grouping: {
        fieldId: 'team',
        unassigned: { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
        order: ['team-b', 'team-a'],
        collapsedSwimlaneIds: ['team-a'],
        presentation: 'band',
      },
    };
    const viewport = new KanbanViewport({ source, query: () => query, card: CARD, structure: () => structure });
    const render = mount(viewport);

    await vi.waitFor(() => {
      render.flush();
      expect(viewport.inspection().visibleCards.map((card) => card.cardKey)).toEqual([3]);
    });

    const inspection = viewport.inspection();
    expect(inspection.visibleColumns.map((column) => column.columnId)).toEqual(['doing', 'done']);
    expect(viewport.focusedNavigator()?.total ?? 2).toBe(2);
    expect(inspection.regions.filter((region) => region.kind === 'swimlane-band')).toHaveLength(2);
    expect(inspection.cells.every((cell) => cell.address.swimlaneId === 'team-b')).toBe(true);
    expect(inspection.visibleCards.some((card) => card.address.swimlaneId === 'team-a')).toBe(false);
    render.unmount();
  });

  it('keeps acquiring later cards while scrolling within tall and unequal grouped rows', async () => {
    const cards: readonly GroupedCard[] = [
      ...Array.from({ length: 12 }, (_, index) => ({
        id: index,
        columnId: 'ready',
        team: 'team-a',
        title: `A ${index}`,
      })),
      ...Array.from({ length: 20 }, (_, index) => ({
        id: 100 + index,
        columnId: 'ready',
        team: 'team-b',
        title: `B ${index}`,
      })),
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      swimlanes: () => [
        { swimlaneId: 'team-a', label: 'Team A', revision: 1 },
        { swimlaneId: 'team-b', label: 'Team B', revision: 1 },
      ],
      keyOf: (card: GroupedCard) => card.id,
      columnOf: (card: GroupedCard) => card.columnId,
      groupingFields: [{ id: 'team', swimlaneOf: (card: GroupedCard) => card.team }],
    });
    const query: KanbanQuery = { filters: [], sort: [], groupBy: 'team' };
    const viewport = new KanbanViewport({ source, query: () => query, card: CARD });
    const render = mount(viewport, 40, 12);
    await vi.waitFor(() => {
      render.flush();
      expect(viewport.metrics().extents.y).toBeGreaterThan(30);
    });

    viewport.scrollTo({ y: 18 });
    await vi.waitFor(() => {
      render.flush();
      expect(
        viewport
          .inspection()
          .visibleCards.some(
            (card) => card.address.swimlaneId === 'team-a' && typeof card.cardKey === 'number' && card.cardKey >= 4,
          ),
      ).toBe(true);
    });

    viewport.scrollTo({ y: 80 });
    await vi.waitFor(() => {
      render.flush();
      expect(
        viewport
          .inspection()
          .visibleCards.some(
            (card) => card.address.swimlaneId === 'team-b' && typeof card.cardKey === 'number' && card.cardKey > 100,
          ),
      ).toBe(true);
    });
    render.unmount();
  });

  it('scrolls grouped chrome when every visible swimlane is collapsed', () => {
    const swimlanes = Array.from({ length: 20 }, (_, index) => ({
      swimlaneId: `team-${index}`,
      label: `Team ${index}`,
      revision: 1,
    }));
    const source = createEagerKanbanDataSource<GroupedCard>(() => [], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      swimlanes: () => swimlanes,
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      groupingFields: [{ id: 'team', swimlaneOf: (card) => card.team }],
    });
    const query: KanbanQuery = { filters: [], sort: [], groupBy: 'team' };
    const structure: KanbanStructurePolicy<GroupedCard> = {
      revision: 'collapsed-groups-v1',
      columns: [],
      grouping: {
        fieldId: 'team',
        unassigned: { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
        collapsedSwimlaneIds: swimlanes.map((swimlane) => swimlane.swimlaneId),
      },
    };
    const viewport = new KanbanViewport({ source, query: () => query, card: CARD, structure: () => structure });
    const render = mount(viewport, 40, 12);
    render.flush();

    expect(viewport.metrics().extents.y).toBe(11);
    viewport.scrollTo({ y: 8 });
    render.flush();
    expect(viewport.metrics().offsets.y).toBe(8);
    expect(viewport.inspection().visibleCards).toEqual([]);
    render.unmount();
  });
});
