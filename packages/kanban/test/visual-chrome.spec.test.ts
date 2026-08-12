/**
 * Specification oracle for the board's fundamental visual grouping.
 *
 * Workflow lanes require a visible vertical delimiter. Every card is one coherent framed surface:
 * inactive cards use a single frame, the focused card uses a double frame, and text cells preserve
 * the card surface background instead of painting disconnected patches.
 */
import { Attr, classicTheme, resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { afterEach, expect, test } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createKanbanTheme, resolveKanbanThemeRole } from '../src/index.js';
import type { KanbanCardAdapter, KanbanQuery } from '../src/index.js';

interface VisualCard {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly status: string;
}

const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARDS: readonly VisualCard[] = Object.freeze([
  Object.freeze({
    id: 1,
    columnId: 'ready',
    title: 'Focused card with a deliberately long title that must be ellipsized',
    status: 'Ready',
  }),
  Object.freeze({ id: 2, columnId: 'doing', title: 'Inactive card', status: 'Ready' }),
  Object.freeze({ id: 3, columnId: 'doing', title: 'Other lane', status: 'In progress' }),
]);
const CARD: KanbanCardAdapter<VisualCard> = Object.freeze({
  keyOf: (card: VisualCard) => card.id,
  titleOf: (card: VisualCard) => card.title,
  statusOf: (card: VisualCard) => card.status,
});
const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', glyphs: { boxDrawing: true } },
}).profile;
const ASCII_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
}).profile;
const apps: Application[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.loop.dispose();
});

/** Mounts the visual fixture through the public board and eager-source APIs. */
function mountVisualBoard(
  caps = CAPS,
  headerAlignment: 'start' | 'center' = 'start',
  accentTheme = false,
): { readonly app: Application; readonly board: KanbanBoard<VisualCard> } {
  const source = createEagerKanbanDataSource(() => CARDS, {
    columns: () => [
      { columnId: 'ready', label: 'Ready', revision: 1 },
      { columnId: 'doing', label: 'In progress', revision: 1 },
    ],
    keyOf: CARD.keyOf,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => QUERY,
    card: accentTheme
      ? { ...CARD, styleOf: () => ({ revision: 'accent', surfaceRole: 'card.accent-1' as const }) }
      : CARD,
    ...(accentTheme
      ? { theme: () => createKanbanTheme(classicTheme, { 'card.accent-1': { fg: '#010101', bg: '#000000' } }) }
      : {}),
    density: () => 'compact',
    structure: () => ({
      revision: `visual-${headerAlignment}`,
      columns: [
        { columnId: 'ready', headerAlignment },
        { columnId: 'doing', headerAlignment },
      ],
    }),
    identity: () => ({ focusedCardKey: 1, selectedCardKeys: [2] }),
  });
  const app = createApplication({ content: board, viewport: { width: 48, height: 16 }, caps });
  apps.push(app);
  app.loop.renderRoot.flush();
  return { app, board };
}

/** Finds one exact card hit rectangle without depending on internal scene objects. */
function cardTarget(board: KanbanBoard<VisualCard>, cardKey: number) {
  const target = board
    .inspection()
    .actionTargets.find((candidate) => candidate.kind === 'card' && candidate.cardKey === cardKey);
  if (target === undefined) throw new Error(`Expected card target ${cardKey}.`);
  return target;
}

test('workflow lanes should be separated by a visible vertical line', () => {
  const { app, board } = mountVisualBoard();
  const origin = app.loop.renderRoot.originOf(board.viewport);
  const firstHeader = board.inspection().regions.find((region) => region.kind === 'workflow-header');
  if (origin === null || firstHeader === undefined) throw new Error('Expected a mounted first column header.');
  const separatorX = origin.x + firstHeader.x + firstHeader.width;
  const rows = app.loop.renderRoot.buffer().rows();

  expect(rows[origin.y + 1]?.[separatorX]?.char).toBe('│');
  expect(rows[origin.y + 5]?.[separatorX]?.char).toBe('│');
});

