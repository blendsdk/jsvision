import { describe, expect, it, vi } from 'vitest';

import { createKanbanActionRegistry, createKanbanActionRouter } from '../src/index.js';
import type {
  KanbanActionDefinition,
  KanbanActionInvocation,
  KanbanActionRouter,
  KanbanActionTerminalOutcome,
} from '../src/index.js';

/** Creates one record-free board invocation for a namespaced application action. */
function invocation(actionId: string): KanbanActionInvocation {
  return {
    actionId,
    origin: 'programmatic',
    target: { kind: 'board' },
    selection: { count: 0 },
    source: { state: 'ready' },
    view: {},
  };
}

/** Creates one application action around a focused handler. */
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

/** Keeps recursion fixtures synchronous while preserving the router's public pending union. */
function terminal(outcome: ReturnType<KanbanActionRouter['invoke']>): KanbanActionTerminalOutcome {
  return outcome.kind === 'pending' ? Object.freeze({ kind: 'unavailable', code: 'action-unavailable' }) : outcome;
}

describe('Kanban action router implementation', () => {
  it('rejects same-action recursion before a second handler or capability call', () => {
    const handler = vi.fn(() => terminal(router.invoke(invocation('acme.recursive'))));
    const capability = vi.fn(() => ({ state: 'allowed' as const }));
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [extension('acme.recursive', handler)],
    });
    const router = createKanbanActionRouter({ registry, capability });

    expect(router.invoke(invocation('acme.recursive'))).toEqual({
      kind: 'unavailable',
      code: 'action-reentrant',
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(capability).toHaveBeenCalledOnce();
  });

  it('admits the configured distinct-action depth and rejects the next route', () => {
    let router: KanbanActionRouter | undefined;
    const actions = Array.from({ length: 17 }, (_, index) => {
      const id = `acme.depth-${index}`;
      return extension(id, () => {
        const next = index + 1;
        return next >= 17 || router === undefined
          ? ({ kind: 'handled' } as const)
          : terminal(router.invoke(invocation(`acme.depth-${next}`)));
      });
    });
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: actions,
    });
    router = createKanbanActionRouter({ registry });
    expect(router.invoke(invocation('acme.depth-0'))).toEqual({
      kind: 'unavailable',
      code: 'action-depth-exceeded',
    });

    router = createKanbanActionRouter({ registry, maxDepth: 17 });
    expect(router.invoke(invocation('acme.depth-0'))).toEqual({ kind: 'handled' });
    expect(() => createKanbanActionRouter({ registry, maxDepth: 65 })).toThrow();
  });

  it('redacts throws, rejections, malformed outcomes, and replaceable Promise methods', async () => {
    const ownThen = vi.fn();
    const modifiedPromise = Promise.resolve<KanbanActionTerminalOutcome>({ kind: 'handled' });
    Object.defineProperty(modifiedPromise, 'then', { value: ownThen, configurable: true });
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [
        extension('acme.throw', () => {
          throw new Error('secret-card-body');
        }),
        extension('acme.reject', () => Promise.reject(new Error('secret-filter'))),
        extension('acme.malformed', () => ({ kind: 'disabled', code: 'Unsafe Code' })),
        extension('acme.modified-promise', () => modifiedPromise),
      ],
    });
    const router = createKanbanActionRouter({ registry });

    expect(router.invoke(invocation('acme.throw'))).toEqual({ kind: 'disabled', code: 'action-failed' });
    expect(router.invoke(invocation('acme.malformed'))).toEqual({ kind: 'disabled', code: 'action-failed' });
    expect(router.invoke(invocation('acme.modified-promise'))).toEqual({ kind: 'disabled', code: 'action-failed' });
    expect(ownThen).not.toHaveBeenCalled();
    const pending = router.invoke(invocation('acme.reject'));
    if (pending.kind !== 'pending') throw new Error('Expected native rejection normalization.');
    await expect(pending.completion).resolves.toEqual({ kind: 'disabled', code: 'action-failed' });
  });

  it('freezes record-free capability context and fails closed on hostile invocations', () => {
    const contexts: unknown[] = [];
    const registry = createKanbanActionRegistry({ executePackageAction: () => ({ kind: 'handled' }) });
    const router = createKanbanActionRouter({
      registry,
      capability: (context) => {
        contexts.push(context);
        return { state: 'allowed' };
      },
    });
    const valid = {
      ...invocation('kanban.help.open'),
      target: { kind: 'card' as const, cardKey: 1, revision: 'r1' },
    };
    expect(router.invoke(valid)).toEqual({ kind: 'handled' });
    expect(Object.isFrozen(contexts[0])).toBe(true);
    expect(contexts[0]).not.toHaveProperty('record');
    expect(router.invoke({ ...valid, selection: { count: Number.MAX_SAFE_INTEGER } })).toEqual({
      kind: 'unavailable',
      code: 'action-unavailable',
    });
  });
});
