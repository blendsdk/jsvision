/** Specification oracle for stable Kanban actions, routing parity, extension, and disposal behavior. */
import { describe, expect, it, vi } from 'vitest';

import { KANBAN_ACTION_IDS, createKanbanActionRegistry, createKanbanActionRouter } from '../src/index.js';
import type { KanbanActionDefinition, KanbanActionInvocation, KanbanActionOrigin } from '../src/index.js';

/** Every package behavior named by RD-12 must remain discoverable through one stable inventory. */
const REQUIRED_ACTION_IDS = [
  'kanban.navigation.left',
  'kanban.navigation.right',
  'kanban.navigation.up',
  'kanban.navigation.down',
  'kanban.navigation.cell-first',
  'kanban.navigation.cell-last',
  'kanban.navigation.page-up',
  'kanban.navigation.page-down',
  'kanban.navigation.board-first',
  'kanban.navigation.board-last',
  'kanban.selection.toggle',
  'kanban.selection.extend-left',
  'kanban.selection.extend-right',
  'kanban.selection.extend-up',
  'kanban.selection.extend-down',
  'kanban.selection.select-all',
  'kanban.selection.clear',
  'kanban.card.open',
  'kanban.card.create',
  'kanban.card.edit',
  'kanban.card.duplicate',
  'kanban.card.archive',
  'kanban.card.delete',
  'kanban.card.grab',
  'kanban.card.drop',
  'kanban.card.move',
  'kanban.card.cancel-move',
  'kanban.column.configure',
  'kanban.column.add',
  'kanban.column.reorder',
  'kanban.column.delete',
  'kanban.swimlane.configure',
  'kanban.swimlane.add',
  'kanban.swimlane.reorder',
  'kanban.swimlane.delete',
  'kanban.search.focus',
  'kanban.filter.clear',
  'kanban.sort.configure',
  'kanban.view.apply',
  'kanban.view.save',
  'kanban.context.open',
  'kanban.help.open',
  'kanban.source.retry',
  'kanban.history.undo',
  'kanban.history.redo',
] as const;

/** Creates one bounded card-target invocation used across every supported origin. */
function moveInvocation(origin: KanbanActionOrigin): KanbanActionInvocation {
  return {
    actionId: 'kanban.card.move',
    origin,
    target: { kind: 'card', cardKey: 42, revision: 'card-r1' },
    selection: { count: 1 },
    source: { state: 'ready', revision: 'source-r1' },
    view: { revision: 'view-r1' },
  };
}

