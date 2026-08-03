import type {
  CardKey,
  KanbanChecklistId,
  KanbanColumnId,
  KanbanExtensionId,
  KanbanExtensionRequest,
  KanbanFieldId,
  KanbanOperationId,
  KanbanRequest,
  KanbanRequestDispatcher,
  KanbanRevision,
  KanbanSwimlaneId,
  KanbanViewId,
} from '../../src/index.js';
// @ts-expect-error The public package must not export an ambiguous KanbanLaneId alias.
import type { KanbanLaneId } from '../../src/index.js';

/** A consumer-owned record that deliberately does not inherit a package card model. */
export interface ConsumerWorkItem {
  readonly workItemId: number;
  readonly bucket: string;
  readonly summary: string;
}

/** Verifies that card keys retain their public string-or-number domain. */
export type ConsumerCardKey = CardKey;

/** Verifies that every semantic identity alias remains available from the public entry. */
export interface ConsumerKanbanIdentities {
  readonly card: CardKey;
  readonly column: KanbanColumnId;
  readonly swimlane: KanbanSwimlaneId;
  readonly field: KanbanFieldId;
  readonly view: KanbanViewId;
  readonly checklist: KanbanChecklistId;
  readonly extension: KanbanExtensionId;
  readonly operation: KanbanOperationId;
  readonly revision: KanbanRevision;
}

/** A namespaced consumer payload accepted by the generic extension envelope. */
export type ConsumerReviewPayload = {
  readonly cardKey: CardKey;
  readonly approved: boolean;
};

/** Verifies that consumers can preserve a literal extension name and payload type. */
export type ConsumerReviewRequest = KanbanExtensionRequest<'example.review', ConsumerReviewPayload>;

/** Verifies that the typed extension envelope remains assignable to the public request union. */
export type ConsumerRequestCompatibility = ConsumerReviewRequest extends KanbanRequest ? true : never;

// @ts-expect-error Functions are outside the immutable semantic payload domain.
export type ConsumerFunctionPayloadMustRemainInvalid = KanbanExtensionRequest<'example.invalid', () => void>;

export const consumerCustomResultMustRemainInvalid: KanbanRequestDispatcher = () => ({
  // @ts-expect-error Dispatchers may return only the four package-owned result variants.
  kind: 'custom',
  operationId: 'review-1',
});

/** Extracts member names that would reintroduce ambiguous bare-lane terminology. */
type BareLaneMember<T> = Extract<keyof T, 'lane' | 'laneId' | 'lanes'>;

/** Fails compilation if the foundational request contract exposes a bare-lane member. */
export type RequestUsesSemanticAxisNames = BareLaneMember<KanbanRequest> extends never ? true : never;

/** Proves that bare lane identity remains unavailable while keeping the expected error observable. */
export type AmbiguousLaneIdentityMustRemainUnavailable = KanbanLaneId;
