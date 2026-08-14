import { describe, expect, it, vi } from 'vitest';

import {
  KanbanInvalidSemanticValueError,
  createKanbanCardEditorSchema,
  createKanbanEditorSession,
} from '../src/index.js';
import type { KanbanCardEditorAdapter, KanbanRevision } from '../src/index.js';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

interface TicketDraft {
  readonly title: string;
}

type TicketPublication =
  { readonly kind: 'record'; readonly card: Ticket; readonly revision: KanbanRevision } | { readonly kind: 'deleted' };

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

/** Creates a manually settled promise for deterministic generation-order tests. */
function deferred<T>(): Deferred<T> {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: settle };
}

/** Creates a one-field adapter with injectable application callbacks. */
function adapter(
  options: {
    readonly validateAsync?: (input: { readonly value: string; readonly signal: AbortSignal }) => Promise<undefined>;
    readonly parse?: (value: unknown) => string;
    readonly snapshot?: (draft: TicketDraft) => { readonly title: string };
  } = {},
): KanbanCardEditorAdapter<Ticket, TicketDraft> {
  const schema = createKanbanCardEditorSchema({
    revision: 'ticket-editor-v1',
    sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
    fields: [
      {
        fieldId: 'title',
        sectionId: 'main',
        kind: 'text',
        labelId: 'app.fields.title',
        order: 0,
        read: (draft: TicketDraft) => draft.title,
        write: (draft: TicketDraft, title: string) => ({ ...draft, title }),
        ...(options.parse === undefined ? {} : { parse: options.parse }),
        ...(options.validateAsync === undefined ? {} : { validateAsync: [options.validateAsync] }),
      },
    ],
  });
  return {
    schema,
    create: (card) => ({ title: card?.title ?? '' }),
    snapshot: options.snapshot ?? ((draft) => ({ title: draft.title })),
    proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: 'ticket-1', patch: snapshot }),
  };
}

/** Creates an immediately resolved application record source. */
function resolver(card: Ticket, revision: KanbanRevision) {
  return {
    subscribe: vi.fn(() => vi.fn()),
    resolve: vi.fn(async () => ({ kind: 'record' as const, card, revision })),
  };
}

const CARD: Ticket = Object.freeze({ id: 'ticket-1', title: 'Original' });

describe('Kanban editor session implementation boundaries', () => {
  it('should suppress stale validation notifications after a newer generation settles', async () => {
    const validations: { readonly signal: AbortSignal; readonly deferred: Deferred<undefined> }[] = [];
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter({
        validateAsync: ({ signal }) => {
          const pending = deferred<undefined>();
          validations.push({ signal, deferred: pending });
          return pending.promise;
        },
      }),
      resolver: resolver(CARD, 'card-r1'),
      authority: { request: vi.fn() },
    });
    const subscriber = vi.fn();
    session.subscribe(subscriber);

    const first = session.setValue('title', 'First');
    const second = session.setValue('title', 'Second');
    expect(validations[0]?.signal.aborted).toBe(true);
    validations[1]?.deferred.resolve(undefined);
    await second.settled;
    const callsAfterCurrentGeneration = subscriber.mock.calls.length;
    validations[0]?.deferred.resolve(undefined);
    await first.settled;

    expect(subscriber).toHaveBeenCalledTimes(callsAfterCurrentGeneration);
    expect(session.snapshot().draft).toEqual({ title: 'Second' });
    session.dispose();
  });

  it('should retain the last valid draft when parser or snapshot callbacks fail', async () => {
    const parsing = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter({
        parse: () => {
          throw new Error('private-parser-value');
        },
      }),
      resolver: resolver(CARD, 'card-r1'),
      authority: { request: vi.fn() },
    });

    const parseResult = parsing.setValue('title', 'Rejected');
    await parseResult.settled;
    expect(parseResult.kind).toBe('invalid-value');
    expect(parsing.snapshot().draft).toEqual({ title: 'Original' });
    expect(parsing.fieldState('title').diagnostics).toEqual([{ code: 'callback-failed' }]);
    expect(JSON.stringify(parsing.fieldState('title'))).not.toContain('private-parser-value');
    parsing.dispose();

    const snapshotting = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter({
        snapshot: (draft) => {
          if (draft.title === 'Rejected') throw new Error('private-snapshot-value');
          return { title: draft.title };
        },
      }),
      resolver: resolver(CARD, 'card-r1'),
      authority: { request: vi.fn() },
    });

    await expect(snapshotting.setValue('title', 'Rejected').settled).resolves.toBeUndefined();
    expect(snapshotting.snapshot().draft).toEqual({ title: 'Original' });
    expect(snapshotting.fieldState('title').diagnostics).toEqual([{ code: 'invalid-value' }]);
    snapshotting.dispose();
  });

  it('should reconcile a buffered publication that arrives before initial resolution', async () => {
    const initial = deferred<{ readonly kind: 'record'; readonly card: Ticket; readonly revision: KanbanRevision }>();
    let publish: ((publication: TicketPublication) => void) | undefined;
    const source = {
      subscribe: vi.fn((_cardKey: string, listener: (publication: TicketPublication) => void) => {
        publish = listener;
        return vi.fn();
      }),
      resolve: vi.fn(() => initial.promise),
    };
    const opening = createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: source,
      authority: { request: vi.fn() },
    });

    publish?.({ kind: 'record', card: { ...CARD, title: 'Published' }, revision: 'card-r2' });
    initial.resolve({ kind: 'record', card: CARD, revision: 'card-r1' });
    const session = await opening;

    expect(session.snapshot()).toMatchObject({ baseRevision: 'card-r2', draft: { title: 'Published' } });
    session.dispose();
  });

  it('should abort resolution and release the subscription when opening fails', async () => {
    const unsubscribe = vi.fn();
    let openingSignal: AbortSignal | undefined;
    const source = {
      subscribe: vi.fn(() => unsubscribe),
      resolve: vi.fn(async (_cardKey: string, context: { readonly signal: AbortSignal }) => {
        openingSignal = context.signal;
        throw new Error('private-resolution-value');
      }),
    };

    await expect(
      createKanbanEditorSession({
        mode: 'edit',
        cardKey: CARD.id,
        adapter: adapter(),
        resolver: source,
        authority: { request: vi.fn() },
      }),
    ).rejects.toBeInstanceOf(KanbanInvalidSemanticValueError);
    expect(openingSignal?.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
