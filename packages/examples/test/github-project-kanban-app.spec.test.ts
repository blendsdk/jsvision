/**
 * Specification oracle for the standalone GitHub Kanban application shell.
 *
 * The real component must render imported metadata, switch themes, support local moves, and restore
 * authoritative data on refresh without issuing any GitHub mutation.
 */
import { classicTheme, nordTheme, resolveCapabilities } from '@jsvision/core';
import { inspectKanbanDragFrame } from '@jsvision/kanban/testing';
import { afterEach, expect, test, vi } from 'vitest';

import type { GitHubProjectSnapshot } from '../github-project-kanban/github-project.js';
import { GITHUB_KANBAN_COMMANDS, createGitHubProjectKanbanApp } from '../github-project-kanban/shell.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const MONO_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'mono', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const SOURCE_URL = 'https://github.com/orgs/nodejs/projects/11';
const disposeApps: (() => void)[] = [];

/** Creates a realistic but bounded imported project fixture. */
function projectSnapshot(): GitHubProjectSnapshot {
  return {
    projectId: 'project-node',
    title: 'Node-API Team Project',
    description: 'Public delivery work',
    url: SOURCE_URL,
    location: { ownerKind: 'orgs', owner: 'nodejs', projectNumber: 11 },
    columns: [
      { columnId: 'todo', label: 'Todo', revision: 1, color: 'GREEN' },
      { columnId: 'progress', label: 'In Progress', revision: 1, color: 'YELLOW' },
      { columnId: 'done', label: 'Done', revision: 1, color: 'PURPLE' },
    ],
    cards: [
      {
        key: 'item-1',
        columnId: 'todo',
        title: 'Show labels and repository context',
        status: 'Todo',
        type: 'Issue',
        labels: [{ id: 'label-1', label: 'good first issue' }],
        assignees: [{ id: 'user-1', label: 'octocat' }],
        summaries: [
          { fieldId: 'repository', label: 'Repo', value: 'nodejs/node' },
          { fieldId: 'reference', label: 'Item', value: '#123' },
        ],
        custom: { repository: 'nodejs/node', reference: '#123', statusColor: 'GREEN' },
      },
      {
        key: 'item-2',
        columnId: 'progress',
        title: 'Polish drag and drop',
        status: 'In Progress',
        type: 'PullRequest',
        custom: { statusColor: 'YELLOW' },
      },
    ],
  };
}

/** Builds one deterministic GitHub-shaped item identity with realistic encoded length. */
function scaledCardKey(index: number): string {
  return `PVTI_lADOAJfUac4Am6NBzg${String(index).padStart(6, '0')}`;
}

/** Expands the representative project to the 84-card stabilization scale. */
function scaledProjectSnapshot(): GitHubProjectSnapshot {
  const base = projectSnapshot();
  return {
    ...base,
    cards: Array.from({ length: 84 }, (_, index) => {
      const seed = base.cards[index % base.cards.length]!;
      return {
        ...seed,
        key: scaledCardKey(index),
        title:
          index % 7 === 0 ? `Lange Unicode-taak 界 ${index} met uitgebreide projectinformatie` : `Work item ${index}`,
      };
    }),
  };
}

/** Adds two statuses so the wide native-terminal fixture exposes five independent drop lanes. */
function wideProjectSnapshot(): GitHubProjectSnapshot {
  const scaled = scaledProjectSnapshot();
  const columns = [
    ...scaled.columns,
    { columnId: 'review', label: 'Review', revision: 1, color: 'BLUE' as const },
    { columnId: 'released', label: 'Released', revision: 1, color: 'GREEN' as const },
  ];
  return {
    ...scaled,
    columns,
    cards: scaled.cards.map((card, index) => {
      const columnIndex = index < 33 ? 0 : index < 47 ? 1 : index < 60 ? 2 : index < 64 ? 3 : 4;
      return { ...card, columnId: columns[columnIndex]!.columnId };
    }),
  };
}

