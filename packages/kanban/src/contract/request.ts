import type { KanbanRequestContext } from './capability.js';
import type {
  CardKey,
  KanbanColumnId,
  KanbanExtensionId,
  KanbanFieldId,
  KanbanOperationId,
  KanbanSwimlaneId,
  KanbanViewId,
  PlacementToken,
} from './identity.js';
import type { KanbanRevision } from './revision.js';
import type { KanbanSemanticValue } from './semantic-query.js';
import type {
  KanbanCellAddress,
  KanbanDefinitionOfDone,
  KanbanStructureStyle,
  KanbanWipPolicy,
} from '../source/types.js';
import type { KanbanUndoDescriptor } from '../operation/types.js';

/** Captured card revision required by an application request. */
export interface KanbanExpectedCardRevision {
  /** Entity discriminator used for exact validation. */
  readonly kind: 'card';
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Equality-only revision captured before admission. */
  readonly revision: KanbanRevision;
}

/** Captured workflow-column revision required by an application request. */
export interface KanbanExpectedColumnRevision {
  /** Entity discriminator used for exact validation. */
  readonly kind: 'column';
  /** Stable workflow-column identity. */
  readonly columnId: KanbanColumnId;
  /** Equality-only revision captured before admission. */
  readonly revision: KanbanRevision;
}

/** Captured swimlane revision required by an application request. */
export interface KanbanExpectedSwimlaneRevision {
  /** Entity discriminator used for exact validation. */
  readonly kind: 'swimlane';
  /** Stable explicit-swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Equality-only revision captured before admission. */
  readonly revision: KanbanRevision;
}

/** One typed entity revision captured before a request reaches application code. */
export type KanbanExpectedEntityRevision =
  KanbanExpectedCardRevision | KanbanExpectedColumnRevision | KanbanExpectedSwimlaneRevision;

/** Equality-only revisions captured with an application request. */
export interface KanbanRequestExpectedRevisions {
  /** Optional board-wide equality revision. */
  readonly board?: KanbanRevision;
  /** Optional source-session equality revision. */
  readonly source?: KanbanRevision;
  /** Optional active-query equality revision. */
  readonly query?: KanbanRevision;
  /** Bounded entity revisions that must still match before dispatch. */
  readonly entities?: readonly KanbanExpectedEntityRevision[];
}

/** Package-owned lifecycle values added to a validated proposal immediately before dispatch. */
export interface KanbanRequestLifecycle {
  /** Unique operation identity allocated or adopted for this dispatch. */
  readonly operationId: KanbanOperationId;
  /** Equality-only authority snapshot captured before application code runs. */
  readonly expected: KanbanRequestExpectedRevisions;
  /** Live cancellation signal owned by the operation coordinator. */
  readonly signal: AbortSignal;
}

/** Source placement and revision evidence captured for one card in an atomic move. */
export interface KanbanMovedCardSnapshot {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Semantic source cell before the move. */
  readonly source: KanbanCellAddress;
  /** Source-issued semantic placement at capture time. */
  readonly sourcePlacement: KanbanMovePosition;
  /** Equality-only source-cell revision captured with the placement. */
  readonly sourceRevision: KanbanRevision;
  /** Equality-only card revision captured with the placement. */
  readonly entityRevision: KanbanRevision;
}

/** Dispatchable semantic destination that never treats a visual index or generated rank as authority. */
export type KanbanMovePosition =
  | { readonly kind: 'start'; readonly cursorRevision: KanbanRevision }
  | { readonly kind: 'end'; readonly cursorRevision: KanbanRevision }
  | {
      readonly kind: 'between';
      readonly beforeCardKey: CardKey | null;
      readonly afterCardKey: CardKey | null;
      readonly cursorRevision: KanbanRevision;
    }
  | {
      readonly kind: 'window-edge';
      readonly edge: 'before' | 'after';
      readonly neighborCardKey: CardKey;
      readonly token: PlacementToken;
      readonly cursorRevision: KanbanRevision;
    };

