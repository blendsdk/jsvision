import { describe, expect, it } from 'vitest';

import { projectKanbanVerticalGeometry, solveKanbanColumnWidths } from '../src/index.js';

describe('responsive layout implementation properties', () => {
  it('keeps every source-ordered width monotone across both allocation tiers', () => {
    const columns = [
      { columnId: 'a', minimumWidth: 7, preferredWidth: 13, maximumWidth: 19 },
      { columnId: 'b', minimumWidth: 9, preferredWidth: 15, maximumWidth: 21 },
      { columnId: 'c', minimumWidth: 11, preferredWidth: 17, maximumWidth: 23 },
    ] as const;
    let previous = new Map<string, number>();
    for (let width = 28; width <= 80; width += 1) {
      const solution = solveKanbanColumnWidths({ availableWidth: width, columns, separatorWidth: 1 });
      const current = new Map(solution.columns.map((column) => [column.columnId, column.width] as const));
      for (const column of columns) {
        expect(current.get(column.columnId) ?? 0).toBeGreaterThanOrEqual(previous.get(column.columnId) ?? 0);
      }
      previous = current;
    }
  });

  it('breaks normalized allocation ties in stable source order', () => {
    const columns = ['first', 'second', 'third'].map((columnId) => ({
      columnId,
      minimumWidth: 4,
      preferredWidth: 7,
      maximumWidth: 10,
    }));

    expect(solveKanbanColumnWidths({ availableWidth: 15, columns, separatorWidth: 1 }).columns).toMatchObject([
      { columnId: 'first', width: 5 },
      { columnId: 'second', width: 4 },
      { columnId: 'third', width: 4 },
    ]);
    expect(solveKanbanColumnWidths({ availableWidth: 16, columns, separatorWidth: 1 }).columns).toMatchObject([
      { columnId: 'first', width: 5 },
      { columnId: 'second', width: 5 },
      { columnId: 'third', width: 4 },
    ]);
  });

  it('clips every projected region to randomized viewport-local bounds', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const width = 1 + ((seed * 17) % 40);
      const height = 1 + ((seed * 29) % 30);
      const geometry = projectKanbanVerticalGeometry({
        bounds: { x: 0, y: 0, width, height },
        stickyHeaderHeight: Math.min(1, height),
        scrollOffset: (seed * 31) % 200,
        density: seed % 3 === 0 ? 'compact' : seed % 3 === 1 ? 'comfortable' : 'spacious',
        cards: Array.from({ length: 25 }, (_, index) => ({ cardKey: index, height: 1 + ((seed + index) % 6) })),
        verticalOverscan: seed % 9,
      });
      for (const region of geometry.regions) {
        expect(region.x).toBeGreaterThanOrEqual(0);
        expect(region.y).toBeGreaterThanOrEqual(0);
        expect(region.x + region.width).toBeLessThanOrEqual(width);
        expect(region.y + region.height).toBeLessThanOrEqual(height);
      }
    }
  });
});