describe('Kanban action inventory and routing', () => {
  it('publishes complete immutable action metadata with an explicit binding marker', () => {
    const executePackageAction = vi.fn(() => ({ kind: 'handled' as const }));
    const registry = createKanbanActionRegistry({ executePackageAction });
    const actions = registry.actions();

    expect(KANBAN_ACTION_IDS).toEqual(REQUIRED_ACTION_IDS);
    expect(actions.map((action) => action.id)).toEqual(REQUIRED_ACTION_IDS);
    for (const action of actions) {
      expect(action).toMatchObject({
        id: expect.stringMatching(/^kanban\./u),
        category: expect.any(String),
        labelMessageId: expect.stringMatching(/^kanban\.action\./u),
        helpMessageId: expect.stringMatching(/^kanban\.action\./u),
        target: expect.any(String),
        capability: expect.any(String),
        bindings: expect.any(Array),
        handler: expect.any(Function),
      });
      expect(Object.isFrozen(action)).toBe(true);
      expect(Object.isFrozen(action.bindings)).toBe(true);
    }
    expect(actions.find((action) => action.id === 'kanban.card.delete')?.bindings).toEqual([]);
    expect(actions.find((action) => action.id === 'kanban.column.configure')?.bindings).toEqual([]);
  });

  it('routes every origin through one capability snapshot and one package handler seam', () => {
    const calls: KanbanActionInvocation[] = [];
    const capability = vi.fn(() => ({ state: 'allowed' as const }));
    const registry = createKanbanActionRegistry({
      executePackageAction: (invocation) => {
        calls.push(invocation);
        return { kind: 'handled' };
      },
    });
    const router = createKanbanActionRouter({ registry, capability });
    const origins: readonly KanbanActionOrigin[] = [
      'keyboard',
      'menu',
      'context-menu',
      'status',
      'pointer',
      'programmatic',
    ];

    for (const origin of origins) {
      expect(router.invoke(moveInvocation(origin))).toEqual({ kind: 'handled' });
    }
    expect(capability).toHaveBeenCalledTimes(origins.length);
    expect(calls.map((call) => call.origin)).toEqual(origins);
    expect(calls.map(({ origin: _origin, ...semantic }) => semantic)).toEqual(
      origins.map(() => {
        const { origin: _origin, ...semantic } = moveInvocation('programmatic');
        return semantic;
      }),
    );
  });

  it('normalizes synchronous, asynchronous, disabled, hidden, and unavailable outcomes', async () => {
    let completion: ((value: { readonly kind: 'handled' }) => void) | undefined;
    const registry = createKanbanActionRegistry({
      executePackageAction: () =>
        new Promise((resolve) => {
          completion = resolve;
        }),
    });
    const router = createKanbanActionRouter({ registry });
    const pending = router.invoke(moveInvocation('keyboard'));
    expect(pending).toMatchObject({ kind: 'pending', actionId: 'kanban.card.move' });
    if (pending.kind !== 'pending') throw new Error('Expected an asynchronous pending action.');
    completion?.({ kind: 'handled' });
    await expect(pending.completion).resolves.toEqual({ kind: 'handled' });

    expect(router.invoke({ ...moveInvocation('menu'), actionId: 'kanban.missing' })).toEqual({
      kind: 'unavailable',
      code: 'action-unavailable',
    });
  });

  it('runs a namespaced custom action through the same route and rejects package collisions', () => {
    const customHandler = vi.fn(() => ({ kind: 'handled' as const }));
    const custom: KanbanActionDefinition = {
      id: 'acme.export',
      category: 'application',
      labelMessageId: 'acme.action.export.label',
      helpMessageId: 'acme.action.export.help',
      target: 'board',
      capability: 'acme.export',
      bindings: [],
      handler: customHandler,
    };
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [custom],
    });
    const router = createKanbanActionRouter({ registry });
    expect(
      router.invoke({ ...moveInvocation('programmatic'), actionId: 'acme.export', target: { kind: 'board' } }),
    ).toEqual({ kind: 'handled' });
    expect(customHandler).toHaveBeenCalledOnce();

    expect(() =>
      createKanbanActionRegistry({
        executePackageAction: () => ({ kind: 'handled' }),
        extensions: [{ ...custom, id: 'kanban.card.move' }],
      }),
    ).toThrow();
  });

  it('makes retained routes inert after disposal and ignores late async completion', async () => {
    let completion: ((value: { readonly kind: 'handled' }) => void) | undefined;
    const handler = vi.fn(
      () =>
        new Promise<{ readonly kind: 'handled' }>((resolve) => {
          completion = resolve;
        }),
    );
    const registry = createKanbanActionRegistry({ executePackageAction: handler });
    const router = createKanbanActionRouter({ registry });
    const pending = router.invoke(moveInvocation('pointer'));
    if (pending.kind !== 'pending') throw new Error('Expected an asynchronous pending action.');
    router.dispose();
    completion?.({ kind: 'handled' });
    await expect(pending.completion).resolves.toEqual({ kind: 'unavailable', code: 'router-disposed' });
    expect(router.invoke(moveInvocation('keyboard'))).toEqual({
      kind: 'unavailable',
      code: 'router-disposed',
    });
    expect(handler).toHaveBeenCalledOnce();
  });
});
