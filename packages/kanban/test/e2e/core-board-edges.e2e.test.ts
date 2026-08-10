import { classicTheme } from '@jsvision/core';
import { createApplication, resolveCapabilities, signal } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createKanbanTheme } from '../../src/index.js';
import type { KanbanCardAdapter, KanbanQuery } from '../../src/index.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
let disposeApp: (() => void) | undefined;

afterEach(() => {
  disposeApp?.();
  disposeApp = undefined;
});

describe('Kanban one-axis real-loop edges', () => {
  it('reflows a theme replacement without changing semantic card identity', () => {
    const theme = signal(createKanbanTheme(classicTheme));
    const source = createEagerKanbanDataSource(() => [{ id: 1, columnId: 'ready', title: 'Stable identity' }], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const board = new KanbanBoard({ source, query: () => QUERY, card: CARD, theme });
    board.setLayout({ position: 'fill' });
    const app = createApplication({ content: board, viewport: { width: 48, height: 14 }, caps: CAPS });
    disposeApp = () => app.loop.dispose();
    app.loop.renderRoot.flush();
    const before = board.inspection();

    theme.set(createKanbanTheme(classicTheme, { 'content.title': { fg: '#ffffff', bg: '#000080' } }));
    app.loop.renderRoot.flush();
    const after = board.inspection();

    expect(after.layoutReflows).toBeGreaterThan(before.layoutReflows);
    expect(after.visibleCards.map(({ cardKey }) => cardKey)).toEqual(before.visibleCards.map(({ cardKey }) => cardKey));
  });
});
