import { describe, expect, it, vi } from 'vitest';

import { createKanbanHistoryBinding } from '../src/index.js';
import type { KanbanHistoryAvailability, KanbanRequest } from '../src/index.js';
import { KanbanBoardAuthority } from '../src/board/board-authority.js';

describe('Kanban history binding implementation', () => {
  it('retains the last valid availability and releases provider and pending build resources', async () => {
    let availability: KanbanHistoryAvailability = {
      revision: 'history-r1',
      undo: { labelMessageId: 'acme.history.undo' },
    };
    let notify = () => undefined;
    const release = vi.fn();
    let buildSignal: AbortSignal | undefined;
    const authority = new KanbanBoardAuthority(undefined, undefined);
    const binding = createKanbanHistoryBinding({
      authority,
      provider: {
        availability: () => availability,
        subscribe(listener) {
          notify = listener;
          return release;
        },
        build: (_direction, context) => {
          buildSignal = context.signal;
          return new Promise(() => undefined);
        },
      },
    });
    const pending = binding.invoke('undo');
    availability = { revision: 'history-r2', undo: { labelMessageId: 'not-namespaced' } };
    notify();
    expect(binding.snapshot().revision).toBe('history-r1');

    binding.dispose();
    expect(release).toHaveBeenCalledOnce();
    expect(buildSignal?.aborted).toBe(true);
    await expect(binding.invoke('undo')).resolves.toMatchObject({ code: 'history-unavailable' });
    void pending;
    authority.dispose();
  });

  it('contains builder failure without dispatching a request', async () => {
    const dispatcher = vi.fn((_request: KanbanRequest) => ({ kind: 'accepted' as const }));
    const authority = new KanbanBoardAuthority(dispatcher, undefined);
    const binding = createKanbanHistoryBinding({
      authority,
      provider: {
        availability: () => ({
          revision: 'history-r1',
          redo: { labelMessageId: 'acme.history.redo' },
        }),
        subscribe: () => () => undefined,
        build: () => {
          throw new Error('private history token');
        },
      },
    });

    await expect(binding.invoke('redo')).resolves.toMatchObject({ code: 'history-failed' });
    expect(dispatcher).not.toHaveBeenCalled();
    binding.dispose();
    authority.dispose();
  });
});
