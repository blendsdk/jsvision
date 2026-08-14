/**
 * Immutable integration requirements for custom editor replacement, inspector ownership, stale
 * reload, and deletion. The package must keep one coordinator-owned session across every surface.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createI18n } from '@jsvision/i18n';
import { Dialog, Group, Input, Text, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorCoordinator,
  openKanbanCardEditDialog,
  openKanbanCardInspector,
  openKanbanCardViewDialog,
} from '../src/index.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorDialogContext,
  KanbanEditorRecordPublication,
  KanbanEditorSession,
} from '../src/index.js';

interface Ticket {
  readonly id: string;
  readonly title: string;
}

interface Draft {
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const CARD: Ticket = Object.freeze({ id: 'ticket-1', title: 'Original' });

/** Builds the smallest valid editable ticket adapter. */
function adapter(): KanbanCardEditorAdapter<Ticket, Draft> {
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'integration-v1',
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
    proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: CARD.id, patch: snapshot }),
  };
}

/** Creates an application resolver with replaceable current record and synchronous publications. */
function source() {
  let current: Ticket = CARD;
  let revision = 'card-r1';
  let listener: ((publication: KanbanEditorRecordPublication<Ticket>) => void) | undefined;
  return {
    resolver: {
      resolve: vi.fn(async () => ({ kind: 'record' as const, card: current, revision })),
      subscribe: vi.fn((_cardKey: string, next: (publication: KanbanEditorRecordPublication<Ticket>) => void) => {
        listener = next;
        return vi.fn();
      }),
    },
    replace(card: Ticket, nextRevision: string): void {
      current = card;
      revision = nextRevision;
      listener?.({ kind: 'record', card, revision: nextRevision });
    },
    delete(): void {
      listener?.({ kind: 'deleted' });
    },
  };
}

/** Builds a live modal host and remembers the current mounted replacement/default dialog. */
function host() {
  const root = new Group();
  const loop = createEventLoop({ width: 80, height: 24 }, { caps: CAPS });
  loop.mount(root);
  let mountedView: View | undefined;
  return {
    loop,
    mounted: (): View | undefined => mountedView,
    value: {
      i18n: createI18n(),
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width: 80, height: 24 },
        addWindow(view: View): void {
          mountedView = view;
          root.add(view);
        },
        removeWindow(view: View): void {
          root.remove(view);
          if (mountedView === view) mountedView = undefined;
        },
      },
    },
  };
}

/** Allows async session acquisition and mounting to complete. */
const mounted = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Returns whether a view tree contains one standard editable Input. */
function containsInput(view: View): boolean {
  if (view instanceof Input) return true;
  return view instanceof Group && view.children.some(containsInput);
}

describe('Kanban editor presentation integration', () => {
  it('should mount a complete custom replacement over the same package-owned session', async () => {
    const h = host();
    const records = source();
    let context: KanbanEditorDialogContext<Draft> | undefined;
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request: vi.fn() } },
      replacement: (next) => {
        context = next;
        const dialog = new Dialog({ title: 'Custom ticket editor', width: 42, height: 10 });
        dialog.add(new Text('Application-owned presentation'));
        return dialog;
      },
    });
    await mounted();
    h.loop.renderRoot.flush();

    expect(context?.session.snapshot()).toMatchObject({ mode: 'edit', draft: { title: 'Original' } });
    expect(h.mounted()).toBeInstanceOf(Dialog);
    expect(containsInput(h.mounted()!)).toBe(false);

    if (context?.mode !== 'edit') throw new Error('Expected edit replacement context.');
    expect(Object.keys(context.actions).sort()).toEqual(['cancel', 'close', 'reload', 'submit']);
    await context.actions.cancel();
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('should expose only Close to a read-only replacement', async () => {
    const h = host();
    const records = source();
    let context: KanbanEditorDialogContext<Draft> | undefined;
    const pending = openKanbanCardViewDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      coordinator: createKanbanEditorCoordinator(),
      replacement: (next) => {
        context = next;
        return new Dialog({ title: 'Read-only ticket', width: 42, height: 10 });
      },
    });
    await mounted();
    if (context?.mode !== 'view') throw new Error('Expected view replacement context.');

    expect(Object.keys(context.actions)).toEqual(['close']);
    await context.actions.close();
    await expect(pending).resolves.toEqual({ kind: 'closed' });
  });

  it('should reveal one existing inspector instead of creating a second draft or modal', async () => {
    const records = source();
    const coordinator = createKanbanEditorCoordinator();
    const mountInspector = vi.fn((_session: KanbanEditorSession<Draft>) => undefined);
    const revealInspector = vi.fn((_session: KanbanEditorSession<Draft>) => undefined);
    const options = {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      coordinator,
      presentation: { mount: mountInspector, reveal: revealInspector },
    };

    const first = await openKanbanCardInspector(options);
    const second = await openKanbanCardInspector(options);

    expect(first.kind).toBe('opened');
    expect(second).toMatchObject({ kind: 'already-open' });
    expect(mountInspector).toHaveBeenCalledTimes(1);
    if (second.kind === 'already-open') {
      expect(revealInspector).toHaveBeenCalledWith(second.session);
      expect(second.session.snapshot()).toEqual(first.session.snapshot());
      expect('dispose' in second.session).toBe(false);
    }

    const h = host();
    await expect(
      openKanbanCardEditDialog(h.value, {
        cardKey: CARD.id,
        adapter: adapter(),
        resolver: records.resolver,
        coordinator,
        completion: { kind: 'authority', authority: { request: vi.fn() } },
      }),
    ).resolves.toMatchObject({ kind: 'already-open' });
    expect(h.mounted()).toBeUndefined();
    if (first.kind === 'opened') first.session.dispose();
    coordinator.dispose();
  });

  it('should confirm stale reload, rebase the same draft session, and preserve field focus identity', async () => {
    const h = host();
    const records = source();
    const confirm = vi.fn(async () => true);
    let context: KanbanEditorDialogContext<Draft> | undefined;
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request: vi.fn() } },
      confirm,
      replacement: (next) => {
        context = next;
        return new Dialog({ title: 'Conflict editor', width: 42, height: 10 });
      },
    });
    await mounted();
    if (context?.mode !== 'edit') throw new Error('Expected edit replacement context.');
    await context?.session.setValue('title', 'Local').settled;
    context?.session.focusField('title');
    records.replace({ ...CARD, title: 'Remote' }, 'card-r2');

    await expect(context?.actions.reload()).resolves.toEqual({ kind: 'reloaded' });
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reload-stale' }));
    expect(context?.session.snapshot()).toMatchObject({
      baseRevision: 'card-r2',
      draft: { title: 'Remote' },
      dirty: false,
      focusedFieldId: 'title',
      record: { kind: 'ready' },
    });

    await context?.actions.cancel();
    await pending;
  });

  it('should block submission after deletion while leaving safe Close reachable', async () => {
    const h = host();
    const records = source();
    const request = vi.fn();
    let context: KanbanEditorDialogContext<Draft> | undefined;
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: records.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request } },
      replacement: (next) => {
        context = next;
        return new Dialog({ title: 'Deleted ticket', width: 42, height: 10 });
      },
    });
    await mounted();
    if (context?.mode !== 'edit') throw new Error('Expected edit replacement context.');
    records.delete();

    await expect(context?.actions.submit()).resolves.toEqual({ kind: 'deleted' });
    expect(request).not.toHaveBeenCalled();
    expect(h.mounted()).toBeDefined();

    context?.actions.close();
    await expect(pending).resolves.toEqual({ kind: 'closed' });
  });
});
