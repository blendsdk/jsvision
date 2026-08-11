import type { KanbanRequestContext } from './capability.js';
import type {
  CardKey,
  KanbanColumnId,
  KanbanExtensionId,
  KanbanOperationId,
  KanbanSwimlaneId,
  KanbanViewId,
  PlacementToken,
} from './identity.js';
import type { KanbanRevision } from './revision.js';
import type { KanbanSemanticValue } from './semantic-query.js';
import type { KanbanCellAddress, KanbanPlacement } from '../source/types.js';

/** Captured card revision required by an application request. */
export interface KanbanExpectedCardRevision {
  readonly kind: 'card';
  readonly cardKey: CardKey;
  readonly revision: KanbanRevision;
}

/** Captured workflow-column revision required by an application request. */
export interface KanbanExpectedColumnRevision {
  readonly kind: 'column';
  readonly columnId: KanbanColumnId;
  readonly revision: KanbanRevision;
}

/** Captured swimlane revision required by an application request. */
export interface KanbanExpectedSwimlaneRevision {
  readonly kind: 'swimlane';
  readonly swimlaneId: KanbanSwimlaneId;
  readonly revision: KanbanRevision;
}

/** One typed entity revision captured before a request reaches application code. */
export type KanbanExpectedEntityRevision =
  KanbanExpectedCardRevision | KanbanExpectedColumnRevision | KanbanExpectedSwimlaneRevision;

/** Equality-only revisions captured with an application request. */
export interface KanbanRequestExpectedRevisions {
  readonly board?: KanbanRevision;
  readonly source?: KanbanRevision;
  readonly query?: KanbanRevision;
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
  readonly sourcePlacement: KanbanPlacement;
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
  readonly kind: 'card-create';
  readonly target: KanbanCellAddress;
  readonly draft: KanbanSemanticValue;
}

/** Patch one application-schema card without exposing its record to the component. */
export interface KanbanCardUpdateProposal {
  readonly kind: 'card-update';
  readonly cardKey: CardKey;
  readonly patch: KanbanSemanticValue;
}

/** Duplicate one card into an exact semantic destination. */
export interface KanbanCardDuplicateProposal {
  readonly kind: 'card-duplicate';
  readonly cardKey: CardKey;
  readonly target: KanbanCellAddress;
  readonly position: KanbanMovePosition;
}

/** Archive one card through application-owned persistence. */
export interface KanbanCardArchiveProposal {
  readonly kind: 'card-archive';
  readonly cardKey: CardKey;
}

/** Permanently delete one card through application-owned persistence. */
export interface KanbanCardDeleteProposal {
  readonly kind: 'card-delete';
  readonly cardKey: CardKey;
}

/** Move one ordered, non-empty atomic card set to one semantic destination. */
export interface KanbanCardMoveProposal {
  readonly kind: 'card-move';
  readonly moved: readonly KanbanMovedCardSnapshot[];
  readonly target: KanbanCellAddress;
  readonly position: KanbanMovePosition;
  readonly viewRevision?: KanbanRevision;
}

/** Caller-facing namespaced extension proposal without coordinator-owned lifecycle fields. */
export interface KanbanExtensionRequestProposal<
  TType extends KanbanExtensionId = KanbanExtensionId,
  TPayload extends KanbanSemanticValue = KanbanSemanticValue,
> {
  readonly kind: 'extension';
  readonly extensionId: TType;
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
  readonly columnId: KanbanColumnId;
  readonly label: string;
  readonly data?: KanbanSemanticValue;
}

/** Generic application-owned swimlane draft with package-validated identity and label. */
export interface KanbanSwimlaneDraft {
  readonly swimlaneId: KanbanSwimlaneId;
  readonly label: string;
  readonly data?: KanbanSemanticValue;
}

/** Add one workflow column at a semantic structural position. */
export interface KanbanColumnAddProposal {
  readonly kind: 'column-add';
  readonly draft: KanbanColumnDraft;
  readonly position: KanbanColumnPosition;
}

