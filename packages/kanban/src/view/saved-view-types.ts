import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanColumnId, KanbanExtensionId, KanbanFieldId, KanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import type { KanbanViewRegistry } from './registry.js';
import type { KanbanSearchPolicy, KanbanViewState } from './types.js';

/** The current package-owned saved-view envelope discriminator. */
export const KANBAN_SAVED_VIEW_KIND = 'jsvision-kanban-view' as const;

/** The oldest and newest envelope versions understood directly by this package build. */
export const KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS = Object.freeze({ minimum: 1, maximum: 1 } as const);

/** Action taken when a durable reference no longer exists in the current board schema. */
export type KanbanSavedViewMissingPolicy = 'drop' | 'reject';

/** Stable reference categories used by reconciliation diagnostics and policy defaults. */
export type KanbanSavedViewReferenceCategory =
  | 'filter-field'
  | 'operator'
  | 'quick-filter'
  | 'sort-field'
  | 'comparator'
  | 'grouping-field'
  | 'grouping-variant'
  | 'column'
  | 'swimlane'
  | 'card-field'
  | 'summary'
  | 'checklist'
  | 'display-option';

/** Optional missing-reference policy shared by saved directives. */
export interface KanbanSavedViewReferencePolicy {
  /** Explicit behavior when the directive's primary field or structure identity is unavailable. */
  readonly onMissing?: KanbanSavedViewMissingPolicy;
}

/** One durable application-owned filter directive. */
export interface KanbanSavedFilterV1 extends KanbanSavedViewReferencePolicy {
  /** Application field evaluated by the active data source. */
  readonly fieldId: KanbanFieldId;
  /** Registered source operator selected for the field. */
  readonly operatorId: KanbanExtensionId;
  /** Detached JSON-like operand passed to the registered operator. */
  readonly value: KanbanSemanticValue;
}

/** One durable named quick-filter selection. */
export interface KanbanSavedQuickFilterV1 extends KanbanSavedViewReferencePolicy {
  /** Registered application-namespaced quick-filter identity. */
  readonly id: KanbanExtensionId;
  /** Optional detached parameter accepted by the quick filter's registered codec. */
  readonly value?: KanbanSemanticValue;
}

/** One durable sort directive. */
export interface KanbanSavedSortV1 extends KanbanSavedViewReferencePolicy {
  /** Application field evaluated by the active data source. */
  readonly fieldId: KanbanFieldId;
  /** Optional registered comparator; omission selects the field's current default. */
  readonly comparatorId?: KanbanExtensionId;
  /** Requested value order. */
  readonly direction: 'ascending' | 'descending';
}

/** One durable semantic grouping selection. */
export interface KanbanSavedGroupingV1 extends KanbanSavedViewReferencePolicy {
  /** Registered source field used to derive swimlanes. */
  readonly fieldId: KanbanFieldId;
  /** Optional application-namespaced presentation variant. */
  readonly variantId?: KanbanExtensionId;
}

/** Durable presentation overrides for one workflow column. */
export interface KanbanSavedColumnV1 extends KanbanSavedViewReferencePolicy {
  /** Stable workflow-column identity. */
  readonly columnId: KanbanColumnId;
  /** Whether the column participates in the visible projection. */
  readonly visible: boolean;
  /** Whether the visible column starts collapsed. */
  readonly collapsed: boolean;
  /** Optional preferred terminal-cell width before current runtime clamping. */
  readonly width?: number;
  /** Optional header alignment preference. */
  readonly alignment?: 'start' | 'center';
}

/** Durable presentation overrides for one semantic swimlane. */
export interface KanbanSavedSwimlaneV1 extends KanbanSavedViewReferencePolicy {
  /** Stable semantic swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Whether the swimlane participates in the visible projection. */
  readonly visible: boolean;
  /** Whether the visible swimlane starts collapsed. */
  readonly collapsed: boolean;
}

/** Durable card-presentation state independent of runtime descriptors and callbacks. */
export interface KanbanSavedPresentationV1 {
  /** Named package card-density preset. */
  readonly density: KanbanCardDensity;
  /** Ordered application card fields retained on cards. */
  readonly cardFieldIds: readonly KanbanFieldId[];
  /** Ordered application summary sections retained on cards. */
  readonly summaryIds: readonly KanbanFieldId[];
  /** Bounded checklist presentation mode. */
  readonly checklist: 'hidden' | 'progress' | 'preview';
}

