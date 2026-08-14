import { describe, expect, it, vi } from 'vitest';

import { createKanbanCardEditorSchema, createKanbanEditorSession } from '../src/index.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorRecordPublication,
  KanbanRequestResult,
  KanbanRevision,
} from '../src/index.js';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

interface TicketDraft {
  readonly title: string;
}

interface Deferred<TValue> {
  readonly promise: Promise<TValue>;
  readonly resolve: (value: TValue) => void;
}

/** Creates one manually settled promise for deterministic race ordering. */
function deferred<TValue>(): Deferred<TValue> {
  let settle: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: settle };
}

/** Builds one typed adapter with optional async validation and proposal targeting. */
function adapter(
  options: {
    readonly target?: string;
    readonly validateAsync?: (input: { readonly signal: AbortSignal }) => Promise<undefined>;
  } = {},
): KanbanCardEditorAdapter<Ticket, TicketDraft> {
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'race-v1',
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
          ...(options.validateAsync === undefined ? {} : { validateAsync: [options.validateAsync] }),
        },
      ],
    }),
    create: (card) => ({ title: card?.title ?? '' }),
    snapshot: (draft) => ({ title: draft.title }),
    proposal: ({ snapshot }) => ({
      kind: 'card-update',
      cardKey: options.target ?? 'ticket-1',
      patch: snapshot,
    }),
  };
}

/** Creates a publishable resolver over one current application record. */
function source(card: Ticket, revision: KanbanRevision) {
  let listener: ((publication: KanbanEditorRecordPublication<Ticket>) => void) | undefined;
  const resolver = {
    subscribe: vi.fn((_cardKey: string, next: (publication: KanbanEditorRecordPublication<Ticket>) => void) => {
      listener = next;
      return vi.fn();
    }),
    resolve: vi.fn(async () => ({ kind: 'record' as const, card, revision })),
  };
  return {
    resolver,
    publish(publication: KanbanEditorRecordPublication<Ticket>): void {
      listener?.(publication);
    },
  };
}

const CARD: Ticket = Object.freeze({ id: 'ticket-1', title: 'Original' });

/** Reads a title from a semantic draft without assuming an application object prototype. */
function semanticTitle(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  if (!('title' in value)) return undefined;
  return typeof value.title === 'string' ? value.title : undefined;
}