/** Add one application-schema card to a semantic cell. */
export interface KanbanCardCreateProposal {
  /** Request discriminator. */
  readonly kind: 'card-create';
  /** Semantic destination cell for the new card. */
  readonly target: KanbanCellAddress;
  /** Bounded application-schema data used to create the card. */
  readonly draft: KanbanSemanticValue;
}

/** Patch one application-schema card without exposing its record to the component. */
export interface KanbanCardUpdateProposal {
  /** Request discriminator. */
  readonly kind: 'card-update';
  /** Stable identity of the card to update. */
  readonly cardKey: CardKey;
  /** Bounded application-schema patch data. */
  readonly patch: KanbanSemanticValue;
  /** Optional exact evidence that identifies an editor-produced full-draft update. */
  readonly editor?: KanbanEditorUpdateEvidence;
}

/** Exact evidence carried only when a card update patch is a complete editor draft. */
export interface KanbanEditorUpdateEvidence {
  /** Evidence discriminator that distinguishes full drafts from legacy sparse patches. */
  readonly kind: 'full-draft';
  /** Schema-ordered field identities whose values differ from the editor baseline. */
  readonly changedFieldIds: readonly KanbanFieldId[];
  /** Equality-only card revision captured when the editor draft opened. */
  readonly baseRevision: KanbanRevision;
}

/** Duplicate one card into an exact semantic destination. */
export interface KanbanCardDuplicateProposal {
  /** Request discriminator. */
  readonly kind: 'card-duplicate';
  /** Stable identity of the source card. */
  readonly cardKey: CardKey;
  /** Semantic destination cell for the copy. */
  readonly target: KanbanCellAddress;
  /** Revision-bound semantic destination interval. */
  readonly position: KanbanMovePosition;
}

/** Archive one card through application-owned persistence. */
export interface KanbanCardArchiveProposal {
  /** Request discriminator. */
  readonly kind: 'card-archive';
  /** Stable identity of the card to archive. */
  readonly cardKey: CardKey;
}

/** Permanently delete one card through application-owned persistence. */
export interface KanbanCardDeleteProposal {
  /** Request discriminator. */
  readonly kind: 'card-delete';
  /** Stable identity of the card to delete permanently. */
  readonly cardKey: CardKey;
}

/** Move one ordered, non-empty atomic card set to one semantic destination. */
export interface KanbanCardMoveProposal {
  /** Request discriminator. */
  readonly kind: 'card-move';
  /** Ordered non-empty atomic card set with captured source evidence. */
  readonly moved: readonly KanbanMovedCardSnapshot[];
  /** Semantic destination cell shared by the atomic card set. */
  readonly target: KanbanCellAddress;
  /** Revision-bound semantic destination interval. */
  readonly position: KanbanMovePosition;
  /** Optional projection revision that must remain current. */
  readonly viewRevision?: KanbanRevision;
}

/** Caller-facing namespaced extension proposal without coordinator-owned lifecycle fields. */
export interface KanbanExtensionRequestProposal<
  TType extends KanbanExtensionId = KanbanExtensionId,
  TPayload extends KanbanSemanticValue = KanbanSemanticValue,
> {
  /** Request discriminator. */
  readonly kind: 'extension';
  /** Namespaced application extension identity. */
  readonly extensionId: TType;
  /** Bounded application-owned extension data. */
  readonly payload: TPayload;
}

/** Card and extension proposals implemented independently of structural editing. */
export type KanbanCardRequestProposal =
  | KanbanCardCreateProposal
  | KanbanCardUpdateProposal
  | KanbanCardDuplicateProposal
  | KanbanCardArchiveProposal
  | KanbanCardDeleteProposal
  | KanbanCardMoveProposal;

/** Semantic placement of one workflow column among stable neighboring column identities. */
export type KanbanColumnPosition =
  | { readonly kind: 'start' }
  | { readonly kind: 'end' }
  | {
      readonly kind: 'between';
      readonly beforeColumnId: KanbanColumnId | null;
      readonly afterColumnId: KanbanColumnId | null;
    };

/** Semantic placement of one swimlane relative to a stable neighboring swimlane identity. */
export type KanbanSwimlanePosition =
  | { readonly kind: 'start' }
  | { readonly kind: 'end' }
  | { readonly kind: 'before'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'after'; readonly swimlaneId: KanbanSwimlaneId };

