import type { KanbanCardAction } from '../card/descriptor.js';
import type { KanbanChecklistGroup } from '../card/checklist.js';
import type {
  CardKey,
  KanbanColumnId,
  KanbanExtensionId,
  KanbanFieldId,
  KanbanSwimlaneId,
} from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanCellAddress } from '../source/types.js';

/** A semantic board target that may own keyboard focus. */
export type KanbanFocusTarget =
  | { readonly kind: 'board-state' }
  | { readonly kind: 'column-header'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane-header'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'card'; readonly cardKey: CardKey; readonly address: KanbanCellAddress };

/** Navigation work that is waiting for a bounded reveal or data acquisition. */
export interface KanbanPendingNavigation {
  /** Operation being completed without moving the current focus prematurely. */
  readonly kind: 'reveal' | 'acquire';
  /** Requested destination retained across asynchronous settlement. */
  readonly target: KanbanFocusTarget;
}

/** Stable, payload-free interaction feedback categories. */
export type KanbanInteractionFeedbackCode =
  | 'navigation-pending'
  | 'navigation-unavailable'
  | 'navigation-error'
  | 'selection-limit-exceeded'
  | 'selection-pruned'
  | 'interaction-unavailable';

/** Localized, bounded feedback that may be shown without exposing card values. */
export interface KanbanInteractionFeedback {
  /** Machine-readable reason used by applications and tests. */
  readonly code: KanbanInteractionFeedbackCode;
  /** Sanitized localized text suitable for board chrome. */
  readonly label: string;
  /** Optional non-negative count associated with selection feedback. */
  readonly count?: number;
  /** Whether the same semantic request may be attempted again. */
  readonly retry?: 'available' | 'unavailable';
}

/** Opaque application reference for a server-wide selection not expanded into resident card keys. */
export interface KanbanServerSelectionReference {
  /** Bounded opaque token interpreted only by the owning application. */
  readonly token: string;
  /** Optional equality-only revision of the represented server selection. */
  readonly revision?: KanbanRevision;
  /** Optional sanitized localized description of the selection scope. */
  readonly label?: string;
}

/** Explicit anchor used for range selection inside one semantic cell. */
export interface KanbanRangeAnchor {
  /** Stable card identity at which range extension began. */
  readonly cardKey: CardKey;
  /** Cell containing the anchor when it was established. */
  readonly address: KanbanCellAddress;
}

/** Complete immutable interaction state consumed by scene construction. */
export interface KanbanInteractionSnapshot {
  /** Monotonic semantic-state revision owned by the interaction controller. */
  readonly revision: number;
  /** Current semantic focus target. */
  readonly focused: KanbanFocusTarget;
  /** Ordered selected keys with number and string identities kept distinct. */
  readonly selectedCardKeys: readonly CardKey[];
  /** Optional range-selection anchor. */
  readonly rangeAnchor?: KanbanRangeAnchor;
  /** Preferred visual center row retained during horizontal navigation. */
  readonly preferredCenterRow?: number;
  /** Optional asynchronous navigation operation. */
  readonly pendingNavigation?: KanbanPendingNavigation;
  /** Optional safe localized status feedback. */
  readonly feedback?: KanbanInteractionFeedback;
  /** Optional application-owned server-wide selection reference. */
  readonly serverSelection?: KanbanServerSelectionReference;
}

/** Directions understood by programmatic spatial navigation. */
export type KanbanNavigationDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'home'
  | 'end'
  | 'page-up'
  | 'page-down'
  | 'board-start'
  | 'board-end'
  | 'previous-column'
  | 'next-column';

/** Reasons that require stable focus and selection to reconcile with current evidence. */
export type KanbanInteractionReconcileReason =
  'query' | 'source-publication' | 'cursor-unload' | 'geometry' | 'visibility' | 'deletion';

/** Selection operations owned by the interaction controller. */
export type KanbanSelectionOperation =
  | 'replace'
  | 'toggle'
  | 'range'
  | 'select-loaded-visible-matching'
  | 'clear-multiple'
  | 'set-server-selection'
  | 'clear-server-selection';

/** Closed programmatic interaction transition accepted by a controller or facade. */
export type KanbanInteractionTransition =
  | { readonly kind: 'focus'; readonly target: KanbanFocusTarget }
  | {
      readonly kind: 'navigate';
      readonly direction: KanbanNavigationDirection;
      readonly extendSelection?: boolean;
    }
  | {
      readonly kind: 'selection';
      readonly operation: KanbanSelectionOperation;
      readonly serverSelection?: KanbanServerSelectionReference;
    }
  | { readonly kind: 'reconcile'; readonly reason: KanbanInteractionReconcileReason }
  | {
      readonly kind: 'escape';
      readonly transient?: { readonly kind: 'synthetic'; readonly cancel: () => void };
    };

/** Successful interaction settlement with the controller's complete current snapshot. */
export type KanbanInteractionSuccessResult =
  | { readonly kind: 'changed'; readonly snapshot: KanbanInteractionSnapshot }
  | { readonly kind: 'unchanged'; readonly snapshot: KanbanInteractionSnapshot };

/** Pending bounded acquisition settlement that leaves current focus in place. */
export interface KanbanInteractionPendingResult {
  /** Stable result discriminator. */
  readonly kind: 'pending';
  /** Current immutable state while bounded source work is outstanding. */
  readonly snapshot: KanbanInteractionSnapshot;
}

/** Typed unavailable settlement used instead of throwing across the public facade. */
export interface KanbanInteractionUnavailableResult {
  /** Stable result discriminator. */
  readonly kind: 'unavailable';
  /** Payload-free reason suitable for localization and diagnostics. */
  readonly code: KanbanInteractionFeedbackCode;
  /** Last valid immutable state retained after the rejected transition. */
  readonly snapshot: KanbanInteractionSnapshot;
  /** Whether the same semantic transition may be retried. */
  readonly retry?: 'available' | 'unavailable';
}

/** Complete typed settlement returned by a controller or facade transition. */
export type KanbanInteractionResult =
  KanbanInteractionSuccessResult | KanbanInteractionPendingResult | KanbanInteractionUnavailableResult;

/** One eligible selected card detached from live cursor and application ownership. */
export interface KanbanSelectionEntry {
  /** Stable type-preserving application card identity. */
  readonly cardKey: CardKey;
  /** Semantic cell occupied when the snapshot was captured. */
  readonly address: KanbanCellAddress;
  /** Equality-only entity revision captured with the selection. */
  readonly entityRevision: KanbanRevision;
}

/** Immutable bounded selection captured for one later action or request. */
export interface KanbanSelectionSnapshot {
  /** Ordered eligible selected cards. */
  readonly entries: readonly KanbanSelectionEntry[];
  /** Query-session revision that owns every entry. */
  readonly sessionRevision: KanbanRevision;
  /** Query generation that owns every entry. */
  readonly queryGeneration: number;
  /** Optional application saved-view revision. */
  readonly viewRevision?: KanbanRevision;
}

/** One bounded scene target used by pure navigation without reading a live view. */
export interface KanbanNavigationTarget {
  /** Semantic focus target represented by this rectangle. */
  readonly target: KanbanFocusTarget;
  /** Source scene order used as the deterministic final tie-breaker. */
  readonly sceneIndex: number;
  /** Viewport-local horizontal center in terminal cells. */
  readonly centerColumn: number;
  /** Viewport-local vertical center in terminal rows. */
  readonly centerRow: number;
  /** Whether the current policy permits focus. */
  readonly enabled: boolean;
}

/** Detached bounded scene evidence supplied to pure focus and navigation transitions. */
export interface KanbanNavigationSnapshot {
  /** Equality-only scene revision. */
  readonly revision: KanbanRevision;
  /** Visible targets in deterministic scene order. */
  readonly targets: readonly KanbanNavigationTarget[];
  /** Visible content height used by page navigation. */
  readonly viewportContentHeight: number;
}

/** Current session and view revisions exposed without source records or host handles. */
export interface KanbanInteractionRevisions {
  /** Active query-session revision. */
  readonly sessionRevision: KanbanRevision;
  /** Active query generation. */
  readonly queryGeneration: number;
  /** Optional application saved-view revision. */
  readonly viewRevision?: KanbanRevision;
}

/** Bounded acquisition request for one semantic target. */
export interface KanbanInteractionAcquisitionRequest {
  /** Requested focus target retained across asynchronous settlement. */
  readonly target: KanbanFocusTarget;
  /** Operation requiring the bounded source work. */
  readonly kind: 'reveal' | 'acquire';
}

/** Payload-free bounded reveal or acquisition settlement. */
export type KanbanInteractionAcquisitionResult =
  { readonly kind: 'available' } | { readonly kind: 'unavailable'; readonly retry: 'available' | 'unavailable' };

/** Mount-scoped bounded services available to an interaction controller factory. */
export interface KanbanInteractionEnvironment {
  /** Reads current detached scene evidence. */
  readonly scene: () => KanbanNavigationSnapshot;
  /** Reads current source/query revision evidence. */
  readonly revisions: () => KanbanInteractionRevisions;
  /** Minimally reveals an already-known eligible target. */
  readonly reveal: (
    target: KanbanFocusTarget,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<KanbanInteractionAcquisitionResult> | KanbanInteractionAcquisitionResult;
  /** Requests one bounded missing-target acquisition. */
  readonly acquire: (
    request: KanbanInteractionAcquisitionRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<KanbanInteractionAcquisitionResult> | KanbanInteractionAcquisitionResult;
  /** Creates safe localized feedback without exposing source payloads. */
  readonly feedback: (code: KanbanInteractionFeedbackCode, count?: number) => KanbanInteractionFeedback;
  /** Schedules at most one mounted repaint for a published semantic change. */
  readonly invalidate: () => void;
}

/** One complete safe field value available for focused-card inspection. */
export interface KanbanFocusedDetailField {
  /** Stable configured field identity. */
  readonly fieldId: KanbanFieldId;
  /** Sanitized localized field label. */
  readonly label: string;
  /** Complete bounded safe display values, independent of visible card clipping. */
  readonly values: readonly string[];
}

/** Keyboard hint for one semantic action available on the focused target. */
export interface KanbanFocusedDetailKeyHint {
  /** Application or package action advertised by the target. */
  readonly actionId: KanbanExtensionId;
  /** Sanitized localized action label. */
  readonly label: string;
  /** Sanitized host-normalized key description. */
  readonly key: string;
}

/** Honest scope summary for the current ordered selection. */
export interface KanbanFocusedDetailSelection {
  /** Number of resident card keys in the ordered selection. */
  readonly loadedCount: number;
  /** Whether a separate application server-wide selection is active. */
  readonly scope: 'loaded' | 'server';
}

/** Detached, bounded values used by focused help, status chrome, and inspection. */
export interface KanbanFocusedDetailSnapshot {
  /** Target described by the remaining fields. */
  readonly target: KanbanFocusTarget;
  /** Optional complete sanitized title for a focused card. */
  readonly title?: string;
  /** Optional complete sanitized status for a focused card. */
  readonly status?: string;
  /** Complete bounded safe field values selected for inspection. */
  readonly fields: readonly KanbanFocusedDetailField[];
  /** Complete bounded read-only checklist values selected for inspection. */
  readonly checklists: readonly KanbanChecklistGroup[];
  /** Optional complete sanitized definition-of-done text. */
  readonly definitionOfDone?: string;
  /** Semantic actions currently advertised by the focused target. */
  readonly actions: readonly KanbanCardAction[];
  /** Current host-normalized key hints for the advertised actions. */
  readonly keyHints: readonly KanbanFocusedDetailKeyHint[];
  /** Honest summary of the current ordered selection. */
  readonly selection: KanbanFocusedDetailSelection;
}

/** Frozen board-state focus used before a usable scene selects a more specific target. */
export const KANBAN_NEUTRAL_FOCUS_TARGET: KanbanFocusTarget = Object.freeze({ kind: 'board-state' });

/**
 * Frozen interaction snapshot used before an interaction controller publishes state.
 *
 * @example
 * ```ts
 * const initialFocus = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT.focused;
 * ```
 */
export const KANBAN_NEUTRAL_INTERACTION_SNAPSHOT: KanbanInteractionSnapshot = Object.freeze({
  revision: 0,
  focused: KANBAN_NEUTRAL_FOCUS_TARGET,
  selectedCardKeys: Object.freeze([]),
});

/**
 * Frozen payload-free focused detail used when no eligible card or header is available.
 *
 * @example
 * ```ts
 * const detail = KANBAN_NEUTRAL_FOCUSED_DETAIL_SNAPSHOT;
 * detail.fields.length; // 0
 * ```
 */
export const KANBAN_NEUTRAL_FOCUSED_DETAIL_SNAPSHOT: KanbanFocusedDetailSnapshot = Object.freeze({
  target: KANBAN_NEUTRAL_FOCUS_TARGET,
  fields: Object.freeze([]),
  checklists: Object.freeze([]),
  actions: Object.freeze([]),
  keyHints: Object.freeze([]),
  selection: Object.freeze({ loadedCount: 0, scope: 'loaded' }),
});
