import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanColumnId, KanbanExtensionId, KanbanFieldId, KanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanFilter, KanbanQuery, KanbanSort } from '../source/types.js';
import type { KanbanViewSummary } from './summary.js';

/** Determines whether raw search text is eligible for durable saved-view capture. */
export type KanbanSearchPolicy = 'transient' | 'durable';

/** One active registered field filter retained by view state. */
export type KanbanFilterSelection = KanbanFilter;

/** One active application quick filter and its optional detached parameter. */
export interface KanbanQuickFilterSelection {
  /** Stable application-namespaced quick-filter identity. */
  readonly id: KanbanExtensionId;
  /** Optional inert parameter interpreted only by the registered filter. */
  readonly value?: KanbanSemanticValue;
}

/** The single semantic grouping selected by a view. */
export interface KanbanGroupingSelection {
  /** Registered source grouping field. */
  readonly fieldId: KanbanFieldId;
  /** Optional application-namespaced presentation variant. */
  readonly variantId?: KanbanExtensionId;
}

/** View-only overrides for one workflow column. */
export interface KanbanColumnViewItem {
  /** Stable column identity. */
  readonly columnId: KanbanColumnId;
  /** Whether the column participates in the visible projection. */
  readonly visible: boolean;
  /** Whether the visible column is collapsed. */
  readonly collapsed: boolean;
  /** Optional preferred terminal-cell width before runtime clamping. */
  readonly width?: number;
  /** Optional header alignment override. */
  readonly alignment?: 'start' | 'center';
}

/** Ordered complete column-personalization state owned by the view controller. */
export interface KanbanColumnViewState {
  /** Columns in requested display order. */
  readonly items: readonly KanbanColumnViewItem[];
}

/** View-only overrides for one semantic swimlane. */
export interface KanbanSwimlaneViewItem {
  /** Stable swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Whether the swimlane participates in the visible projection. */
  readonly visible: boolean;
  /** Whether the visible swimlane is collapsed. */
  readonly collapsed: boolean;
}

/** Ordered complete swimlane-personalization state owned by the view controller. */
export interface KanbanSwimlaneViewState {
  /** Swimlanes in requested display order. */
  readonly items: readonly KanbanSwimlaneViewItem[];
}

/** Durable card-presentation facets owned by one view. */
export interface KanbanViewPresentation {
  /** Named card-density preset. */
  readonly density: KanbanCardDensity;
  /** Optional ordered allowlist of application card fields. */
  readonly cardFieldIds: readonly KanbanFieldId[];
  /** Whether bounded checklist presentation is enabled. */
  readonly checklist: 'hidden' | 'progress' | 'preview';
}

/** Complete immutable semantic view snapshot. */
export interface KanbanViewState {
  /** Persistence treatment for raw search text. */
  readonly searchPolicy: KanbanSearchPolicy;
  /** Last committed sanitized search value. */
  readonly search: string;
  /** Ordered active field filters. */
  readonly filters: readonly KanbanFilterSelection[];
  /** Ordered jointly active named quick filters. */
  readonly quickFilters: readonly KanbanQuickFilterSelection[];
  /** Ordered stable sort directives. */
  readonly sort: readonly KanbanSort[];
  /** Optional single semantic grouping. */
  readonly grouping?: KanbanGroupingSelection;
  /** Complete column view facets. */
  readonly columns: KanbanColumnViewState;
  /** Complete swimlane view facets. */
  readonly swimlanes: KanbanSwimlaneViewState;
  /** Complete durable card presentation. */
  readonly presentation: KanbanViewPresentation;
  /** Equality-only revision changed once per committed transition. */
  readonly revision: KanbanRevision;
}

/** Atomic user or application request to change controller-owned view state. */
export type KanbanViewTransition =
  | { readonly kind: 'set-search'; readonly search: string }
  | { readonly kind: 'set-search-policy'; readonly policy: KanbanSearchPolicy }
  | { readonly kind: 'set-filters'; readonly filters: readonly KanbanFilterSelection[] }
  | { readonly kind: 'set-quick-filters'; readonly quickFilters: readonly KanbanQuickFilterSelection[] }
  | { readonly kind: 'set-sort'; readonly sort: readonly KanbanSort[] }
  | { readonly kind: 'set-grouping'; readonly grouping?: KanbanGroupingSelection }
  | { readonly kind: 'set-columns'; readonly columns: KanbanColumnViewState }
  | { readonly kind: 'set-swimlanes'; readonly swimlanes: KanbanSwimlaneViewState }
  | { readonly kind: 'set-presentation'; readonly presentation: KanbanViewPresentation }
  | { readonly kind: 'set-density'; readonly density: KanbanCardDensity }
  | { readonly kind: 'clear-filters' };

/** Sanitized result returned synchronously when a view transition is requested. */
export type KanbanViewTransitionResult =
  | { readonly kind: 'changed'; readonly revision: KanbanRevision; readonly code?: undefined }
  | { readonly kind: 'pending'; readonly code?: undefined }
  | { readonly kind: 'unchanged'; readonly code?: undefined }
  | { readonly kind: 'rejected'; readonly code: string }
  | { readonly kind: 'unavailable'; readonly code?: string };

/** Observer invoked after a complete state/query pair becomes publicly visible. */
export type KanbanViewSubscriber = (state: KanbanViewState, query: KanbanQuery) => void;

/** Disposable owner of one immutable committed Kanban view projection. */
export interface KanbanViewController {
  /** Returns the current committed state snapshot. */
  readonly state: () => KanbanViewState;
  /** Returns the current committed source query. */
  readonly query: () => KanbanQuery;
  /** Returns honest source/projection counts for the committed query. */
  readonly summary: () => KanbanViewSummary;
  /** Requests one exact view transition. */
  apply(transition: KanbanViewTransition): KanbanViewTransitionResult;
  /** Replaces the complete state after exact bounded validation. */
  replace(state: unknown): KanbanViewTransitionResult;
  /** Clears search, field filters, and quick filters atomically. */
  clearFilters(): KanbanViewTransitionResult;
  /** Subscribes to committed state/query publications. */
  subscribe(subscriber: KanbanViewSubscriber): () => void;
  /** Cancels pending work and makes future transitions unavailable. */
  dispose(): void;
}