/** Generic application-owned workflow-column draft with package-validated identity and label. */
export interface KanbanColumnDraft {
  /** Stable identity proposed for the new workflow column. */
  readonly columnId: KanbanColumnId;
  /** Safe human-readable column label. */
  readonly label: string;
  /** Optional visible text distinguishing an application-approved duplicate label. */
  readonly disambiguator?: string;
  /** Optional safe completion policy presented by column help and configuration UI. */
  readonly definitionOfDone?: KanbanDefinitionOfDone;
  /** Optional application-authoritative workflow count policy. */
  readonly wip?: KanbanWipPolicy;
  /** Optional allowlisted semantic surface style. */
  readonly style?: KanbanStructureStyle;
  /** Optional bounded application-owned column metadata. */
  readonly data?: KanbanSemanticValue;
}

/** Generic application-owned swimlane draft with package-validated identity and label. */
export interface KanbanSwimlaneDraft {
  /** Stable identity proposed for the new explicit swimlane. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Safe human-readable swimlane label. */
  readonly label: string;
  /** Optional visible text distinguishing an application-approved duplicate label. */
  readonly disambiguator?: string;
  /** Optional allowlisted semantic surface style. */
  readonly style?: KanbanStructureStyle;
  /** Optional bounded application-owned swimlane metadata. */
  readonly data?: KanbanSemanticValue;
}

/** Add one workflow column at a semantic structural position. */
export interface KanbanColumnAddProposal {
  /** Request discriminator. */
  readonly kind: 'column-add';
  /** Validated generic column definition. */
  readonly draft: KanbanColumnDraft;
  /** Stable-neighbor structural destination. */
  readonly position: KanbanColumnPosition;
}

/** Patch one workflow column through application-owned policy. */
export interface KanbanColumnUpdateProposal {
  /** Request discriminator. */
  readonly kind: 'column-update';
  /** Stable identity of the column to update. */
  readonly columnId: KanbanColumnId;
  /** Bounded application-schema patch data. */
  readonly patch: KanbanSemanticValue;
}

/** Reorder one workflow column without a numeric index or generated rank. */
export interface KanbanColumnReorderProposal {
  /** Request discriminator. */
  readonly kind: 'column-reorder';
  /** Stable identity of the column to move. */
  readonly columnId: KanbanColumnId;
  /** Stable-neighbor structural destination. */
  readonly position: KanbanColumnPosition;
}

/** Delete one workflow column with an optional application-authorized card reassignment target. */
export interface KanbanColumnDeleteProposal {
  /** Request discriminator. */
  readonly kind: 'column-delete';
  /** Stable identity of the column to delete. */
  readonly columnId: KanbanColumnId;
  /** Optional application-authorized destination for affected cards. */
  readonly reassignTo?: KanbanColumnId;
}

/** Add one explicit swimlane at a semantic structural position. */
export interface KanbanSwimlaneAddProposal {
  /** Request discriminator. */
  readonly kind: 'swimlane-add';
  /** Validated generic explicit-swimlane definition. */
  readonly draft: KanbanSwimlaneDraft;
  /** Stable-neighbor structural destination. */
  readonly position: KanbanSwimlanePosition;
}

/** Patch one explicit swimlane through application-owned policy. */
export interface KanbanSwimlaneUpdateProposal {
  /** Request discriminator. */
  readonly kind: 'swimlane-update';
  /** Stable identity of the swimlane to update. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Bounded application-schema patch data. */
  readonly patch: KanbanSemanticValue;
}

/** Reorder one explicit swimlane without a numeric index or generated rank. */
export interface KanbanSwimlaneReorderProposal {
  /** Request discriminator. */
  readonly kind: 'swimlane-reorder';
  /** Stable identity of the swimlane to move. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Stable-neighbor structural destination. */
  readonly position: KanbanSwimlanePosition;
}

/** Delete one explicit swimlane with an optional application-authorized reassignment target. */
export interface KanbanSwimlaneDeleteProposal {
  /** Request discriminator. */
  readonly kind: 'swimlane-delete';
  /** Stable identity of the swimlane to delete. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Optional application-authorized destination for affected cards. */
  readonly reassignTo?: KanbanSwimlaneId;
}

