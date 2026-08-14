import { describe, expect, it, vi } from 'vitest';

import { createKanbanCardEditorSchema, createKanbanEditorSession } from '../src/index.js';
import type {
  KanbanCardEditorAdapter,
  KanbanRequestProposal,
  KanbanRequestResult,
  KanbanRevision,
} from '../src/index.js';

interface Ticket {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

interface TicketDraft {
  readonly title: string;
  readonly description: string;
}

interface FieldDiagnostic {
  readonly code: string;
  readonly messageId: string;
}

interface ValidationInput {
  readonly value: string;
  readonly signal: AbortSignal;
}

type RecordPublication =
  { readonly kind: 'record'; readonly card: Ticket; readonly revision: KanbanRevision } | { readonly kind: 'deleted' };

/** Creates one deferred async-validation result with externally observable cancellation. */
function deferredValidation(input: ValidationInput): {
  readonly input: ValidationInput;
  readonly promise: Promise<FieldDiagnostic | undefined>;
  readonly resolve: (diagnostic: FieldDiagnostic | undefined) => void;
} {
  let resolvePromise: (diagnostic: FieldDiagnostic | undefined) => void = () => undefined;
  const promise = new Promise<FieldDiagnostic | undefined>((resolve) => {
    resolvePromise = resolve;
  });
  return { input, promise, resolve: resolvePromise };
}

/** Builds a typed adapter whose schema order is title followed by description. */
function createTicketAdapter(
  validateTitle?: (input: ValidationInput) => Promise<FieldDiagnostic | undefined>,
): KanbanCardEditorAdapter<Ticket, TicketDraft> {
  const required = ({ value }: ValidationInput): FieldDiagnostic | undefined =>
    value.length === 0 ? { code: 'required', messageId: 'app.errors.required' } : undefined;
  const title = {
    fieldId: 'title',
    sectionId: 'main',
    kind: 'text' as const,
    labelId: 'app.fields.title',
    order: 0,
    read: (draft: TicketDraft) => draft.title,
    write: (draft: TicketDraft, value: string) => ({ ...draft, title: value }),
    validate: [required],
    ...(validateTitle === undefined ? {} : { validateAsync: [validateTitle] }),
  };
  const description = {
    fieldId: 'description',
    sectionId: 'main',
    kind: 'multiline' as const,
    labelId: 'app.fields.description',
    order: 1,
    read: (draft: TicketDraft) => draft.description,
    write: (draft: TicketDraft, value: string) => ({ ...draft, description: value }),
    validate: [required],
  };
  const schema = createKanbanCardEditorSchema({
    revision: 'ticket-schema-v1',
    sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
    fields: [title, description],
  });
  return {
    schema,
    create: (card) => ({ title: card?.title ?? '', description: card?.description ?? '' }),
    snapshot: (draft) => ({ title: draft.title, description: draft.description }),
    proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: 'ticket-1', patch: snapshot }),
  };
}

/** Creates an application-owned resolver and a deterministic publication harness. */
function createResolver(initialCard: Ticket, initialRevision: KanbanRevision) {
  let currentCard = initialCard;
  let currentRevision = initialRevision;
  let subscriber: ((publication: RecordPublication) => void) | undefined;
  const unsubscribe = vi.fn();
  const resolver = {
    subscribe: vi.fn((_cardKey: string, next: (publication: RecordPublication) => void) => {
      subscriber = next;
      return unsubscribe;
    }),
    resolve: vi.fn(async (_cardKey: string, { signal }: { readonly signal: AbortSignal }) => {
      if (signal.aborted) return { kind: 'unavailable' as const, code: 'cancelled' };
      return { kind: 'record' as const, card: currentCard, revision: currentRevision };
    }),
  };
  return {
    resolver,
    unsubscribe,
    publish(publication: RecordPublication): void {
      subscriber?.(publication);
    },
    replace(card: Ticket, revision: KanbanRevision): void {
      currentCard = card;
      currentRevision = revision;
    },
  };
}

const CARD: Ticket = { id: 'ticket-1', title: 'Original', description: 'Original description' };