/** Returns all text currently painted to the terminal buffer. */
function screenText(showcase: ReturnType<typeof createGitHubProjectKanbanApp>): string {
  return showcase.app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map(({ char }) => char).join(''))
    .join('\n');
}

/** Drains the board's intentionally asynchronous source-session publication. */
async function settleBoard(): Promise<void> {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  for (const dispose of disposeApps.splice(0)) dispose();
});

// The app must open as a real, responsive Kanban rather than a static terminal imitation.
test('should render a loaded public project as a visible live Kanban', async () => {
  const showcase = createGitHubProjectKanbanApp(CAPS, {
    viewport: { width: 80, height: 24 },
    loader: () => Promise.resolve(projectSnapshot()),
  });
  disposeApps.push(() => showcase.app.loop.dispose());

  await showcase.load(SOURCE_URL);
  await settleBoard();
  showcase.app.loop.renderRoot.flush();

  expect(showcase.activeBoard()?.inspection().visibleCards).toHaveLength(2);
  expect(screenText(showcase)).toMatch(/Node-API Team Project/u);
  expect(screenText(showcase)).toMatch(/Todo\s+\|\s+In Progress/u);
  expect(screenText(showcase)).toMatch(/Labels: good/u);
  expect(showcase.localCards()[0]?.assignees).toEqual([{ id: 'user-1', label: 'octocat' }]);
  expect(showcase.app.desktop.activeWindow()?.resizeMode).toBe('outline');
});

// Every built-in theme command must repaint the complete app while preserving project state.
test('should switch themes without rebuilding the imported board', async () => {
  const showcase = createGitHubProjectKanbanApp(CAPS, {
    viewport: { width: 80, height: 24 },
    loader: () => Promise.resolve(projectSnapshot()),
  });
  disposeApps.push(() => showcase.app.loop.dispose());
  await showcase.load(SOURCE_URL);
  await settleBoard();
  const board = showcase.activeBoard();

  showcase.app.loop.emitCommand(`${GITHUB_KANBAN_COMMANDS.themePrefix}nord`);
  showcase.app.loop.renderRoot.flush();

  expect(showcase.currentTheme()).toBe('Nord');
  expect(showcase.activeBoard()).toBe(board);
  expect(showcase.app.loop.renderRoot.buffer().get(0, 0)?.bg).toBe(nordTheme.menuBar.bg);
  expect(board?.inspection().visibleCards[0]?.descriptor.surfaceRole).toMatch(/^card\.accent-/u);
});

// Moving a card changes only local application state, and refresh restores the GitHub snapshot.
test('should keep card moves local and restore source data on refresh', async () => {
  let loads = 0;
  const showcase = createGitHubProjectKanbanApp(CAPS, {
    viewport: { width: 80, height: 24 },
    loader: () => {
      loads += 1;
      return Promise.resolve(projectSnapshot());
    },
  });
  disposeApps.push(() => showcase.app.loop.dispose());
  await showcase.load(SOURCE_URL);
  await settleBoard();
  const board = showcase.activeBoard();
  if (board === undefined) throw new Error('Expected a loaded board.');

  const result = await board.interaction().moveCard({
    cardKey: 'item-1',
    target: { columnId: 'done' },
    direction: 'end',
    origin: 'programmatic',
  });
  await Promise.resolve();

  expect(result.kind).toBe('accepted');
  expect(showcase.localCards().find(({ key }) => key === 'item-1')?.columnId).toBe('done');
  expect(showcase.activity()).toMatch(/Moved locally.*Refresh restores GitHub/u);
  const second = await board.interaction().moveCard({
    cardKey: 'item-1',
    target: { columnId: 'todo' },
    direction: 'end',
    origin: 'programmatic',
  });
  expect(second.kind).toBe('accepted');

  await showcase.load(showcase.currentUrl());
  await settleBoard();
  expect(loads).toBe(2);
  expect(showcase.localCards().find(({ key }) => key === 'item-1')?.columnId).toBe('todo');
});

