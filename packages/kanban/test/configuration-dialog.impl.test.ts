import { describe, expect, it, vi } from 'vitest';

import { createKanbanConfigurationSession, createKanbanConfigurationSnapshot } from '../src/index.js';
import type { KanbanConfigurationSnapshot } from '../src/index.js';

/** Creates one replaceable source and exposes its retained listener for lifecycle assertions. */
function source(initial: KanbanConfigurationSnapshot) {
  let current = initial;
  let listener: ((snapshot: KanbanConfigurationSnapshot) => void) | undefined;
  const unsubscribe = vi.fn(() => {
    listener = undefined;
  });
  return {
    value: {
      resolve: vi.fn(async () => current),
      subscribe: vi.fn((next: (snapshot: KanbanConfigurationSnapshot) => void) => {
        listener = next;
        return unsubscribe;
      }),
    },
    publish(next: KanbanConfigurationSnapshot): void {
      current = next;
      listener?.(next);
    },
    unsubscribe,
  };
}

/** Creates one configuration publication with a selectable column label and revision. */
function structure(revision: string, label: string): KanbanConfigurationSnapshot {
  return createKanbanConfigurationSnapshot({
    revision,
    columns: [{ columnId: 'todo', label, revision }],
    swimlanes: [],
  });
}

describe('Kanban configuration session implementation', () => {
  it('retains the isolated draft after rejection and returns the corrected proposal later', async () => {
    const records = source(structure('r1', 'To do'));
    const request = vi.fn(async () => ({
      kind: 'rejected' as const,
      operationId: 'configuration-1',
      code: 'conflict',
    }));
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'todo' },
      authority: { request },
    });

    expect(session.setLabel('Ready')).toBe(true);
    await expect(session.apply()).resolves.toEqual({ kind: 'rejected', code: 'conflict' });
    expect(session.snapshot()).toMatchObject({ label: 'Ready', dirty: true, submission: 'rejected' });
    session.dispose();
  });

  it('marks a dirty publication stale, blocks Apply, and explicitly reloads current authority', async () => {
    const records = source(structure('r1', 'To do'));
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'todo' },
    });
    session.setLabel('Local');
    records.publish(structure('r2', 'Remote'));

    expect(session.snapshot()).toMatchObject({ record: 'stale', label: 'Local', dirty: true });
    await expect(session.apply()).resolves.toEqual({ kind: 'stale' });
    await expect(session.reload()).resolves.toBe(true);
    expect(session.snapshot()).toMatchObject({ record: 'ready', label: 'Remote', dirty: false });
    session.dispose();
  });

  it('keeps a publication delivered during initial resolve instead of rebasing to stale data', async () => {
    const stale = structure('r1', 'Stale');
    const current = structure('r2', 'Current');
    let listener: ((snapshot: KanbanConfigurationSnapshot) => void) | undefined;
    const session = await createKanbanConfigurationSession({
      source: {
        subscribe(next: (snapshot: KanbanConfigurationSnapshot) => void) {
          listener = next;
          return () => {
            listener = undefined;
          };
        },
        async resolve() {
          listener?.(current);
          return stale;
        },
      },
      operation: { kind: 'update', columnId: 'todo' },
    });

    expect(session.snapshot()).toMatchObject({ record: 'ready', label: 'Current' });
    session.dispose();
  });

  it('isolates observer failures and releases the source exactly once on disposal', async () => {
    const records = source(structure('r1', 'To do'));
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'todo' },
    });
    const observer = vi.fn();
    session.subscribe(() => {
      throw new Error('private-observer-token');
    });
    session.subscribe(observer);

    expect(session.setLabel('Ready')).toBe(true);
    expect(observer).toHaveBeenCalledOnce();
    session.dispose();
    session.dispose();
    expect(records.unsubscribe).toHaveBeenCalledOnce();
    records.publish(structure('r2', 'Late'));
    expect(session.snapshot().label).toBe('Ready');
  });
});
