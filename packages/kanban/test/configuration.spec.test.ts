/** Immutable requirements for pure programmatic board-configuration builders. */
import { describe, expect, it } from 'vitest';

import {
  buildKanbanColumnAddProposal,
  buildKanbanColumnDeleteProposal,
  buildKanbanColumnReorderProposal,
  buildKanbanColumnUpdateProposal,
  buildKanbanSwimlaneAddProposal,
  buildKanbanSwimlaneDeleteProposal,
  buildKanbanSwimlaneReorderProposal,
  buildKanbanSwimlaneUpdateProposal,
  createKanbanConfigurationSnapshot,
  normalizeKanbanConfigurationName,
} from '../src/index.js';

/** Creates one authoritative structure fixture with stable IDs, labels, and revisions. */
function structure() {
  return createKanbanConfigurationSnapshot({
    revision: 'structure-r1',
    columns: [
      { columnId: 'todo', label: 'To do', revision: 'column-r1' },
      { columnId: 'doing', label: 'Doing', revision: 'column-r1' },
      { columnId: 'done', label: 'Done', revision: 'column-r1' },
    ],
    swimlanes: [
      { swimlaneId: 'team-a', label: 'Team A', revision: 'swimlane-r1' },
      { swimlaneId: 'team-b', label: 'Team B', revision: 'swimlane-r1' },
    ],
  });
}

describe('Kanban programmatic configuration', () => {
  it('builds lifecycle-free column proposals without UI, dispatch, or source mutation', () => {
    const snapshot = structure();
    const before = JSON.stringify(snapshot);

    expect(
      buildKanbanColumnAddProposal({
        snapshot,
        draft: { columnId: 'review', label: 'Review' },
        position: { kind: 'between', beforeColumnId: 'doing', afterColumnId: 'done' },
      }),
    ).toEqual({
      kind: 'column-add',
      draft: { columnId: 'review', label: 'Review' },
      position: { kind: 'between', beforeColumnId: 'doing', afterColumnId: 'done' },
    });
    expect(buildKanbanColumnUpdateProposal({ snapshot, columnId: 'todo', changes: { label: 'Ready' } })).toEqual({
      kind: 'column-update',
      columnId: 'todo',
      patch: { label: 'Ready' },
    });
    expect(
      buildKanbanColumnReorderProposal({
        snapshot,
        columnId: 'done',
        position: { kind: 'start' },
      }),
    ).toEqual({ kind: 'column-reorder', columnId: 'done', position: { kind: 'start' } });
    expect(
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 0 },
      }),
    ).toEqual({ kind: 'column-delete', columnId: 'doing' });

    expect(JSON.stringify(snapshot)).toBe(before);
    expect(
      'operationId' in buildKanbanColumnReorderProposal({ snapshot, columnId: 'done', position: { kind: 'end' } }),
    ).toBe(false);
  });

  it('builds equivalent explicit-swimlane proposals with stable-neighbor ordering', () => {
    const snapshot = structure();

    expect(
      buildKanbanSwimlaneAddProposal({
        snapshot,
        draft: { swimlaneId: 'team-c', label: 'Team C' },
        position: { kind: 'after', swimlaneId: 'team-b' },
      }),
    ).toEqual({
      kind: 'swimlane-add',
      draft: { swimlaneId: 'team-c', label: 'Team C' },
      position: { kind: 'after', swimlaneId: 'team-b' },
    });
    expect(
      buildKanbanSwimlaneUpdateProposal({ snapshot, swimlaneId: 'team-a', changes: { label: 'Platform team' } }),
    ).toEqual({ kind: 'swimlane-update', swimlaneId: 'team-a', patch: { label: 'Platform team' } });
    expect(
      buildKanbanSwimlaneReorderProposal({
        snapshot,
        swimlaneId: 'team-b',
        position: { kind: 'before', swimlaneId: 'team-a' },
      }),
    ).toEqual({
      kind: 'swimlane-reorder',
      swimlaneId: 'team-b',
      position: { kind: 'before', swimlaneId: 'team-a' },
    });
    expect(
      buildKanbanSwimlaneDeleteProposal({
        snapshot,
        swimlaneId: 'team-b',
        occupancy: { quality: 'exact', count: 0 },
      }),
    ).toEqual({ kind: 'swimlane-delete', swimlaneId: 'team-b' });
  });

  it('normalizes visible names deterministically and rejects normalized collisions', () => {
    expect(normalizeKanbanConfigurationName('  \u001b[31mＲＥＶＩＥＷ\n  ')).toEqual({
      label: 'REVIEW',
      collisionKey: 'review',
    });
    const snapshot = structure();

    expect(() =>
      buildKanbanColumnAddProposal({
        snapshot,
        draft: { columnId: 'duplicate', label: '  ＴＯ ＤＯ ' },
        position: { kind: 'end' },
      }),
    ).toThrow();
    expect(() =>
      buildKanbanSwimlaneUpdateProposal({
        snapshot,
        swimlaneId: 'team-b',
        changes: { label: ' team a ' },
      }),
    ).toThrow();
  });

  it('preserves identity across rename and rejects unknown or self-relative structure operations', () => {
    const snapshot = structure();

    const rename = buildKanbanColumnUpdateProposal({
      snapshot,
      columnId: 'todo',
      changes: { label: 'Incoming work' },
    });
    expect(rename.columnId).toBe('todo');
    expect(() =>
      buildKanbanColumnUpdateProposal({ snapshot, columnId: 'missing', changes: { label: 'Unknown' } }),
    ).toThrow();
    expect(() =>
      buildKanbanColumnReorderProposal({
        snapshot,
        columnId: 'doing',
        position: { kind: 'between', beforeColumnId: 'doing', afterColumnId: 'done' },
      }),
    ).toThrow();
  });

  it('keeps visibility and collapse personalization out of structural snapshots and proposals', () => {
    expect(() =>
      createKanbanConfigurationSnapshot({
        revision: 'structure-r1',
        columns: [{ columnId: 'todo', label: 'To do', revision: 'column-r1', visible: false }],
        swimlanes: [],
      }),
    ).toThrow();

    const proposal = buildKanbanColumnUpdateProposal({
      snapshot: structure(),
      columnId: 'todo',
      changes: { label: 'Queued' },
    });
    expect(proposal.patch).not.toHaveProperty('visible');
    expect(proposal.patch).not.toHaveProperty('collapsed');
  });
});