describe('Kanban editor session specification', () => {
  // Opening subscribes before resolution and changes only the detached session-owned draft.
  it('isolates the draft and reconciles application-owned record resolution', async () => {
    const source = createResolver(CARD, 'card-r1');
    const authority = { request: vi.fn() };
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createTicketAdapter(),
      resolver: source.resolver,
      authority,
    });

    expect(source.resolver.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      source.resolver.resolve.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    const change = session.setValue('title', 'Detached update');
    await change.settled;

    expect(CARD.title).toBe('Original');
    expect(session.snapshot()).toMatchObject({
      baseRevision: 'card-r1',
      dirty: true,
      changedFieldIds: ['title'],
      draft: { title: 'Detached update' },
    });
    session.dispose();
  });

  // A newer value aborts the prior validator and late settlement cannot replace current field state.
  it('owns one abortable async validation generation per field', async () => {
    const validations: ReturnType<typeof deferredValidation>[] = [];
    const source = createResolver(CARD, 'card-r1');
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createTicketAdapter((input) => {
        const validation = deferredValidation(input);
        validations.push(validation);
        return validation.promise;
      }),
      resolver: source.resolver,
      authority: { request: vi.fn() },
    });

    const first = session.setValue('title', 'First');
    const second = session.setValue('title', 'Second');
    expect(validations[0]?.input.signal.aborted).toBe(true);
    validations[0]?.resolve({ code: 'stale', messageId: 'app.errors.stale' });
    validations[1]?.resolve(undefined);
    await Promise.all([first.settled, second.settled]);

    expect(session.fieldState('title').diagnostics).toEqual([]);
    expect(session.snapshot().draft).toMatchObject({ title: 'Second' });
    session.dispose();
  });

  // Submission validates in schema order and reveals the first invalid field without dispatching.
  it('focuses the first invalid field and dispatches no request', async () => {
    const source = createResolver(CARD, 'card-r1');
    const authority = { request: vi.fn() };
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createTicketAdapter(),
      resolver: source.resolver,
      authority,
    });
    await Promise.all([session.setValue('title', '').settled, session.setValue('description', '').settled]);

    await expect(session.submit()).resolves.toMatchObject({ kind: 'invalid', fieldId: 'title' });
    expect(session.snapshot().focusedFieldId).toBe('title');
    expect(authority.request).not.toHaveBeenCalled();
    session.dispose();
  });

  // Editor updates retain exact full-draft evidence; rejection is editable and resubmit gets a fresh authority ID.
  it('submits exact evidence, preserves rejection state, and awaits matching publication', async () => {
    const source = createResolver(CARD, 'card-r1');
    const request = vi
      .fn<(proposal: KanbanRequestProposal) => Promise<KanbanRequestResult>>()
      .mockResolvedValueOnce({
        kind: 'rejected',
        operationId: 'edit-1',
        code: 'validation-rejected',
        fieldErrors: [{ fieldId: 'title', code: 'reserved', label: 'Choose another title' }],
      })
      .mockResolvedValueOnce({
        kind: 'accepted',
        operationId: 'edit-2',
        publication: {
          operationId: 'edit-2',
          subjects: [
            {
              kind: 'card',
              cardKey: CARD.id,
              baselineRevision: 'card-r1',
              expectedRevision: 'card-r2',
            },
          ],
        },
      });
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createTicketAdapter(),
      resolver: source.resolver,
      authority: { request },
    });
    await session.setValue('title', 'Reserved').settled;

    await expect(session.submit()).resolves.toMatchObject({ kind: 'rejected', operationId: 'edit-1' });
    expect(session.fieldState('title')).toMatchObject({ touched: true, diagnostics: [{ code: 'reserved' }] });
    expect(request).toHaveBeenLastCalledWith({
      kind: 'card-update',
      cardKey: CARD.id,
      patch: { title: 'Reserved', description: CARD.description },
      editor: { kind: 'full-draft', changedFieldIds: ['title'], baseRevision: 'card-r1' },
    });

    await session.setValue('title', 'Accepted').settled;
    await expect(session.submit()).resolves.toMatchObject({ kind: 'awaiting-publication', operationId: 'edit-2' });
    expect(session.snapshot().submission).toMatchObject({ kind: 'awaiting-publication', operationId: 'edit-2' });
    source.publish({ kind: 'record', card: { ...CARD, title: 'Accepted' }, revision: 'card-r2' });
    expect(session.snapshot().submission.kind).toBe('committed');
    session.dispose();
  });

  // Dirty external changes block submit; explicit reload rebases, while a contradictory acceptance stays stale.
  it('requires explicit reload and never commits contradictory publication', async () => {
    const source = createResolver(CARD, 'card-r1');
    const request = vi.fn(async (_proposal: KanbanRequestProposal) => ({
      kind: 'accepted' as const,
      operationId: 'edit-3',
      publication: {
        operationId: 'edit-3',
        subjects: [
          { kind: 'card' as const, cardKey: CARD.id, baselineRevision: 'card-r2', expectedRevision: 'card-r3' },
        ],
      },
    }));
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createTicketAdapter(),
      resolver: source.resolver,
      authority: { request },
    });
    await session.setValue('title', 'Local').settled;
    const remote = { ...CARD, title: 'Remote' };
    source.replace(remote, 'card-r2');
    source.publish({ kind: 'record', card: remote, revision: 'card-r2' });

    await expect(session.submit()).resolves.toMatchObject({ kind: 'stale' });
    expect(request).not.toHaveBeenCalled();
    await expect(session.reload('discard-draft')).resolves.toMatchObject({ kind: 'reloaded' });
    expect(session.snapshot()).toMatchObject({ baseRevision: 'card-r2', dirty: false, draft: { title: 'Remote' } });

    await session.setValue('title', 'Next').settled;
    await session.submit();
    source.publish({ kind: 'record', card: { ...remote, title: 'Other' }, revision: 'card-r4' });
    expect(session.snapshot()).toMatchObject({ record: { kind: 'stale' }, submission: { kind: 'idle' } });
    session.dispose();
  });

  // Disposal aborts owned work, unsubscribes once, and makes late validation settlement inert.
  it('disposes validation and resolver ownership idempotently', async () => {
    const validations: ReturnType<typeof deferredValidation>[] = [];
    const source = createResolver(CARD, 'card-r1');
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createTicketAdapter((input) => {
        const validation = deferredValidation(input);
        validations.push(validation);
        return validation.promise;
      }),
      resolver: source.resolver,
      authority: { request: vi.fn() },
    });
    const change = session.setValue('title', 'Pending');

    session.dispose();
    session.dispose();
    expect(validations[0]?.input.signal.aborted).toBe(true);
    expect(source.unsubscribe).toHaveBeenCalledTimes(1);
    validations[0]?.resolve({ code: 'late', messageId: 'app.errors.late' });
    await change.settled;
    expect(session.disposed()).toBe(true);
  });
});