test('lane headers should form a complete joined frame around one compact label row', () => {
  const { app, board } = mountVisualBoard();
  const origin = app.loop.renderRoot.originOf(board.viewport);
  const firstHeader = board.inspection().regions.find((region) => region.kind === 'workflow-header');
  if (origin === null || firstHeader === undefined) throw new Error('Expected a mounted first column header.');
  const separatorX = origin.x + firstHeader.x + firstHeader.width;
  const rows = app.loop.renderRoot.buffer().rows();

  expect(rows[origin.y]?.[origin.x + firstHeader.x]?.char).toBe('┌');
  expect(rows[origin.y]?.[origin.x + firstHeader.x + 1]?.char).toBe('─');
  expect(rows[origin.y]?.[separatorX]?.char).toBe('┬');
  expect(rows[origin.y + 1]?.[origin.x + firstHeader.x]?.char).toBe('│');
  expect(rows[origin.y + 1]?.[origin.x + firstHeader.x + 1]?.char).toBe(' ');
  expect(rows[origin.y + 1]?.[origin.x + firstHeader.x + 2]?.char).toBe('R');
  expect(rows[origin.y + 2]?.[origin.x + firstHeader.x]?.char).toBe('├');
  expect(rows[origin.y + 2]?.[origin.x + firstHeader.x + 1]?.char).toBe('─');
  expect(rows[origin.y + 2]?.[separatorX]?.char).toBe('┼');
  expect(rows[origin.y + 3]?.[separatorX]?.char).toBe('│');

  board.scrollTo({ x: board.viewport.metrics().extents.x });
  app.loop.renderRoot.flush();
  const lastHeader = [...board.inspection().regions].reverse().find((region) => region.kind === 'workflow-header');
  if (lastHeader === undefined) throw new Error('Expected a mounted last column header.');
  const scrolledRows = app.loop.renderRoot.buffer().rows();
  expect(scrolledRows[origin.y]?.[origin.x + lastHeader.x + lastHeader.width]?.char).toBe('┐');
  expect(scrolledRows[origin.y + 2]?.[origin.x + lastHeader.x + lastHeader.width]?.char).toBe('┤');
});

test('lane headers should optionally center their complete visible label', () => {
  const { app, board } = mountVisualBoard(CAPS, 'center');
  const origin = app.loop.renderRoot.originOf(board.viewport);
  const firstHeader = board.inspection().regions.find((region) => region.kind === 'workflow-header');
  if (origin === null || firstHeader === undefined) throw new Error('Expected a mounted first column header.');
  const row = app.loop.renderRoot.buffer().rows()[origin.y + 1];
  const renderedLabel = 'Ready';
  const labelStart = row?.findIndex(
    (cell, index) => index >= origin.x + firstHeader.x && cell.char === renderedLabel[0],
  );
  const availableWidth = firstHeader.width - 3;
  const expectedStart = origin.x + firstHeader.x + 2 + Math.floor((availableWidth - renderedLabel.length) / 2);

  expect(labelStart).toBe(expectedStart);
});

test('lanes should pad cards and the focused card should cast a contained drop shadow', () => {
  const { app, board } = mountVisualBoard();
  const origin = app.loop.renderRoot.originOf(board.viewport);
  const firstHeader = board.inspection().regions.find((region) => region.kind === 'workflow-header');
  if (origin === null || firstHeader === undefined) throw new Error('Expected a mounted first column header.');
  const focused = cardTarget(board, 1);
  const rows = app.loop.renderRoot.buffer().rows();
  const rightShadow = rows[origin.y + focused.y + 1]?.[origin.x + focused.x + focused.width];
  const bottomShadow = rows[origin.y + focused.y + focused.height]?.[origin.x + focused.x + 1];

  expect(focused.x).toBe(firstHeader.x + 2);
  expect(focused.x + focused.width).toBe(firstHeader.x + firstHeader.width - 1);
  expect(rightShadow).toMatchObject({ fg: classicTheme.shadow.fg, bg: classicTheme.shadow.bg });
  expect(bottomShadow).toMatchObject({ fg: classicTheme.shadow.fg, bg: classicTheme.shadow.bg });
  expect(rows[origin.y + focused.y + 1]?.[origin.x + firstHeader.x + firstHeader.width]?.char).toBe('│');
});

test('cards should use a double frame when focused and a single frame when selected but unfocused', () => {
  const { app, board } = mountVisualBoard();
  const origin = app.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected a mounted board viewport.');
  const focused = cardTarget(board, 1);
  const inactive = cardTarget(board, 2);
  const rows = app.loop.renderRoot.buffer().rows();

  expect(rows[origin.y + focused.y]?.[origin.x + focused.x]?.char).toBe('╔');
  expect(rows[origin.y + focused.y]?.[origin.x + focused.x + 1]?.char).toBe('═');
  expect(rows[origin.y + focused.y + focused.height - 1]?.[origin.x + focused.x]?.char).toBe('╚');
  expect(rows[origin.y + inactive.y]?.[origin.x + inactive.x]?.char).toBe('┌');
  expect(rows[origin.y + inactive.y]?.[origin.x + inactive.x + 1]?.char).toBe('─');
  expect(rows[origin.y + inactive.y + inactive.height - 1]?.[origin.x + inactive.x]?.char).toBe('└');
});

