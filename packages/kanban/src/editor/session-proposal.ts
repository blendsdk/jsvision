import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import type { KanbanRequestProposal } from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type {
  KanbanCardEditorAdapter,
  KanbanEditorMode,
  KanbanEditorPrepareResult,
  KanbanEditorRecordState,
  KanbanEditorResult,
} from './types.js';

/** Prepared result and validated proposal retained until dispatch or result-only detachment. */
export interface PreparedKanbanEditorSubmission<TDraft> {
  /** Internal success discriminator. */
  readonly kind: 'ready';
  /** Typed result-only payload supplied to an application detacher. */
  readonly result: Extract<KanbanEditorPrepareResult<TDraft>, { readonly kind: 'prepared' }>;
  /** Validated lifecycle-free request proposal used only by authority completion. */
  readonly proposal: KanbanRequestProposal;
  /** Submission generation that must remain authoritative. */
  readonly generation: number;
  /** Cancellation owner for this validation and dispatch generation. */
  readonly controller: AbortController;
}

/** Internal preparation result used by both authority and result-only completion paths. */
export type KanbanEditorPreparation<TDraft> =
  PreparedKanbanEditorSubmission<TDraft> | Exclude<KanbanEditorPrepareResult<TDraft>, { readonly kind: 'prepared' }>;

/** Inputs required to create one bounded editor result and exact proposal. */
export interface PrepareKanbanEditorProposalOptions<TCard, TDraft> {
  /** Adapter that owns the typed proposal mapping. */
  readonly adapter: KanbanCardEditorAdapter<TCard, TDraft>;
  /** Current typed session draft. */
  readonly draft: TDraft;
  /** Already bounded semantic representation of the draft. */
  readonly snapshot: KanbanSemanticValue;
  /** Schema-ordered fields changed from the baseline. */
  readonly changedFieldIds: readonly KanbanFieldId[];
  /** Optional baseline revision for full edit evidence. */
  readonly baseRevision?: KanbanRevision;
  /** Current create or edit policy. */
  readonly mode: KanbanEditorMode;
  /** Existing card identity or provisional create claim. */
  readonly cardKey: CardKey;
}

/** Creates one typed result and validates its adapter-produced request proposal. */
export function prepareKanbanEditorProposal<TCard, TDraft>(
  options: PrepareKanbanEditorProposalOptions<TCard, TDraft>,
): { readonly result: KanbanEditorResult<TDraft>; readonly proposal: KanbanRequestProposal } {
  const result = Object.freeze({
    draft: options.draft,
    snapshot: options.snapshot,
    changedFieldIds: options.changedFieldIds,
    ...(options.baseRevision === undefined ? {} : { baseRevision: options.baseRevision }),
  });
  const proposed = options.adapter.proposal(result);
  const proposal = snapshotKanbanRequestProposal(
    proposed.kind === 'card-update' && options.baseRevision !== undefined
      ? {
          ...proposed,
          editor: {
            kind: 'full-draft',
            changedFieldIds: options.changedFieldIds,
            baseRevision: options.baseRevision,
          },
        }
      : proposed,
  );
  if (
    (options.mode === 'edit' && (proposal.kind !== 'card-update' || !Object.is(proposal.cardKey, options.cardKey))) ||
    (options.mode === 'create' && proposal.kind !== 'card-create')
  ) {
    throw new KanbanInvalidSemanticValueError();
  }
  return Object.freeze({ result, proposal });
}

/** Maps an interrupted preparation to the current payload-free record outcome. */
export function interruptedKanbanEditorPreparationResult<TDraft>(
  disposed: boolean,
  record: KanbanEditorRecordState,
): Exclude<KanbanEditorPrepareResult<TDraft>, { readonly kind: 'prepared' }> {
  if (disposed) return Object.freeze({ kind: 'disposed' });
  if (record.kind === 'stale') return Object.freeze({ kind: 'stale' });
  if (record.kind === 'deleted') return Object.freeze({ kind: 'deleted' });
  if (record.kind === 'unavailable') return Object.freeze({ kind: 'unavailable' });
  return Object.freeze({ kind: 'failed' });
}
