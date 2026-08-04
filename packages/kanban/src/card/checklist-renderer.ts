import { createKanbanExtensionId } from '../contract/identity.js';
import type { KanbanExtensionId } from '../contract/identity.js';
import type { KanbanChecklistGroup } from './checklist.js';
import type { KanbanCardRow } from './descriptor.js';
import type { KanbanCardPresentationSnapshot } from './presentation-snapshot.js';
import { clipKanbanCardText } from './text-layout.js';
import type { KanbanThemeRole } from './theme.js';

/** Stable package action emitted by read-only checklist regions to request the card editor. */
export const KANBAN_OPEN_CARD_EDITOR_ACTION_ID: KanbanExtensionId = createKanbanExtensionId('kanban.card.open-editor');

/** Checklist-specific candidate metadata used for staged preview degradation. */
export type KanbanChecklistCandidateMetadata =
  | {
      readonly kind: 'header';
      readonly completed: number;
      readonly total: number;
      readonly omitted: number;
    }
  | { readonly kind: 'title' }
  | { readonly kind: 'item' };

/** Structural checklist candidate consumed by the standard section composer. */
export interface KanbanChecklistSectionCandidate {
  /** Descriptor-local stable identity. */
  readonly id: string;
  /** Preview or progress semantic family. */
  readonly kind: 'checklist-progress' | 'checklist-preview';
  /** Degradation priority. */
  readonly priority: number;
  /** One already-clipped checklist row. */
  readonly rows: readonly KanbanCardRow[];
  /** Checklist-specific staged-degradation metadata. */
  readonly checklist: KanbanChecklistCandidateMetadata;
  /** Checklist rows are always optional. */
  readonly optional: true;
}

/** Geometry and style values needed for checklist row composition. */
export interface KanbanChecklistCompositionContext {
  /** Total card width including the marker cell. */
  readonly width: number;
  /** Terminal width policy used for clipping. */
  readonly widthMode: 'wcwidth' | 'ambiguous-wide';
  /** Optional semantic role selected for standard optional text. */
  readonly textRole?: KanbanThemeRole;
}

/** Creates one clipped checklist row. */
function checklistRow(
  kind: 'checklist-progress' | 'checklist-preview',
  text: string,
  role: KanbanThemeRole,
  context: KanbanChecklistCompositionContext,
): KanbanCardRow {
  const clipped = clipKanbanCardText(text, context.width - 1, context.widthMode).text;
  return Object.freeze({ section: kind, spans: Object.freeze([Object.freeze({ column: 1, text: clipped, role })]) });
}

/** Returns selected checklist groups in the resolved per-card order. */
function selectedGroups(snapshot: KanbanCardPresentationSnapshot): readonly KanbanChecklistGroup[] {
  const groups: KanbanChecklistGroup[] = [];
  for (const checklistId of snapshot.selection.checklistIds) {
    const group = snapshot.checklists.find((candidate) => candidate.checklistId === checklistId);
    if (group !== undefined) groups.push(group);
  }
  return groups;
}

/** Builds the checklist progress text, including honest preview omission evidence. */
function progressText(completed: number, total: number, omitted: number): string {
  return `${completed}/${total}${omitted > 0 ? ` +${omitted}` : ''}`;
}

/** Creates hidden/progress/preview candidates without mutating checklist publication data. */
export function createKanbanChecklistSectionCandidates(
  snapshot: KanbanCardPresentationSnapshot,
  context: KanbanChecklistCompositionContext,
): readonly KanbanChecklistSectionCandidate[] {
  const mode = snapshot.selection.budget.checklistMode;
  if (mode === 'hidden') return Object.freeze([]);
  const groups = selectedGroups(snapshot);
  const items = groups.flatMap((group) => group.items);
  if (items.length === 0) return Object.freeze([]);
  const completed = items.filter((item) => item.completed).length;
  const total = items.length;
  const previewLimit = mode === 'preview' ? snapshot.selection.budget.checklistPreviewItems : 0;
  const visibleItems = items.slice(0, previewLimit);
  const omitted = mode === 'preview' ? total - visibleItems.length : 0;
  const kind: 'checklist-progress' | 'checklist-preview' =
    mode === 'preview' ? 'checklist-preview' : 'checklist-progress';
  const candidates: KanbanChecklistSectionCandidate[] = [
    Object.freeze({
      id: 'checklist:header',
      kind,
      priority: 10_000,
      rows: Object.freeze([
        checklistRow(kind, progressText(completed, total, omitted), context.textRole ?? 'checklist.progress', context),
      ]),
      checklist: Object.freeze({ kind: 'header', completed, total, omitted }),
      optional: true,
    }),
  ];
  if (mode !== 'preview') return Object.freeze(candidates);

  for (const group of groups) {
    if (group.title !== undefined && group.items.some((item) => visibleItems.includes(item))) {
      candidates.push(
        Object.freeze({
          id: `checklist:title:${group.checklistId}`,
          kind: 'checklist-preview',
          priority: 20_000,
          rows: Object.freeze([
            checklistRow('checklist-preview', group.title, context.textRole ?? 'content.metadata', context),
          ]),
          checklist: Object.freeze({ kind: 'title' }),
          optional: true,
        }),
      );
    }
    for (const item of group.items) {
      const index = visibleItems.indexOf(item);
      if (index < 0) continue;
      candidates.push(
        Object.freeze({
          id: `checklist:item:${group.checklistId}:${item.itemId}`,
          kind: 'checklist-preview',
          priority: 30_000 + index,
          rows: Object.freeze([
            checklistRow(
              'checklist-preview',
              `${item.completed ? '[x]' : '[ ]'} ${item.text}`,
              context.textRole ?? (item.completed ? 'checklist.complete' : 'checklist.incomplete'),
              context,
            ),
          ]),
          checklist: Object.freeze({ kind: 'item' }),
          optional: true,
        }),
      );
    }
  }
  return Object.freeze(candidates);
}

/** Rebuilds a preview header after one or more item rows are omitted by geometry. */
export function updateKanbanChecklistHeader(
  candidate: KanbanChecklistSectionCandidate,
  omitted: number,
  progressOnly: boolean,
  context: KanbanChecklistCompositionContext,
): KanbanChecklistSectionCandidate {
  if (candidate.checklist.kind !== 'header') return candidate;
  const kind: 'checklist-progress' | 'checklist-preview' = progressOnly ? 'checklist-progress' : 'checklist-preview';
  return Object.freeze({
    ...candidate,
    kind,
    rows: Object.freeze([
      checklistRow(
        kind,
        progressText(candidate.checklist.completed, candidate.checklist.total, progressOnly ? 0 : omitted),
        context.textRole ?? 'checklist.progress',
        context,
      ),
    ]),
    checklist: Object.freeze({ ...candidate.checklist, omitted }),
  });
}