test('the focused card title should be bold without making inactive titles bold', () => {
  const { app, board } = mountVisualBoard();
  const origin = app.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected a mounted board viewport.');
  const focused = cardTarget(board, 1);
  const inactive = cardTarget(board, 2);
  const rows = app.loop.renderRoot.buffer().rows();
  const focusedTitle = rows[origin.y + focused.y + 1]?.[origin.x + focused.x + 2];
  const inactiveTitle = rows[origin.y + inactive.y + 1]?.[origin.x + inactive.x + 2];

  expect((focusedTitle?.attrs ?? Attr.none) & Attr.bold).toBe(Attr.bold);
  expect((inactiveTitle?.attrs ?? Attr.none) & Attr.bold).toBe(Attr.none);
});

test('ellipsized standard-card text should retain one blank cell before the right frame', () => {
  const { app, board } = mountVisualBoard();
  const origin = app.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected a mounted board viewport.');
  const focused = cardTarget(board, 1);
  const rows = app.loop.renderRoot.buffer().rows();
  const titleRow = rows[origin.y + focused.y + 1];

  expect(titleRow?.[origin.x + focused.x + focused.width - 3]?.char).toBe('…');
  expect(titleRow?.[origin.x + focused.x + focused.width - 2]?.char).toBe(' ');
  expect(titleRow?.[origin.x + focused.x + focused.width - 1]?.char).toBe('║');
});

test('ASCII terminals should retain distinct focused and inactive frames plus lane separators', () => {
  const { app, board } = mountVisualBoard(ASCII_CAPS);
  const origin = app.loop.renderRoot.originOf(board.viewport);
  const firstHeader = board.inspection().regions.find((region) => region.kind === 'workflow-header');
  if (origin === null || firstHeader === undefined) throw new Error('Expected a mounted first column header.');
  const focused = cardTarget(board, 1);
  const inactive = cardTarget(board, 2);
  const rows = app.loop.renderRoot.buffer().rows();

  expect(rows[origin.y + focused.y]?.[origin.x + focused.x + 1]?.char).toBe('=');
  expect(rows[origin.y + focused.y + 1]?.[origin.x + focused.x]?.char).toBe('!');
  expect(rows[origin.y + inactive.y]?.[origin.x + inactive.x + 1]?.char).toBe('-');
  expect(rows[origin.y + inactive.y + 1]?.[origin.x + inactive.x]?.char).toBe('|');
  expect(rows[origin.y]?.[origin.x + firstHeader.x]?.char).toBe('+');
  expect(rows[origin.y]?.[origin.x + firstHeader.x + firstHeader.width]?.char).toBe('+');
  expect(rows[origin.y + 1]?.[origin.x + firstHeader.x + firstHeader.width]?.char).toBe('|');
  expect(rows[origin.y + 2]?.[origin.x + firstHeader.x]?.char).toBe('+');
  expect(rows[origin.y + 2]?.[origin.x + firstHeader.x + firstHeader.width]?.char).toBe('+');
});

test('card text and empty interior cells should retain the card surface background', () => {
  const { app, board } = mountVisualBoard();
  const origin = app.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected a mounted board viewport.');
  const target = cardTarget(board, 1);
  const card = board.inspection().visibleCards.find(({ cardKey }) => cardKey === 1);
  if (card === undefined) throw new Error('Expected the focused card descriptor.');
  const theme = createKanbanTheme(classicTheme);
  const expectedBackground = resolveKanbanThemeRole(theme, card.descriptor.surfaceRole, 'card.normal', {
    colorDepth: CAPS.colorDepth,
  }).style.bg;
  const rows = app.loop.renderRoot.buffer().rows();
  const titleCell = rows[origin.y + target.y + 1]?.[origin.x + target.x + 2];
  const emptyCell = rows[origin.y + target.y + 1]?.[origin.x + target.x + target.width - 2];

  expect(titleCell?.char).not.toBe(' ');
  expect(titleCell?.bg).toEqual(expectedBackground);
  expect(emptyCell?.bg).toEqual(expectedBackground);
});

test('rendered accents apply capability contrast fallback instead of raw unreadable colors', () => {
  const { app, board } = mountVisualBoard(CAPS, 'start', true);
  const target = cardTarget(board, 1);
  const origin = app.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected a mounted board viewport.');
  const cell = app.loop.renderRoot.buffer().get(origin.x + target.x + 2, origin.y + target.y + 1);
  const normal = createKanbanTheme(classicTheme).roles['card.normal'].style;
  expect(cell).toMatchObject({ fg: normal.fg, bg: normal.bg });
});
