import { Button, Text, col, fixed, grow, onCleanup, row } from '@jsvision/ui';
import { captureKanbanSavedView, createKanbanViewController } from '@jsvision/kanban';

import type { KanbanStory } from '../story.js';
import { createShowcaseBoard } from '../work-items.js';
import type { ShowcaseCard } from '../work-items.js';

/** Cards make search and density changes immediately visible without remote data. */
const PRODUCTIVITY_CARDS: readonly ShowcaseCard[] = Object.freeze([
  Object.freeze({ key: 501, columnId: 'backlog', title: 'Prepare release checklist', status: 'Ready' }),
  Object.freeze({ key: 502, columnId: 'active', title: 'Review release candidate', status: 'In progress' }),
  Object.freeze({ key: 503, columnId: 'active', title: 'Resolve accessibility feedback', status: 'Blocked' }),
  Object.freeze({ key: 504, columnId: 'done', title: 'Publish migration notes', status: 'Done' }),
]);

/** Permanent story for controller-owned search, density, and saved-view capture. */
export const PRODUCTIVITY_STORY: KanbanStory = {
  id: 'kanban/productivity',
  category: 'Productivity',
  title: 'Views & filters',
  blurb: 'Try filtering release work, switching density, and capturing a local saved view.',
  build: () => {
    const controller = createKanbanViewController({ debounceMs: 0, initial: { density: 'comfortable' } });
    onCleanup(() => controller.dispose());
    const { board, activity, setActivity } = createShowcaseBoard({
      cards: PRODUCTIVITY_CARDS,
      view: { controller, chrome: 'standard' },
      initialActivity: 'Try: search in the view bar or use the compact workflow buttons',
    });
    const filter = new Button('~F~ilter release', {
      onClick: () => {
        controller.apply({ kind: 'set-search', search: 'release' });
        setActivity('Filter applied · matching release work');
      },
    });
    const density = new Button('~D~ensity', {
      onClick: () => {
        const next = controller.state().presentation.density === 'compact' ? 'comfortable' : 'compact';
        controller.apply({ kind: 'set-density', density: next });
        setActivity(`Card density · ${next}`);
      },
    });
    const save = new Button('~S~ave view', {
      onClick: () => {
        const saved = captureKanbanSavedView(controller, { name: 'Release focus' });
        setActivity(`Saved locally · ${saved.name ?? 'Release focus'}`);
      },
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('Controller-owned view chrome keeps search, filtering, and density coherent.'), 1),
      fixed(row({ gap: 1 }, grow(filter), grow(density), grow(save)), 2),
      grow(board),
      fixed(new Text(() => `Activity: ${activity()}`), 1),
    );
    return { view, board, activity };
  },
};
