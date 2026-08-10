import { Text, col, fixed, grow } from '@jsvision/ui';

import type { KanbanStory } from '../story.js';
import { createShowcaseBoard } from '../work-items.js';

/** Grouped story proving one semantic team model can use horizontal hybrid swimlane chrome. */
export const SWIMLANES_STORY: KanbanStory = {
  id: 'kanban/team-swimlanes',
  category: 'Layout',
  title: 'Team swimlanes',
  blurb: 'Hybrid horizontal grouping separates teams while preserving the same vertical workflow columns.',
  build: () => {
    const { board, activity } = createShowcaseBoard({
      density: 'compact',
      swimlanes: 'hybrid',
      initialActivity: 'Try: resize narrower to see the board choose focused-column mode automatically',
      cards: [
        { key: 201, columnId: 'backlog', title: 'Terminal theme audit', status: 'Ready', custom: { team: 'platform' } },
        {
          key: 202,
          columnId: 'active',
          title: 'Viewport virtualization',
          status: 'In progress',
          custom: { team: 'platform' },
        },
        { key: 203, columnId: 'done', title: 'Package entry point', status: 'Done', custom: { team: 'platform' } },
        {
          key: 204,
          columnId: 'backlog',
          title: 'Card editor research',
          status: 'Ready',
          custom: { team: 'experience' },
        },
        {
          key: 205,
          columnId: 'active',
          title: 'Mouse hit targets',
          status: 'In progress',
          custom: { team: 'experience' },
        },
        { key: 206, columnId: 'done', title: 'Keyboard selection', status: 'Done', custom: { team: 'experience' } },
      ],
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(
        new Text('Rows are application-selected groups; nested grouping is intentionally absent for TUI clarity.'),
        2,
      ),
      grow(board),
      fixed(new Text(() => `Activity: ${activity()}`), 2),
    );
    return { view, board, activity };
  },
};
