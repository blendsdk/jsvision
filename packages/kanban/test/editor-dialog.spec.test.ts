/**
 * Immutable requirements for the public Kanban create, view, and edit dialog invokers.
 *
 * These tests use a real headless modal host and public controls. A failing assertion means the
 * dialog contract is wrong; the oracle must not be weakened to match an implementation shortcut.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createI18n } from '@jsvision/i18n';
import { Commands, Group, Input, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorCoordinator,
  openKanbanCardCreateDialog,
  openKanbanCardEditDialog,
  openKanbanCardViewDialog,
} from '../src/index.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorRecordPublication,
  KanbanEditorResult,
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

const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const CARD: Ticket = Object.freeze({ id: 'ticket-1', title: 'Original' });

/** Builds a live modal host and records every mounted and removed dialog. */
function host(width = 80, height = 24) {
  const root = new Group();
  const loop = createEventLoop({ width, height }, { caps: CAPS });
  loop.mount(root);
  const added: View[] = [];
  const removed: View[] = [];
  return {
    loop,
    added,
    removed,
    value: {
      i18n: createI18n(),
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width, height },
        addWindow(view: View): void {
          added.push(view);
          root.add(view);
        },
        removeWindow(view: View): void {
          removed.push(view);
          root.remove(view);
        },
      },
    },
  };
}

/** Builds one requirements-level adapter with a required title. */
function adapter(proposalKind: 'create' | 'update' = 'update'): KanbanCardEditorAdapter<Ticket, TicketDraft> {
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'dialog-v1',
      sections: [{ sectionId: 'main', labelId: 'ticket.section.main', order: 0 }],
      fields: [
        {
          fieldId: 'title',
          sectionId: 'main',
          kind: 'text',
          labelId: 'ticket.field.title',
          order: 0,
          read: (draft: TicketDraft) => draft.title,
          write: (_draft: TicketDraft, title: string) => ({ title }),
          validate: [
            ({ value }: { readonly value: string }) => (value.length === 0 ? { code: 'required' } : undefined),
          ],
        },
      ],
    }),
    create: (card) => ({ title: card?.title ?? '' }),
    snapshot: (draft) => ({ title: draft.title }),
    proposal: ({ snapshot }) =>
      proposalKind === 'create'
        ? { kind: 'card-create', target: { columnId: 'todo' }, draft: snapshot }
        : { kind: 'card-update', cardKey: CARD.id, patch: snapshot },
  };
}

/** Creates a resolver whose publications can be driven synchronously by an authority. */
function records(card: Ticket = CARD, revision: KanbanRevision = 'card-r1') {
  let listener: ((publication: KanbanEditorRecordPublication<Ticket>) => void) | undefined;
  return {
    resolver: {
      resolve: vi.fn(async () => ({ kind: 'record' as const, card, revision })),
      subscribe: vi.fn((_cardKey: string, next: (publication: KanbanEditorRecordPublication<Ticket>) => void) => {
        listener = next;
        return vi.fn();
      }),
    },
    publish(publication: KanbanEditorRecordPublication<Ticket>): void {
      listener?.(publication);
    },
  };
}

/** Gives asynchronous session acquisition and modal mounting one event-loop turn. */
const mounted = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Replaces the focused single-line field through public keyboard behavior. */
function replaceFocusedInput(loop: ReturnType<typeof createEventLoop>, value: string): void {
  expect(loop.getFocused()).toBeInstanceOf(Input);
  loop.dispatch({ type: 'key', key: 'a', ctrl: true, alt: false, shift: false });
  for (const key of value) loop.dispatch({ type: 'key', key, ctrl: false, alt: false, shift: false });
}

