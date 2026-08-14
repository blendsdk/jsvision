/** Immutable quality requirements for authoritative and bounded board configuration. */
import { describe, expect, it, vi } from 'vitest';

import {
  buildKanbanColumnAddProposal,
  buildKanbanColumnReorderProposal,
  createKanbanConfigurationSession,
  createKanbanConfigurationSnapshot,
  reconcileKanbanDeletedColumnFocus,
  reconcileKanbanDeletedSwimlaneFocus,
} from '../src/index.js';
import type { KanbanConfigurationSnapshot } from '../src/index.js';
import type { KanbanConfigurationAuthorityContext } from '../src/index.js';

/** Creates a replaceable source with exact structural revision evidence. */
function source(initial: KanbanConfigurationSnapshot) {
  let current = initial;
  let listener: ((snapshot: KanbanConfigurationSnapshot) => void) | undefined;
  return {
    value: {
      resolve: vi.fn(async () => current),
      subscribe(next: (snapshot: KanbanConfigurationSnapshot) => void) {
        listener = next;
        return () => {
          if (listener === next) listener = undefined;
        };
      },
    },
    publish(next: KanbanConfigurationSnapshot): void {
      current = next;
      listener?.(next);
    },
  };
}

/** Creates a three-column structure for ordering and publication checks. */
function structure(revision = 'board-r1', doingRevision = 'doing-r1') {
  return createKanbanConfigurationSnapshot({
    revision,
    columns: [
      { columnId: 'todo', label: 'To do', revision: 'todo-r1' },
      { columnId: 'doing', label: 'Doing', revision: doingRevision },
      { columnId: 'done', label: 'Done', revision: 'done-r1' },
    ],
    swimlanes: [
      { swimlaneId: 'team-a', label: 'Team A', revision: 'team-a-r1' },
      { swimlaneId: 'team-b', label: 'Team B', revision: 'team-b-r1' },
    ],
  });
}

