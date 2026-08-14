/** Specification oracle for action-event settlement and disposal-safe late work. */
import { describe, expect, it, vi } from 'vitest';

import { createKanbanActionRegistry, createKanbanActionRouter, createKanbanEventHub } from '../src/index.js';
import type {
  KanbanActionDefinition,
  KanbanActionInvocation,
  KanbanActionTerminalOutcome,
  KanbanEvent,
} from '../src/index.js';

/** Creates one board-target invocation for a custom application action. */
function invocation(actionId: string): KanbanActionInvocation {
  return {
    actionId,
    boardId: 'board-main',
    origin: 'programmatic',
    target: { kind: 'board' },
    selection: { count: 0 },
    source: { state: 'ready', revision: 'source-r1', queryRevision: 'query-r1' },
    view: { revision: 'view-r1' },
  };
}

/** Creates one namespaced board action around an exact handler. */
function extension(id: string, handler: KanbanActionDefinition['handler']): KanbanActionDefinition {
  return {
    id,
    category: 'application',
    labelMessageId: `${id}.label`,
    helpMessageId: `${id}.help`,
    target: 'board',
    capability: id,
    bindings: [],
    handler,
  };
}

describe('Kanban action event lifecycle', () => {
  it('publishes a custom asynchronous action intent, pending admission, and terminal outcome', async () => {
    let settle: ((outcome: KanbanActionTerminalOutcome) => void) | undefined;
    const handler = vi.fn(
      () =>
        new Promise<KanbanActionTerminalOutcome>((resolve) => {
          settle = resolve;
        }),
    );
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [extension('acme.export', handler)],
    });
    const hub = createKanbanEventHub({ boardId: 'board-main', now: () => 10 });
    const events: KanbanEvent[] = [];
    hub.subscribe((event) => events.push(event));
    const router = createKanbanActionRouter({ registry, events: hub });

    const pending = router.invoke(invocation('acme.export'));
    expect(pending).toMatchObject({ kind: 'pending', actionId: 'acme.export' });
    expect(events.map((event) => (event.kind === 'action' ? event.state : event.kind))).toEqual(['intent', 'pending']);
    if (pending.kind !== 'pending') throw new Error('Expected pending custom action.');
    settle?.({ kind: 'handled' });
    await expect(pending.completion).resolves.toEqual({ kind: 'handled' });
    expect(events.map((event) => (event.kind === 'action' ? event.state : event.kind))).toEqual([
      'intent',
      'pending',
      'handled',
    ]);
  });

  it('does not emit a late action settlement after event-hub disposal', async () => {
    let settle: ((outcome: KanbanActionTerminalOutcome) => void) | undefined;
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [
        extension(
          'acme.slow',
          () =>
            new Promise<KanbanActionTerminalOutcome>((resolve) => {
              settle = resolve;
            }),
        ),
      ],
    });
    const hub = createKanbanEventHub({ boardId: 'board-main', now: () => 20 });
    const events: KanbanEvent[] = [];
    hub.subscribe((event) => events.push(event));
    const router = createKanbanActionRouter({ registry, events: hub });
    const pending = router.invoke(invocation('acme.slow'));
    if (pending.kind !== 'pending') throw new Error('Expected pending custom action.');
    hub.dispose();
    settle?.({ kind: 'handled' });

    await expect(pending.completion).resolves.toEqual({ kind: 'handled' });
    expect(events.map((event) => (event.kind === 'action' ? event.state : event.kind))).toEqual(['intent', 'pending']);
    expect(hub.publish({ kind: 'selection', count: 1 })).toEqual({ kind: 'disposed' });
    expect(hub.snapshot()).toEqual([]);
  });

  it('publishes capability denial as a terminal action outcome without invoking the handler', () => {
    const handler = vi.fn(() => ({ kind: 'handled' as const }));
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [extension('acme.denied', handler)],
    });
    const hub = createKanbanEventHub({ boardId: 'board-main', now: () => 30 });
    const events: KanbanEvent[] = [];
    hub.subscribe((event) => events.push(event));
    const router = createKanbanActionRouter({
      registry,
      events: hub,
      capability: () => ({ state: 'disabled', reasonCode: 'application-denied' }),
    });

    expect(router.invoke(invocation('acme.denied'))).toEqual({
      kind: 'disabled',
      code: 'application-denied',
    });
    expect(handler).not.toHaveBeenCalled();
    expect(events).toMatchObject([
      { kind: 'action', state: 'intent', actionId: 'acme.denied' },
      { kind: 'action', state: 'disabled', actionId: 'acme.denied', code: 'application-denied' },
    ]);
  });
});