test('should keep the deterministic 84-card showcase responsive through resize and theme changes', async () => {
  const showcase = createGitHubProjectKanbanApp(CAPS, {
    viewport: { width: 80, height: 24 },
    loader: () => Promise.resolve(scaledProjectSnapshot()),
  });
  disposeApps.push(() => showcase.app.loop.dispose());
  await showcase.load(SOURCE_URL);
  await settleBoard();
  const board = showcase.activeBoard();
  if (board === undefined) throw new Error('Expected the scaled board.');

  expect(showcase.localCards()).toHaveLength(84);
  expect(board.inspection().visibleCards.length).toBeGreaterThanOrEqual(4);
  expect(board.inspection().visibleCards.length).toBeLessThan(84);

  const cancelledSource = board
    .inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === scaledCardKey(0));
  const initialOrigin = showcase.app.loop.renderRoot.originOf(board.viewport);
  if (cancelledSource === undefined || initialOrigin === null) {
    throw new Error('Expected a visible pointer drag source.');
  }
  const cancelledDown = {
    x: initialOrigin.x + cancelledSource.x + 2,
    y: initialOrigin.y + cancelledSource.y + 1,
  };
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...cancelledDown });
  showcase.app.loop.dispatch({
    type: 'mouse',
    kind: 'drag',
    button: 0,
    x: cancelledDown.x + 3,
    y: cancelledDown.y,
  });
  expect(inspectKanbanDragFrame(board.viewport).ghost).toBeDefined();
  showcase.app.loop.resize({ width: 90, height: 28 });
  showcase.app.loop.renderRoot.flush();
  await settleBoard();
  expect(inspectKanbanDragFrame(board.viewport).ghost).toBeUndefined();
  expect(showcase.localCards().find(({ key }) => key === scaledCardKey(0))?.columnId).toBe('todo');

  const source = board
    .inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === scaledCardKey(0));
  const destination = board
    .inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === scaledCardKey(1));
  const origin = showcase.app.loop.renderRoot.originOf(board.viewport);
  if (source === undefined || destination === undefined || origin === null) {
    throw new Error('Expected visible pointer drag targets.');
  }
  const down = { x: origin.x + source.x + 2, y: origin.y + source.y + 1 };
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, x: down.x + 3, y: down.y });
  showcase.app.loop.dispatch({
    type: 'mouse',
    kind: 'drag',
    button: 0,
    x: origin.x + destination.x + 2,
    y: origin.y + destination.y + Math.max(1, destination.height - 1),
  });
  showcase.app.loop.dispatch({
    type: 'mouse',
    kind: 'up',
    button: 0,
    x: origin.x + destination.x + 2,
    y: origin.y + destination.y + Math.max(1, destination.height - 1),
  });
  await settleBoard();
  expect(showcase.localCards().find(({ key }) => key === scaledCardKey(0))?.columnId).toBe('progress');

  board.scrollBy({ y: 4 });
  showcase.app.loop.renderRoot.flush();
  expect(board.inspection().visibleCards.length).toBeGreaterThan(0);
  showcase.app.loop.resize({ width: 120, height: 36 });
  showcase.app.loop.renderRoot.flush();
  showcase.app.loop.emitCommand(`${GITHUB_KANBAN_COMMANDS.themePrefix}monochrome`);
  showcase.app.loop.renderRoot.flush();

  expect(showcase.currentTheme()).toBe('Monochrome');
  expect(
    board.inspection().actionTargets.some(({ kind, width, height }) => kind === 'card' && width > 0 && height > 0),
  ).toBe(true);
  expect(screenText(showcase)).toMatch(/Lange Unicode/u);

  expect(showcase.isMaximized()).toBe(true);
  showcase.toggleMaximize();
  expect(showcase.isMaximized()).toBe(false);
  expect(board.inspection().visibleCards.length).toBeGreaterThan(0);
  showcase.toggleMaximize();
  expect(showcase.isMaximized()).toBe(true);
  expect(board.inspection().visibleCards.length).toBeGreaterThan(0);
});