/** Save or replace one application-owned semantic view definition. */
export interface KanbanSavedViewSaveProposal {
  /** Request discriminator. */
  readonly kind: 'saved-view-save';
  /** Stable application-owned view identity. */
  readonly viewId: KanbanViewId;
  /** Bounded semantic view definition. */
  readonly data: KanbanSemanticValue;
}

/** Rename one application-owned saved view. */
export interface KanbanSavedViewRenameProposal {
  /** Request discriminator. */
  readonly kind: 'saved-view-rename';
  /** Stable application-owned view identity. */
  readonly viewId: KanbanViewId;
  /** Safe human-readable replacement label. */
  readonly label: string;
}

/** Delete one application-owned saved view. */
export interface KanbanSavedViewDeleteProposal {
  /** Request discriminator. */
  readonly kind: 'saved-view-delete';
  /** Stable application-owned view identity. */
  readonly viewId: KanbanViewId;
}

/** Structural standard proposals for columns and explicit swimlanes. */
export type KanbanStructureRequestProposal =
  | KanbanColumnAddProposal
  | KanbanColumnUpdateProposal
  | KanbanColumnReorderProposal
  | KanbanColumnDeleteProposal
  | KanbanSwimlaneAddProposal
  | KanbanSwimlaneUpdateProposal
  | KanbanSwimlaneReorderProposal
  | KanbanSwimlaneDeleteProposal;

/** Saved-view standard proposals defined for later package-owned view UI. */
export type KanbanSavedViewRequestProposal =
  KanbanSavedViewSaveProposal | KanbanSavedViewRenameProposal | KanbanSavedViewDeleteProposal;

/** Generic namespaced application-extension request. */
export interface KanbanExtensionRequest<
  TType extends KanbanExtensionId = KanbanExtensionId,
  TPayload extends KanbanSemanticValue = KanbanSemanticValue,
> {
  /** Request discriminator. */
  readonly kind: 'extension';
  /** Namespaced application extension identity. */
  readonly extensionId: TType;
  /** Caller-provided legacy operation identity adopted by the coordinator. */
  readonly operationId: KanbanOperationId;
  /** Equality-only authority captured by the legacy caller. */
  readonly expected: KanbanRequestExpectedRevisions;
  /** Bounded application-owned extension data. */
  readonly payload: TPayload;
  /** Live legacy cancellation signal adopted for this operation. */
  readonly signal: AbortSignal;
}

/** Complete caller-facing standard and namespaced-extension proposal union. */
export type KanbanRequestProposal =
  | KanbanCardRequestProposal
  | KanbanStructureRequestProposal
  | KanbanSavedViewRequestProposal
  | KanbanExtensionRequestProposal;

/** Final package-owned standard dispatch envelope. */
export type KanbanStandardRequest = (
  KanbanCardRequestProposal | KanbanStructureRequestProposal | KanbanSavedViewRequestProposal
) &
  KanbanRequestLifecycle;

/** Final request union accepted by the application dispatcher. */
export type KanbanRequest = KanbanStandardRequest | KanbanExtensionRequest;

/** Publication metadata returned with an accepted request result. */
export interface KanbanRequestAccepted {
  /** Result discriminator. */
  readonly kind: 'accepted';
  /** Identity of the operation being acknowledged. */
  readonly operationId: KanbanOperationId;
  /** Optional authoritative publication expected before commit. */
  readonly publication?: KanbanPublicationExpectation;
  /** Optional application-owned descriptor retained only after authoritative commit. */
  readonly undo?: KanbanUndoDescriptor;
}

/** Sanitized application rejection. */
export interface KanbanRequestRejected {
  /** Result discriminator. */
  readonly kind: 'rejected';
  /** Identity of the rejected operation. */
  readonly operationId: KanbanOperationId;
  /** Safe machine-readable reason code. */
  readonly code: string;
  /** Optional sanitized application-facing reason label. */
  readonly label?: string;
  /** Optional bounded field-specific failures used by editor sessions. */
  readonly fieldErrors?: readonly KanbanFieldRejection[];
}

