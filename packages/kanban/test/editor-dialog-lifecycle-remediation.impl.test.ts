import { resolveCapabilities } from '@jsvision/core';
import { createI18n } from '@jsvision/i18n';
import { Dialog, Group, Input, createEventLoop } from '@jsvision/ui';
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

interface Card {
  readonly title: string;
  readonly estimate: number;
}

type Draft = Card;

interface Deferred<TValue> {
  readonly promise: Promise<TValue>;
  readonly resolve: (value: TValue) => void;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const CARD: Card = Object.freeze({ title: 'Original', estimate: 1 });

/** Creates one externally settled promise for deterministic pending-action races. */
function deferred<TValue>(): Deferred<TValue> {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Creates one two-field adapter with an optional registered title control. */
function adapter(control?: {
  readonly controlId: string;
  readonly create: (context?: KanbanEditorControlContext) => {
    readonly view: View;
    readonly measure: () => { readonly minimumWidth: number; readonly preferredWidth: number; readonly rows: number };
    readonly dispose: () => void;
  };
}): KanbanCardEditorAdapter<Card, Draft> {
  const controls = control === undefined ? undefined : createKanbanEditorControlRegistry({ controls: [control] });
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'lifecycle-remediation-v1',
      sections: [{ sectionId: 'main', labelId: 'card.main', order: 0 }],
      fields: [
        {
          fieldId: 'title',
          sectionId: 'main',
          kind: control === undefined ? 'text' : 'custom',
          labelId: 'card.title',
          order: 0,
          read: (draft: Draft) => draft.title,
          write: (draft: Draft, title: string) => ({ ...draft, title }),
          ...(control === undefined ? {} : { controlId: control.controlId }),
        },
        {
          fieldId: 'estimate',
          sectionId: 'main',
          kind: 'number',
          labelId: 'card.estimate',
          order: 1,
          read: (draft: Draft) => draft.estimate,
          write: (draft: Draft, estimate: number) => ({ ...draft, estimate }),
        },
      ],
      ...(controls === undefined ? {} : { controls }),
    }),
    create: (card) => card ?? CARD,
    snapshot: (draft) => ({ title: draft.title, estimate: draft.estimate }),
    proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: 'card-1', patch: snapshot }),
  };
}

/** Creates one resolver with observable cleanup. */
function records() {
  const unsubscribe = vi.fn();
  let listener: ((publication: KanbanEditorRecordPublication<Card>) => void) | undefined;
  return {
    unsubscribe,
    resolver: {
      resolve: async () => ({ kind: 'record' as const, card: CARD, revision: 'r1' }),
      subscribe: (_key: string, next: (publication: KanbanEditorRecordPublication<Card>) => void) => {
        listener = next;
        return unsubscribe;
      },
    },
    publish(publication: KanbanEditorRecordPublication<Card>): void {
      listener?.(publication);
    },
  };
}

/** Creates an application-like host with replaceable mount behavior. */
function host(addWindow?: (view: View) => void) {
  const root = new Group();
  const loop = createEventLoop({ width: 80, height: 24 }, { caps: CAPS });
  loop.mount(root);
  return {
    loop,
    value: {
      i18n: createI18n(),
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width: 80, height: 24 },
        addWindow: addWindow ?? ((view: View) => root.add(view)),
        removeWindow: (view: View) => root.remove(view),
      },
    },
  };
}

