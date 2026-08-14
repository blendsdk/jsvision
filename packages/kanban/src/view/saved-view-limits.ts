import { KANBAN_LIMITS, KANBAN_STRUCTURE_PRESENTATION_LIMITS } from '../contract/limits.js';

/** Fixed conservative budgets used at every untrusted saved-view entry point. */
export interface KanbanSavedViewLimits {
  /** Maximum UTF-8 bytes accepted for one complete encoded envelope. */
  readonly encodedBytes: number;
  /** Maximum nested array/object depth accepted before retention. */
  readonly depth: number;
  /** Maximum entries accepted in any one envelope array. */
  readonly arrayEntries: number;
  /** Maximum enumerable keys accepted in any one envelope object. */
  readonly objectKeys: number;
  /** Maximum UTF-8 bytes accepted for any one string or object key. */
  readonly stringBytes: number;
  /** Maximum workflow columns retained by a durable view. */
  readonly columns: number;
  /** Maximum semantic swimlanes retained by a durable view. */
  readonly swimlanes: number;
  /** Maximum filter, quick-filter, sort, and card-field directives per facet. */
  readonly fieldDirectives: number;
  /** Maximum summary-section identities retained by card presentation. */
  readonly summaries: number;
  /** Maximum inert application extensions retained by one envelope. */
  readonly extensions: number;
  /** Maximum registered identities inspected during one reconciliation. */
  readonly registeredIds: number;
  /** Maximum sequential migration adapters registered at once. */
  readonly migrations: number;
  /** Maximum non-fatal diagnostics returned by reconciliation. */
  readonly diagnostics: number;
  /** Inclusive maximum saved column width in terminal cells. */
  readonly columnWidthCells: number;
}

/**
 * Conservative immutable budgets shared by parsing, migration, reconciliation, and serialization.
 *
 * JSON shape limits intentionally match the semantic-value snapshotter. A value accepted during
 * parsing must remain acceptable when it is detached and canonically serialized later.
 *
 * @example
 * ```ts
 * if (encoded.byteLength > KANBAN_SAVED_VIEW_LIMITS.encodedBytes) rejectSavedView();
 * ```
 */
export const KANBAN_SAVED_VIEW_LIMITS: KanbanSavedViewLimits = Object.freeze({
  encodedBytes: KANBAN_LIMITS.savedViewEncodedBytes.safe,
  depth: KANBAN_LIMITS.savedViewDepth.safe,
  arrayEntries: KANBAN_LIMITS.savedViewArrayEntries.safe,
  objectKeys: KANBAN_LIMITS.savedViewObjectKeys.safe,
  stringBytes: KANBAN_LIMITS.savedViewStringBytes.safe,
  columns: KANBAN_LIMITS.columns.safe,
  swimlanes: KANBAN_LIMITS.swimlanes.safe,
  fieldDirectives: KANBAN_LIMITS.cardFields.safe,
  summaries: KANBAN_LIMITS.summarySections.safe,
  extensions: KANBAN_LIMITS.savedViewExtensions.safe,
  registeredIds: KANBAN_LIMITS.savedViewRegisteredIds.safe,
  migrations: KANBAN_LIMITS.savedViewMigrations.safe,
  diagnostics: KANBAN_LIMITS.savedViewDiagnostics.safe,
  columnWidthCells: KANBAN_STRUCTURE_PRESENTATION_LIMITS.columnWidthCells,
});
