import { Button, Text, col, fixed, grow, onCleanup, row } from '@jsvision/ui';
import { captureKanbanSavedView, createKanbanViewController, createKanbanViewRegistry } from '@jsvision/kanban';

import type { KanbanStory } from '../story.js';
import { createShowcaseBoard } from '../work-items.js';
import type { ShowcaseCard } from '../work-items.js';

/** Cards make search and density changes immediately visible without remote data. */
const PRODUCTIVITY_CARDS: readonly ShowcaseCard[] = Object.freeze([
  Object.freeze({
    key: 501,
    columnId: 'backlog',
    title: 'Prepare release checklist',
    status: 'Ready',
    custom: { team: 'platform', owner: 'alex' },
  }),
  Object.freeze({
    key: 502,
    columnId: 'active',
    title: 'Review release candidate',
    status: 'In progress',
    custom: { team: 'platform', owner: 'alex' },
  }),
  Object.freeze({
    key: 503,
    columnId: 'active',
    title: 'Resolve accessibility feedback',
    status: 'Blocked',
    custom: { team: 'experience', owner: 'blair' },
  }),
  Object.freeze({
    key: 504,
    columnId: 'done',
    title: 'Publish migration notes',
    status: 'Done',
    custom: { team: 'experience', owner: 'alex' },
  }),
]);

/** Permanent story for controller-owned search, density, and saved-view capture. */
export const PRODUCTIVITY_STORY: KanbanStory = {
  id: 'kanban/productivity',
  category: 'Productivity',
  title: 'Views & filters',
  blurb: 'Try filtering release work, switching density, and capturing a local saved view.',
  build: () => {
    const registry = createKanbanViewRegistry({
      quickFilters: [
        {
          id: 'showcase.mine',
          labelId: 'showcase.filters.mine',
          filter: { fieldId: 'owner', operatorId: 'showcase.equals', value: 'alex' },
        },
        {
          id: 'showcase.active',
          labelId: 'showcase.filters.active',
          filter: { fieldId: 'status', operatorId: 'showcase.equals', value: 'In progress' },
        },
      ],
    });
    const controller = createKanbanViewController({
      debounceMs: 0,
      initial: { density: 'comfortable' },
      registry,
    });
    onCleanup(() => controller.dispose());
    const { board, activity, setActivity } = createShowcaseBoard({
      cards: PRODUCTIVITY_CARDS,
      swimlanes: 'hybrid',
      view: { controller, chrome: 'standard' },
      filterFields: [
        {
          fieldId: 'owner',
          operators: [{ operatorId: 'showcase.equals', matches: (card, value) => card.custom?.owner === value }],
        },
        {
          fieldId: 'status',
          operators: [{ operatorId: 'showcase.equals', matches: (card, value) => card.status === value }],
        },
      ],
      sortFields: [
        {
          fieldId: 'title',
          compare: (left, right) => (left.title === right.title ? 0 : left.title < right.title ? -1 : 1),
        },
      ],
      initialActivity: 'Try: search in the view bar or use the compact workflow buttons',
    });
    let savedState = controller.state();
    const filter = new Button('~Q~uick focus', {
      onClick: () => {
        controller.apply({
          kind: 'set-quick-filters',
          quickFilters: [{ id: 'showcase.mine' }, { id: 'showcase.active' }],
        });
        controller.apply({ kind: 'set-sort', sort: [{ fieldId: 'title', direction: 'ascending' }] });
        controller.apply({ kind: 'set-grouping', grouping: { fieldId: 'team' } });
        setActivity('Two quick filters + title sort + team grouping applied');
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
        savedState = controller.state();
        setActivity(`Saved locally · ${saved.name ?? 'Release focus'}`);
      },
    });
    const apply = new Button('~A~pply saved', {
      onClick: () => {
        const outcome = controller.replace(savedState);
        setActivity(`Saved view apply · ${outcome.kind}`);
      },
    });
    const empty = new Button('~E~mpty result', {
      onClick: () => {
        controller.apply({ kind: 'set-search', search: 'no matching release item' });
        setActivity('Filtered-empty state requested · clear restores all cards');
      },
    });
    const clear = new Button('~C~lear', {
      onClick: () => {
        controller.clearFilters();
        setActivity('Filters cleared · all source items visible');
      },
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 0 },
      fixed(new Text('Controller-owned view chrome keeps search, filtering, and density coherent.'), 1),
      fixed(row({ gap: 1 }, grow(filter), grow(density), grow(save)), 2),
      fixed(row({ gap: 1 }, grow(apply), grow(empty), grow(clear)), 2),
      grow(board),
      fixed(
        new Text(() => {
          const summary = controller.summary();
          const count = (value: typeof summary.matching): string =>
            value.quality === 'unknown' ? '?' : String(value.value);
          return `Counts: ${count(summary.matching)}/${count(summary.total)} · visible ${summary.visible} · ${summary.emptyState}`;
        }),
        1,
      ),
      fixed(new Text(() => `Activity: ${activity()}`), 1),
    );
    return { view, board, activity };
  },
};
