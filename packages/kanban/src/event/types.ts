import type { KanbanActionOrigin } from '../command/types.js';
import type {
  CardKey,
  KanbanBoardId,
  KanbanColumnId,
  KanbanOperationId,
  KanbanSwimlaneId,
} from '../contract/identity.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanRequest, KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanOperationState } from '../operation/types.js';

/** Action lifecycle states exposed without handler results or application payloads. */
export type KanbanActionEventState = 'intent' | 'pending' | 'handled' | 'disabled' | 'hidden' | 'unavailable';

/** Logical focus target retained by a public event. */
export type KanbanFocusEventTarget =
  | { readonly kind: 'board' }
  | { readonly kind: 'card'; readonly cardKey: CardKey }
  | { readonly kind: 'cell'; readonly columnId: KanbanColumnId; readonly swimlaneId?: KanbanSwimlaneId }
  | { readonly kind: 'column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane'; readonly swimlaneId: KanbanSwimlaneId };

/** Payload-free action input accepted before sequence and timestamp allocation. */
export interface KanbanActionEventInput {
  /** Event discriminator. */
  readonly kind: 'action';
  /** Stable package or application action identity. */
  readonly actionId: string;
  /** Origin that invoked the shared action route. */
  readonly origin: KanbanActionOrigin;
  /** Current public action lifecycle state. */
  readonly state: KanbanActionEventState;
  /** Optional safe reason code for denied or unavailable outcomes. */
  readonly code?: string;
}

/** Payload-free request lifecycle input derived from the existing operation lifecycle. */
export interface KanbanRequestEventInput {
  /** Event discriminator. */
  readonly kind: 'request';
  /** Exact operation identity shared by every request transition. */
  readonly operationId: KanbanOperationId;
  /** Standard or namespaced-extension request discriminator. */
  readonly requestKind: KanbanRequest['kind'];
  /** Existing operation lifecycle state. */
  readonly state: KanbanOperationState;
  /** Optional safe terminal reason code. */
  readonly code?: string;
}

/** Focus input published only after public focus state changes. */
export interface KanbanFocusEventInput {
  /** Event discriminator. */
  readonly kind: 'focus';
  /** New logical focus target. */
  readonly target: KanbanFocusEventTarget;
}

/** Record-free selection input published after selection changes. */
export interface KanbanSelectionEventInput {
  /** Event discriminator. */
  readonly kind: 'selection';
  /** Current selected-card count. */
  readonly count: number;
}

/** Active-view input without filter/search values. */
export interface KanbanViewEventInput {
  /** Event discriminator. */
  readonly kind: 'view';
  /** Equality-only active-view revision. */
  readonly revision: KanbanRevision;
}

/** Source lifecycle input without records, queries, or errors. */
export interface KanbanSourceEventInput {
  /** Event discriminator. */
  readonly kind: 'source';
  /** Current bounded source lifecycle state. */
  readonly state: 'loading' | 'ready' | 'refreshing' | 'partial' | 'empty' | 'error' | 'disposed';
  /** Optional equality-only source revision. */
  readonly revision?: KanbanRevision;
  /** Optional equality-only query projection revision. */
  readonly queryRevision?: KanbanRevision;
}

/** Bounded numeric counters available to error and degradation events. */
export type KanbanEventCounts = Readonly<Record<string, number>>;

/** Safe error input that never includes a thrown value or raw message. */
export interface KanbanErrorEventInput {
  /** Event discriminator. */
  readonly kind: 'error';
  /** Stable safe reason code. */
  readonly code: string;
  /** Optional bounded payload-free counters. */
  readonly counts?: KanbanEventCounts;
}

/** Safe capability or geometry degradation input. */
export interface KanbanDegradationEventInput {
  /** Event discriminator. */
  readonly kind: 'degradation';
  /** Stable safe reason code. */
  readonly code: string;
  /** Optional bounded payload-free counters. */
  readonly counts?: KanbanEventCounts;
}

/** Closed input union accepted by the public event hub. */
export type KanbanEventInput =
  | KanbanActionEventInput
  | KanbanRequestEventInput
  | KanbanFocusEventInput
  | KanbanSelectionEventInput
  | KanbanViewEventInput
  | KanbanSourceEventInput
  | KanbanErrorEventInput
  | KanbanDegradationEventInput;