describe('Kanban editor session race hardening', () => {
  it('should stop a validating submit when the authoritative record becomes stale', async () => {
    const validation = deferred<undefined>();
    let validationRuns = 0;
    const records = source(CARD, 'card-r1');
    const request = vi.fn();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter({
        validateAsync: () => {
          validationRuns += 1;
          return validationRuns === 1 ? Promise.resolve(undefined) : validation.promise;
        },
      }),
      resolver: records.resolver,
      authority: { request },
    });
    await session.setValue('title', 'Local').settled;
    const submit = session.submit();

    records.publish({ kind: 'record', card: { ...CARD, title: 'Remote' }, revision: 'card-r2' });
    validation.resolve(undefined);

    await expect(submit).resolves.toEqual({ kind: 'stale' });
    expect(request).not.toHaveBeenCalled();
    session.dispose();
  });

  it('should not dispatch when proposal preparation observes a newer record', async () => {
    const records = source(CARD, 'card-r1');
    const baseAdapter = adapter();
    const request = vi.fn();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: {
        ...baseAdapter,
        proposal: (result) => {
          records.publish({ kind: 'record', card: { ...CARD, title: 'Remote' }, revision: 'card-r2' });
          return baseAdapter.proposal(result);
        },
      },
      resolver: records.resolver,
      authority: { request },
    });
    await session.setValue('title', 'Local').settled;

    await expect(session.submit()).resolves.toEqual({ kind: 'stale' });
    expect(request).not.toHaveBeenCalled();
    session.dispose();
  });

  it('should commit a matching publication that arrives before authority acceptance settles', async () => {
    const records = source(CARD, 'card-r1');
    const request = vi.fn((): KanbanRequestResult => {
      records.publish({ kind: 'record', card: { ...CARD, title: 'Updated' }, revision: 'card-r2' });
      return {
        kind: 'accepted',
        operationId: 'edit-race-1',
        publication: {
          operationId: 'edit-race-1',
          subjects: [
            {
              kind: 'card',
              cardKey: CARD.id,
              baselineRevision: 'card-r1',
              expectedRevision: 'card-r2',
            },
          ],
        },
      };
    });
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      authority: { request },
    });
    await session.setValue('title', 'Updated').settled;

    await expect(session.submit()).resolves.toEqual({ kind: 'committed', operationId: 'edit-race-1' });
    expect(session.snapshot()).toMatchObject({
      baseRevision: 'card-r2',
      record: { kind: 'ready' },
      submission: { kind: 'committed', operationId: 'edit-race-1' },
    });
    session.dispose();
  });

  it('should serialize reentrant notifications without delivering snapshots backwards', async () => {
    const records = source(CARD, 'card-r1');
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      authority: { request: vi.fn() },
    });
    let nested = false;
    const observed: string[] = [];
    session.subscribe((snapshot) => {
      if (!nested && semanticTitle(snapshot.draft) === 'First') {
        nested = true;
        session.setValue('title', 'Second');
      }
    });
    session.subscribe((snapshot) => {
      const title = semanticTitle(snapshot.draft);
      if (title !== undefined) observed.push(title);
    });

    await session.setValue('title', 'First').settled;

    expect(observed.indexOf('First')).toBeGreaterThanOrEqual(0);
    expect(observed.indexOf('Second')).toBeGreaterThan(observed.indexOf('First'));
    expect(observed.slice(observed.indexOf('Second') + 1)).not.toContain('First');
    session.dispose();
  });

  it('should settle ignored validator and authority promises promptly on disposal', async () => {
    const never = new Promise<undefined>(() => undefined);
    const records = source(CARD, 'card-r1');
    const validating = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter({ validateAsync: () => never }),
      resolver: records.resolver,
      authority: { request: vi.fn() },
    });
    const change = validating.setValue('title', 'Pending');
    validating.dispose();
    await expect(change.settled).resolves.toBeUndefined();

    const dispatching = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      authority: { request: () => new Promise<KanbanRequestResult>(() => undefined) },
    });
    await dispatching.setValue('title', 'Pending').settled;
    const submit = dispatching.submit();
    dispatching.dispose();
    await expect(submit).resolves.toEqual({ kind: 'disposed' });
  });

  it('should reject cross-card proposals before application authority sees them', async () => {
    const records = source(CARD, 'card-r1');
    const request = vi.fn();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter({ target: 'ticket-2' }),
      resolver: records.resolver,
      authority: { request },
    });

    await expect(session.submit()).resolves.toEqual({ kind: 'failed' });
    expect(request).not.toHaveBeenCalled();
    session.dispose();
  });

  it('should seal reload while dispatch owns correlation', async () => {
    const records = source(CARD, 'card-r1');
    const authority = deferred<KanbanRequestResult>();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      authority: { request: () => authority.promise },
    });
    await session.setValue('title', 'Pending').settled;
    const submit = session.submit();

    await expect(session.reload('discard-draft')).resolves.toEqual({ kind: 'sealed' });
    session.dispose();
    await expect(submit).resolves.toEqual({ kind: 'disposed' });
  });

  it('should reconcile the latest publication observed while reload resolution is pending', async () => {
    const reloadResolution = deferred<{
      readonly kind: 'record';
      readonly card: Ticket;
      readonly revision: KanbanRevision;
    }>();
    let listener: ((publication: KanbanEditorRecordPublication<Ticket>) => void) | undefined;
    let resolves = 0;
    const resolver = {
      subscribe: vi.fn((_cardKey: string, next: (publication: KanbanEditorRecordPublication<Ticket>) => void) => {
        listener = next;
        return vi.fn();
      }),
      resolve: vi.fn(() => {
        resolves += 1;
        return resolves === 1
          ? Promise.resolve({ kind: 'record' as const, card: CARD, revision: 'card-r1' })
          : reloadResolution.promise;
      }),
    };
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter(),
      resolver,
      authority: { request: vi.fn() },
    });
    await session.setValue('title', 'Local').settled;
    listener?.({ kind: 'record', card: { ...CARD, title: 'Stale' }, revision: 'card-r2' });
    const reload = session.reload('discard-draft');
    listener?.({ kind: 'record', card: { ...CARD, title: 'Newest' }, revision: 'card-r3' });
    reloadResolution.resolve({ kind: 'record', card: { ...CARD, title: 'Older' }, revision: 'card-r2' });

    await expect(reload).resolves.toEqual({ kind: 'reloaded' });
    expect(session.snapshot()).toMatchObject({ baseRevision: 'card-r3', draft: { title: 'Newest' } });
    session.dispose();
  });

  it('should settle an ignored reload resolution when the session is disposed', async () => {
    let listener: ((publication: KanbanEditorRecordPublication<Ticket>) => void) | undefined;
    let reloadSignal: AbortSignal | undefined;
    let resolves = 0;
    const resolver = {
      subscribe: vi.fn((_cardKey: string, next: (publication: KanbanEditorRecordPublication<Ticket>) => void) => {
        listener = next;
        return vi.fn();
      }),
      resolve: vi.fn((_cardKey: string, context: { readonly signal: AbortSignal }) => {
        resolves += 1;
        if (resolves === 1) return Promise.resolve({ kind: 'record' as const, card: CARD, revision: 'card-r1' });
        reloadSignal = context.signal;
        return new Promise<never>(() => undefined);
      }),
    };
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: adapter(),
      resolver,
      authority: { request: vi.fn() },
    });
    await session.setValue('title', 'Local').settled;
    listener?.({ kind: 'record', card: { ...CARD, title: 'Remote' }, revision: 'card-r2' });
    const reload = session.reload('discard-draft');

    session.dispose();

    await expect(reload).resolves.toEqual({ kind: 'disposed' });
    expect(reloadSignal?.aborted).toBe(true);
  });
});
