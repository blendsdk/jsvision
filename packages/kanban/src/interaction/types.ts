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
