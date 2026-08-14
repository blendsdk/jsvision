/**
 * Immutable requirements for editor ownership, result-only preparation, standard creation, and
 * board lifetime. These are public safety and completion contracts, not implementation details.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorCoordinator,
  createKanbanEditorSession,
  createStandardKanbanEditorAdapter,
} from '../src/index.js';
import { createKanbanBoardEditorInteractionHandler } from '../src/board/editor-binding.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorRecordResolver,
  KanbanInteractionIntent,
  KanbanRequestProposal,
} from '../src/index.js';

interface Ticket {
  readonly title: string;
}

interface Draft {
  readonly title: string;
}

/** Builds a generic adapter that can serve both provisional create and persisted edit sessions. */
function adapter(proposal = vi.fn()): KanbanCardEditorAdapter<Ticket, Draft> {
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'quality-remediation-v1',
      sections: [{ sectionId: 'main', labelId: 'ticket.section.main', order: 0 }],
      fields: [
        {
          fieldId: 'title',
          sectionId: 'main',
          kind: 'text',
          labelId: 'ticket.field.title',
          order: 0,
          read: (draft: Draft) => draft.title,
          write: (_draft: Draft, title: string) => ({ title }),
        },
      ],
    }),
    create: (card) => ({ title: card?.title ?? '' }),
    snapshot: (draft) => ({ title: draft.title }),
    proposal: (result) => {
      proposal(result);
      return { kind: 'card-update', cardKey: 'same-key', patch: result.snapshot };
    },
  };
}

/** Returns a resolver that owns one persisted card and no external resources. */
function resolver(): KanbanEditorRecordResolver<Ticket> {
  return {
    resolve: async () => ({ kind: 'record', card: { title: 'Persisted' }, revision: 'r1' }),
    subscribe: () => () => undefined,
  };
}

const intent: KanbanInteractionIntent = Object.freeze({
  kind: 'open-card',
  origin: 'pointer',
  selection: Object.freeze({ entries: Object.freeze([]), sessionRevision: 1, queryGeneration: 1 }),
  cardKey: 'card-1',
  address: Object.freeze({ columnId: 'todo' }),
});

describe('Kanban editor quality-remediation contracts', () => {
  it('should keep provisional create claims separate from persisted card claims with the same text', async () => {
    const coordinator = createKanbanEditorCoordinator();
    const common = {
      cardKey: 'same-key',
      adapter: adapter(),
      resolver: resolver(),
      authority: { request: vi.fn() },
      editorKind: 'standard' as const,
    };

    const created = await coordinator.open({ ...common, mode: 'create' });
    const edited = await coordinator.open({ ...common, mode: 'edit' });

    expect(created.kind).toBe('opened');
    expect(edited.kind).toBe('opened');
    if (created.kind === 'opened') created.session.dispose();
    if (edited.kind === 'opened') edited.session.dispose();
    coordinator.dispose();
  });

  it('should return a non-disposable borrowed session when an editor identity is already open', async () => {
    const coordinator = createKanbanEditorCoordinator();
    const options = {
      mode: 'edit' as const,
      cardKey: 'same-key',
      adapter: adapter(),
      resolver: resolver(),
      authority: { request: vi.fn() },
      editorKind: 'standard' as const,
    };
    const owner = await coordinator.open(options);
    const borrowed = await coordinator.open(options);

    expect(owner.kind).toBe('opened');
    expect(borrowed.kind).toBe('already-open');
    if (borrowed.kind === 'already-open') expect('dispose' in borrowed.session).toBe(false);
    if (owner.kind === 'opened') owner.session.dispose();
    coordinator.dispose();
  });

  it('should prepare a detached result without invoking proposal construction', async () => {
    const proposed = vi.fn();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: 'same-key',
      adapter: adapter(proposed),
      resolver: resolver(),
      authority: { request: vi.fn() },
    });

    await expect(session.prepare()).resolves.toMatchObject({ kind: 'prepared' });
    expect(proposed).not.toHaveBeenCalled();
    session.dispose();
  });

  it('should build a standard card-create proposal from configured defaults and placement', async () => {
    const requests: KanbanRequestProposal[] = [];
    const standard = createStandardKanbanEditorAdapter({
      fields: ['title', 'status'],
      create: {
        target: { columnId: 'todo' },
        defaults: { title: 'New work', status: 'Todo' },
      },
    });
    const session = await createKanbanEditorSession({
      mode: 'create',
      cardKey: 'new-1',
      adapter: standard,
      resolver: { resolve: async () => ({ kind: 'unavailable', code: 'new' }), subscribe: () => () => undefined },
      authority: {
        request: (proposal) => {
          requests.push(proposal);
          return { kind: 'rejected', operationId: 'create-1', code: 'demo' };
        },
      },
    });

    await session.submit();

    expect(requests).toEqual([
      expect.objectContaining({
        kind: 'card-create',
        target: { columnId: 'todo' },
        draft: expect.objectContaining({ title: 'New work', status: 'Todo' }),
      }),
    ]);
    session.dispose();
  });

  it('should not start an editor microtask after the owning board lifetime is aborted', async () => {
    const lifetime = new AbortController();
    const open = vi.fn();
    const handler = createKanbanBoardEditorInteractionHandler({
      editor: { open },
      authority: { request: vi.fn() },
      signal: lifetime.signal,
    });
    if (handler === undefined) throw new Error('Expected an editor interaction handler.');

    handler(intent);
    lifetime.abort();
    await Promise.resolve();

    expect(open).not.toHaveBeenCalled();
  });
});