/** Hub-owned event envelope common to every public semantic event. */
export interface KanbanEventEnvelope {
  /** Monotonic sequence allocated when the event leaves the queue. */
  readonly sequence: number;
  /** Finite timestamp returned by the injected clock. */
  readonly timestamp: number;
  /** Exact board instance that owns the event stream. */
  readonly boardId: KanbanBoardId;
}

/** Immutable public event snapshot. */
export type KanbanEvent = KanbanEventInput & KanbanEventEnvelope;

/** One isolated public-event subscriber. */
export type KanbanEventSubscriber = (event: KanbanEvent) => void;

/** Result of one event publication attempt. */
export type KanbanEventPublishOutcome =
  { readonly kind: 'published' } | { readonly kind: 'event-queue-overflow' } | { readonly kind: 'disposed' };

/** Options for one bounded board-scoped event hub. */
export interface KanbanEventHubOptions {
  /** Exact board instance published on every event. */
  readonly boardId: KanbanBoardId;
  /** Injected finite clock, defaulting to wall time. */
  readonly now?: () => number;
  /** Queue capacity from 1 through 4,096; defaults to 256. */
  readonly capacity?: number;
  /** Number of recent events retained by `snapshot`; defaults to 0. */
  readonly retained?: number;
  /** Optional payload-free observation sink for hub failures. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Bounded board-scoped public event stream. */
export interface KanbanEventHub {
  /** Validates and publishes or queues one detached event input. */
  readonly publish: (input: KanbanEventInput) => KanbanEventPublishOutcome;
  /** Subscribes one isolated event listener. */
  readonly subscribe: (subscriber: KanbanEventSubscriber) => () => void;
  /** Returns the bounded recent-event snapshot, if retention is enabled. */
  readonly snapshot: () => readonly KanbanEvent[];
  /** Clears queued/retained events and subscribers and rejects future publication. */
  readonly dispose: () => void;
  /** Reports whether all hub resources have been released. */
  readonly disposed: () => boolean;
}

/** Application-owned history direction exposed by package commands. */
export type KanbanHistoryDirection = 'undo' | 'redo';

/** Bounded discoverable history action without a token or stack entry. */
export interface KanbanHistoryActionAvailability {
  /** Translation message ID used for status, menu, and help presentation. */
  readonly labelMessageId: string;
}

/** Reactive record-free application history availability. */
export interface KanbanHistoryAvailability {
  /** Equality-only revision of the application history state. */
  readonly revision: KanbanRevision;
  /** Present only when the application currently offers undo. */
  readonly undo?: KanbanHistoryActionAvailability;
  /** Present only when the application currently offers redo. */
  readonly redo?: KanbanHistoryActionAvailability;
}

/** Detached context supplied whenever an application builds a fresh history proposal. */
export interface KanbanHistoryBuildContext {
  /** Availability revision that admitted the invocation. */
  readonly revision: KanbanRevision;
  /** Cancellation signal owned by the history binding. */
  readonly signal: AbortSignal;
}

/** Application history provider that owns availability and proposal construction. */
export interface KanbanHistoryProvider {
  /** Returns current bounded availability. */
  readonly availability: () => KanbanHistoryAvailability;
  /** Notifies the binding that availability should be captured again. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Builds one fresh proposal from current application history. */
  readonly build: (
    direction: KanbanHistoryDirection,
    context: KanbanHistoryBuildContext,
  ) => KanbanRequestProposal | Promise<KanbanRequestProposal>;
}

/** Minimal request authority required by application-owned history integration. */
export interface KanbanHistoryAuthority {
  /** Validates and dispatches one fresh history proposal through board authority. */
  readonly request: (proposal: KanbanRequestProposal) => Promise<KanbanRequestResult>;
}

/** Reactive application-owned history integration surface. */
export interface KanbanHistoryBinding {
  /** Returns the current detached availability snapshot. */
  readonly snapshot: () => KanbanHistoryAvailability;
  /** Observes successfully captured availability replacements. */
  readonly subscribe: (listener: (snapshot: KanbanHistoryAvailability) => void) => () => void;
  /** Builds and dispatches one fresh undo or redo proposal. */
  readonly invoke: (direction: KanbanHistoryDirection) => Promise<KanbanRequestResult>;
  /** Releases provider/subscriber/cancellation resources. */
  readonly dispose: () => void;
  /** Reports whether the history integration has been released. */
  readonly disposed: () => boolean;
}
