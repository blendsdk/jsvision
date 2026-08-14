import { describe, expect, it, vi } from 'vitest';

import {
  KANBAN_LIMITS,
  KanbanInvalidEditorSchemaError,
  createKanbanCardEditorSchema,
  createKanbanEditorSession,
  createStandardKanbanEditorAdapter,
} from '../../src/index.js';
import type { KanbanCardEditorAdapter } from '../../src/index.js';

interface ChoiceDraft {
  readonly state: string;
  readonly tags: readonly string[];
}

interface Ticket {
  readonly id: string;
  readonly title: string;
}

/** Creates an immediately resolved record source for callback and choice tests. */
function resolver<TCard>(card: TCard) {
  return {
    subscribe: () => () => undefined,
    resolve: async () => ({ kind: 'record' as const, card, revision: 'card-r1' }),
  };
}

describe('Kanban editor hostile-boundary hardening', () => {
  it('should reject duplicate choice identities and values outside registered domains', async () => {
    const duplicate = {
      fieldId: 'state',
      sectionId: 'main',
      kind: 'single-choice' as const,
      labelId: 'app.fields.state',
      order: 0,
      read: (draft: ChoiceDraft) => draft.state,
      write: (draft: ChoiceDraft, state: string) => ({ ...draft, state }),
      choices: [
        { choiceId: 'ready', labelId: 'app.choices.ready', value: 'ready' },
        { choiceId: 'ready', labelId: 'app.choices.done', value: 'done' },
      ],
    };
    expect(() =>
      createKanbanCardEditorSchema({
        revision: 'duplicate-v1',
        sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
        fields: [duplicate],
      }),
    ).toThrow(KanbanInvalidEditorSchemaError);

    const schema = createKanbanCardEditorSchema({
      revision: 'choices-v1',
      sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
      fields: [
        { ...duplicate, choices: [{ choiceId: 'ready', labelId: 'app.choices.ready', value: 'ready' }] },
        {
          fieldId: 'tags',
          sectionId: 'main',
          kind: 'multiple-choice' as const,
          labelId: 'app.fields.tags',
          order: 1,
          read: (draft: ChoiceDraft) => draft.tags,
          write: (draft: ChoiceDraft, tags: readonly string[]) => ({ ...draft, tags }),
          choices: [
            { choiceId: 'bug', labelId: 'app.choices.bug', value: 'bug' },
            { choiceId: 'docs', labelId: 'app.choices.docs', value: 'docs' },
          ],
        },
      ],
    });
    const adapter: KanbanCardEditorAdapter<ChoiceDraft, ChoiceDraft> = {
      schema,
      create: (card) => card ?? { state: 'ready', tags: [] },
      snapshot: (draft) => ({ state: draft.state, tags: draft.tags }),
      proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: 'ticket-1', patch: snapshot }),
    };
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: 'ticket-1',
      adapter,
      resolver: resolver<ChoiceDraft>({ state: 'ready', tags: [] }),
      authority: { request: vi.fn() },
    });

    expect(session.setValue('state', 'unknown').kind).toBe('invalid-value');
    expect(session.setValue('tags', 'bug').kind).toBe('invalid-value');
    expect(session.setValue('tags', ['bug', 'unknown']).kind).toBe('invalid-value');
    await expect(session.setValue('tags', ['bug', 'docs']).settled).resolves.toBeUndefined();
    expect(session.snapshot().draft).toMatchObject({ tags: ['bug', 'docs'] });
    session.dispose();
  });

  it('should retain presentation callback failures and block submission', async () => {
    const request = vi.fn();
    const adapter: KanbanCardEditorAdapter<Ticket, { readonly title: string }> = {
      schema: createKanbanCardEditorSchema({
        revision: 'callbacks-v1',
        sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
        fields: [
          {
            fieldId: 'title',
            sectionId: 'main',
            kind: 'text',
            labelId: 'app.fields.title',
            order: 0,
            read: (draft: { readonly title: string }) => draft.title,
            write: (draft: { readonly title: string }, title: string) => ({ ...draft, title }),
            visible: () => {
              throw new Error('private-visibility-token');
            },
            format: () => {
              throw new Error('private-format-token');
            },
          },
        ],
      }),
      create: (card) => ({ title: card?.title ?? '' }),
      snapshot: (draft) => ({ title: draft.title }),
      proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: 'ticket-1', patch: snapshot }),
    };
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: 'ticket-1',
      adapter,
      resolver: resolver<Ticket>({ id: 'ticket-1', title: 'Original' }),
      authority: { request },
    });

    expect(session.fieldState('title')).toMatchObject({
      visible: false,
      diagnostics: [{ code: 'callback-failed' }, { code: 'callback-failed' }],
    });
    await expect(session.submit()).resolves.toEqual({ kind: 'invalid', fieldId: 'title' });
    expect(request).not.toHaveBeenCalled();
    expect(JSON.stringify(session.fieldState('title'))).not.toContain('private-');
    session.dispose();
  });

  it('should block a standard record whose key contradicts the claimed session identity', async () => {
    const request = vi.fn();
    const standard = createStandardKanbanEditorAdapter({ fields: ['title', 'status'] });
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: 'ticket-1',
      adapter: standard,
      resolver: resolver({
        key: 'ticket-2',
        columnId: 'ready',
        title: 'Wrong record',
        status: 'Ready',
      }),
      authority: { request },
    });

    await expect(session.submit()).resolves.toEqual({ kind: 'failed' });
    expect(request).not.toHaveBeenCalled();
    session.dispose();
  });

  it('should bound standard options and nested card collections before traversal', () => {
    const fields: ('title' | 'status')[] = ['title'];
    Object.defineProperty(fields, '0', {
      enumerable: true,
      get: () => {
        throw new Error('private-option-token');
      },
    });
    expect(() => createStandardKanbanEditorAdapter({ fields })).toThrow(KanbanInvalidEditorSchemaError);

    const adapter = createStandardKanbanEditorAdapter({ fields: ['title', 'assignees', 'checklists'] });
    const oversizedAssignees = Array.from({ length: KANBAN_LIMITS.cardFields.safe + 1 }, (_, index) => ({
      id: `user-${index}`,
      label: `User ${index}`,
    }));
    expect(() =>
      adapter.create(
        {
          key: 'ticket-1',
          columnId: 'ready',
          title: 'Oversized',
          status: 'Ready',
          assignees: oversizedAssignees,
        },
        { mode: 'edit', signal: new AbortController().signal },
      ),
    ).toThrow(KanbanInvalidEditorSchemaError);

    const item = {
      itemId: 'verify',
      get text(): string {
        throw new Error('private-item-token');
      },
      completed: false,
    };
    expect(() =>
      adapter.create(
        {
          key: 'ticket-1',
          columnId: 'ready',
          title: 'Accessor',
          status: 'Ready',
          checklists: [{ checklistId: 'release', items: [item] }],
        },
        { mode: 'edit', signal: new AbortController().signal },
      ),
    ).toThrow(KanbanInvalidEditorSchemaError);
  });
});
