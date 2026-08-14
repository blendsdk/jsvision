import { describe, expect, it, vi } from 'vitest';

import { KANBAN_OPEN_CARD_EDITOR_ACTION_ID, createKanbanCardKey, createKanbanExtensionId } from '../src/index.js';
import { createKanbanBoardEditorInteractionHandler } from '../src/board/editor-binding.js';
import type { KanbanInteractionIntent } from '../src/index.js';

const CARD_KEY = createKanbanCardKey('ticket-1');
const SELECTION = Object.freeze({ entries: Object.freeze([]), sessionRevision: 1, queryGeneration: 1 });

/** Creates one frozen open-card intent through the same shape delivered by the intent router. */
function openCard(actionId?: ReturnType<typeof createKanbanExtensionId>): KanbanInteractionIntent {
  return Object.freeze({
    kind: 'open-card',
    origin: 'pointer',
    selection: SELECTION,
    cardKey: CARD_KEY,
    address: Object.freeze({ columnId: 'todo' }),
    ...(actionId === undefined ? {} : { actionId }),
  });
}

describe('Kanban board editor binding implementation', () => {
  it('should open whole-card and standard checklist activation without consuming application intents', async () => {
    const open = vi.fn(() => Promise.resolve());
    const application = vi.fn();
    const handler = createKanbanBoardEditorInteractionHandler({
      editor: { open },
      authority: { request: vi.fn() },
      application,
    });
    if (handler === undefined) throw new Error('Expected a composed interaction handler.');

    const card = openCard();
    const checklist = openCard(KANBAN_OPEN_CARD_EDITOR_ACTION_ID);
    handler(card);
    handler(checklist);
    await Promise.resolve();

    expect(application).toHaveBeenNthCalledWith(1, card);
    expect(application).toHaveBeenNthCalledWith(2, checklist);
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenNthCalledWith(1, CARD_KEY, expect.objectContaining({ request: expect.any(Function) }));
  });

  it('should leave unrelated descriptor actions with the application handler only', async () => {
    const open = vi.fn();
    const application = vi.fn();
    const handler = createKanbanBoardEditorInteractionHandler({
      editor: { open },
      authority: { request: vi.fn() },
      application,
    });
    if (handler === undefined) throw new Error('Expected a composed interaction handler.');
    const intent = openCard(createKanbanExtensionId('example.card.archive'));

    handler(intent);
    await Promise.resolve();

    expect(application).toHaveBeenCalledWith(intent);
    expect(open).not.toHaveBeenCalled();
  });

  it('should contain editor startup failure without suppressing application delivery', async () => {
    const observe = vi.fn();
    const application = vi.fn();
    const handler = createKanbanBoardEditorInteractionHandler({
      editor: {
        open: () => {
          throw new Error('private editor payload');
        },
      },
      authority: { request: vi.fn() },
      application,
      observe,
    });
    if (handler === undefined) throw new Error('Expected a composed interaction handler.');
    const intent = openCard();

    handler(intent);
    await Promise.resolve();
    await Promise.resolve();

    expect(application).toHaveBeenCalledWith(intent);
    expect(observe).toHaveBeenCalledWith(expect.objectContaining({ code: 'editor-open-failed', scope: 'board' }));
    expect(JSON.stringify(observe.mock.calls)).not.toContain('private editor payload');
  });
});
