import type {
  CardKey,
  KanbanChecklistId,
  KanbanColumnId,
  KanbanFieldId,
  KanbanSwimlaneId,
} from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';

/** One compact application-owned assignee label carried by the convenience card model. */
export interface StandardCardAssignee {
  /** Stable application identity for the assignee. */
  readonly id: string;
  /** Application-formatted display label. */
  readonly label: string;
}

/** One compact application-owned label carried by the convenience card model. */
export interface StandardCardLabel {
  /** Stable application identity for the label. */
  readonly id: string;
  /** Application-formatted display label. */
  readonly label: string;
}

/** One read-only checklist item available to later standard-card presentation modes. */
export interface StandardCardChecklistItem {
  /** Stable application identity within its checklist group. */
  readonly itemId: string;
  /** Application-owned checklist text. */
  readonly text: string;
  /** Whether the application currently considers the item complete. */
  readonly completed: boolean;
}

/** One ordered checklist group carried by a standard card. */
export interface StandardCardChecklist {
  /** Stable checklist-group identity. */
  readonly checklistId: KanbanChecklistId;
  /** Optional application-formatted group heading. */
  readonly title?: string;
  /** Ordered application-owned items in this group. */
  readonly items: readonly StandardCardChecklistItem[];
}

/** One compact application-formatted summary value carried by a standard card. */
export interface StandardCardSummary {
  /** Stable identity of the application field being summarized. */
  readonly fieldId: KanbanFieldId;
  /** Application-formatted summary label. */
  readonly label: string;
  /** Application-formatted summary value. */
  readonly value: string;
}

/**
 * Optional convenience model for common Kanban card data.
 *
 * Applications may use any record shape through `KanbanCardAdapter`; this interface is not a base
 * class and the package never requires application records to implement it. Date and custom values stay
 * opaque until application-provided formatters or later editor schemas consume them.
 *
 * @example
 * ```ts
 * const card: StandardCard = {
 *   key: 'work-42',
 *   columnId: 'ready',
 *   title: 'Review release notes',
 *   status: 'Ready',
 * };
 * ```
 */
export interface StandardCard<TDate = unknown, TCustom = unknown> {
  /** Stable application-owned card identity. */
  readonly key: CardKey;
  /** Workflow column that currently contains the card. */
  readonly columnId: KanbanColumnId;
  /** Optional horizontal grouping identity. */
  readonly swimlaneId?: KanbanSwimlaneId;
  /** Optional application ordering value; the package does not rewrite it. */
  readonly rank?: string | number;
  /** Optional equality-only revision for presentation-affecting values. */
  readonly presentationRevision?: KanbanRevision;
  /** Required primary card label. */
  readonly title: string;
  /** Required application-formatted workflow status. */
  readonly status: string;
  /** Optional long description reserved for editor and later presentation phases. */
  readonly description?: string;
  /** Optional application-formatted work-item type. */
  readonly type?: string;
  /** Optional application-formatted priority. */
  readonly priority?: string;
  /** Optional ordered assignee summaries. */
  readonly assignees?: readonly StandardCardAssignee[];
  /** Optional ordered card labels. */
  readonly labels?: readonly StandardCardLabel[];
  /** Optional opaque start-date value interpreted only by an injected formatter. */
  readonly startDate?: TDate;
  /** Optional opaque due-date value interpreted only by an injected formatter. */
  readonly dueDate?: TDate;
  /** Optional application-formatted estimate. */
  readonly estimate?: string;
  /** Optional application-formatted business value. */
  readonly value?: string;
  /** Optional ordered checklist groups reserved for configurable later rendering. */
  readonly checklists?: readonly StandardCardChecklist[];
  /** Optional ordered compact summary values. */
  readonly summaries?: readonly StandardCardSummary[];
  /** Optional application-specific data retained without interpretation. */
  readonly custom?: TCustom;
}
