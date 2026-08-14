import { describe, expect, it, vi } from 'vitest';

import {
  buildKanbanColumnAddProposal,
  buildKanbanColumnDeleteProposal,
  buildKanbanColumnReorderProposal,
  createKanbanConfigurationSnapshot,
  reconcileKanbanDeletedColumnFocus,
} from '../src/index.js';
import type { KanbanConfigurationDeletionContext } from '../src/index.js';

/** Creates one mutable input whose detached snapshot can be inspected independently. */
function mutableStructure() {
  return {
    revision: 'structure-r1',
    columns: [
      { columnId: 'todo', label: 'To do', revision: 'column-r1' },
      { columnId: 'doing', label: 'Doing', revision: 'column-r1' },
      { columnId: 'done', label: 'Done', revision: 'column-r1' },
    ],
    swimlanes: [{ swimlaneId: 'team-a', label: 'Team A', revision: 'swimlane-r1' }],
  };
}

describe('Kanban configuration builder implementation', () => {
  it('deeply detaches snapshots and supplies the explicit default swimlane mode', () => {
    const input = mutableStructure();
    const snapshot = createKanbanConfigurationSnapshot(input);
    input.columns[0]!.label = 'Mutated';

    expect(snapshot.columns[0]?.label).toBe('To do');
    expect(snapshot.swimlanes[0]?.mode).toBe('explicit');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.columns)).toBe(true);
    expect(Object.isFrozen(snapshot.columns[0])).toBe(true);
  });

  it('rejects unknown neighbors and exact-shape additions without inspecting extra accessors', () => {
    const snapshot = createKanbanConfigurationSnapshot(mutableStructure());
    expect(() =>
      buildKanbanColumnReorderProposal({
        snapshot,
        columnId: 'done',
        position: { kind: 'between', beforeColumnId: 'missing', afterColumnId: 'todo' },
      }),
    ).toThrow();

    const getter = vi.fn(() => 'private');
    const draft = { columnId: 'review', label: 'Review' };
    Object.defineProperty(draft, 'secret', { enumerable: true, get: getter });
    expect(() => buildKanbanColumnAddProposal({ snapshot, draft, position: { kind: 'end' } })).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });

  it('passes a frozen custom context and normalizes callback failures to a fixed error', () => {
    const snapshot = createKanbanConfigurationSnapshot(mutableStructure());
    const build = vi.fn((context: KanbanConfigurationDeletionContext) => {
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(context.identity)).toBe(true);
      expect(Object.isFrozen(context.occupancy)).toBe(true);
      expect(context.signal.aborted).toBe(false);
      return { kind: 'extension', extensionId: 'example.delete', payload: { destination: 'archive' } };
    });
    expect(
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 3 },
        policy: { kind: 'custom', build },
      }),
    ).toMatchObject({ kind: 'extension', extensionId: 'example.delete' });

    expect(() =>
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 3 },
        policy: {
          kind: 'custom',
          build: () => {
            throw new Error('private-delete-token');
          },
        },
      }),
    ).toThrow('Invalid Kanban semantic value.');
  });

  it('reconciles focus to next, previous, preserved, and board targets deterministically', () => {
    expect(
      reconcileKanbanDeletedColumnFocus({
        previousColumnIds: ['todo', 'doing', 'done'],
        currentColumnIds: ['todo', 'done'],
        deletedColumnId: 'doing',
        focusedColumnId: 'doing',
      }),
    ).toEqual({ kind: 'column', columnId: 'done' });
    expect(
      reconcileKanbanDeletedColumnFocus({
        previousColumnIds: ['todo', 'doing'],
        currentColumnIds: ['todo'],
        deletedColumnId: 'doing',
        focusedColumnId: 'doing',
      }),
    ).toEqual({ kind: 'column', columnId: 'todo' });
    expect(
      reconcileKanbanDeletedColumnFocus({
        previousColumnIds: ['todo', 'doing'],
        currentColumnIds: ['todo'],
        deletedColumnId: 'doing',
        focusedColumnId: 'todo',
      }),
    ).toEqual({ kind: 'column', columnId: 'todo' });
    expect(
      reconcileKanbanDeletedColumnFocus({
        previousColumnIds: ['doing'],
        currentColumnIds: [],
        deletedColumnId: 'doing',
        focusedColumnId: 'doing',
      }),
    ).toEqual({ kind: 'board' });
  });
});
