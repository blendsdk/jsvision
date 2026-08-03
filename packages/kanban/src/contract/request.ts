import type { KanbanRequestContext } from './capability.js';
import type { CardKey, KanbanColumnId, KanbanExtensionId, KanbanOperationId, KanbanSwimlaneId } from './identity.js';
import type { KanbanRevision } from './revision.js';
import type { KanbanSemanticValue } from './semantic-query.js';

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

/** Current package-owned request union, designed to accept later standard variants. */
export type KanbanRequest = KanbanExtensionRequest;

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
