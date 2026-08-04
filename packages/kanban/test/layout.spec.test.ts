import { describe, expect, it } from 'vitest';

import { projectKanbanMinimumGeometry, projectKanbanVerticalGeometry, solveKanbanColumnWidths } from '../src/index.js';
import type {
  KanbanColumnWidthSolution,
  KanbanLayoutRegion,
  KanbanMinimumGeometry,
  KanbanVerticalGeometry,
} from '../src/index.js';

const DEFAULT_COLUMNS = [{ columnId: 'ready' }, { columnId: 'doing' }, { columnId: 'done' }] as const;

interface InspectedWidthColumn {
  readonly columnId: string;
  readonly width: number;
}

interface InspectedActionTarget {
  readonly y: number;
}

/** Solves the default three-column workflow at one terminal-cell width. */
function solveDefault(availableWidth: number): KanbanColumnWidthSolution {
  return solveKanbanColumnWidths({
    availableWidth,
    columns: DEFAULT_COLUMNS,
    focusedColumnId: 'doing',
    separatorWidth: 1,
  });
}

/** Indexes a multi-column solution by stable semantic column identity. */
function widthsById(solution: KanbanColumnWidthSolution): ReadonlyMap<string, number> {
  return new Map(solution.columns.map((column: InspectedWidthColumn) => [column.columnId, column.width] as const));
}

describe('Kanban responsive column widths', () => {
  it('should fit three preferred columns in 74 cells and use the remaining width without exceeding maxima', () => {
    // Default widths exclude the two one-cell separators: 3 × 24 + 2 = 74.
    const preferred = solveDefault(74);
    const expanded = solveDefault(80);

    expect(preferred).toMatchObject({
      mode: 'multi-column',
      availableWidth: 74,
      contentWidth: 74,
      separatorWidth: 1,
      columns: [
        { columnId: 'ready', width: 24 },
        { columnId: 'doing', width: 24 },
        { columnId: 'done', width: 24 },
      ],
    });
    expect(expanded.mode).toBe('multi-column');
    expect(expanded.contentWidth).toBe(80);
    expect(expanded.columns).toHaveLength(3);
    expect(expanded.columns.reduce((sum: number, column: InspectedWidthColumn) => sum + column.width, 0) + 2).toBe(80);
    expect(expanded.columns.every((column: InspectedWidthColumn) => column.width >= 24 && column.width <= 32)).toBe(
      true,
    );
    expect(Object.isFrozen(expanded)).toBe(true);
    expect(Object.isFrozen(expanded.columns)).toBe(true);
  });

  it('should switch below the two-minimum boundary to one focused column and one compact navigator row', () => {
    // Two default minima need 18 + 1 + 18 cells; one fewer cell cannot expose a clipped second column.
    const boundary = solveDefault(37);
    const narrow = solveDefault(36);

    expect(boundary.mode).toBe('multi-column');
    expect(boundary.columns).toHaveLength(3);
    expect(narrow).toMatchObject({
      mode: 'focused-column',
      availableWidth: 36,
      columns: [{ columnId: 'doing' }],
      interactiveColumnIds: ['doing'],
      navigator: {
        rowCount: 1,
        columnId: 'doing',
        position: 2,
        total: 3,
        previousEnabled: true,
        nextEnabled: true,
      },
    });
    expect(narrow.columns).toHaveLength(1);
    expect(narrow.navigator?.rowCount).toBe(1);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 10_000])(
    'should fall back from hostile renderer minimum hint %s without oversized allocation',
    (rendererMinimumHint) => {
      // An invalid hint cannot reduce the minimum, exceed the declared maximum, or drive unsafe allocation.
      const baseline = solveKanbanColumnWidths({
        availableWidth: 32,
        columns: [{ columnId: 'ready', minimumWidth: 18, preferredWidth: 24, maximumWidth: 32 }],
        focusedColumnId: 'ready',
        separatorWidth: 1,
      });
      const hostile = solveKanbanColumnWidths({
        availableWidth: 32,
        columns: [
          {
            columnId: 'ready',
            minimumWidth: 18,
            preferredWidth: 24,
            maximumWidth: 32,
            rendererMinimumHint,
          },
        ],
        focusedColumnId: 'ready',
        separatorWidth: 1,
      });

      expect(hostile).toEqual(baseline);
      expect(hostile.columns).toHaveLength(1);
      expect(hostile.columns[0]?.width).toBeLessThanOrEqual(32);
      expect(hostile.contentWidth).toBeLessThanOrEqual(32);
    },
  );

  it('should allocate monotonically and break equal tier fulfillment ties in source order', () => {
    // Increasing width by one never takes a cell away; equal candidates advance left-to-right.
    expect(solveDefault(74).columns.map((column: InspectedWidthColumn) => column.width)).toEqual([24, 24, 24]);
    expect(solveDefault(75).columns.map((column: InspectedWidthColumn) => column.width)).toEqual([25, 24, 24]);
    expect(solveDefault(76).columns.map((column: InspectedWidthColumn) => column.width)).toEqual([25, 25, 24]);
    expect(solveDefault(77).columns.map((column: InspectedWidthColumn) => column.width)).toEqual([25, 25, 25]);

    let previous = widthsById(solveDefault(37));
    for (let availableWidth = 38; availableWidth <= 100; availableWidth += 1) {
      const current = widthsById(solveDefault(availableWidth));
      for (const column of DEFAULT_COLUMNS) {
        expect(current.get(column.columnId)).toBeGreaterThanOrEqual(previous.get(column.columnId) ?? 0);
      }
      previous = current;
    }
  });
});

