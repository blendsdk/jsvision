import { resolveCapabilities } from '@jsvision/core';
import { createI18n } from '@jsvision/i18n';
import { Commands, Dialog, Group, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorControlBinding,
  createKanbanEditorControlRegistry,
  createKanbanEditorCoordinator,
  createKanbanEditorSession,
  openKanbanCardEditDialog,
} from '../src/index.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorControlContext,
  KanbanEditorDialogContext,
  KanbanEditorRecordPublication,
  KanbanRequestResult,
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

const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const CARD: Ticket = Object.freeze({ id: 'ticket-1', title: 'Original' });

/** Creates one externally settled promise for deterministic submission tests. */
function deferred<TValue>(): Deferred<TValue> {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Builds a mounted modal host while retaining window lifecycle evidence. */
function host() {
  const root = new Group();
  const loop = createEventLoop({ width: 80, height: 24 }, { caps: CAPS });
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
        bounds: { x: 0, y: 0, width: 80, height: 24 },
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

/** Creates one resolver with observable subscription cleanup. */
function records() {
  const unsubscribe = vi.fn();
  let listener: ((publication: KanbanEditorRecordPublication<Ticket>) => void) | undefined;
  return {
    unsubscribe,
    resolver: {
      resolve: vi.fn(async () => ({ kind: 'record' as const, card: CARD, revision: 'card-r1' })),
      subscribe: vi.fn((_cardKey: string, next: (publication: KanbanEditorRecordPublication<Ticket>) => void) => {
        listener = next;
        return unsubscribe;
      }),
    },
    publish(publication: KanbanEditorRecordPublication<Ticket>): void {
      listener?.(publication);
    },
  };
}

/** Builds a one-field adapter, optionally backed by a registered custom control. */
function adapter(control?: {
  readonly controlId: string;
  readonly create: (context?: KanbanEditorControlContext) => {
    readonly view: View;
    readonly measure: (availableWidth: number) => {
      readonly minimumWidth: number;
      readonly preferredWidth: number;
      readonly rows: number;
    };
    readonly dispose: () => void;
  };
}): KanbanCardEditorAdapter<Ticket, TicketDraft> {
  const controls = control === undefined ? undefined : createKanbanEditorControlRegistry({ controls: [control] });
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'dialog-impl-v1',
      sections: [{ sectionId: 'main', labelId: 'ticket.section.main', order: 0 }],
      fields: [
        {
          fieldId: 'title',
          sectionId: 'main',
          kind: control === undefined ? 'text' : 'custom',
          labelId: 'ticket.field.title',
          order: 0,
          read: (draft: TicketDraft) => draft.title,
          write: (_draft: TicketDraft, title: string) => ({ title }),
          ...(control === undefined ? {} : { controlId: control.controlId }),
        },
      ],
      ...(controls === undefined ? {} : { controls }),
    }),
    create: (card) => ({ title: card?.title ?? '' }),
    snapshot: (draft) => ({ title: draft.title }),
    proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: CARD.id, patch: snapshot }),
  };
}

/** Allows async session acquisition and dialog mounting to settle. */
const mounted = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('Kanban editor dialog implementation boundaries', () => {
  it('should release modal, resolver, custom-control, and abort ownership exactly once', async () => {
    const h = host();
    const source = records();
    const dispose = vi.fn();
    let controlSignal: AbortSignal | undefined;
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter({
        controlId: 'example.controls.title',
        create: (context) => {
          controlSignal = context?.signal;
          return {
            view: new Group(),
            measure: () => ({ minimumWidth: 8, preferredWidth: 20, rows: 1 }),
            dispose,
          };
        },
      }),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request: vi.fn() } },
    });
    await mounted();

    h.loop.emitCommand(Commands.cancel);

    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
    expect(h.removed).toEqual(h.added);
    expect(source.unsubscribe).toHaveBeenCalledOnce();
    expect(controlSignal?.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('should seal duplicate submit while one asynchronous authority request is pending', async () => {
    const h = host();
    const source = records();
    const authority = deferred<KanbanRequestResult>();
    const request = vi.fn(() => authority.promise);
    let context: KanbanEditorDialogContext<TicketDraft> | undefined;
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: CARD.id,
      adapter: adapter(),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request } },
      confirm: async () => true,
      replacement: (next) => {
        context = next;
        return new Dialog({ title: 'Async editor', width: 40, height: 10 });
      },
    });
    await mounted();
    if (context === undefined) throw new Error('Expected the custom editor context to mount.');
    await context.session.setValue('title', 'Pending').settled;

    const first = context.actions.submit();
    await expect(context.actions.submit()).resolves.toEqual({ kind: 'sealed' });
    expect(request).toHaveBeenCalledOnce();
    authority.resolve({ kind: 'rejected', operationId: 'edit-1', code: 'retry' });
    await expect(first).resolves.toEqual({ kind: 'rejected', operationId: 'edit-1', code: 'retry' });

    await context.actions.cancel();
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('should mirror mounted control focus into stable session field identity', async () => {
    const source = records();
    const editor = adapter();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: editor,
      resolver: source.resolver,
      authority: { request: vi.fn() },
    });
    const field = editor.schema.fields[0];
    if (field === undefined) throw new Error('Expected the title field in the test schema.');
    const binding = createKanbanEditorControlBinding({ field, session });
    const root = new Group();
    root.add(binding.view);
    const loop = createEventLoop({ width: 40, height: 8 }, { caps: CAPS });
    loop.mount(root);

    loop.focusView(binding.view);

    expect(session.snapshot().focusedFieldId).toBe('title');
    binding.dispose();
    session.dispose();
  });

  it('should replace a throwing custom control with a payload-free fallback binding', async () => {
    const source = records();
    const editor = adapter({
      controlId: 'example.controls.throwing',
      create: () => {
        throw new Error('private control payload');
      },
    });
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: CARD.id,
      adapter: editor,
      resolver: source.resolver,
      authority: { request: vi.fn() },
    });
    const field = editor.schema.fields[0];
    if (field === undefined) throw new Error('Expected the title field in the test schema.');

    const binding = createKanbanEditorControlBinding({ field, session });

    expect(binding.diagnostics()).toEqual([
      { code: 'custom-control-failed', messageId: 'kanban.editor.controlUnavailable' },
    ]);
    expect(JSON.stringify(binding.diagnostics())).not.toContain('private control payload');
    binding.dispose();
    session.dispose();
  });
});
