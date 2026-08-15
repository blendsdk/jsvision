import { resolveCapabilities } from '@jsvision/core';
import { afterEach, describe, expect, it } from 'vitest';

import type { GitHubProjectSnapshot } from '../github-project-kanban/github-project.js';
import { createGitHubProjectKanbanApp } from '../github-project-kanban/shell.js';
import { createKanbanShowcase } from '../kanban-showcase/shell.js';
import { KANBAN_STORIES } from '../kanban-showcase/stories/index.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

/** Returns a detached two-card snapshot suitable for repeated local-board replacement. */
function githubSnapshot(revision: number): GitHubProjectSnapshot {
  return {
    projectId: `project-${revision}`,
    title: `Lifecycle project ${revision}`,
    url: 'https://github.com/orgs/nodejs/projects/11',
    location: { ownerKind: 'orgs', owner: 'nodejs', projectNumber: 11 },
    columns: [
      { columnId: 'todo', label: 'Todo', revision, color: 'GREEN' },
      { columnId: 'done', label: 'Done', revision, color: 'PURPLE' },
    ],
    cards: [
      { key: `card-${revision}-1`, columnId: 'todo', title: 'First', status: 'Todo', custom: { statusColor: 'GREEN' } },
      {
        key: `card-${revision}-2`,
        columnId: 'done',
        title: 'Second',
        status: 'Done',
        custom: { statusColor: 'PURPLE' },
      },
    ],
  };
}

describe('Phase D example lifecycle', () => {
  it('should dispose each replaced kitchen-sink story action graph through repeated responsive navigation', () => {
    const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
    disposers.push(() => showcase.app.loop.dispose());
    const phaseD = ['kanban/productivity', 'kanban/editing', 'kanban/configuration', 'kanban/actions-history'];

    for (const id of phaseD) {
      const previous = showcase.activeBoard();
      const index = KANBAN_STORIES.findIndex((story) => story.id === id);
      showcase.selectStory(index);
      showcase.app.loop.resize({ width: 48 + index, height: 18 });
      showcase.app.loop.renderRoot.flush();

      expect(previous.actions()?.invoke('kanban.help.open', 'programmatic', { kind: 'board' })).toEqual({
        kind: 'unavailable',
        code: 'router-disposed',
      });
      expect(showcase.activeBoard().inspection().visibleCards.length).toBeGreaterThan(0);
    }
    expect(showcase.disposedStoryCount()).toBe(phaseD.length);
  });

  it('should dispose a replaced GitHub board while preserving application-owned saved views', async () => {
    let revision = 0;
    const showcase = createGitHubProjectKanbanApp(CAPS, {
      viewport: { width: 80, height: 24 },
      loader: () => Promise.resolve(githubSnapshot(++revision)),
    });
    disposers.push(() => showcase.app.loop.dispose());
    await showcase.load('https://github.com/orgs/nodejs/projects/11');
    const first = showcase.activeBoard();
    if (first === undefined) throw new Error('Expected the first imported board.');
    showcase.saveLocalView('Lifecycle view');

    await showcase.load('https://github.com/orgs/nodejs/projects/11');

    expect(first.actions()?.invoke('kanban.help.open', 'programmatic', { kind: 'board' })).toEqual({
      kind: 'unavailable',
      code: 'router-disposed',
    });
    expect(showcase.localSavedViews()).toMatchObject([{ name: 'Lifecycle view' }]);
    expect(showcase.activeBoard()).not.toBe(first);
  });
});
