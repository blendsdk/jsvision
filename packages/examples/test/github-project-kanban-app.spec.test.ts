/**
 * Specification oracle for the standalone GitHub Kanban application shell.
 *
 * The real component must render imported metadata, switch themes, support local moves, and restore
 * authoritative data on refresh without issuing any GitHub mutation.
 */
import { classicTheme, nordTheme, resolveCapabilities } from '@jsvision/core';
import { inspectKanbanDragFrame } from '@jsvision/kanban/testing';
import { afterEach, expect, test } from 'vitest';

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

/** Expands the representative project to the 84-card stabilization scale. */
function scaledProjectSnapshot(): GitHubProjectSnapshot {
  const base = projectSnapshot();
  return {
    ...base,
    cards: Array.from({ length: 84 }, (_, index) => {
      const seed = base.cards[index % base.cards.length]!;
      return {
        ...seed,
        key: `scaled-${index}`,
        title:
          index % 7 === 0 ? `Lange Unicode-taak 界 ${index} met uitgebreide projectinformatie` : `Work item ${index}`,
      };
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
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 'scaled-0');
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
    kind: 'move',
    button: 0,
    x: cancelledDown.x + 3,
    y: cancelledDown.y,
  });
  expect(inspectKanbanDragFrame(board.viewport).ghost).toBeDefined();
  showcase.app.loop.resize({ width: 90, height: 28 });
  showcase.app.loop.renderRoot.flush();
  await settleBoard();
  expect(inspectKanbanDragFrame(board.viewport).ghost).toBeUndefined();
  expect(showcase.localCards().find(({ key }) => key === 'scaled-0')?.columnId).toBe('todo');

  const source = board
    .inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 'scaled-0');
  const destination = board
    .inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 'scaled-1');
  const origin = showcase.app.loop.renderRoot.originOf(board.viewport);
  if (source === undefined || destination === undefined || origin === null) {
    throw new Error('Expected visible pointer drag targets.');
  }
  const down = { x: origin.x + source.x + 2, y: origin.y + source.y + 1 };
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
  showcase.app.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, x: down.x + 3, y: down.y });
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
  expect(showcase.localCards().find(({ key }) => key === 'scaled-0')?.columnId).toBe('progress');

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
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === 'scaled-0');
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