/** Projects two adjacent cards into one retained column. */
function projectDensity(density: 'compact' | 'comfortable' | 'spacious'): KanbanVerticalGeometry {
  return projectKanbanVerticalGeometry({
    bounds: { x: 0, y: 0, width: 24, height: 12 },
    stickyHeaderHeight: 1,
    scrollOffset: 0,
    density,
    cards: [
      { cardKey: 1, height: 2 },
      { cardKey: 2, height: 2 },
    ],
    verticalOverscan: 1,
  });
}

describe('Kanban vertical geometry', () => {
  it('should keep the workflow header sticky while scrolled and never classify it as a card target', () => {
    // Sticky workflow chrome consumes the first row independently of the scrolled card projection.
    const geometry = projectKanbanVerticalGeometry({
      bounds: { x: 3, y: 4, width: 24, height: 10 },
      stickyHeaderHeight: 1,
      scrollOffset: 5,
      density: 'comfortable',
      cards: Array.from({ length: 8 }, (_, index) => ({ cardKey: index, height: 2 })),
      verticalOverscan: 1,
    });
    const header = geometry.regions.find((region: KanbanLayoutRegion) => region.kind === 'workflow-header');

    expect(header).toEqual({
      kind: 'workflow-header',
      x: 3,
      y: 4,
      width: 24,
      height: 1,
      actionable: false,
    });
    expect(geometry.actionTargets.some((target: InspectedActionTarget) => target.y === 4)).toBe(false);
    expect(
      geometry.regions
        .filter((region: KanbanLayoutRegion) => region.kind === 'card')
        .every((region: KanbanLayoutRegion) => region.y >= 5),
    ).toBe(true);
  });

  it('should classify a swimlane header separately from the first insertion gutter below it', () => {
    // Header chrome and the future insertion seam occupy distinct semantic regions and never alias.
    const geometry = projectKanbanVerticalGeometry({
      bounds: { x: 0, y: 0, width: 24, height: 10 },
      stickyHeaderHeight: 1,
      swimlaneHeaderHeight: 1,
      scrollOffset: 0,
      density: 'compact',
      cards: [{ cardKey: 1, height: 2 }],
      verticalOverscan: 1,
      projectInsertionGutters: true,
    });
    const swimlaneHeader = geometry.regions.find((region: KanbanLayoutRegion) => region.kind === 'swimlane-header');
    const firstGutter = geometry.regions.find((region: KanbanLayoutRegion) => region.kind === 'insertion-gutter');

    expect(swimlaneHeader).toMatchObject({ kind: 'swimlane-header', y: 1, height: 1, actionable: false });
    expect(firstGutter).toMatchObject({ kind: 'insertion-gutter', y: 2, height: 1, actionable: false });
    expect(swimlaneHeader).not.toEqual(firstGutter);
    expect(geometry.actionTargets).toEqual([]);
  });

  it.each([
    [0, 'compact'],
    [1, 'comfortable'],
    [1, 'spacious'],
  ] as const)('should reserve exactly %i resting gap row for %s density', (expectedGapHeight, density) => {
    // Resting card separation is density-owned; compact's future active insertion gap stays collapsed.
    const geometry = projectDensity(density);
    const gaps = geometry.regions.filter((region: KanbanLayoutRegion) => region.kind === 'card-gap');

    expect(gaps.reduce((sum: number, gap: KanbanLayoutRegion) => sum + gap.height, 0)).toBe(expectedGapHeight);
    expect(gaps.every((gap: KanbanLayoutRegion) => gap.width === 24 && gap.actionable === false)).toBe(true);
  });
});

describe('Kanban minimum geometry', () => {
  it('should render one bounded localized minimum-size message and expose no partial targets', () => {
    // Impossible geometry degrades atomically instead of leaking clipped header, card, or action regions.
    const geometry: KanbanMinimumGeometry = projectKanbanMinimumGeometry({
      bounds: { x: 0, y: 0, width: 10, height: 2 },
      requiredWidth: 18,
      requiredHeight: 4,
      message: 'Kanban needs at least 18 × 4 cells\u001b[31m',
    });

    expect(geometry.kind).toBe('minimum-size');
    expect(geometry.message.text.trim().length).toBeGreaterThan(0);
    expect(geometry.message.text).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);
    expect(geometry.message.width).toBeLessThanOrEqual(10);
    expect(geometry.message.height).toBeLessThanOrEqual(2);
    expect(geometry.inspectionRegions).toEqual([]);
    expect(geometry.actionTargets).toEqual([]);
    expect(Object.isFrozen(geometry)).toBe(true);
  });
});
