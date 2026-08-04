import type {
  CardKey,
  KanbanColumnId,
  KanbanFieldId,
  KanbanExtensionId,
  KanbanSwimlaneId,
  PlacementToken,
} from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanBoardCounts, KanbanCellCounts, KanbanCount } from './counts.js';
import type { KanbanCellState, KanbanKnownLength, KanbanSourceState } from './states.js';

/** One semantic filter supplied to a data source. */
export interface KanbanFilter {
  /** Application field evaluated by a registered source adapter. */
  readonly fieldId: KanbanFieldId;
  /** Application-namespaced operator interpreted by that adapter. */
  readonly operatorId: KanbanExtensionId;
  /** Detached semantic operand, never an executable expression. */
  readonly value: KanbanSemanticValue;
}

/** One stable ordering directive in a semantic query. */
export interface KanbanSort {
  /** Application field evaluated by a registered sort adapter. */
  readonly fieldId: KanbanFieldId;
  /** Requested order for values of the field. */
  readonly direction: 'ascending' | 'descending';
}

/** Immutable semantic read projection opened by a Kanban data source. */
export interface KanbanQuery {
  /** Optional bounded plain-text search term. */
  readonly search?: string;
  /** Ordered local filter directives. */
  readonly filters?: readonly KanbanFilter[];
  /** Optional field used to derive semantic swimlanes. */
  readonly groupBy?: KanbanFieldId;
  /** Ordered stable sort directives. */
  readonly sort?: readonly KanbanSort[];
  /** Optional allowlist of visible workflow columns. */
  readonly visibleColumnIds?: readonly KanbanColumnId[];
  /** Optional allowlist of visible semantic swimlanes. */
  readonly visibleSwimlaneIds?: readonly KanbanSwimlaneId[];
  /** Equality-only application revision of the saved or active view. */
  readonly viewRevision?: KanbanRevision;
}

/** Display metadata for one workflow column. */
export interface KanbanColumnMeta {
  /** Stable semantic column identity. */
  readonly columnId: KanbanColumnId;
  /** Human-readable label rendered after terminal sanitization. */
  readonly label: string;
  /** Equality-only presentation revision for this metadata. */
  readonly revision: KanbanRevision;
}

/** Display metadata for one optional horizontal swimlane. */
export interface KanbanSwimlaneMeta {
  /** Stable semantic swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Human-readable label rendered after terminal sanitization. */
  readonly label: string;
  /** Equality-only presentation revision for this metadata. */
  readonly revision: KanbanRevision;
}

/** Collision-safe semantic address of one column/swimlane cell. */
export interface KanbanCellAddress {
  /** Workflow column containing the cell. */
  readonly columnId: KanbanColumnId;
  /** Optional horizontal grouping containing the cell. */
  readonly swimlaneId?: KanbanSwimlaneId;
}

/** Header metadata shared by columns and swimlanes. */
export interface KanbanHeaderSummary {
  /** Optional authoritative work-in-progress count. */
  readonly wip?: KanbanCount;
  /** Bounded semantic summaries keyed by application field identity. */
  readonly summaries?: Readonly<Record<string, KanbanSemanticValue>>;
}

/** Detached column header publication. */
export interface KanbanColumnHeader extends KanbanHeaderSummary {
  /** Column represented by this header. */
  readonly columnId: KanbanColumnId;
  /** Sanitized human-readable label. */
  readonly label: string;
}

/** Detached swimlane header publication. */
export interface KanbanSwimlaneHeader extends KanbanHeaderSummary {
  /** Swimlane represented by this header. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Sanitized human-readable label. */
  readonly label: string;
}

/** Atomic header metadata for one session revision. */
export interface KanbanHeaderBatch {
  /** Session revision from which the header values were derived. */
  readonly revision: KanbanRevision;
  /** Ordered column headers. */
  readonly columns: readonly KanbanColumnHeader[];
  /** Ordered swimlane headers. */
  readonly swimlanes: readonly KanbanSwimlaneHeader[];
}

