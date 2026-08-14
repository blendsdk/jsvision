/** Security oracle for capability containment, read-only hit targets, and authorization separation. */
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanActionRegistry,
  createKanbanActionRouter,
  createKanbanReadOnlyCapabilityProvider,
} from '../../src/index.js';
import type { KanbanActionInvocation } from '../../src/index.js';
import { KanbanBoardAuthority } from '../../src/board/board-authority.js';

/** Produces one bounded invocation with identity/revision evidence but no application record payload. */
function invocation(actionId: string, origin: KanbanActionInvocation['origin'] = 'keyboard'): KanbanActionInvocation {
  return {
    actionId,
    origin,
    target: { kind: 'card', cardKey: 42, revision: 'card-r1' },
    selection: { count: 1 },
    source: { state: 'ready', revision: 'source-r1' },
    view: { revision: 'view-r1' },
  };
}

describe('Kanban action capability boundary', () => {
  it('returns safe disabled or hidden outcomes without invoking the action handler', () => {
    const handler = vi.fn(() => ({ kind: 'handled' as const }));
    const capability = vi.fn((context: { readonly actionId: string }) =>
      context.actionId === 'kanban.card.delete'
        ? { state: 'disabled' as const, reasonCode: 'delete-not-permitted', label: 'Deletion is unavailable' }
        : { state: 'hidden' as const },
    );
    const registry = createKanbanActionRegistry({ executePackageAction: handler });
    const router = createKanbanActionRouter({ registry, capability });

    expect(router.invoke(invocation('kanban.card.delete'))).toEqual({
      kind: 'disabled',
      code: 'delete-not-permitted',
      label: 'Deletion is unavailable',
    });
    expect(router.invoke(invocation('kanban.card.archive', 'pointer'))).toEqual({ kind: 'hidden' });
    expect(router.affordance(invocation('kanban.card.archive', 'pointer'))).toEqual({
      visible: false,
      enabled: false,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(capability).toHaveBeenCalledTimes(3);
    expect(capability.mock.calls[0]?.[0]).not.toHaveProperty('record');
    expect(capability.mock.calls[0]?.[0]).not.toHaveProperty('draft');
  });

  it('contains provider exceptions as payload-free disabled feedback while sibling actions continue', () => {
    const handler = vi.fn(() => ({ kind: 'handled' as const }));
    const capability = vi.fn((context: { readonly actionId: string }) => {
      if (context.actionId === 'kanban.card.delete') throw new Error('secret-card-body');
      return { state: 'allowed' as const };
    });
    const registry = createKanbanActionRegistry({ executePackageAction: handler });
    const router = createKanbanActionRouter({ registry, capability });

    const failed = router.invoke(invocation('kanban.card.delete'));
    expect(failed).toEqual({ kind: 'disabled', code: 'capability-failed' });
    expect(JSON.stringify(failed)).not.toContain('secret-card-body');
    expect(router.invoke(invocation('kanban.navigation.right'))).toEqual({ kind: 'handled' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('removes read-only mutation pointer targets while retaining non-mutating actions', () => {
    const handler = vi.fn(() => ({ kind: 'handled' as const }));
    const registry = createKanbanActionRegistry({ executePackageAction: handler });
    const router = createKanbanActionRouter({
      registry,
      capability: createKanbanReadOnlyCapabilityProvider(),
    });
    const mutations = [
      'kanban.card.create',
      'kanban.card.edit',
      'kanban.card.duplicate',
      'kanban.card.archive',
      'kanban.card.delete',
      'kanban.card.grab',
      'kanban.card.drop',
      'kanban.card.move',
      'kanban.column.configure',
      'kanban.swimlane.configure',
      'kanban.history.undo',
      'kanban.history.redo',
    ] as const;
    for (const actionId of mutations) {
      expect(router.affordance(invocation(actionId, 'pointer'))).toEqual({ visible: false, enabled: false });
      expect(router.invoke(invocation(actionId, 'keyboard'))).toEqual({ kind: 'disabled', code: 'read-only' });
    }
    expect(handler).not.toHaveBeenCalled();

    const retained = [
      'kanban.navigation.right',
      'kanban.selection.toggle',
      'kanban.search.focus',
      'kanban.filter.clear',
      'kanban.view.apply',
      'kanban.card.open',
      'kanban.help.open',
    ] as const;
    for (const actionId of retained) {
      expect(router.invoke(invocation(actionId))).toEqual({ kind: 'handled' });
    }
    expect(handler).toHaveBeenCalledTimes(retained.length);
  });

  it('keeps read-only as UX policy and still sends raw proposals to application authorization', async () => {
    const dispatcher = vi.fn((request: { readonly operationId: string }) => ({
      kind: 'rejected' as const,
      operationId: request.operationId,
      code: 'application-denied',
    }));
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}));

    await expect(authority.request({ kind: 'card-delete', cardKey: 42 })).resolves.toMatchObject({
      kind: 'rejected',
      code: 'application-denied',
    });
    expect(dispatcher).toHaveBeenCalledOnce();
    authority.dispose();
  });
});