const mounted = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('Kanban editor lifecycle remediation', () => {
  it('should release a partially initialized custom control when later binding setup throws', async () => {
    const dispose = vi.fn();
    const view = new Group();
    Object.defineProperty(view.state, 'disabled', {
      configurable: true,
      set: () => {
        throw new Error('hostile');
      },
    });
    const editor = adapter({
      controlId: 'example.controls.hostile',
      create: () => ({ view, measure: () => ({ minimumWidth: 8, preferredWidth: 20, rows: 1 }), dispose }),
    });
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: 'card-1',
      adapter: editor,
      resolver: records().resolver,
      authority: { request: vi.fn() },
    });
    const field = editor.schema.field('title');
    if (field === undefined) throw new Error('Expected title field.');

    const binding = createKanbanEditorControlBinding({ field, session, controls: editor.schema.controls });

    expect(binding.diagnostics()).toHaveLength(1);
    expect(dispose).toHaveBeenCalledOnce();
    binding.dispose();
    session.dispose();
  });

  it('should release resolver and custom-control ownership when host mounting throws', async () => {
    const source = records();
    const dispose = vi.fn();
    const result = await openKanbanCardEditDialog(
      host(() => {
        throw new Error('mount failed');
      }).value,
      {
        cardKey: 'card-1',
        adapter: adapter({
          controlId: 'example.controls.title',
          create: () => ({
            view: new Group(),
            measure: () => ({ minimumWidth: 8, preferredWidth: 20, rows: 1 }),
            dispose,
          }),
        }),
        resolver: source.resolver,
        coordinator: createKanbanEditorCoordinator(),
        completion: { kind: 'authority', authority: { request: vi.fn() } },
      },
    );

    expect(result).toEqual({ kind: 'failed' });
    expect(source.unsubscribe).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('should release a custom control when its first responsive measurement throws', async () => {
    const source = records();
    const dispose = vi.fn();
    let controlSignal: AbortSignal | undefined;
    const result = await openKanbanCardEditDialog(host().value, {
      cardKey: 'card-1',
      adapter: adapter({
        controlId: 'example.controls.throwing-measure',
        create: (context) => {
          controlSignal = context?.signal;
          return {
            view: new Group(),
            measure: () => {
              throw new Error('hostile measurement');
            },
            dispose,
          };
        },
      }),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request: vi.fn() } },
    });

    expect(result).toEqual({ kind: 'failed' });
    expect(controlSignal?.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
    expect(source.unsubscribe).toHaveBeenCalledOnce();
  });

  it('should retain correctable invalid text but restore authoritative text for a sealed write', async () => {
    const editor = adapter();
    const authority = deferred<KanbanRequestResult>();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: 'card-1',
      adapter: editor,
      resolver: records().resolver,
      authority: { request: () => authority.promise },
    });
    const field = editor.schema.field('estimate');
    if (field === undefined) throw new Error('Expected estimate field.');
    const binding = createKanbanEditorControlBinding({ field, session });
    if (!(binding.view instanceof Input)) throw new Error('Expected numeric Input.');
    const value = binding.view.getValueSignal();

    value.set('not-a-number');
    expect(value()).toBe('not-a-number');
    expect(session.fieldValue('estimate')).toBe(1);

    const submitting = session.submit();
    await Promise.resolve();
    value.set('2');
    expect(value()).toBe('1');
    authority.resolve({ kind: 'rejected', operationId: 'edit-1', code: 'retry' });
    await submitting;
    binding.dispose();
    session.dispose();
  });

  it('should replace retained invalid input after an authoritative clean rebase', async () => {
    const source = records();
    const editor = adapter();
    const session = await createKanbanEditorSession({
      mode: 'edit',
      cardKey: 'card-1',
      adapter: editor,
      resolver: source.resolver,
      authority: { request: vi.fn() },
    });
    const field = editor.schema.field('estimate');
    if (field === undefined) throw new Error('Expected estimate field.');
    const binding = createKanbanEditorControlBinding({ field, session });
    if (!(binding.view instanceof Input)) throw new Error('Expected numeric Input.');
    const value = binding.view.getValueSignal();

    value.set('not-a-number');
    source.publish({ kind: 'record', card: { ...CARD, estimate: 7 }, revision: 'r2' });

    expect(value()).toBe('7');
    binding.dispose();
    session.dispose();
  });

  it('should guard Escape and ignore cancellation while an unacknowledged submission owns the dialog', async () => {
    const h = host();
    const source = records();
    const authority = deferred<KanbanRequestResult>();
    const confirm = vi.fn(async () => false);
    let context: KanbanEditorDialogContext<Draft> | undefined;
    const pending = openKanbanCardEditDialog(h.value, {
      cardKey: 'card-1',
      adapter: adapter(),
      resolver: source.resolver,
      coordinator: createKanbanEditorCoordinator(),
      completion: { kind: 'authority', authority: { request: () => authority.promise } },
      confirm,
      replacement: (next) => {
        context = next;
        return new Dialog({ title: 'Replacement', width: 40, height: 10 });
      },
    });
    await mounted();
    if (context === undefined) throw new Error('Expected replacement context.');
    if (context.mode !== 'edit') throw new Error('Expected edit replacement context.');
    await context.session.setValue('title', 'Changed').settled;
    const submitting = context.actions.submit();
    await context.actions.cancel();
    h.loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
    await mounted();
    expect(confirm).not.toHaveBeenCalled();

    authority.resolve({ kind: 'rejected', operationId: 'edit-1', code: 'retry' });
    await submitting;
    h.loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
    await mounted();
    expect(confirm).toHaveBeenCalledOnce();

    confirm.mockResolvedValue(true);
    h.loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });
});
