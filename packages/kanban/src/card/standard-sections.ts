import type { KanbanCardRow, KanbanCardSectionKind } from './descriptor.js';
import type { KanbanCardPresentationSnapshot } from './presentation-snapshot.js';
import { clipKanbanCardText } from './text-layout.js';
import type { KanbanThemeRole } from './theme.js';

/** One immutable candidate section before the card row budget is applied. */
export interface KanbanStandardSectionCandidate {
  /** Descriptor-local stable section identity. */
  readonly id: string;
  /** Semantic family used by degradation policy. */
  readonly kind: KanbanCardSectionKind;
  /** Lower values survive optional degradation longer. */
  readonly priority: number;
  /** Already clipped rows emitted together when the section is retained. */
  readonly rows: readonly KanbanCardRow[];
  /** Whether geometry may omit this section. */
  readonly optional: boolean;
}

/** Inputs needed to turn a safe card snapshot into candidate terminal rows. */
export interface KanbanStandardSectionContext {
  /** Total card width in terminal cells, including the marker cell. */
  readonly width: number;
  /** Terminal width policy used for clipping. */
  readonly widthMode: 'wcwidth' | 'ambiguous-wide';
}

/** Creates one clipped immutable row for a candidate section. */
function row(
  kind: KanbanCardSectionKind,
  value: string,
  role: KanbanThemeRole,
  context: KanbanStandardSectionContext,
): KanbanCardRow {
  const text = clipKanbanCardText(value, context.width - 1, context.widthMode).text;
  return Object.freeze({ section: kind, spans: Object.freeze([Object.freeze({ column: 1, text, role })]) });
}

/** Joins a field label and values without allowing values to create extra rows. */
function fieldText(label: string, values: readonly string[]): string {
  return `${label}: ${values.join(', ')}`;
}

/** Joins one bounded summary label with its text/count evidence. */
function summaryText(label: string, text: string | undefined, count: number | undefined): string {
  const value = text === undefined ? String(count) : count === undefined ? text : `${text} (${count})`;
  return `${label}: ${value}`;
}

/** Builds mandatory and selected optional standard-card candidate sections in source order. */
export function createStandardKanbanSectionCandidates(
  snapshot: KanbanCardPresentationSnapshot,
  context: KanbanStandardSectionContext,
): readonly KanbanStandardSectionCandidate[] {
  const titleRole = snapshot.style.titleRole ?? 'content.title';
  const statusRole = snapshot.style.statusRole ?? 'content.status';
  const textRole = snapshot.style.textRole;
  const candidates: KanbanStandardSectionCandidate[] = [
    Object.freeze({
      id: 'title',
      kind: 'title',
      priority: 0,
      rows: Object.freeze([row('title', snapshot.title, titleRole, context)]),
      optional: false,
    }),
    Object.freeze({
      id: 'status',
      kind: 'status',
      priority: 1,
      rows: Object.freeze([row('status', snapshot.status, statusRole, context)]),
      optional: false,
    }),
  ];

  for (const field of snapshot.fields) {
    const kind = field.kind === 'labels' ? 'labels' : 'metadata';
    const role = field.role ?? textRole ?? (kind === 'labels' ? 'content.label' : 'content.metadata');
    candidates.push(
      Object.freeze({
        id: `field:${field.fieldId}`,
        kind,
        priority: field.priority,
        rows: Object.freeze([row(kind, fieldText(field.label, field.values), role, context)]),
        optional: true,
      }),
    );
  }

  for (const summary of snapshot.summaries) {
    candidates.push(
      Object.freeze({
        id: `summary:${summary.summaryId}`,
        kind: 'summary',
        priority: summary.priority,
        rows: Object.freeze([
          row(
            'summary',
            summaryText(summary.label, summary.text, summary.count),
            summary.role ?? textRole ?? 'content.summary',
            context,
          ),
        ]),
        optional: true,
      }),
    );
  }

  return Object.freeze(candidates);
}
