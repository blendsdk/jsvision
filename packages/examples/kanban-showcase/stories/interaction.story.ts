import { Text, col, fixed, grow } from '@jsvision/ui';

import type { KanbanStory } from '../story.js';
import { createShowcaseBoard } from '../work-items.js';
import type { ShowcaseCard } from '../work-items.js';

/** Input story exposing semantic keyboard and mouse intents in a visible application-owned log. */
export const INTERACTION_STORY: KanbanStory = {
  id: 'kanban/interaction-lab',
  category: 'Interaction',
  title: 'Keyboard & mouse lab',
  blurb: 'Focus, selection, activation, context targeting, and scrolling use the same board interaction model.',
  build: () => {
    const cards: readonly ShowcaseCard[] = Array.from({ length: 18 }, (_, index) => ({
      key: 300 + index,
      columnId: index % 3 === 0 ? 'backlog' : index % 3 === 1 ? 'active' : 'done',
      title: `Work item ${String(index + 1).padStart(2, '0')} · ${index % 2 === 0 ? 'keyboard' : 'pointer'} path`,
      status: index % 3 === 0 ? 'Ready' : index % 3 === 1 ? 'In progress' : 'Done',
    }));
    const { board, activity } = createShowcaseBoard({
      cards,
      density: 'compact',
      initialActivity: 'Try: click a card · double-click opens · right-click requests context · wheel scrolls',
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('Activation emits semantic intents; dragging publishes an application-owned card move.'), 2),
      grow(board),
      fixed(new Text(() => `Last intent: ${activity()}`), 2),
    );
    return { view, board, activity };
  },
};