test('should paint the scaled showcase through monochrome capability fallbacks', async () => {
  const showcase = createGitHubProjectKanbanApp(MONO_CAPS, {
    viewport: { width: 80, height: 24 },
    loader: () => Promise.resolve(scaledProjectSnapshot()),
  });
  disposeApps.push(() => showcase.app.loop.dispose());
  await showcase.load(SOURCE_URL);
  await settleBoard();
  showcase.app.loop.renderRoot.flush();
  const board = showcase.activeBoard();
  const target = board
    ?.inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === scaledCardKey(0));
  const origin = board === undefined ? null : showcase.app.loop.renderRoot.originOf(board.viewport);
  if (board === undefined || target === undefined || origin === null) {
    throw new Error('Expected a visible monochrome card.');
  }

  const titleCell = showcase.app.loop.renderRoot.buffer().get(origin.x + target.x + 2, origin.y + target.y + 1);
  expect(board.inspection().visibleCards.length).toBeGreaterThanOrEqual(4);
  expect(board.inspection().visibleCards[0]?.descriptor.surfaceRole).toMatch(/^card\.accent-/u);
  expect(titleCell?.bg).toBe(classicTheme.listNormal.bg);
  expect(titleCell?.bg).not.toBe(classicTheme.progressFill.fg);
});

// Real GitHub item IDs must not make a wide board's bounded interaction revision invalid.
test('should keep realistic GitHub item identities clickable in a 248 by 54 window', async () => {
  const showcase = createGitHubProjectKanbanApp(CAPS, {
    viewport: { width: 248, height: 54 },
    loader: () => Promise.resolve(wideProjectSnapshot()),
  });
  disposeApps.push(() => showcase.app.loop.dispose());
  await showcase.load(SOURCE_URL);
  await settleBoard();
  showcase.app.loop.renderRoot.flush();
  const board = showcase.activeBoard();
  const origin = board === undefined ? null : showcase.app.loop.renderRoot.originOf(board.viewport);
  if (board === undefined || origin === null) throw new Error('Expected a mounted wide board.');
  const clicked = board
    .inspection()
    .actionTargets.find(
      ({ kind, x, y, width, height }) =>
        kind === 'card' &&
        149 >= origin.x + x &&
        149 < origin.x + x + width &&
        9 >= origin.y + y &&
        9 < origin.y + y + height,
    );
  if (clicked?.cardKey === undefined) throw new Error('Expected a card beneath terminal cell 150,10.');

  showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 150, y: 10 });
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, x: 150, y: 10 });

  expect(board.inspection().interaction.focused).toMatchObject({ kind: 'card', cardKey: clicked.cardKey });
});

