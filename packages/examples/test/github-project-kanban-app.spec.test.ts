/**
 * Specification oracle for the standalone GitHub Kanban application shell.
 *
 * The real component must render imported metadata, switch themes, support local moves, and restore
 * authoritative data on refresh without issuing any GitHub mutation.
 */
import { nordTheme, resolveCapabilities } from '@jsvision/core';
import { afterEach, expect, test } from 'vitest';

import type { GitHubProjectSnapshot } from '../github-project-kanban/github-project.js';
import { GITHUB_KANBAN_COMMANDS, createGitHubProjectKanbanApp } from '../github-project-kanban/shell.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
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

  await showcase.load(showcase.currentUrl());
  await settleBoard();
  expect(loads).toBe(2);
  expect(showcase.localCards().find(({ key }) => key === 'item-1')?.columnId).toBe('todo');
});