describe('Kanban configuration quality boundary', () => {
  it('rejects ambiguous normalized label/disambiguator pairs and non-adjacent column intervals', () => {
    expect(() =>
      createKanbanConfigurationSnapshot({
        revision: 'board-r1',
        columns: [
          { columnId: 'a', label: 'Review', disambiguator: 'Team A', revision: 'a-r1' },
          { columnId: 'b', label: 'ＲＥＶＩＥＷ', disambiguator: 'team a', revision: 'b-r1' },
        ],
        swimlanes: [],
      }),
    ).toThrow();
    const duplicateSnapshot = createKanbanConfigurationSnapshot({
      revision: 'board-r1',
      columns: [{ columnId: 'review-a', label: 'Review', disambiguator: 'Team A', revision: 'a-r1' }],
      swimlanes: [],
    });
    expect(() =>
      buildKanbanColumnAddProposal({
        snapshot: duplicateSnapshot,
        draft: { columnId: 'review-b', label: 'ＲＥＶＩＥＷ' },
        duplicateName: { disambiguator: 'team a' },
        position: { kind: 'end' },
      }),
    ).toThrow();
    expect(() =>
      buildKanbanColumnReorderProposal({
        snapshot: structure(),
        columnId: 'doing',
        position: { kind: 'between', beforeColumnId: 'todo', afterColumnId: 'done' },
      }),
    ).not.toThrow();
    expect(() =>
      buildKanbanColumnReorderProposal({
        snapshot: structure(),
        columnId: 'done',
        position: { kind: 'between', beforeColumnId: 'todo', afterColumnId: null },
      }),
    ).toThrow();
  });

  it('dispatches once with detached revision evidence and commits only after matching publication', async () => {
    const records = source(structure());
    let resolveRequest: ((value: unknown) => void) | undefined;
    const request = vi.fn(
      (_proposal: unknown, _context?: KanbanConfigurationAuthorityContext) =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'doing' },
      authority: { request },
    });
    session.setLabel('In progress');
    const first = session.apply();
    await expect(session.apply()).resolves.toEqual({ kind: 'failed' });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      boardRevision: 'board-r1',
      entities: [{ kind: 'column', columnId: 'doing', revision: 'doing-r1' }],
      signal: expect.any(AbortSignal),
    });
    resolveRequest?.({
      kind: 'accepted',
      operationId: 'configuration-1',
      publication: {
        operationId: 'configuration-1',
        subjects: [
          {
            kind: 'column',
            columnId: 'doing',
            baselineRevision: 'doing-r1',
            expectedRevision: 'doing-r2',
          },
        ],
      },
    });
    await expect(first).resolves.toEqual({ kind: 'awaiting-publication', operationId: 'configuration-1' });
    expect(session.snapshot().submission).toBe('awaiting-publication');

    records.publish(structure('board-r2', 'doing-r2'));
    expect(session.snapshot()).toMatchObject({ submission: 'committed', operationId: 'configuration-1' });
    expect(session.setLabel('Second request')).toBe(false);
    await expect(session.apply()).resolves.toEqual({ kind: 'committed', operationId: 'configuration-1' });
    records.publish(structure('board-r3', 'doing-r3'));
    expect(session.snapshot()).toMatchObject({ submission: 'committed', operationId: 'configuration-1' });
    expect(request).toHaveBeenCalledOnce();
    session.dispose();
  });

  it('aborts a pending request on disposal and retains an immutable deletion policy snapshot', async () => {
    const records = source(structure());
    const policy = { kind: 'reassign' as const, destinationId: 'todo' };
    const resultOnly = await createKanbanConfigurationSession({
      source: records.value,
      operation: {
        kind: 'delete',
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 2 },
        policy,
      },
    });
    policy.destinationId = 'done';
    expect(resultOnly.operation()).toEqual({
      kind: 'delete',
      columnId: 'doing',
      occupancy: { quality: 'exact', count: 2 },
      policy: { kind: 'reassign', destinationId: 'todo' },
    });
    expect(Object.isFrozen(resultOnly.operation())).toBe(true);
    await expect(resultOnly.apply()).resolves.toEqual({
      kind: 'proposal',
      proposal: { kind: 'column-delete', columnId: 'doing', reassignTo: 'todo' },
    });
    resultOnly.dispose();

    const request = vi.fn(
      (_proposal: unknown, _context?: KanbanConfigurationAuthorityContext) => new Promise<never>(() => undefined),
    );
    const pending = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'doing' },
      authority: { request },
    });
    pending.setLabel('Local');
    const applying = pending.apply();
    pending.dispose();
    await expect(applying).resolves.toEqual({ kind: 'disposed' });
    expect(request.mock.calls[0]?.[1]?.signal.aborted).toBe(true);
  });

  it('offers atomic delete destinations and publishes the next stable focus target only after commit', async () => {
    const records = source(structure());
    const request = vi.fn((_proposal: unknown, _context?: KanbanConfigurationAuthorityContext) => ({
      kind: 'accepted' as const,
      operationId: 'delete-1',
      publication: {
        operationId: 'delete-1',
        subjects: [
          {
            kind: 'column' as const,
            columnId: 'doing',
            baselineRevision: 'doing-r1',
            expectedRevision: 'doing-r2',
          },
        ],
      },
    }));
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'delete', columnId: 'doing', occupancy: { quality: 'exact', count: 3 } },
      authority: { request },
    });
    expect(session.snapshot().deletion).toEqual({ kind: 'disabled', code: 'non-empty-policy-required' });
    expect(session.deletionDestinations()).toEqual([
      { destinationId: 'todo', label: 'To do' },
      { destinationId: 'done', label: 'Done' },
    ]);
    expect(session.setDeletionDestination('todo')).toBe(true);
    expect(session.snapshot().deletion).toEqual({ kind: 'ready' });
    await expect(session.apply()).resolves.toEqual({ kind: 'awaiting-publication', operationId: 'delete-1' });
    expect(request.mock.calls[0]?.[1]?.entities).toEqual([
      { kind: 'column', columnId: 'doing', revision: 'doing-r1' },
      { kind: 'column', columnId: 'todo', revision: 'todo-r1' },
    ]);

    records.publish(
      createKanbanConfigurationSnapshot({
        revision: 'board-r2',
        columns: [
          { columnId: 'todo', label: 'To do', revision: 'todo-r1' },
          { columnId: 'done', label: 'Done', revision: 'done-r1' },
        ],
        swimlanes: structure().swimlanes,
      }),
    );
    expect(session.snapshot()).toMatchObject({
      submission: 'committed',
      focusTarget: { kind: 'column', columnId: 'done' },
    });
    session.dispose();
  });

  it('settles initial resolution when caller lifetime aborts and rejects acceptance without publication evidence', async () => {
    const controller = new AbortController();
    const unsubscribe = vi.fn();
    const opening = createKanbanConfigurationSession({
      source: {
        resolve: () => new Promise<KanbanConfigurationSnapshot>(() => undefined),
        subscribe: () => unsubscribe,
      },
      operation: { kind: 'update', columnId: 'doing' },
      signal: controller.signal,
    });
    controller.abort();
    await expect(opening).rejects.toThrow('Invalid Kanban configuration session.');
    expect(unsubscribe).toHaveBeenCalledOnce();

    const records = source(structure());
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'doing' },
      authority: {
        request: () => ({ kind: 'accepted', operationId: 'missing-publication' }),
      },
    });
    session.setLabel('Local');
    await expect(session.apply()).resolves.toEqual({ kind: 'rejected', code: 'publication-required' });
    expect(session.snapshot()).toMatchObject({ dirty: true, submission: 'rejected' });
    session.dispose();
  });

  it('retains bounded application field diagnostics for correction and resubmission', async () => {
    const records = source(structure());
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'doing' },
      authority: {
        request: () => ({
          kind: 'rejected',
          operationId: 'configuration-invalid',
          code: 'invalid-fields',
          fieldErrors: [{ fieldId: 'application.metadata', code: 'invalid-json', label: 'Metadata is invalid' }],
        }),
      },
    });
    session.setLabel('Local');
    await expect(session.apply()).resolves.toEqual({ kind: 'rejected', code: 'invalid-fields' });
    expect(session.snapshot().diagnostics).toEqual([
      { fieldId: 'application.metadata', code: 'invalid-json', label: 'Metadata is invalid' },
    ]);
    session.setLabel('Corrected');
    expect(session.snapshot().diagnostics).toBeUndefined();
    session.dispose();
  });

  it('edits typed column policy fields and expresses optional-field clearing explicitly', async () => {
    const records = source(
      createKanbanConfigurationSnapshot({
        revision: 'board-r1',
        columns: [
          {
            columnId: 'doing',
            label: 'Doing',
            revision: 'doing-r1',
            definitionOfDone: { summary: 'Reviewed' },
            wip: { minimum: 1, maximum: 3, mode: 'blocking', countDone: 'exclude' },
            style: { role: 'column.header' },
            data: { owner: 'team-a' },
          },
        ],
        swimlanes: [],
      }),
    );
    const session = await createKanbanConfigurationSession({
      source: records.value,
      operation: { kind: 'update', columnId: 'doing' },
    });
    expect(session.snapshot()).toMatchObject({
      wip: { minimum: 1, maximum: 3, mode: 'blocking', countDone: 'exclude' },
      style: { role: 'column.header' },
      data: { owner: 'team-a' },
    });
    expect(session.setDefinitionOfDone('')).toBe(true);
    expect(session.setWip(undefined)).toBe(true);
    expect(session.setStyle(undefined)).toBe(true);
    expect(session.setData(undefined)).toBe(true);
    await expect(session.apply()).resolves.toEqual({
      kind: 'proposal',
      proposal: {
        kind: 'column-update',
        columnId: 'doing',
        patch: {
          label: 'Doing',
          definitionOfDone: null,
          wip: null,
          style: null,
          data: null,
        },
      },
    });
    session.dispose();
  });

  it('bounds both structural focus axes and chooses the next stable survivor', () => {
    expect(
      reconcileKanbanDeletedColumnFocus({
        previousColumnIds: ['todo', 'doing', 'done'],
        currentColumnIds: ['todo', 'done'],
        deletedColumnId: 'doing',
        focusedColumnId: 'doing',
      }),
    ).toEqual({ kind: 'column', columnId: 'done' });
    expect(
      reconcileKanbanDeletedSwimlaneFocus({
        previousSwimlaneIds: ['team-a', 'team-b'],
        currentSwimlaneIds: ['team-a'],
        deletedSwimlaneId: 'team-b',
        focusedSwimlaneId: 'team-b',
      }),
    ).toEqual({ kind: 'swimlane', swimlaneId: 'team-a' });
    expect(() =>
      reconcileKanbanDeletedSwimlaneFocus({
        previousSwimlaneIds: ['team-a', 'team-a'],
        currentSwimlaneIds: ['team-a'],
        deletedSwimlaneId: 'team-a',
      }),
    ).toThrow();
  });
});
