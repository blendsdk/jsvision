/** Immutable requirements for safe structural deletion and atomic destination policies. */
import { describe, expect, it, vi } from 'vitest';

import {
  buildKanbanColumnDeleteProposal,
  buildKanbanSwimlaneDeleteProposal,
  createKanbanConfigurationSnapshot,
  evaluateKanbanColumnDeletion,
  evaluateKanbanSwimlaneDeletion,
} from '../src/index.js';

/** Creates a bounded configuration fixture used by deletion-policy oracles. */
function structure() {
  return createKanbanConfigurationSnapshot({
    revision: 'structure-r1',
    columns: [
      { columnId: 'todo', label: 'To do', revision: 'column-r1' },
      { columnId: 'doing', label: 'Doing', revision: 'column-r1' },
      { columnId: 'archive', label: 'Archive', revision: 'column-r1' },
    ],
    swimlanes: [
      { swimlaneId: 'team-a', label: 'Team A', revision: 'swimlane-r1', mode: 'explicit' },
      { swimlaneId: 'team-b', label: 'Team B', revision: 'swimlane-r1', mode: 'explicit' },
      { swimlaneId: 'derived', label: 'Derived', revision: 'swimlane-r1', mode: 'derived' },
    ],
  });
}

describe('Kanban structural deletion', () => {
  it('requires UI confirmation for an eligible empty structure but keeps the pure builder request-free', () => {
    const snapshot = structure();

    expect(
      evaluateKanbanColumnDeletion({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 0 },
      }),
    ).toEqual({ kind: 'confirmation-required', code: 'delete-empty-column' });
    expect(
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 0 },
      }),
    ).toEqual({ kind: 'column-delete', columnId: 'doing' });
  });

  it.each([
    { occupancy: { quality: 'unknown' as const }, code: 'occupancy-unknown' },
    { occupancy: { quality: 'exact' as const, count: 3 }, code: 'non-empty-policy-required' },
  ])('fails closed for $code and produces no proposal', ({ occupancy, code }) => {
    const snapshot = structure();

    expect(evaluateKanbanColumnDeletion({ snapshot, columnId: 'doing', occupancy })).toEqual({
      kind: 'disabled',
      code,
    });
    expect(() => buildKanbanColumnDeleteProposal({ snapshot, columnId: 'doing', occupancy })).toThrow();
  });

  it('builds one atomic non-empty reassignment or archive proposal with a complete destination', () => {
    const snapshot = structure();

    expect(
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 4 },
        policy: { kind: 'reassign', destinationId: 'todo' },
      }),
    ).toEqual({ kind: 'column-delete', columnId: 'doing', reassignTo: 'todo' });
    expect(
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 4 },
        policy: { kind: 'archive', destinationId: 'archive' },
      }),
    ).toEqual({ kind: 'column-delete', columnId: 'doing', reassignTo: 'archive' });
    expect(() =>
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 4 },
        policy: { kind: 'reassign', destinationId: 'missing' },
      }),
    ).toThrow();
  });

  it('validates one custom atomic proposal and never synthesizes cascade card deletion', () => {
    const build = vi.fn(() => ({
      kind: 'extension' as const,
      extensionId: 'example.kanban.delete-column',
      payload: { columnId: 'doing', destination: 'cold-storage' },
    }));
    const proposal = buildKanbanColumnDeleteProposal({
      snapshot: structure(),
      columnId: 'doing',
      occupancy: { quality: 'exact', count: 4 },
      policy: { kind: 'custom', build },
    });

    expect(proposal).toEqual({
      kind: 'extension',
      extensionId: 'example.kanban.delete-column',
      payload: { columnId: 'doing', destination: 'cold-storage' },
    });
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: { kind: 'column', columnId: 'doing' },
        occupancy: { quality: 'exact', count: 4 },
        signal: expect.any(Object),
      }),
    );
    expect(JSON.stringify(proposal)).not.toContain('card-delete');
  });

  it('applies the same non-empty and destination rules to explicit swimlanes', () => {
    const snapshot = structure();

    expect(
      buildKanbanSwimlaneDeleteProposal({
        snapshot,
        swimlaneId: 'team-a',
        occupancy: { quality: 'exact', count: 2 },
        policy: { kind: 'reassign', destinationId: 'team-b' },
      }),
    ).toEqual({ kind: 'swimlane-delete', swimlaneId: 'team-a', reassignTo: 'team-b' });
    expect(() =>
      buildKanbanSwimlaneDeleteProposal({
        snapshot,
        swimlaneId: 'team-a',
        occupancy: { quality: 'unknown' },
      }),
    ).toThrow();
  });

  it('reports derived grouping as non-mutable through evaluator and programmatic builder', () => {
    const snapshot = structure();

    expect(
      evaluateKanbanSwimlaneDeletion({
        snapshot,
        swimlaneId: 'derived',
        occupancy: { quality: 'exact', count: 0 },
      }),
    ).toEqual({ kind: 'disabled', code: 'derived-group-read-only' });
    expect(() =>
      buildKanbanSwimlaneDeleteProposal({
        snapshot,
        swimlaneId: 'derived',
        occupancy: { quality: 'exact', count: 0 },
      }),
    ).toThrow();
  });

  it('rejects self-destination and unknown identities without invoking custom policy', () => {
    const snapshot = structure();
    const build = vi.fn();

    expect(() =>
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 1 },
        policy: { kind: 'reassign', destinationId: 'doing' },
      }),
    ).toThrow();
    expect(() =>
      buildKanbanColumnDeleteProposal({
        snapshot,
        columnId: 'missing',
        occupancy: { quality: 'exact', count: 1 },
        policy: { kind: 'custom', build },
      }),
    ).toThrow();
    expect(build).not.toHaveBeenCalled();
  });
});
