import { Button, Text, col, fixed, grow, onCleanup, row } from '@jsvision/ui';
import {
  createKanbanEditorCoordinator,
  createStandardKanbanEditorAdapter,
  openKanbanCardEditDialog,
} from '@jsvision/kanban';
import type {
  CardKey,
  KanbanBoardEditorBinding,
  KanbanEditorRecordResolver,
  StandardKanbanEditorDraft,
} from '@jsvision/kanban';

import type { KanbanStory } from '../story.js';
import { createShowcaseBoard } from '../work-items.js';
import type { ShowcaseBoardServices, ShowcaseCard } from '../work-items.js';

/** Editable cards include fields rendered by the mainstream standard adapter. */
const EDITING_CARDS: readonly ShowcaseCard[] = Object.freeze([
  Object.freeze({
    key: 601,
    columnId: 'backlog',
    title: 'Polish keyboard editing flow',
    status: 'Ready',
    description: 'Keep every field reachable in a compact terminal dialog.',
    priority: 'High',
    labels: Object.freeze([Object.freeze({ id: 'ux', label: 'UX' })]),
  }),
  Object.freeze({ key: 602, columnId: 'active', title: 'Validate result-only mode', status: 'In progress' }),
  Object.freeze({ key: 603, columnId: 'done', title: 'Ship editor schema', status: 'Done' }),
]);

/** Builds an application-owned resolver over the story's current immutable records. */
function recordResolver(services: ShowcaseBoardServices): KanbanEditorRecordResolver<ShowcaseCard> {
  return Object.freeze({
    resolve: async (cardKey: CardKey) => {
      const card = services.cards().find((candidate) => candidate.key === cardKey);
      return card === undefined
        ? Object.freeze({ kind: 'unavailable' as const, code: 'not-found' })
        : Object.freeze({
            kind: 'record' as const,
            card,
            revision: card.presentationRevision ?? `card-${String(card.key)}`,
          });
    },
    subscribe: () => () => undefined,
  });
}

/** Applies the editable standard fields while retaining application-owned placement data. */
function applyDraft(card: ShowcaseCard, draft: StandardKanbanEditorDraft): ShowcaseCard {
  return Object.freeze({
    ...card,
    title: draft.title,
    status: draft.status,
    description: draft.description,
    priority: draft.priority,
    estimate: draft.estimate,
    presentationRevision: `${String(card.presentationRevision ?? card.key)}-edited`,
  });
}

/** Permanent story for package-provided responsive card editing with local result ownership. */
export const EDITING_STORY: KanbanStory = {
  id: 'kanban/editing',
  category: 'Editing',
  title: 'Card editor',
  blurb: 'Edit a card in the package dialog; this playground applies the detached result locally.',
  build: ({ app }) => {
    const coordinator = createKanbanEditorCoordinator();
    onCleanup(() => coordinator.dispose());
    const adapter = createStandardKanbanEditorAdapter({ fields: ['title', 'status', 'description', 'priority'] });
    let binding: KanbanBoardEditorBinding | undefined;
    const result = createShowcaseBoard({
      cards: EDITING_CARDS,
      initialActivity: 'Try: activate a card or choose Edit first card',
      editor: (services) => {
        const resolver = recordResolver(services);
        const editor: KanbanBoardEditorBinding = {
          open: async (cardKey, _authority, context) => {
            if (app?.desktop === undefined) {
              services.setActivity('Editor host is unavailable outside the mounted showcase');
              return;
            }
            const outcome = await openKanbanCardEditDialog(
              { i18n: app.i18n, loop: app.loop, desktop: app.desktop },
              {
                cardKey,
                adapter,
                resolver,
                coordinator,
                completion: { kind: 'result-only', detach: ({ draft }) => draft },
                ...(context === undefined ? {} : { signal: context.signal }),
              },
            );
            if (outcome.kind !== 'result') {
              services.setActivity(`Editor closed · ${outcome.kind}`);
              return;
            }
            const current = services.cards().find((card) => card.key === cardKey);
            if (current !== undefined) services.replaceCard(applyDraft(current, outcome.value));
            services.setActivity('Editor result applied locally · no remote persistence');
          },
        };
        binding = Object.freeze(editor);
        return binding;
      },
    });
    const edit = new Button('~E~dit first card', {
      onClick: () => {
        void binding?.open(601, { request: () => ({ kind: 'rejected', operationId: 'demo', code: 'local-only' }) });
      },
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('The standard dialog is schema-driven; the application owns records and results.'), 1),
      fixed(row({ gap: 1 }, fixed(edit, 20), grow(new Text('Enter/double-click also opens the focused card.'))), 2),
      grow(result.board),
      fixed(new Text(() => `Activity: ${result.activity()}`), 1),
    );
    return { view, board: result.board, activity: result.activity };
  },
};
