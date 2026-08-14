import { createApplication, resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createKanbanViewController } from '../src/index.js';
import type { KanbanDataSource, KanbanQuery, KanbanQuerySession } from '../src/index.js';

interface Card {
  readonly id: number;
  readonly columnId: 'ready';
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Wraps a real eager session while counting complete publication reads. */
function countedSource(cards: readonly Card[], publicationReads: { value: number }): KanbanDataSource<Card> {
  const eager = createEagerKanbanDataSource(() => cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
  return {
    openQuery(query: KanbanQuery, options?: { readonly signal?: AbortSignal }): KanbanQuerySession<Card> {
      const session = eager.openQuery(query, options);
      const locateCard = session.locateCard;
      const swimlaneLayoutHints = session.swimlaneLayoutHints;
      return {
        state: () => session.state(),
        revision: () => session.revision(),
        columns: () => {
          publicationReads.value += 1;
          return session.columns();
        },
        swimlanes: () => session.swimlanes(),
        counts: () => session.counts(),
        headers: () => session.headers(),
        identityChanges: () => session.identityChanges(),
        cell: (address) => session.cell(address),
        ...(locateCard === undefined
          ? {}
          : { locateCard: (key, locateOptions) => locateCard.call(session, key, locateOptions) }),
        ...(swimlaneLayoutHints === undefined
          ? {}
          : {
              swimlaneLayoutHints: (request, hintOptions) => swimlaneLayoutHints.call(session, request, hintOptions),
            }),
        dispose: () => session.dispose(),
      };
    },
  };
}

describe('Kanban view transaction implementation', () => {
  it('should consume one prepared publication without a second activation refresh', () => {
    const reads = { value: 0 };
    const controller = createKanbanViewController();
    const board = new KanbanBoard({
      source: countedSource([{ id: 1, columnId: 'ready', title: 'Card' }], reads),
      query: controller.query,
      card: {
        keyOf: (card) => card.id,
        titleOf: (card) => card.title,
        statusOf: () => 'Ready',
      },
      view: { controller },
    });
    board.setLayout({ position: 'fill' });
    const application = createApplication({ content: board, viewport: { width: 40, height: 12 }, caps: CAPS });
    application.loop.renderRoot.flush();
    const before = reads.value;

    const result = controller.apply({ kind: 'set-density', density: 'compact' });

    expect(result.kind).toBe('changed');
    expect(reads.value - before).toBe(1);
    application.loop.dispose();
    controller.dispose();
  });
});
