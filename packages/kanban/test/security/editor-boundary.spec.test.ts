import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorCoordinator,
  createKanbanEditorSession,
} from '../../src/index.js';
import type { KanbanCardEditorAdapter, KanbanRequestProposal, KanbanRevision } from '../../src/index.js';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

interface TicketDraft {
  readonly title: string;
}

type RecordPublication =
  { readonly kind: 'record'; readonly card: Ticket; readonly revision: KanbanRevision } | { readonly kind: 'deleted' };

/** Creates a minimal typed editor adapter with optional hostile callback behavior. */
function createAdapter(
  options: { readonly throwValidator?: boolean; readonly formatAnsi?: boolean } = {},
): KanbanCardEditorAdapter<Ticket, TicketDraft> {
  const field = {
    fieldId: 'title',
    sectionId: 'main',
    kind: 'text' as const,
    labelId: 'app.fields.title',
    order: 0,
    read: (draft: TicketDraft) => draft.title,
    write: (draft: TicketDraft, value: string) => ({ ...draft, title: value }),
    ...(options.formatAnsi === true ? { format: () => '\u001b[31mVisible\u0007' } : {}),
    ...(options.throwValidator === true
      ? {
          validate: [
            () => {
              throw new Error('private-token-must-not-escape');
            },
          ],
        }
      : {}),
  };
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'ticket-schema-v1',
      sections: [{ sectionId: 'main', labelId: 'app.sections.main', order: 0 }],
      fields: [field],
    }),
    create: (card) => ({ title: card?.title ?? '' }),
    snapshot: (draft) => ({ title: draft.title }),
    proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: 'ticket-1', patch: snapshot }),
  };
}

/** Creates one resolver whose publication callback remains application-owned. */
function createResolver(card: Ticket, revision: KanbanRevision) {
  let subscriber: ((publication: RecordPublication) => void) | undefined;
  const resolver = {
    subscribe: vi.fn((_cardKey: string, next: (publication: RecordPublication) => void) => {
      subscriber = next;
      return vi.fn();
    }),
    resolve: vi.fn(async () => ({ kind: 'record' as const, card, revision })),
  };
  return {
    resolver,
    publish(publication: RecordPublication): void {
      subscriber?.(publication);
    },
  };
}

const CARD: Ticket = { id: 'ticket-1', title: 'Original' };

describe('Kanban editor security boundary specification', () => {
  // A card identity may own only one package or custom editor lease at a time.
  it('enforces identity exclusivity across standard and custom editor attempts', async () => {
    const source = createResolver(CARD, 'card-r1');
    const coordinator = createKanbanEditorCoordinator();
    const options = {
      mode: 'edit' as const,
      cardKey: CARD.id,
      adapter: createAdapter(),
      resolver: source.resolver,
      authority: { request: vi.fn() },
    };

    const standard = await coordinator.open({ ...options, editorKind: 'standard' });
    const custom = await coordinator.open({ ...options, editorKind: 'custom' });

    expect(standard.kind).toBe('opened');
    expect(custom).toMatchObject({ kind: 'already-open', editorKind: 'standard' });
    if (standard.kind !== 'opened' || custom.kind !== 'already-open') {
      throw new Error('Expected one opened editor and one typed already-open outcome.');
    }
    expect(custom.session).toBe(standard.session);
    standard.session.dispose();
    await expect(coordinator.open({ ...options, editorKind: 'custom' })).resolves.toMatchObject({ kind: 'opened' });
    coordinator.dispose();
  });

  // View mode exposes resolved values but rejects every mutation and submission route.
  it('keeps view mode non-mutating and non-submittable', async () => {
    const source = createResolver(CARD, 'card-r1');
    const authority = { request: vi.fn() };
    const session = await createKanbanEditorSession({
      mode: 'view',
      cardKey: CARD.id,
      adapter: createAdapter(),
      resolver: source.resolver,
      authority,
    });

    expect(session.snapshot()).toMatchObject({ mode: 'view', draft: { title: 'Original' }, dirty: false });
    expect(session.setValue('title', 'Forbidden')).toMatchObject({ kind: 'read-only' });
    await expect(session.submit()).resolves.toMatchObject({ kind: 'read-only' });
    expect(authority.request).not.toHaveBeenCalled();
    expect(session.snapshot().draft).toEqual({ title: 'Original' });
    session.dispose();
  });

  // Dispatcher acceptance alone is not a commit; exact application publication is authoritative.
  it('waits for matching authoritative publication and blocks deleted records', async () => {
    const source = createResolver(CARD, 'card-r1');
    const request = vi.fn(async (_proposal: KanbanRequestProposal) => ({
      kind: 'accepted' as const,
      operationId: 'edit-authoritative-1',
      publication: {
        operationId: 'edit-authoritative-1',
        subjects: [
          { kind: 'card' as const, cardKey: CARD.id, baselineRevision: 'card-r1', expectedRevision: 'card-r2' },
        ],
      },
    }));
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createAdapter(),
      resolver: source.resolver,
      authority: { request },
    });
    await session.setValue('title', 'Updated').settled;
    await session.submit();

    expect(session.snapshot().submission.kind).toBe('awaiting-publication');
    source.publish({ kind: 'record', card: { ...CARD, title: 'Updated' }, revision: 'card-r2' });
    expect(session.snapshot().submission.kind).toBe('committed');

    source.publish({ kind: 'deleted' });
    expect(session.snapshot().record.kind).toBe('deleted');
    await expect(session.submit()).resolves.toMatchObject({ kind: 'deleted' });
    expect(request).toHaveBeenCalledTimes(1);
    session.dispose();
  });

  // Unknown values are never coerced, and thrown callback data cannot enter safe diagnostics.
  it('contains hostile values, terminal controls, and callback failures', async () => {
    const source = createResolver(CARD, 'card-r1');
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: createAdapter({ throwValidator: true, formatAnsi: true }),
      resolver: source.resolver,
      authority: { request: vi.fn() },
    });
    const coercion = vi.fn(() => 'coerced');

    expect(session.setValue('title', { toString: coercion })).toMatchObject({ kind: 'invalid-value' });
    expect(coercion).not.toHaveBeenCalled();
    expect(session.snapshot().draft).toEqual({ title: 'Original' });
    await expect(session.submit()).resolves.toMatchObject({ kind: 'invalid' });

    const fieldState = session.fieldState('title');
    expect(fieldState.displayValue).toContain('Visible');
    expect(fieldState.displayValue).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);
    expect(JSON.stringify(fieldState)).not.toContain('private-token-must-not-escape');
    session.dispose();
  });
});