/** Complete version-1 view state that is safe to persist between sessions. */
export interface KanbanDurableViewStateV1 {
  /** Whether committed search text may be persisted. */
  readonly searchPolicy: KanbanSearchPolicy;
  /** Committed search text, present only when the durable policy permits capture. */
  readonly search?: string;
  /** Ordered active field filters. */
  readonly filters: readonly KanbanSavedFilterV1[];
  /** Ordered active named quick filters. */
  readonly quickFilters: readonly KanbanSavedQuickFilterV1[];
  /** Ordered stable sort directives. */
  readonly sort: readonly KanbanSavedSortV1[];
  /** Optional single semantic grouping. */
  readonly grouping?: KanbanSavedGroupingV1;
  /** Ordered workflow-column personalization. */
  readonly columns: { readonly items: readonly KanbanSavedColumnV1[] };
  /** Ordered semantic-swimlane personalization. */
  readonly swimlanes: { readonly items: readonly KanbanSavedSwimlaneV1[] };
  /** Durable card presentation. */
  readonly presentation: KanbanSavedPresentationV1;
}

/** Canonical version-1 application-stored saved-view envelope. */
export interface KanbanSavedViewV1 {
  /** Package discriminator used before version-specific parsing. */
  readonly kind: typeof KANBAN_SAVED_VIEW_KIND;
  /** Exact envelope schema version. */
  readonly version: 1;
  /** Optional user-facing view name. */
  readonly name?: string;
  /** Durable semantic and presentation state. */
  readonly view: KanbanDurableViewStateV1;
  /** Inert namespaced application data preserved without package interpretation. */
  readonly extensions?: Readonly<Record<KanbanExtensionId, KanbanSemanticValue>>;
}

/** Sanitized diagnostic codes returned by saved-view processing stages. */
export type KanbanSavedViewDiagnosticCode =
  'invalid-view' | 'migration-failed' | 'missing-reference-dropped' | 'missing-required-reference';

/** Bounded payload-free diagnostic that never includes saved values or raw exceptions. */
export interface KanbanSavedViewDiagnostic {
  /** Stable machine-readable outcome code. */
  readonly code: KanbanSavedViewDiagnosticCode;
  /** Reference category when reconciliation reached a missing identity. */
  readonly category?: KanbanSavedViewReferenceCategory;
  /** Stable missing identity; semantic operands and extension payloads are never included. */
  readonly id?: string;
}

/** Result of exact current-envelope parsing. */
export type KanbanSavedViewParseResult =
  | { readonly kind: 'parsed'; readonly value: KanbanSavedViewV1 }
  | { readonly kind: 'rejected'; readonly diagnostic: KanbanSavedViewDiagnostic }
  | {
      readonly kind: 'unsupported-version';
      readonly version: number;
      readonly supported: typeof KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS;
    };

/** One deterministic adapter that advances an older envelope by exactly one schema version. */
export interface KanbanSavedViewMigration {
  /** Exact source version accepted by the adapter. */
  readonly fromVersion: number;
  /** Exact destination version produced by the adapter. */
  readonly toVersion: number;
  /** Returns a new JSON-like envelope without mutating the detached source value. */
  readonly migrate: (value: KanbanSemanticValue) => unknown;
}

/** Input accepted by the bounded migration-registry constructor. */
export interface KanbanSavedViewMigrationRegistryOptions {
  /** Sequential one-version adapters keyed by their source version. */
  readonly migrations?: readonly KanbanSavedViewMigration[];
}

/** Immutable lookup registry for application-provided saved-view migrations. */
export interface KanbanSavedViewMigrationRegistry {
  /** Detached ordered adapter metadata and callbacks. */
  readonly migrations: readonly KanbanSavedViewMigration[];
  /** Finds the single adapter registered for a source version. */
  migrationFrom(version: number): KanbanSavedViewMigration | undefined;
}

/** Options supplied to one pure migration run. */
export interface KanbanSavedViewMigrationOptions {
  /** Application migration adapters supplementing package-owned schema steps. */
  readonly registry?: KanbanSavedViewMigrationRegistry;
}

/** Result of advancing one older envelope to the current saved-view schema. */
export type KanbanSavedViewMigrationResult =
  | {
      readonly kind: 'migrated';
      readonly fromVersion: number;
      readonly toVersion: 1;
      readonly value: KanbanSavedViewV1;
    }
  | { readonly kind: 'rejected'; readonly diagnostic: KanbanSavedViewDiagnostic }
  | {
      readonly kind: 'unsupported-version';
      readonly version: number;
      readonly supported: typeof KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS;
    };

/** Current application metadata for one filterable or sortable field. */
export interface KanbanSavedViewFieldDefinition {
  /** Stable application field identity. */
  readonly fieldId: KanbanFieldId;
  /** Registered operators currently valid for this field. */
  readonly operators: readonly KanbanExtensionId[];
  /** Registered comparators currently valid for this field. */
  readonly comparators: readonly KanbanExtensionId[];
}

