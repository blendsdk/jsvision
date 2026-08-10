import { Text, col, fixed, grow } from '@jsvision/ui';

import type { KanbanStory } from '../story.js';
import { RICH_PRESENTATION, createShowcaseBoard } from '../work-items.js';

/** Flagship rich-card story showing status styles, metadata, summaries, and checklist previews. */
export const DELIVERY_STORY: KanbanStory = {
  id: 'kanban/delivery-board',
  category: 'Foundation',
  title: 'Delivery board',
  blurb: 'Status colors, metadata, task progress, and checklist previews degrade safely as space shrinks.',
  build: () => {
    const { board, activity } = createShowcaseBoard({
      presentation: RICH_PRESENTATION,
      headerAlignment: 'center',
      initialActivity: 'Try: arrows navigate · Space selects · Enter opens · mouse click focuses',
      cards: [
        {
          key: 101,
          columnId: 'backlog',
          title: 'Keyboard command palette',
          status: 'Ready',
          priority: 'High',
          estimate: '5 pts',
          labels: [{ id: 'ux', label: 'UX' }],
          checklists: [
            {
              checklistId: 'tasks',
              title: 'Tasks',
              items: [
                { itemId: 'keys', text: 'Map commands', completed: true },
                { itemId: 'help', text: 'Write compact help copy', completed: false },
              ],
            },
          ],
          summaries: [{ fieldId: 'progress', label: 'Tasks', value: '1/2' }],
        },
        {
          key: 102,
          columnId: 'active',
          title: 'Responsive board geometry',
          status: 'In progress',
          priority: 'Critical',
          estimate: '8 pts',
          labels: [{ id: 'layout', label: 'Layout' }],
          checklists: [
            {
              checklistId: 'tasks',
              items: [
                { itemId: 'wide', text: 'Verify wide layout', completed: true },
                { itemId: 'narrow', text: 'Verify focused-column mode', completed: false },
              ],
            },
          ],
          summaries: [{ fieldId: 'progress', label: 'Tasks', value: '1/2' }],
        },
        {
          key: 103,
          columnId: 'active',
          title: 'Resolve contrast regression',
          status: 'Blocked',
          priority: 'Critical',
          estimate: '3 pts',
          labels: [{ id: 'a11y', label: 'Accessibility' }],
          summaries: [{ fieldId: 'progress', label: 'Tasks', value: '0/1' }],
        },
        {
          key: 104,
          columnId: 'done',
          title: 'Publish package foundation',
          status: 'Done',
          priority: 'Normal',
          estimate: '5 pts',
          labels: [{ id: 'release', label: 'Release' }],
          summaries: [{ fieldId: 'progress', label: 'Tasks', value: '3/3' }],
        },
      ],
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('Rich cards keep title and status mandatory; optional detail yields to terminal space.'), 2),
      grow(board),
      fixed(new Text(() => `Activity: ${activity()}`), 2),
    );
    return { view, board, activity };
  },
};