/** Authoritative deletion of one semantic identity. */
export type KanbanIdentityChange =
  | { readonly kind: 'deleted-card'; readonly cardKey: CardKey }
  | { readonly kind: 'deleted-column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'deleted-swimlane'; readonly swimlaneId: KanbanSwimlaneId };

/** Bounded authoritative deletion facts for one session revision. */
export interface KanbanIdentityChangeBatch {
  /** Session revision from which the deletion facts were derived. */
  readonly revision: KanbanRevision;
  /** Exact deletion records; transient unload is deliberately absent. */
  readonly changes: readonly KanbanIdentityChange[];
}

/** Half-open source range used as an optional placement prefetch hint. */
export interface KanbanPrefetchRange {
  /** First included logical card index. */
  readonly start: number;
  /** First excluded logical card index. */
  readonly end: number;
}

/** Revision-bound semantic insertion placement returned by a cursor. */
export type KanbanPlacement =
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
      readonly token?: PlacementToken;
      readonly cursorRevision: KanbanRevision;
    }
  | {
      readonly kind: 'unavailable';
      readonly code: string;
      readonly label?: string;
      readonly prefetch?: KanbanPrefetchRange;
      readonly cursorRevision: KanbanRevision;
    };

/** Revision-bound result of one optional, bounded card-identity lookup. */
export type KanbanCardLocation =
  | {
      readonly kind: 'found' | 'unloaded';
      readonly address: KanbanCellAddress;
      readonly index?: number;
      readonly placement?: KanbanPlacement;
      readonly sessionRevision: KanbanRevision;
    }
  | { readonly kind: 'unknown' | 'unsupported'; readonly sessionRevision: KanbanRevision };

/** Complete atomic source metadata publication used by deterministic sources and validators. */
export interface KanbanSessionPublication {
  /** Equality-only revision of every value in this snapshot. */
  readonly revision: KanbanRevision;
  /** Board-wide lifecycle state. */
  readonly state: KanbanSourceState;
  /** Ordered workflow-column metadata. */
  readonly columns: readonly KanbanColumnMeta[];
  /** Ordered optional swimlane metadata. */
  readonly swimlanes: readonly KanbanSwimlaneMeta[];
  /** Honest board-wide count qualities. */
  readonly counts: KanbanBoardCounts;
  /** Header metadata from the same revision. */
  readonly headers: KanbanHeaderBatch;
  /** Authoritative identity facts from the same revision. */
  readonly identityChanges: KanbanIdentityChangeBatch;
}

/** Sparse, independently disposable card reader for one semantic cell. */
export interface KanbanCellCursor<TCard> {
  /** Returns the reactive cell lifecycle state. */
  state(): KanbanCellState;
  /** Returns honest reactive counts for this cell. */
  counts(): KanbanCellCounts;
  /** Returns exact, lower-bound, or unknown logical length knowledge. */
  length(): KanbanKnownLength;
  /** Returns a resident application card or `undefined` for an unloaded slot. */
  cardAt(index: number): TCard | undefined;
  /** Acquires one bounded half-open logical range. */
  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void>;
  /** Returns the equality-only revision governing reads and placements. */
  revision(): KanbanRevision;
  /** Returns a revision-bound semantic insertion placement for one logical slot. */
  placementAt(slot: number): KanbanPlacement;
  /** Retries the cursor's scoped error, when available. */
  retry(): Promise<void> | void;
  /** Releases source work and retained application card references idempotently. */
  dispose(): void;
}

/** Independently disposable read session for one semantic query. */
export interface KanbanQuerySession<TCard> {
  /** Returns the reactive board-wide source state. */
  state(): KanbanSourceState;
  /** Returns the equality-only active session revision. */
  revision(): KanbanRevision;
  /** Returns ordered reactive column metadata. */
  columns(): readonly KanbanColumnMeta[];
  /** Returns ordered reactive swimlane metadata. */
  swimlanes(): readonly KanbanSwimlaneMeta[];
  /** Returns honest reactive board-wide counts. */
  counts(): KanbanBoardCounts;
  /** Returns atomic reactive header metadata. */
  headers(): KanbanHeaderBatch;
  /** Returns authoritative reactive deletion facts. */
  identityChanges(): KanbanIdentityChangeBatch;
  /** Opens a sparse cursor only for the explicitly requested semantic cell. */
  cell(address: KanbanCellAddress): KanbanCellCursor<TCard>;
  /** Performs one bounded optional identity lookup without scanning cursor contents. */
  locateCard?(
    key: CardKey,
    options?: { readonly signal?: AbortSignal },
  ): Promise<KanbanCardLocation> | KanbanCardLocation;
  /** Releases session work and child resources idempotently. */
  dispose(): void;
}

/** Application-owned source that opens synchronous, independently disposable query sessions. */
export interface KanbanDataSource<TCard> {
  /** Opens one session and immediately transfers cancellation/disposal ownership to the caller. */
  openQuery(query: KanbanQuery, options?: { readonly signal?: AbortSignal }): KanbanQuerySession<TCard>;
}
