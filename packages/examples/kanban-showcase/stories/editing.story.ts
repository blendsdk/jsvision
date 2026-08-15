import { Button, Text, col, fixed, grow, onCleanup, row } from '@jsvision/ui';
import {
  createKanbanEditorCoordinator,
  createStandardKanbanEditorAdapter,
  openKanbanCardCreateDialog,
  openKanbanCardEditDialog,
  openKanbanCardViewDialog,
} from '@jsvision/kanban';
import type {
  CardKey,
  KanbanBoardEditorBinding,
  KanbanEditorRecordPublication,
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
    checklists: Object.freeze([
      Object.freeze({
        checklistId: 'release',
        title: 'Release tasks',
        items: Object.freeze([
          Object.freeze({ itemId: 'keyboard', text: 'Verify keyboard reachability', completed: true }),
          Object.freeze({ itemId: 'mouse', text: 'Verify mouse editing', completed: false }),
        ]),
      }),
    ]),
    custom: Object.freeze({ team: 'experience', owner: 'alex' }),
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
    subscribe: (cardKey: CardKey, listener: (publication: KanbanEditorRecordPublication<ShowcaseCard>) => void) =>
      services.subscribeCards((cards) => {
        const card = cards.find((candidate) => candidate.key === cardKey);
        listener(
          card === undefined
            ? Object.freeze({ kind: 'deleted' as const })
            : Object.freeze({
                kind: 'record' as const,
                card,
                revision: card.presentationRevision ?? `card-${String(card.key)}`,
              }),
        );
      }),
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
  build: ({ app, signal: storySignal }) => {
    const lifetime = new AbortController();
    const abortLifetime = (): void => lifetime.abort();
    storySignal?.addEventListener('abort', abortLifetime, { once: true });
    const coordinator = createKanbanEditorCoordinator();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    onCleanup(() => {
      lifetime.abort();
      storySignal?.removeEventListener('abort', abortLifetime);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      coordinator.dispose();
    });
    const adapter = createStandardKanbanEditorAdapter({
      fields: ['title', 'status', 'description', 'priority', 'checklists'],
    });
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
                signal: context?.signal ?? lifetime.signal,
              },
            );
            if (lifetime.signal.aborted) return;
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
    const edit = new Button('~J~Edit first card', {
      onClick: () => {
        void binding?.open(601, { request: () => ({ kind: 'rejected', operationId: 'demo', code: 'local-only' }) });
      },
    });
    const viewCard = new Button('~V~iew', {
      onClick: () => {
        if (app?.desktop === undefined) return;
        void openKanbanCardViewDialog(
          { i18n: app.i18n, loop: app.loop, desktop: app.desktop },
          {
            cardKey: 601,
            adapter,
            resolver: recordResolver(result),
            coordinator,
            signal: lifetime.signal,
          },
        );
      },
    });
    let nextCardKey = 690;
    const createCard = new Button('~N~ew card', {
      onClick: () => {
        if (app?.desktop === undefined) return;
        const claimId = `showcase-new-${String(++nextCardKey)}`;
        void openKanbanCardCreateDialog(
          { i18n: app.i18n, loop: app.loop, desktop: app.desktop },
          {
            claimId,
            adapter,
            coordinator,
            completion: { kind: 'result-only', detach: ({ draft }) => draft },
            signal: lifetime.signal,
          },
        ).then((outcome) => {
          if (lifetime.signal.aborted || outcome.kind !== 'result') return;
          result.appendCard(
            Object.freeze({
              key: nextCardKey,
              columnId: 'backlog',
              title: outcome.value.title,
              status: outcome.value.status,
              description: outcome.value.description,
              priority: outcome.value.priority,
              custom: Object.freeze({ owner: 'local-demo' }),
            }),
          );
          result.setActivity('Created card applied locally · custom owner retained by the application');
        });
      },
    });
    const reject = new Button('~R~ejection', {
      onClick: () => {
        if (app?.desktop === undefined) return;
        void openKanbanCardEditDialog(
          { i18n: app.i18n, loop: app.loop, desktop: app.desktop },
          {
            cardKey: 601,
            adapter,
            resolver: recordResolver(result),
            coordinator,
            completion: {
              kind: 'authority',
              authority: { request: () => ({ kind: 'rejected', operationId: 'showcase-reject', code: 'demo-policy' }) },
            },
            signal: lifetime.signal,
          },
        );
      },
    });
    const stale = new Button('~S~tale edit', {
      onClick: () => {
        void binding?.open(601, { request: () => ({ kind: 'rejected', operationId: 'demo', code: 'local-only' }) });
        const current = result.cards().find((card) => card.key === 601);
        if (current !== undefined) {
          const timer = setTimeout(() => {
            timers.delete(timer);
            if (lifetime.signal.aborted) return;
            result.replaceCard(
              Object.freeze({
                ...current,
                presentationRevision: `${String(current.presentationRevision ?? 601)}-stale`,
              }),
            );
            result.setActivity('Published an external revision · the open editor now shows stale recovery');
          }, 20);
          timers.add(timer);
        }
      },
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('The standard dialog is schema-driven; the application owns records and results.'), 1),
      fixed(row({ gap: 1 }, grow(edit), grow(viewCard), grow(createCard)), 2),
      fixed(row({ gap: 1 }, grow(reject), grow(stale)), 2),
      grow(result.board),
      fixed(new Text(() => `Activity: ${result.activity()}`), 1),
    );
    return { view, board: result.board, activity: result.activity };
  },
};
