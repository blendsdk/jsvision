/** Specification oracle for reactive application-owned history and fresh request authority. */
import { describe, expect, it, vi } from 'vitest';

import { createKanbanHistoryBinding } from '../src/index.js';
import type { KanbanHistoryAvailability, KanbanRequest } from '../src/index.js';
import { KanbanBoardAuthority } from '../src/board/board-authority.js';

/** Small reactive provider harness with application-owned availability state. */
function providerHarness() {
  let availability: KanbanHistoryAvailability = { revision: 'history-r1' };
  const listeners = new Set<() => void>();
  const build = vi.fn((direction: 'undo' | 'redo') => ({
    kind: 'card-archive' as const,
    cardKey: direction === 'undo' ? 41 : 42,
  }));
  return {
    provider: {
      availability: () => availability,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      build,
    },
    publish(next: KanbanHistoryAvailability): void {
      availability = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

describe('Kanban application-owned history', () => {
  it('reactively exposes bounded undo/redo availability without retaining application stacks', () => {
    const source = providerHarness();
    const authority = new KanbanBoardAuthority(undefined, undefined);
    const binding = createKanbanHistoryBinding({ authority, provider: source.provider });
    const snapshots: KanbanHistoryAvailability[] = [];
    binding.subscribe((snapshot) => snapshots.push(snapshot));

    expect(binding.snapshot()).toEqual({ revision: 'history-r1' });
    source.publish({
      revision: 'history-r2',
      undo: { labelMessageId: 'acme.history.undo-last' },
      redo: { labelMessageId: 'acme.history.redo-last' },
    });

    expect(binding.snapshot()).toEqual({
      revision: 'history-r2',
      undo: { labelMessageId: 'acme.history.undo-last' },
      redo: { labelMessageId: 'acme.history.redo-last' },
    });
    expect(snapshots).toHaveLength(1);
    expect(JSON.stringify(binding.snapshot())).not.toContain('record');
    expect(JSON.stringify(binding.snapshot())).not.toContain('stack');
    binding.dispose();
    authority.dispose();
  });

  it('builds a fresh current-revision request for every invocation and preserves rejection', async () => {
    const requests: KanbanRequest[] = [];
    let boardRevision = 'board-r1';
    const dispatcher = vi.fn((request: KanbanRequest) => {
      requests.push(request);
      return { kind: 'rejected' as const, operationId: request.operationId, code: 'history-stale' };
    });
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}), {
      expected: () => ({ board: boardRevision }),
      confirm: () => true,
    });
    const source = providerHarness();
    source.publish({ revision: 'history-r2', undo: { labelMessageId: 'acme.history.undo-last' } });
    const binding = createKanbanHistoryBinding({ authority, provider: source.provider });

    await expect(binding.invoke('undo')).resolves.toMatchObject({ kind: 'rejected', code: 'history-stale' });
    boardRevision = 'board-r2';
    await expect(binding.invoke('undo')).resolves.toMatchObject({ kind: 'rejected', code: 'history-stale' });

    expect(source.provider.build).toHaveBeenCalledTimes(2);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.operationId).not.toBe(requests[1]?.operationId);
    expect(requests.map(({ expected }) => expected.board)).toEqual(['board-r1', 'board-r2']);
    expect(binding.snapshot()).toEqual({
      revision: 'history-r2',
      undo: { labelMessageId: 'acme.history.undo-last' },
    });
    binding.dispose();
    authority.dispose();
  });

  it('returns unavailable without building when a direction is not currently offered', async () => {
    const source = providerHarness();
    const authority = new KanbanBoardAuthority(undefined, undefined);
    const binding = createKanbanHistoryBinding({ authority, provider: source.provider });

    await expect(binding.invoke('redo')).resolves.toEqual({
      kind: 'rejected',
      operationId: 'kanban-history-unavailable',
      code: 'history-unavailable',
    });
    expect(source.provider.build).not.toHaveBeenCalled();
    binding.dispose();
    authority.dispose();
  });
});