/** One sanitized field-specific application rejection. */
export interface KanbanFieldRejection {
  /** Stable schema field identity. */
  readonly fieldId: KanbanFieldId;
  /** Safe machine-readable field failure code. */
  readonly code: string;
  /** Optional sanitized application-facing field label. */
  readonly label?: string;
}

/** Explicit cancellation outcome, distinct from rejection and supersession. */
export interface KanbanRequestCancelled {
  /** Result discriminator. */
  readonly kind: 'cancelled';
  /** Identity of the cancelled operation. */
  readonly operationId: KanbanOperationId;
  /** Optional safe machine-readable reason code. */
  readonly code?: string;
  /** Optional sanitized application-facing reason label. */
  readonly label?: string;
}

/** Outcome indicating that a newer application operation replaced this request. */
export interface KanbanRequestSuperseded {
  /** Result discriminator. */
  readonly kind: 'superseded';
  /** Identity of the superseded operation. */
  readonly operationId: KanbanOperationId;
  /** Optional safe machine-readable reason code. */
  readonly code?: string;
  /** Optional sanitized application-facing reason label. */
  readonly label?: string;
}

/** Terminal operation-correlated result returned by the application dispatcher. */
export type KanbanRequestResult =
  KanbanRequestAccepted | KanbanRequestRejected | KanbanRequestCancelled | KanbanRequestSuperseded;

/** Application-owned dispatcher; capability descriptions never authorize this call. */
export type KanbanRequestDispatcher = (
  request: KanbanRequest,
  context: KanbanRequestContext,
) => KanbanRequestResult | Promise<KanbanRequestResult>;

/** Card publication expected after an accepted application request. */
export interface KanbanCardPublicationSubject {
  readonly kind: 'card';
  readonly cardKey: CardKey;
  readonly baselineRevision: KanbanRevision;
  readonly expectedRevision: KanbanRevision;
}

/** Workflow-column publication expected after an accepted application request. */
export interface KanbanColumnPublicationSubject {
  readonly kind: 'column';
  readonly columnId: KanbanColumnId;
  readonly baselineRevision: KanbanRevision;
  readonly expectedRevision: KanbanRevision;
}

/** Swimlane publication expected after an accepted application request. */
export interface KanbanSwimlanePublicationSubject {
  readonly kind: 'swimlane';
  readonly swimlaneId: KanbanSwimlaneId;
  readonly baselineRevision: KanbanRevision;
  readonly expectedRevision: KanbanRevision;
}

/** One structural subject represented only by safe identity and revision metadata. */
export type KanbanPublicationSubject =
  KanbanCardPublicationSubject | KanbanColumnPublicationSubject | KanbanSwimlanePublicationSubject;

/** Bounded publication metadata retained after an accepted request. */
export interface KanbanPublicationExpectation {
  readonly operationId: KanbanOperationId;
  readonly subjects: readonly KanbanPublicationSubject[];
}

/** Exact operation-correlated confirmation that carries no inferred application semantics. */
export interface KanbanConfirmedPublicationNotice {
  /** Notice discriminator. */
  readonly kind: 'confirmed';
  /** Operation explicitly confirmed by the authoritative application publication. */
  readonly operationId: KanbanOperationId;
}

/** Authoritative subject publication that matches, contradicts, or deletes operation state. */
export interface KanbanSubjectPublicationNotice {
  /** Notice discriminator. */
  readonly kind: 'matching' | 'contradictory' | 'deleted';
  /** Operation explicitly correlated by the application. */
  readonly operationId: KanbanOperationId;
  /** Bounded identity/revision evidence carried by the authoritative publication. */
  readonly subjects: readonly KanbanPublicationSubject[];
}

/** Exact authoritative notice accepted by operation publication reconciliation. */
export type KanbanPublicationNotice = KanbanConfirmedPublicationNotice | KanbanSubjectPublicationNotice;

/** Pure reconciliation result that contains no application records. */
export interface KanbanPublicationReconciliation {
  readonly pending: readonly KanbanPublicationExpectation[];
  readonly cleared?: KanbanPublicationNotice;
}