// Publishing a move after browsing down must retain a usable non-zero viewport and event loop.
test('should remain scrolled and responsive after a native drop below the first cards', async () => {
  const showcase = createGitHubProjectKanbanApp(CAPS, {
    viewport: { width: 248, height: 54 },
    loader: () => Promise.resolve(wideProjectSnapshot()),
  });
  disposeApps.push(() => showcase.app.loop.dispose());
  await showcase.load(SOURCE_URL);
  await settleBoard();
  const board = showcase.activeBoard();
  if (board === undefined) throw new Error('Expected a mounted wide board.');

  const initialOrigin = showcase.app.loop.renderRoot.originOf(board.viewport);
  if (initialOrigin === null) throw new Error('Expected a mounted board origin.');
  for (let index = 0; index < 5; index += 1) {
    showcase.app.loop.dispatch({
      type: 'wheel',
      dir: 'down',
      x: initialOrigin.x + 2,
      y: initialOrigin.y + 8,
      shift: false,
      alt: false,
      ctrl: false,
    });
  }
  await settleBoard();
  const scrollBefore = board.viewport.metrics().offsets.y;
  const origin = showcase.app.loop.renderRoot.originOf(board.viewport);
  const cards = board.inspection().actionTargets.filter(({ kind, height }) => kind === 'card' && height >= 3);
  const source = cards.find((target) => target.address?.columnId === 'todo');
  const destination = cards.find((target) => target.address?.columnId === 'review');
  if (scrollBefore <= 0 || origin === null || source === undefined || destination === undefined) {
    throw new Error('Expected non-zero scrolling and visible cross-lane drop targets.');
  }
  const down = { x: origin.x + source.x + 2, y: origin.y + source.y + 1 };
  const drop = { x: origin.x + destination.x + 2, y: origin.y + destination.y + 1 };
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, x: down.x + 2, y: down.y });
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...drop });
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...drop });
  await settleBoard();
  showcase.app.loop.renderRoot.flush();

  if (source.cardKey === undefined || destination.address === undefined) {
    throw new Error('Expected concrete source and destination identities.');
  }
  expect(showcase.localCards().find(({ key }) => key === source.cardKey)?.columnId).toBe(destination.address.columnId);
  expect(board.viewport.metrics().offsets.y).toBeGreaterThan(0);
  const revision = board.inspection().interaction.revision;
  showcase.app.loop.dispatch({ type: 'key', key: 'right', ctrl: false, alt: false, shift: false });
  expect(board.inspection().interaction.revision).toBeGreaterThan(revision);
});

// A scrolled edge dwell must remain input-safe while still providing deliberate hold-to-scroll behavior.
test('should delay and bound native edge autoscroll before releasing a scrolled drag', async () => {
  vi.useFakeTimers();
  const showcase = createGitHubProjectKanbanApp(CAPS, {
    viewport: { width: 248, height: 54 },
    loader: () => Promise.resolve(wideProjectSnapshot()),
  });
  disposeApps.push(() => showcase.app.loop.dispose());
  await showcase.load(SOURCE_URL);
  await settleBoard();
  const board = showcase.activeBoard();
  const origin = board === undefined ? null : showcase.app.loop.renderRoot.originOf(board.viewport);
  if (board === undefined || origin === null) throw new Error('Expected a mounted wide board.');

  for (let index = 0; index < 5; index += 1) {
    showcase.app.loop.dispatch({
      type: 'wheel',
      dir: 'down',
      x: origin.x + 2,
      y: origin.y + 8,
      shift: false,
      alt: false,
      ctrl: false,
    });
  }
  const scrollBefore = board.viewport.metrics().offsets.y;
  const source = board
    .inspection()
    .actionTargets.find(({ kind, height, address }) => kind === 'card' && height >= 3 && address?.columnId === 'todo');
  if (scrollBefore <= 4 || source === undefined) throw new Error('Expected a scrolled visible source card.');

  const down = { x: origin.x + source.x + 2, y: origin.y + source.y + 1 };
  const edge = { x: down.x + 2, y: down.y };
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...edge });
  expect(inspectKanbanDragFrame(board.viewport).ghost).toBeDefined();
  expect(vi.getTimerCount()).toBe(1);

  vi.advanceTimersByTime(249);
  expect(board.viewport.metrics().offsets.y).toBe(scrollBefore);
  vi.advanceTimersByTime(1);
  const afterActivation = board.viewport.metrics().offsets.y;
  expect(afterActivation).toBeLessThan(scrollBefore);
  expect(afterActivation).toBeGreaterThan(0);
  vi.advanceTimersByTime(124);
  expect(board.viewport.metrics().offsets.y).toBe(afterActivation);
  vi.advanceTimersByTime(1);
  expect(board.viewport.metrics().offsets.y).toBeLessThan(afterActivation);

  showcase.app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...edge });
  expect(vi.getTimerCount()).toBe(0);
  const revision = board.inspection().interaction.revision;
  showcase.app.loop.dispatch({ type: 'key', key: 'right', ctrl: false, alt: false, shift: false });
  expect(board.inspection().interaction.revision).toBeGreaterThan(revision);
});
