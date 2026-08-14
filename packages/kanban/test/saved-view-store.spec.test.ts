import { describe, expect, it } from 'vitest';

import {
  KanbanBoard,
  applyKanbanSavedView,
  captureKanbanSavedView,
  createEagerKanbanDataSource,
  createKanbanSavedViewStore,
  createKanbanViewController,
  createKanbanViewRegistry,
  parseKanbanSavedView,
  reconcileKanbanSavedView,
} from '../src/index.js';
import type { KanbanRequest } from '../src/index.js';

describe('Kanban saved-view store ownership specification', () => {
  it('keeps capture and apply local while save rename and delete use one authority request each', async () => {
    const requests: KanbanRequest[] = [];
    const controller = createKanbanViewController();
    const source = createEagerKanbanDataSource<never>(() => [], {
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }],
      keyOf: () => 'unused',
      columnOf: () => 'ready',
    });
    const board = new KanbanBoard({
      source,
      query: controller.query,
      card: { keyOf: () => 'unused', titleOf: () => '', statusOf: () => '' },
      view: { controller },
      dispatcher: (request) => {
        requests.push(request);
        return { kind: 'accepted', operationId: request.operationId };
      },
      // Saved-view deletion remains destructive; this fixture models explicit user approval.
      confirmOperation: () => true,
    });
    const store = createKanbanSavedViewStore({ request: (proposal) => board.request(proposal) });

    const captured = captureKanbanSavedView(controller, { name: 'Daily' });
    expect(requests).toEqual([]);
    const parsed = parseKanbanSavedView(captured);
    expect(parsed.kind).toBe('parsed');
    if (parsed.kind !== 'parsed') return;
    const reconciled = reconcileKanbanSavedView(parsed.value, {
      registry: createKanbanViewRegistry(),
      fields: [],
      columns: [{ columnId: 'ready', visible: true, collapsed: false, minimumWidth: 18, maximumWidth: 32 }],
      swimlanes: [],
    });
    expect(reconciled.kind).toBe('reconciled');
    if (reconciled.kind !== 'reconciled') return;
    applyKanbanSavedView(controller, reconciled);
    expect(requests).toEqual([]);

    await store.save('daily', captured);
    await store.rename('daily', 'My daily work');
    await store.delete('daily');

    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({ kind: 'saved-view-save', viewId: 'daily', data: captured });
    expect(requests[1]).toMatchObject({ kind: 'saved-view-rename', viewId: 'daily', label: 'My daily work' });
    expect(requests[2]).toMatchObject({ kind: 'saved-view-delete', viewId: 'daily' });
    store.dispose();
    board.dispose();
    controller.dispose();
  });

  it('returns unavailable without dispatch after store disposal', async () => {
    const calls: unknown[] = [];
    const store = createKanbanSavedViewStore({
      request: (proposal) => {
        calls.push(proposal);
        return Promise.resolve({ kind: 'cancelled', operationId: 'unused', code: 'unused' });
      },
    });
    store.dispose();

    const result = await store.delete('daily');

    expect(result).toEqual({ kind: 'unavailable', code: 'saved-view-store-disposed' });
    expect(calls).toEqual([]);
  });
});
