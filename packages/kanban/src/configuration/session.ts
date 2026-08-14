import type { KanbanFieldRejection, KanbanPublicationExpectation, KanbanRequestProposal } from '../contract/request.js';
import { kanbanRevisionsEqual } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import { snapshotKanbanDefinitionOfDone } from '../workflow/definition-of-done.js';
import type { KanbanDefinitionOfDoneSnapshot } from '../workflow/definition-of-done.js';
import type { KanbanStructureStyle, KanbanWipPolicy } from '../source/types.js';
import { awaitEditorWork } from '../editor/session-async.js';
import type { KanbanConfigurationFocusTarget } from '../board/board-configuration-binding.js';
import {
  applicationResult,
  authorityEntities,
  deletionDestinations,
  deletionFocusTarget,
  invalidSession,
  operationLabel,
  operationSubject,
  proposalFor,
  publicationOutcome,
  reorderDestinations,
  sessionOptions,
} from './session-helpers.js';
import { snapshotKanbanConfigurationDeletionPolicy } from './deletion.js';
import type {
  KanbanColumnConfigurationOperation,
  KanbanConfigurationAuthority,
  KanbanConfigurationSession,
  KanbanConfigurationSessionApplyResult,
  KanbanConfigurationSessionSnapshot,
  KanbanConfigurationSnapshot,
  KanbanConfigurationSource,
  KanbanSwimlaneConfigurationOperation,
} from './types.js';
import {
  createKanbanConfigurationSnapshot,
  normalizeKanbanConfigurationName,
  snapshotKanbanConfigurationStyle,
  snapshotKanbanConfigurationWipPolicy,
} from './validation.js';

/** Maximum retained state listeners for one short-lived configuration dialog. */
const MAXIMUM_LISTENERS = 64;

/** Options for one isolated configuration draft session. */
export interface KanbanConfigurationSessionOptions {
  /** Application-owned authoritative structure source. */
  readonly source: KanbanConfigurationSource;
  /** Column or explicit-swimlane operation being configured. */
  readonly operation: KanbanColumnConfigurationOperation | KanbanSwimlaneConfigurationOperation;
  /** Optional application request authority; omission selects result-only behavior. */
  readonly authority?: KanbanConfigurationAuthority;
  /** Optional caller lifetime; aborting it disposes pending session work. */
  readonly signal?: AbortSignal;
}

/** Mutable state retained behind immutable session snapshots. */
interface SessionState {
  record: KanbanConfigurationSessionSnapshot['record'];
  label: string;
  baselineLabel: string;
  dirty: boolean;
  submission: KanbanConfigurationSessionSnapshot['submission'];
  code?: string;
  diagnostics?: readonly KanbanFieldRejection[];
  operationId?: string;
  focusTarget?: KanbanConfigurationFocusTarget;
}

/**
 * Creates one isolated configuration session after resolving the initial authoritative structure.
 *
 * @example
 * ```ts
 * const session = await createKanbanConfigurationSession({
 *   source,
 *   operation: { kind: 'update', columnId: 'todo' },
 * });
 * ```
 */