/** Current defaults and width boundaries for one workflow column. */
export interface KanbanSavedViewColumnDefinition {
  /** Stable workflow-column identity. */
  readonly columnId: KanbanColumnId;
  /** Current visibility used when a saved envelope does not mention the column. */
  readonly visible: boolean;
  /** Current collapsed state used when a saved envelope does not mention the column. */
  readonly collapsed: boolean;
  /** Inclusive minimum runtime width in terminal cells. */
  readonly minimumWidth: number;
  /** Inclusive maximum runtime width in terminal cells. */
  readonly maximumWidth: number;
  /** Current header alignment used for a newly introduced column. */
  readonly alignment?: 'start' | 'center';
}

/** Current defaults for one semantic swimlane. */
export interface KanbanSavedViewSwimlaneDefinition {
  /** Stable semantic swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
  /** Current visibility used when a saved envelope does not mention the swimlane. */
  readonly visible: boolean;
  /** Current collapsed state used when a saved envelope does not mention the swimlane. */
  readonly collapsed: boolean;
}

/** Current registries and structures used to resolve one raw saved view deterministically. */
export interface KanbanSavedViewReconciliationContext {
  /** Immutable named-behavior registry. */
  readonly registry: KanbanViewRegistry;
  /** Current filterable and sortable application fields. */
  readonly fields?: readonly KanbanSavedViewFieldDefinition[];
  /** Current workflow columns in deterministic append order. */
  readonly columns: readonly KanbanSavedViewColumnDefinition[];
  /** Current semantic swimlanes in deterministic append order. */
  readonly swimlanes: readonly KanbanSavedViewSwimlaneDefinition[];
  /** Current card field identities available to presentation. */
  readonly cardFieldIds?: readonly KanbanFieldId[];
  /** Current summary identities available to presentation. */
  readonly summaryIds?: readonly KanbanFieldId[];
  /** Current grouping presentation variants available to saved views. */
  readonly groupingVariantIds?: readonly KanbanExtensionId[];
}

/** Raw durable facets retained after reconciliation for lossless ordinary capture. */
export interface KanbanSavedViewProvenance {
  /** Exact detached envelope that produced the resolved state. */
  readonly raw: KanbanSavedViewV1;
  /** Exact resolved baseline used to detect later facet edits during capture. */
  readonly resolved: KanbanViewState;
}

/** Successfully reconciled raw envelope and current controller-ready state. */
export interface KanbanReconciledSavedView {
  /** Result discriminator. */
  readonly kind: 'reconciled';
  /** Exact detached raw envelope retained for non-destructive capture. */
  readonly raw: KanbanSavedViewV1;
  /** Complete current state ready for one atomic controller replacement. */
  readonly resolved: KanbanViewState;
  /** Facet provenance retained by the controller after apply. */
  readonly provenance: KanbanSavedViewProvenance;
  /** Bounded non-fatal reconciliation diagnostics. */
  readonly diagnostics: readonly KanbanSavedViewDiagnostic[];
}

/** Deterministic reconciliation result that cannot partially mutate a live controller. */
export type KanbanSavedViewReconciliationResult =
  KanbanReconciledSavedView | { readonly kind: 'rejected'; readonly diagnostic: KanbanSavedViewDiagnostic };

/** Capture behavior for controller state with optional retained raw provenance. */
export type KanbanSavedViewCaptureMode = 'preserve' | 'resave';

/** Options supplied when capturing one durable controller snapshot. */
export interface KanbanSavedViewCaptureOptions {
  /** Optional user-facing saved-view name. */
  readonly name?: string;
  /** Optional inert namespaced application extension data. */
  readonly extensions?: Readonly<Record<KanbanExtensionId, KanbanSemanticValue>>;
  /** `resave` writes only current resolved values; the default preserves safe raw provenance. */
  readonly mode?: KanbanSavedViewCaptureMode;
}

/** Application authority seam used by the optional saved-view store helper. */
export interface KanbanSavedViewStoreOptions {
  /** Dispatches one validated saved-view proposal through the owning board or application coordinator. */
  readonly request: (proposal: KanbanRequestProposal) => KanbanRequestResult | Promise<KanbanRequestResult>;
}

/** Store outcome including the package-owned disposed/unavailable state. */
export type KanbanSavedViewStoreResult =
  | KanbanRequestResult
  | { readonly kind: 'unavailable'; readonly code: 'saved-view-store-disposed' | 'saved-view-store-request-failed' };

/** Disposable proposal helper for application-owned saved-view persistence. */
export interface KanbanSavedViewStore {
  /** Saves or replaces one view through application authority. */
  save(viewId: string, view: KanbanSavedViewV1): Promise<KanbanSavedViewStoreResult>;
  /** Renames one application-owned saved view. */
  rename(viewId: string, label: string): Promise<KanbanSavedViewStoreResult>;
  /** Deletes one application-owned saved view. */
  delete(viewId: string): Promise<KanbanSavedViewStoreResult>;
  /** Makes future calls unavailable without owning application persistence. */
  dispose(): void;
}