/** Patch one workflow column through application-owned policy. */
export interface KanbanColumnUpdateProposal {
  readonly kind: 'column-update';
  readonly columnId: KanbanColumnId;
  readonly patch: KanbanSemanticValue;
}

/** Reorder one workflow column without a numeric index or generated rank. */
export interface KanbanColumnReorderProposal {
  readonly kind: 'column-reorder';
  readonly columnId: KanbanColumnId;
  readonly position: KanbanColumnPosition;
}

/** Delete one workflow column with an optional application-authorized card reassignment target. */
export interface KanbanColumnDeleteProposal {
  readonly kind: 'column-delete';
  readonly columnId: KanbanColumnId;
  readonly reassignTo?: KanbanColumnId;
}

/** Add one explicit swimlane at a semantic structural position. */
export interface KanbanSwimlaneAddProposal {
  readonly kind: 'swimlane-add';
  readonly draft: KanbanSwimlaneDraft;
  readonly position: KanbanSwimlanePosition;
}

/** Patch one explicit swimlane through application-owned policy. */
export interface KanbanSwimlaneUpdateProposal {
  readonly kind: 'swimlane-update';
  readonly swimlaneId: KanbanSwimlaneId;
  readonly patch: KanbanSemanticValue;
}

/** Reorder one explicit swimlane without a numeric index or generated rank. */
export interface KanbanSwimlaneReorderProposal {
  readonly kind: 'swimlane-reorder';
  readonly swimlaneId: KanbanSwimlaneId;
  readonly position: KanbanSwimlanePosition;
}

/** Delete one explicit swimlane with an optional application-authorized reassignment target. */
export interface KanbanSwimlaneDeleteProposal {
  readonly kind: 'swimlane-delete';
  readonly swimlaneId: KanbanSwimlaneId;
  readonly reassignTo?: KanbanSwimlaneId;
}

/** Save or replace one application-owned semantic view definition. */
export interface KanbanSavedViewSaveProposal {
  readonly kind: 'saved-view-save';
  readonly viewId: KanbanViewId;
  readonly data: KanbanSemanticValue;
}

/** Rename one application-owned saved view. */
export interface KanbanSavedViewRenameProposal {
  readonly kind: 'saved-view-rename';
  readonly viewId: KanbanViewId;
  readonly label: string;
}

/** Delete one application-owned saved view. */
export interface KanbanSavedViewDeleteProposal {
  readonly kind: 'saved-view-delete';
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
  readonly kind: 'extension';
  readonly extensionId: TType;
  readonly operationId: KanbanOperationId;
  readonly expected: KanbanRequestExpectedRevisions;
  readonly payload: TPayload;
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
  readonly kind: 'accepted';
  readonly operationId: KanbanOperationId;
  readonly publication?: KanbanPublicationExpectation;
}

/** Sanitized application rejection. */
export interface KanbanRequestRejected {
  readonly kind: 'rejected';
  readonly operationId: KanbanOperationId;
  readonly code: string;
  readonly label?: string;
}

/** Explicit cancellation outcome, distinct from rejection and supersession. */
export interface KanbanRequestCancelled {
  readonly kind: 'cancelled';
  readonly operationId: KanbanOperationId;
  readonly code?: string;
  readonly label?: string;
}

/** Outcome indicating that a newer application operation replaced this request. */
export interface KanbanRequestSuperseded {
  readonly kind: 'superseded';
  readonly operationId: KanbanOperationId;
  readonly code?: string;
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

/** Authoritative source publication classification used to clear pending metadata. */
export interface KanbanPublicationNotice {
  readonly kind: 'matching' | 'contradictory';
  readonly operationId: KanbanOperationId;
  readonly subjects: readonly KanbanPublicationSubject[];
}

/** Pure reconciliation result that contains no application records. */
export interface KanbanPublicationReconciliation {
  readonly pending: readonly KanbanPublicationExpectation[];
  readonly cleared?: KanbanPublicationNotice;
}
