import type { KanbanChecklistId, KanbanFieldId } from '../contract/identity.js';
import type { KanbanResolvedLimits } from '../contract/limits.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanCardDensity, KanbanCardSectionKind } from './descriptor.js';

/** Checklist detail rendered by the standard card pipeline. */
export type KanbanChecklistMode = 'hidden' | 'progress' | 'preview';

/** Caller-defined card presentation budget before validation and normalization. */
export interface KanbanCustomPresentation {
  /** Equality-only revision for the complete custom policy. */
  readonly revision: KanbanRevision;
  /** Maximum descriptor rows, including mandatory title and status rows. */
  readonly cardRows: number;
  /** Empty terminal rows reserved between adjacent cards by scene geometry. */
  readonly cardGap: number;
  /** Maximum selected metadata fields. */
  readonly metadataFields: number;
  /** Maximum rows used to wrap labels. */
  readonly labelRows: number;
  /** Maximum selected summary sections. */
  readonly summarySections: number;
  /** Checklist detail available to the standard renderer. */
  readonly checklistMode: KanbanChecklistMode;
  /** Maximum checklist items displayed across selected groups. */
  readonly checklistPreviewItems: number;
  /** Optional low-to-high removal order for non-mandatory sections. */
  readonly degradationOrder?: readonly KanbanCardSectionKind[];
}

/** Preset name or complete custom presentation policy accepted by the public resolver. */
export type KanbanPresentationInput = KanbanCardDensity | KanbanCustomPresentation;

/** Immutable card budget consumed by snapshot, composition, and scene geometry. */
export interface ResolvedKanbanPresentationBudget {
  /** Preset that supplied the values, or `custom` for caller data. */
  readonly preset: KanbanCardDensity | 'custom';
  /** Equality-only normalized policy revision. */
  readonly revision: KanbanRevision;
  /** Maximum descriptor rows. */
  readonly cardRows: number;
  /** Empty scene rows between adjacent cards. */
  readonly cardGap: number;
  /** Maximum selected metadata fields. */
  readonly metadataFields: number;
  /** Maximum label wrapping rows. */
  readonly labelRows: number;
  /** Maximum selected summary sections. */
  readonly summarySections: number;
  /** Resolved checklist detail mode. */
  readonly checklistMode: KanbanChecklistMode;
  /** Maximum checklist preview items across selected groups. */
  readonly checklistPreviewItems: number;
  /** Complete low-to-high removal order for optional sections. */
  readonly degradationOrder: readonly KanbanCardSectionKind[];
}

/** Optional card-specific ordering and subset request. */
export interface KanbanCardPresentationSelection {
  /** Requested metadata field order and subset. */
  readonly fieldIds?: readonly KanbanFieldId[];
  /** Requested summary order and subset. */
  readonly summaryIds?: readonly KanbanFieldId[];
  /** Requested checklist-group order and subset. */
  readonly checklistIds?: readonly KanbanChecklistId[];
}

/** Validated view maximum against which one card selection is intersected. */
export interface KanbanCardPresentationMaximum {
  /** Resolved immutable numeric presentation budget. */
  readonly budget: ResolvedKanbanPresentationBudget;
  /** Active immutable resource ceilings selected by the board. */
  readonly limits: KanbanResolvedLimits;
  /** Configured metadata fields available to this card. */
  readonly availableFieldIds: readonly KanbanFieldId[];
  /** Configured summaries available to this card. */
  readonly availableSummaryIds: readonly KanbanFieldId[];
  /** Configured checklist groups available to this card. */
  readonly availableChecklistIds: readonly KanbanChecklistId[];
}

/** Detached immutable section selection used by the standard card pipeline. */
export interface ResolvedKanbanCardPresentationSelection {
  /** Exact resolved budget supplied by the maximum. */
  readonly budget: ResolvedKanbanPresentationBudget;
  /** Exact active limits supplied by the maximum. */
  readonly limits: KanbanResolvedLimits;
  /** Known metadata IDs after intersection and cardinality capping. */
  readonly fieldIds: readonly KanbanFieldId[];
  /** Known summary IDs after intersection and cardinality capping. */
  readonly summaryIds: readonly KanbanFieldId[];
  /** Known checklist-group IDs after intersection. */
  readonly checklistIds: readonly KanbanChecklistId[];
}