export async function createKanbanConfigurationSession(value: unknown): Promise<KanbanConfigurationSession> {
  const options = sessionOptions(value);
  let disposed = false;
  let generation = 0;
  const lifetimeController = new AbortController();
  let workController: AbortController | undefined;
  let structure: KanbanConfigurationSnapshot;
  let publicationDuringResolve: KanbanConfigurationSnapshot | undefined;
  let publicationDuringDispatch: KanbanConfigurationSnapshot | undefined;
  let expectedPublication: KanbanPublicationExpectation | undefined;
  let position: unknown = { kind: 'end' };
  let positionDirty = false;
  let disambiguator: string | undefined;
  let baselineDisambiguator: string | undefined;
  let definitionOfDone: KanbanDefinitionOfDoneSnapshot | undefined;
  let baselineDefinitionOfDone: KanbanDefinitionOfDoneSnapshot | undefined;
  let wip: KanbanWipPolicy | undefined;
  let baselineWip: KanbanWipPolicy | undefined;
  let style: KanbanStructureStyle | undefined;
  let baselineStyle: KanbanStructureStyle | undefined;
  let data: ReturnType<typeof snapshotKanbanSemanticValue> | undefined;
  let baselineData: ReturnType<typeof snapshotKanbanSemanticValue> | undefined;
  let dataDirty = false;
  let selectedDeletionPolicy =
    options.operation.kind === 'delete'
      ? snapshotKanbanConfigurationDeletionPolicy(options.operation.policy)
      : undefined;
  const state: SessionState = {
    record: 'loading',
    label: '',
    baselineLabel: '',
    dirty: false,
    submission: 'idle',
  };
  const listeners = new Set<(snapshot: KanbanConfigurationSessionSnapshot) => void>();

  const deletionSnapshot = (): KanbanConfigurationSessionSnapshot['deletion'] => {
    const operation = options.operation;
    if (operation.kind !== 'delete') return undefined;
    if (
      'swimlaneId' in operation &&
      structure?.swimlanes.find((entry) => entry.swimlaneId === operation.swimlaneId)?.mode === 'derived'
    ) {
      return Object.freeze({ kind: 'disabled', code: 'derived-group-read-only' });
    }
    if (operation.occupancy.quality === 'unknown') {
      return Object.freeze({ kind: 'disabled', code: 'occupancy-unknown' });
    }
    if (operation.occupancy.count > 0 && selectedDeletionPolicy === undefined) {
      return Object.freeze({ kind: 'disabled', code: 'non-empty-policy-required' });
    }
    return Object.freeze({ kind: 'ready' });
  };

  const snapshot = (): KanbanConfigurationSessionSnapshot =>
    Object.freeze({
      record: state.record,
      label: state.label,
      ...(disambiguator === undefined ? {} : { disambiguator }),
      ...(definitionOfDone === undefined ? {} : { definitionOfDone }),
      ...(wip === undefined ? {} : { wip }),
      ...(style === undefined ? {} : { style }),
      ...(data === undefined ? {} : { data }),
      dirty: state.dirty,
      submission: state.submission,
      ...(state.code === undefined ? {} : { code: state.code }),
      ...(state.diagnostics === undefined ? {} : { diagnostics: state.diagnostics }),
      ...(state.operationId === undefined ? {} : { operationId: state.operationId }),
      ...(state.focusTarget === undefined ? {} : { focusTarget: state.focusTarget }),
      ...(deletionSnapshot() === undefined ? {} : { deletion: deletionSnapshot() }),
    });
  const publish = (): void => {
    const current = snapshot();
    for (const listener of [...listeners]) {
      try {
        listener(current);
      } catch {
        // One application observer cannot prevent the dialog or sibling observers from progressing.
      }
    }
  };
  const refreshDirty = (): void => {
    state.dirty =
      state.label !== state.baselineLabel ||
      disambiguator !== baselineDisambiguator ||
      definitionOfDone?.summary !== baselineDefinitionOfDone?.summary ||
      definitionOfDone?.details !== baselineDefinitionOfDone?.details ||
      wip?.minimum !== baselineWip?.minimum ||
      wip?.maximum !== baselineWip?.maximum ||
      wip?.mode !== baselineWip?.mode ||
      wip?.countDone !== baselineWip?.countDone ||
      style?.role !== baselineStyle?.role ||
      dataDirty ||
      positionDirty;
  };
  const rebase = (next: KanbanConfigurationSnapshot): void => {
    structure = createKanbanConfigurationSnapshot(next);
    const label = operationLabel(options.operation, structure);
    state.label = label;
    state.baselineLabel = label;
    state.dirty = false;
    state.record = 'ready';
    state.submission = 'idle';
    delete state.code;
    delete state.diagnostics;
    delete state.operationId;
    delete state.focusTarget;
    const selectedOperation = options.operation;
    const currentEntity =
      selectedOperation.kind === 'update'
        ? 'columnId' in selectedOperation
          ? structure.columns.find((column) => column.columnId === selectedOperation.columnId)
          : structure.swimlanes.find((swimlane) => swimlane.swimlaneId === selectedOperation.swimlaneId)
        : undefined;
    disambiguator = currentEntity?.disambiguator;
    baselineDisambiguator = disambiguator;
    definitionOfDone =
      'columnId' in selectedOperation && selectedOperation.kind === 'update'
        ? structure.columns.find((column) => column.columnId === selectedOperation.columnId)?.definitionOfDone
        : undefined;
    baselineDefinitionOfDone = definitionOfDone;
    wip = currentEntity !== undefined && 'wip' in currentEntity ? currentEntity.wip : undefined;
    baselineWip = wip;
    style = currentEntity?.style;
    baselineStyle = style;
    data = currentEntity?.data;
    baselineData = data;
    dataDirty = false;
    positionDirty = false;
  };
  const publication = (next: KanbanConfigurationSnapshot): void => {
    if (disposed) return;
    // A committed session is terminal. Later board publications belong to a future session and
    // must not reopen this draft or make a second authority request possible.
    if (state.submission === 'committed') return;
    try {
      const validated = createKanbanConfigurationSnapshot(next);
      if (state.record === 'loading') {
        publicationDuringResolve = validated;
        return;
      }
      if (state.submission === 'dispatching') {
        publicationDuringDispatch = validated;
      } else if (state.submission === 'awaiting-publication' && expectedPublication !== undefined) {
        const outcome = publicationOutcome(options.operation, structure, validated, expectedPublication);
        if (outcome === 'committed') {
          state.focusTarget = deletionFocusTarget(options.operation, structure, validated);
          structure = validated;
          state.record = 'ready';
          state.dirty = false;
          state.submission = 'committed';
          expectedPublication = undefined;
          workController = undefined;
        } else if (outcome === 'contradictory') {
          structure = validated;
          state.record = 'stale';
          state.submission = 'idle';
          expectedPublication = undefined;
          workController?.abort();
          workController = undefined;
          delete state.operationId;
        }
      } else if (state.dirty) {
        structure = validated;
        state.record = 'stale';
      } else {
        rebase(validated);
      }
    } catch {
      state.record = 'unavailable';
    }
    publish();
  };

  let unsubscribe: () => void;
  try {
    unsubscribe = options.source.subscribe(publication);
    if (typeof unsubscribe !== 'function') return invalidSession();
  } catch {
    return invalidSession();
  }
  const releaseOwned = (): void => {
    if (disposed) return;
    disposed = true;
    generation += 1;
    workController?.abort();
    lifetimeController.abort();
    listeners.clear();
    try {
      unsubscribe();
    } catch {
      // A hostile source disposer cannot keep the session or dialog alive.
    }
  };
  const abortLifetime = (): void => releaseOwned();
  if (options.signal?.aborted === true) abortLifetime();
  else options.signal?.addEventListener('abort', abortLifetime, { once: true });
  try {
    const pending = options.source.resolve(Object.freeze({ signal: lifetimeController.signal }));
    const awaited = await awaitEditorWork(pending, lifetimeController.signal);
    if (awaited.kind !== 'value') return invalidSession();
    const resolved = createKanbanConfigurationSnapshot(awaited.value);
    structure = publicationDuringResolve ?? resolved;
    publicationDuringResolve = undefined;
    rebase(structure);
  } catch {
    releaseOwned();
    options.signal?.removeEventListener('abort', abortLifetime);
    return invalidSession();
  }

  return Object.freeze({
    operation: () => options.operation,
    snapshot,
    setLabel(input: unknown): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed'
      ) {
        return false;
      }
      try {
        const nextLabel = normalizeKanbanConfigurationName(input).label;
        if (nextLabel === state.label) return true;
        state.label = nextLabel;
        refreshDirty();
        state.submission = 'idle';
        delete state.code;
        delete state.diagnostics;
        publish();
        return true;
      } catch {
        state.code = 'invalid-name';
        publish();
        return false;
      }
    },
    setDisambiguator(input: unknown): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed'
      ) {
        return false;
      }
      try {
        const nextDisambiguator =
          input === undefined || input === '' ? undefined : normalizeKanbanConfigurationName(input).label;
        if (nextDisambiguator === disambiguator) return true;
        disambiguator = nextDisambiguator;
        refreshDirty();
        state.submission = 'idle';
        delete state.code;
        delete state.diagnostics;
        publish();
        return true;
      } catch {
        state.code = 'invalid-disambiguator';
        publish();
        return false;
      }
    },
    setDefinitionOfDone(summary: unknown, details?: unknown): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed' ||
        !('columnId' in options.operation) ||
        options.operation.kind === 'reorder' ||
        options.operation.kind === 'delete'
      ) {
        return false;
      }
      try {
        const nextDefinition =
          summary === undefined || summary === ''
            ? undefined
            : snapshotKanbanDefinitionOfDone({
                summary,
                ...(details === undefined || details === '' ? {} : { details }),
              });
        if (
          nextDefinition?.summary === definitionOfDone?.summary &&
          nextDefinition?.details === definitionOfDone?.details
        ) {
          return true;
        }
        definitionOfDone = nextDefinition;
        refreshDirty();
        state.submission = 'idle';
        delete state.code;
        delete state.diagnostics;
        publish();
        return true;
      } catch {
        state.code = 'invalid-definition-of-done';
        publish();
        return false;
      }
    },
    setWip(input: unknown): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed' ||
        !('columnId' in options.operation) ||
        options.operation.kind === 'reorder' ||
        options.operation.kind === 'delete'
      )
        return false;
      try {
        const nextWip = input === undefined ? undefined : snapshotKanbanConfigurationWipPolicy(input);
        if (JSON.stringify(nextWip) === JSON.stringify(wip)) return true;
        wip = nextWip;
        refreshDirty();
        state.submission = 'idle';
        delete state.code;
        delete state.diagnostics;
        publish();
        return true;
      } catch {
        state.code = 'invalid-wip-policy';
        publish();
        return false;
      }
    },
    setStyle(input: unknown): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed' ||
        options.operation.kind === 'reorder' ||
        options.operation.kind === 'delete'
      )
        return false;
      try {
        const nextStyle = input === undefined ? undefined : snapshotKanbanConfigurationStyle(input);
        if (nextStyle?.role === style?.role) return true;
        style = nextStyle;
        refreshDirty();
        state.submission = 'idle';
        delete state.code;
        delete state.diagnostics;
        publish();
        return true;
      } catch {
        state.code = 'invalid-style';
        publish();
        return false;
      }
    },
    setData(input: unknown): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed' ||
        options.operation.kind === 'reorder' ||
        options.operation.kind === 'delete'
      ) {
        return false;
      }
      try {
        const nextData = input === undefined ? undefined : snapshotKanbanSemanticValue(input);
        if (JSON.stringify(nextData) === JSON.stringify(data)) return true;
        data = nextData;
        dataDirty = JSON.stringify(data) !== JSON.stringify(baselineData);
        refreshDirty();
        state.submission = 'idle';
        delete state.code;
        delete state.diagnostics;
        publish();
        return true;
      } catch {
        state.code = 'invalid-application-data';
        publish();
        return false;
      }
    },
    setPosition(next: Parameters<KanbanConfigurationSession['setPosition']>[0]): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed'
      ) {
        return false;
      }
      position = next;
      positionDirty = true;
      refreshDirty();
      state.submission = 'idle';
      delete state.code;
      delete state.diagnostics;
      publish();
      return true;
    },
    reorderDestinations: () => reorderDestinations(options.operation, structure),
    deletionDestinations: () => deletionDestinations(options.operation, structure),
    setDeletionDestination(destinationId: unknown): boolean {
      if (
        disposed ||
        state.record === 'unavailable' ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed' ||
        options.operation.kind !== 'delete' ||
        typeof destinationId !== 'string' ||
        !deletionDestinations(options.operation, structure).some(
          (destination) => destination.destinationId === destinationId,
        )
      ) {
        return false;
      }
      selectedDeletionPolicy = Object.freeze({ kind: 'reassign', destinationId });
      state.dirty = true;
      state.submission = 'idle';
      delete state.code;
      delete state.diagnostics;
      publish();
      return true;
    },
    async apply(): Promise<KanbanConfigurationSessionApplyResult> {
      if (disposed) return Object.freeze({ kind: 'disposed' });
      if (state.record === 'stale') return Object.freeze({ kind: 'stale' });
      if (state.record !== 'ready') return Object.freeze({ kind: 'unavailable' });
      if (state.submission === 'committed') {
        return state.operationId === undefined
          ? Object.freeze({ kind: 'failed' })
          : Object.freeze({ kind: 'committed', operationId: state.operationId });
      }
      if (state.submission === 'dispatching' || state.submission === 'awaiting-publication') {
        return Object.freeze({ kind: 'failed' });
      }
      let proposal: KanbanRequestProposal;
      try {
        proposal = proposalFor(
          options.operation,
          structure,
          {
            label: state.label,
            ...(disambiguator === undefined ? {} : { disambiguator }),
            ...(definitionOfDone === undefined ? {} : { definitionOfDone }),
            definitionOfDoneChanged:
              definitionOfDone?.summary !== baselineDefinitionOfDone?.summary ||
              definitionOfDone?.details !== baselineDefinitionOfDone?.details,
            ...(wip === undefined ? {} : { wip }),
            wipChanged:
              wip?.minimum !== baselineWip?.minimum ||
              wip?.maximum !== baselineWip?.maximum ||
              wip?.mode !== baselineWip?.mode ||
              wip?.countDone !== baselineWip?.countDone,
            ...(style === undefined ? {} : { style }),
            styleChanged: style?.role !== baselineStyle?.role,
            ...(data === undefined ? {} : { data }),
            dataChanged: dataDirty,
          },
          position,
          selectedDeletionPolicy,
        );
      } catch {
        state.code = 'invalid-draft';
        publish();
        return Object.freeze({ kind: 'failed' });
      }
      if (options.authority === undefined) return Object.freeze({ kind: 'proposal', proposal });
      const ownGeneration = ++generation;
      const baseline = structure;
      workController?.abort();
      const controller = new AbortController();
      workController = controller;
      const abortWork = (): void => controller.abort();
      lifetimeController.signal.addEventListener('abort', abortWork, { once: true });
      state.submission = 'dispatching';
      delete state.code;
      delete state.diagnostics;
      publicationDuringDispatch = undefined;
      publish();
      try {
        const requested = options.authority.request(
          proposal,
          Object.freeze({
            boardRevision: baseline.revision,
            entities: authorityEntities(options.operation, baseline, proposal),
            signal: controller.signal,
          }),
        );
        const pending = requested instanceof Promise ? requested : Promise.resolve(requested);
        const awaited = await awaitEditorWork(pending, controller.signal);
        if (awaited.kind !== 'value') throw new Error('request-interrupted');
        const result = applicationResult(awaited.value);
        if (disposed || ownGeneration !== generation) return Object.freeze({ kind: 'disposed' });
        if (result.kind === 'accepted') {
          if (result.publication === undefined) {
            state.submission = 'rejected';
            state.code = 'publication-required';
            publish();
            return Object.freeze({ kind: 'rejected', code: state.code });
          }
          const subject = operationSubject(options.operation, result.publication);
          if (subject === undefined) throw new Error('publication-subject-missing');
          if (options.operation.kind !== 'add') {
            const baselineEntity =
              subject.kind === 'column'
                ? baseline.columns.find((entry) => entry.columnId === subject.columnId)
                : subject.kind === 'swimlane'
                  ? baseline.swimlanes.find((entry) => entry.swimlaneId === subject.swimlaneId)
                  : undefined;
            if (
              baselineEntity === undefined ||
              !kanbanRevisionsEqual(baselineEntity.revision, subject.baselineRevision)
            ) {
              throw new Error('publication-baseline-mismatch');
            }
          }
          const current = publicationDuringDispatch;
          if (current !== undefined) {
            const outcome = publicationOutcome(options.operation, baseline, current, result.publication);
            if (outcome === 'committed') {
              state.focusTarget = deletionFocusTarget(options.operation, baseline, current);
              structure = current;
              state.record = 'ready';
              state.dirty = false;
              state.submission = 'committed';
              state.operationId = result.operationId;
              publish();
              return Object.freeze({ kind: 'committed', operationId: result.operationId });
            }
            if (outcome === 'contradictory') {
              structure = current;
              state.record = 'stale';
              state.submission = 'idle';
              publish();
              return Object.freeze({ kind: 'stale' });
            }
          }
          expectedPublication = result.publication;
          state.operationId = result.operationId;
          state.submission = 'awaiting-publication';
          publish();
          return Object.freeze({ kind: 'awaiting-publication', operationId: result.operationId });
        }
        state.submission = 'rejected';
        state.code = result.code ?? result.kind;
        state.diagnostics = result.kind === 'rejected' ? result.fieldErrors : undefined;
        publish();
        return Object.freeze({ kind: 'rejected', code: state.code });
      } catch {
        if (disposed || ownGeneration !== generation) return Object.freeze({ kind: 'disposed' });
        state.submission = 'rejected';
        state.code = 'request-failed';
        publish();
        return Object.freeze({ kind: 'rejected', code: state.code });
      } finally {
        lifetimeController.signal.removeEventListener('abort', abortWork);
        if (workController === controller && state.submission !== 'awaiting-publication') workController = undefined;
      }
    },
    async reload(): Promise<boolean> {
      if (
        disposed ||
        state.submission === 'dispatching' ||
        state.submission === 'awaiting-publication' ||
        state.submission === 'committed'
      )
        return false;
      const ownGeneration = ++generation;
      workController?.abort();
      const controller = new AbortController();
      workController = controller;
      const abortWork = (): void => controller.abort();
      lifetimeController.signal.addEventListener('abort', abortWork, { once: true });
      try {
        const pending = options.source.resolve(Object.freeze({ signal: controller.signal }));
        const awaited = await awaitEditorWork(pending, controller.signal);
        if (awaited.kind !== 'value') return false;
        const resolved = createKanbanConfigurationSnapshot(awaited.value);
        if (disposed || ownGeneration !== generation) return false;
        rebase(resolved);
        publish();
        return true;
      } catch {
        if (!disposed && ownGeneration === generation) {
          state.record = 'unavailable';
          publish();
        }
        return false;
      } finally {
        lifetimeController.signal.removeEventListener('abort', abortWork);
        if (workController === controller) workController = undefined;
      }
    },
    subscribe(listener: (current: KanbanConfigurationSessionSnapshot) => void): () => void {
      if (disposed || typeof listener !== 'function' || listeners.size >= MAXIMUM_LISTENERS) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      options.signal?.removeEventListener('abort', abortLifetime);
      releaseOwned();
    },
    disposed: () => disposed,
  });
}