describe('Kanban card editor dialogs', () => {
  it('should discard an unchanged edit on Cancel without confirmation or authority', async () => {
    const h = host();
    const source = records();
    const request = vi.fn();
    const confirm = vi.fn();
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request } },
      confirm,
    });
    await mounted();

    h.loop.emitCommand(Commands.cancel);

    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
    expect(confirm).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(h.removed).toEqual(h.added);
  });

  it('should retain a dirty draft and focus when discard confirmation is declined', async () => {
    const h = host();
    const source = records();
    const confirm = vi.fn(async () => false);
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request: vi.fn() } },
      confirm,
    });
    await mounted();
    const focused = h.loop.getFocused();
    replaceFocusedInput(h.loop, 'Local');

    h.loop.emitCommand(Commands.cancel);
    await mounted();

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ kind: 'discard-draft' }));
    expect(h.removed).toHaveLength(0);
    expect(h.loop.getFocused()).toBe(focused);

    confirm.mockResolvedValue(true);
    h.loop.emitCommand(Commands.cancel);
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('should keep an invalid editor open and focus the first invalid field without dispatching', async () => {
    const h = host();
    const source = records({ ...CARD, title: '' });
    const request = vi.fn();
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request } },
    });
    await mounted();

    h.loop.emitCommand(Commands.ok);
    await mounted();

    expect(request).not.toHaveBeenCalled();
    expect(h.removed).toHaveLength(0);
    expect(h.loop.getFocused()).toBeInstanceOf(Input);
    h.loop.renderRoot.flush();
    const validationFrame = h.loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');
    expect(validationFrame).toContain('required');

    h.loop.emitCommand(Commands.cancel);
    await pending;
  });

  it('should preserve a rejected edit and close only after a matching committed publication', async () => {
    const h = host();
    const source = records();
    let attempts = 0;
    const request = vi.fn((): KanbanRequestResult => {
      attempts += 1;
      if (attempts === 1) {
        return { kind: 'rejected', operationId: 'edit-1', code: 'title-conflict' };
      }
      source.publish({ kind: 'record', card: { ...CARD, title: 'Accepted' }, revision: 'card-r2' });
      return {
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
      };
    });
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request } },
    });
    await mounted();
    replaceFocusedInput(h.loop, 'Accepted');

    h.loop.emitCommand(Commands.ok);
    await mounted();
    expect(h.removed).toHaveLength(0);

    h.loop.emitCommand(Commands.ok);
    await expect(pending).resolves.toEqual({ kind: 'committed', operationId: 'edit-2' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('should return an application-detached create result without invoking authority', async () => {
    const h = host();
    const detach = vi.fn((result: KanbanEditorResult<TicketDraft>) => Object.freeze({ ...result.draft }));
    const pending = openKanbanCardCreateDialog(h.value, {
      claimId: 'new-ticket-1',
      adapter: adapter('create'),
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'result-only', detach },
    });
    await mounted();
    replaceFocusedInput(h.loop, 'Nieuw werkitem');

    h.loop.emitCommand(Commands.ok);

    await expect(pending).resolves.toEqual({ kind: 'result', value: { title: 'Nieuw werkitem' } });
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it('should retain the result-only dialog and show safe feedback when detachment fails', async () => {
    const h = host();
    const pending = openKanbanCardCreateDialog(h.value, {
      claimId: 'new-ticket-failing-detach',
      adapter: adapter('create'),
      coordinator: createKanbanEditorCoordinator(),
      confirm: async () => true,
      completion: {
        kind: 'result-only',
        detach: () => {
          throw new Error('private application detail');
        },
      },
    });
    await mounted();
    replaceFocusedInput(h.loop, 'Valid title');

    h.loop.emitCommand(Commands.ok);
    await mounted();
    h.loop.renderRoot.flush();
    const painted = h.loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');

    expect(painted).toContain('Unable to prepare result');
    expect(painted).not.toContain('private application detail');
    expect(h.removed).toHaveLength(0);
    h.loop.emitCommand(Commands.cancel);
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('should render view mode without editable controls or an Apply action', async () => {
    const h = host();
    const source = records();
    const pending = openKanbanCardViewDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
    });
    await mounted();
    h.loop.renderRoot.flush();
    const painted = h.loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((cell) => cell.char).join(''))
      .join('\n');

    expect(h.loop.getFocused()).not.toBeInstanceOf(Input);
    expect(painted).toContain('Original');
    expect(painted).not.toMatch(/Apply|Save/u);

    h.loop.emitCommand(Commands.cancel);
    await expect(pending).resolves.toEqual({ kind: 'closed' });
  });
});
