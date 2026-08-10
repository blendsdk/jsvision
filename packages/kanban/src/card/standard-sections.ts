import type { KanbanCardRow, KanbanCardSectionKind } from './descriptor.js';
import { createKanbanChecklistSectionCandidates } from './checklist-renderer.js';
import type { KanbanChecklistCandidateMetadata } from './checklist-renderer.js';
import type { KanbanCardPresentationSnapshot } from './presentation-snapshot.js';
import { clipKanbanCardText, standardKanbanCardTextWidth, wrapKanbanCardText } from './text-layout.js';
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
  /** Optional checklist metadata used for staged preview degradation. */
  readonly checklist?: KanbanChecklistCandidateMetadata;
}

/** Inputs needed to turn a safe card snapshot into candidate terminal rows. */
export interface KanbanStandardSectionContext {
  /** Total card width in terminal cells, including the marker cell. */
  readonly width: number;
  /** Terminal width policy used for clipping. */
  readonly widthMode: 'wcwidth' | 'ambiguous-wide';
  /** Localized compact labels for active card feedback. */
  readonly feedbackLabels: Readonly<Record<'pending' | 'invalid' | 'rejected', string>>;
  /** Whether active feedback must share the mandatory status row at minimum geometry. */
  readonly compactFeedback: boolean;
}

/** Creates one clipped immutable row for a candidate section. */
function row(
  kind: KanbanCardSectionKind,
  value: string,
  role: KanbanThemeRole,
  context: KanbanStandardSectionContext,
): KanbanCardRow {
  const text = clipKanbanCardText(value, standardKanbanCardTextWidth(context.width), context.widthMode).text;
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
    const rows =
      kind === 'labels'
        ? wrapKanbanCardText(
            fieldText(field.label, field.values),
            standardKanbanCardTextWidth(context.width),
            snapshot.selection.budget.labelRows,
            context.widthMode,
          ).map((value) => row(kind, value, role, context))
        : [row(kind, fieldText(field.label, field.values), role, context)];
    if (rows.length === 0) continue;
    candidates.push(
      Object.freeze({
        id: `field:${field.fieldId}`,
        kind,
        priority: field.priority,
        rows: Object.freeze(rows),
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

  candidates.push(
    ...createKanbanChecklistSectionCandidates(snapshot, {
      width: context.width,
      widthMode: context.widthMode,
      ...(textRole === undefined ? {} : { textRole }),
    }),
  );

  const feedback = snapshot.visualState.invalid
    ? { label: context.feedbackLabels.invalid, role: 'operation.rejected' as const }
    : snapshot.visualState.operation === 'rejected'
      ? { label: context.feedbackLabels.rejected, role: 'operation.rejected' as const }
      : snapshot.visualState.operation === 'pending'
        ? { label: context.feedbackLabels.pending, role: 'operation.pending' as const }
        : undefined;
  if (feedback !== undefined) {
    if (context.compactFeedback) {
      const statusIndex = candidates.findIndex(({ kind }) => kind === 'status');
      const status = candidates[statusIndex];
      if (status !== undefined) {
        candidates[statusIndex] = Object.freeze({
          ...status,
          rows: Object.freeze([row('status', `${snapshot.status} · ${feedback.label}`, feedback.role, context)]),
        });
      }
      return Object.freeze(candidates);
    }
    candidates.push(
      Object.freeze({
        id: 'feedback',
        kind: 'feedback',
        priority: 2,
        rows: Object.freeze([row('feedback', feedback.label, feedback.role, context)]),
        optional: false,
      }),
    );
  }

  return Object.freeze(candidates);
}
