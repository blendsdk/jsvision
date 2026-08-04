import { KanbanInvalidDescriptorError } from '../contract/error.js';
import { createKanbanChecklistId, createKanbanFieldId } from '../contract/identity.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import { KANBAN_PHASE_B_ENGLISH_MESSAGES } from '../i18n/catalog.js';
import type { KanbanCardPresentationAdapter } from './adapter.js';
import { snapshotKanbanChecklistGroups } from './checklist.js';
import type { KanbanChecklistGroup } from './checklist.js';
import { KANBAN_OPEN_CARD_EDITOR_ACTION_ID, updateKanbanChecklistHeader } from './checklist-renderer.js';
import type { KanbanChecklistSectionCandidate } from './checklist-renderer.js';
import type {
  KanbanCardDescriptor,
  KanbanCardRenderContext,
  KanbanCardSectionKind,
  KanbanCardTerminalCapabilities,
} from './descriptor.js';
import { snapshotKanbanCardPresentation } from './presentation-snapshot.js';
import type { KanbanCardPresentationSnapshot } from './presentation-snapshot.js';
import { resolveKanbanPresentation } from './presentation-policy.js';
import { resolveKanbanCardStyle } from './style-resolver.js';
import { createStandardKanbanSectionCandidates } from './standard-sections.js';
import type { KanbanStandardSectionCandidate } from './standard-sections.js';
import { measureKanbanCardText, normalizeKanbanCardText } from './text-layout.js';
import type { KanbanTheme } from './theme.js';

/** Geometry/theme inputs used to compose one detached rich card snapshot. */
export interface KanbanStandardCardCompositionContext {
  /** Exact descriptor width in terminal cells. */
  readonly width: number;
  /** Maximum descriptor rows for this projection. */
  readonly rowBudget: number;
  /** Fully resolved semantic theme. */
  readonly theme: Readonly<KanbanTheme>;
  /** Terminal features used for deterministic text geometry. */
  readonly capabilities: Readonly<KanbanCardTerminalCapabilities>;
  /** Optional localized label for the read-only checklist editor action. */
  readonly openEditorLabel?: string;
  /** Optional localized compact labels for pending, invalid, and rejected card state. */
  readonly feedbackLabels?: Partial<Readonly<Record<'pending' | 'invalid' | 'rejected', string>>>;
}

/** Records one section kind once while preserving first-omission order. */
function recordOmission(omitted: KanbanCardSectionKind[], kind: KanbanCardSectionKind): void {
  if (!omitted.includes(kind)) omitted.push(kind);
}

/** Finds the last retained candidate matching one degradation predicate. */
function findLastCandidateIndex(
  candidates: readonly KanbanStandardSectionCandidate[],
  predicate: (candidate: KanbanStandardSectionCandidate) => boolean,
): number {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (predicate(candidates[index]!)) return index;
  }
  return -1;
}

/** Narrows one generic section candidate to the checklist renderer's structural candidate. */
function isChecklistCandidate(
  candidate: KanbanStandardSectionCandidate | undefined,
): candidate is KanbanChecklistSectionCandidate {
  return (
    candidate !== undefined &&
    (candidate.kind === 'checklist-progress' || candidate.kind === 'checklist-preview') &&
    candidate.checklist !== undefined &&
    candidate.optional
  );
}

/**
 * Composes one detached presentation snapshot into a bounded immutable descriptor.
 *
 * Mandatory title/status rows always survive. Optional metadata, labels, and summaries follow source
 * order and are removed according to the resolved degradation order, then descending priority within
 * one semantic family.
 *
 * @example
 * ```ts
 * const descriptor = composeStandardKanbanCard(snapshot, compositionContext);
 * ```
 */
export function composeStandardKanbanCard(
  snapshot: KanbanCardPresentationSnapshot,
  context: KanbanStandardCardCompositionContext,
): KanbanCardDescriptor {
  if (
    !Number.isSafeInteger(context.width) ||
    context.width < 2 ||
    !Number.isSafeInteger(context.rowBudget) ||
    context.rowBudget < 2 ||
    context.rowBudget > snapshot.selection.budget.cardRows
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  if (
    measureKanbanCardText(snapshot.title, context.capabilities.widthMode) === 0 ||
    measureKanbanCardText(snapshot.status, context.capabilities.widthMode) === 0
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  const candidates = createStandardKanbanSectionCandidates(snapshot, {
    width: context.width,
    widthMode: context.capabilities.widthMode,
    compactFeedback: context.rowBudget === 2,
    feedbackLabels: Object.freeze({
      pending:
        normalizeKanbanCardText(
          context.feedbackLabels?.pending ?? KANBAN_PHASE_B_ENGLISH_MESSAGES['kanban.card.feedback.pending'],
        ) || KANBAN_PHASE_B_ENGLISH_MESSAGES['kanban.card.feedback.pending'],
      invalid:
        normalizeKanbanCardText(
          context.feedbackLabels?.invalid ?? KANBAN_PHASE_B_ENGLISH_MESSAGES['kanban.card.feedback.invalid'],
        ) || KANBAN_PHASE_B_ENGLISH_MESSAGES['kanban.card.feedback.invalid'],
      rejected:
        normalizeKanbanCardText(
          context.feedbackLabels?.rejected ?? KANBAN_PHASE_B_ENGLISH_MESSAGES['kanban.card.feedback.rejected'],
        ) || KANBAN_PHASE_B_ENGLISH_MESSAGES['kanban.card.feedback.rejected'],
    }),
  });
  const retained: KanbanStandardSectionCandidate[] = [...candidates];
  const omitted: KanbanCardSectionKind[] = [];
  let height = retained.reduce((total, candidate) => total + candidate.rows.length, 0);
  const removeCandidate = (index: number): void => {
    const [removed] = retained.splice(index, 1);
    if (removed === undefined) return;
    height -= removed.rows.length;
    recordOmission(omitted, removed.kind);
  };

  let retainedLabelRows = 0;
  for (let index = 0; index < retained.length;) {
    const candidate = retained[index]!;
    if (candidate.kind !== 'labels') {
      index += 1;
      continue;
    }
    if (retainedLabelRows + candidate.rows.length <= snapshot.selection.budget.labelRows) {
      retainedLabelRows += candidate.rows.length;
      index += 1;
      continue;
    }
    removeCandidate(index);
  }

  for (const kind of snapshot.selection.budget.degradationOrder) {
    if (kind === 'checklist-preview') {
      while (height > context.rowBudget) {
        const itemIndex = findLastCandidateIndex(retained, (candidate) => candidate.checklist?.kind === 'item');
        if (itemIndex >= 0) {
          removeCandidate(itemIndex);
          const headerIndex = retained.findIndex((candidate) => candidate.checklist?.kind === 'header');
          const header = retained[headerIndex];
          if (isChecklistCandidate(header) && header.checklist.kind === 'header') {
            retained[headerIndex] = updateKanbanChecklistHeader(header, header.checklist.omitted + 1, false, {
              width: context.width,
              widthMode: context.capabilities.widthMode,
              ...(snapshot.style.textRole === undefined ? {} : { textRole: snapshot.style.textRole }),
            });
          }
          continue;
        }
        const titleIndex = findLastCandidateIndex(retained, (candidate) => candidate.checklist?.kind === 'title');
        if (titleIndex >= 0) {
          removeCandidate(titleIndex);
          continue;
        }
        const headerIndex = retained.findIndex(
          (candidate) => candidate.kind === 'checklist-preview' && candidate.checklist?.kind === 'header',
        );
        const header = retained[headerIndex];
        if (!isChecklistCandidate(header)) break;
        retained[headerIndex] = updateKanbanChecklistHeader(header, 0, true, {
          width: context.width,
          widthMode: context.capabilities.widthMode,
          ...(snapshot.style.textRole === undefined ? {} : { textRole: snapshot.style.textRole }),
        });
        recordOmission(omitted, 'checklist-preview');
        break;
      }
    }
    while (height > context.rowBudget) {
      let removalIndex = -1;
      let removalPriority = -1;
      for (let index = 0; index < retained.length; index += 1) {
        const candidate = retained[index]!;
        if (candidate.optional && candidate.kind === kind && candidate.priority >= removalPriority) {
          removalIndex = index;
          removalPriority = candidate.priority;
        }
      }
      if (removalIndex < 0) break;
      removeCandidate(removalIndex);
    }
  }
  while (height > context.rowBudget) {
    let removalIndex = -1;
    let removalPriority = -1;
    for (let index = 0; index < retained.length; index += 1) {
      const candidate = retained[index]!;
      if (candidate.optional && candidate.priority >= removalPriority) {
        removalIndex = index;
        removalPriority = candidate.priority;
      }
    }
    if (removalIndex < 0) break;
    removeCandidate(removalIndex);
  }
  if (height > context.rowBudget) throw new KanbanInvalidDescriptorError();

  const rows = Object.freeze(retained.flatMap((candidate) => candidate.rows));
  let startRow = 0;
  const sections = Object.freeze(
    retained.map((candidate) => {
      const section = Object.freeze({
        id: candidate.id,
        kind: candidate.kind,
        startRow,
        rowCount: candidate.rows.length,
        priority: candidate.priority,
      });
      startRow += candidate.rows.length;
      return section;
    }),
  );
  const resolvedStyle = resolveKanbanCardStyle(snapshot.style, snapshot.visualState, context.capabilities);
  const checklistStart = sections.find(
    (section) => section.kind === 'checklist-progress' || section.kind === 'checklist-preview',
  )?.startRow;
  const checklistEnd = sections.reduce(
    (end, section) =>
      section.kind === 'checklist-progress' || section.kind === 'checklist-preview'
        ? Math.max(end, section.startRow + section.rowCount)
        : end,
    checklistStart ?? 0,
  );
  const fallbackOpenEditorLabel = KANBAN_PHASE_B_ENGLISH_MESSAGES['kanban.action.open-card-editor'];
  const openEditorLabel =
    normalizeKanbanCardText(context.openEditorLabel ?? fallbackOpenEditorLabel) || fallbackOpenEditorLabel;
  const hasChecklistRegion = checklistStart !== undefined && checklistEnd > checklistStart;
  return Object.freeze({
    cardKey: snapshot.cardKey,
    ...(snapshot.presentationRevision === undefined ? {} : { presentationRevision: snapshot.presentationRevision }),
    width: context.width,
    measuredHeight: rows.length,
    surfaceRole: resolvedStyle.surfaceRole,
    borderRole: resolvedStyle.borderRole,
    marker: Object.freeze({
      row: 0,
      column: 0,
      glyph: resolvedStyle.markerGlyph,
      role: resolvedStyle.markerRole,
      cues: resolvedStyle.cues,
    }),
    rows,
    sections,
    actions: hasChecklistRegion
      ? Object.freeze([
          Object.freeze({ actionId: KANBAN_OPEN_CARD_EDITOR_ACTION_ID, label: openEditorLabel, enabled: true }),
        ])
      : Object.freeze([]),
    regions: hasChecklistRegion
      ? Object.freeze([
          Object.freeze({
            regionId: 'checklist:open-editor',
            kind: 'action' as const,
            x: 1,
            y: checklistStart,
            width: context.width - 1,
            height: checklistEnd - checklistStart,
            actionId: KANBAN_OPEN_CARD_EDITOR_ACTION_ID,
          }),
        ])
      : Object.freeze([]),
    degradation: Object.freeze({
      level: omitted.length === 0 ? 'none' : rows.length === 2 ? 'minimum' : 'reduced',
      omittedSections: Object.freeze(omitted),
    }),
  });
}

/** Reads configured field or summary identities without invoking application accessors. */
function configuredAdapterIds<TCard>(
  adapter: KanbanCardPresentationAdapter<TCard>,
  member: 'fields' | 'summaries',
  identityMember: 'fieldId' | 'summaryId',
  maximum: number,
): readonly string[] {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(adapter, member);
    if (descriptor?.get !== undefined || descriptor?.set !== undefined) return Object.freeze([]);
    const values: unknown = descriptor?.value;
    if (values === undefined) return Object.freeze([]);
    if (!Array.isArray(values) || values.length > maximum) return Object.freeze([]);
    const identities: string[] = [];
    for (let index = 0; index < values.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(values, index)) return Object.freeze([]);
      const value: unknown = values[index];
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return Object.freeze([]);
      const identity = Object.getOwnPropertyDescriptor(value, identityMember);
      if (identity?.get !== undefined || identity?.set !== undefined || typeof identity?.value !== 'string') {
        return Object.freeze([]);
      }
      identities.push(identity.value);
    }
    return Object.freeze(identities);
  } catch {
    return Object.freeze([]);
  }
}

/** Acquires and validates checklist values once for the convenience wrapper. */
function readChecklistValues<TCard>(
  card: TCard,
  adapter: KanbanCardPresentationAdapter<TCard>,
  maximumGroups: number,
  maximumItems: number,
): readonly KanbanChecklistGroup[] {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(adapter, 'checklistOf');
    if (descriptor?.get !== undefined || descriptor?.set !== undefined) return Object.freeze([]);
    const callback: unknown = descriptor?.value;
    if (callback === undefined) return Object.freeze([]);
    if (typeof callback !== 'function') return Object.freeze([]);
    return snapshotKanbanChecklistGroups(Reflect.apply(callback, undefined, [card]), maximumGroups, maximumItems);
  } catch {
    return Object.freeze([]);
  }
}

/**
 * Snapshots and composes an application-owned card through the standard rich-card pipeline.
 *
 * Original mandatory-only adapters remain compatible because every rich member is optional. Card
 * spacing belongs to board layout and therefore does not increase the descriptor height.
 *
 * @example
 * ```ts
 * const descriptor = renderStandardKanbanCard(card, adapter, renderContext);
 * ```
 */
export function renderStandardKanbanCard<TCard>(
  card: TCard,
  adapter: KanbanCardPresentationAdapter<TCard>,
  context: KanbanCardRenderContext,
): KanbanCardDescriptor {
  if (!Number.isSafeInteger(context.width) || context.width < 2 || context.rowBudget < 2) {
    throw new KanbanInvalidDescriptorError();
  }
  const limits = validateKanbanLimitOptions({ class: 'standard' });
  const budget = resolveKanbanPresentation(context.density, limits);
  const fields = configuredAdapterIds(adapter, 'fields', 'fieldId', limits.cardFields);
  const summaries = configuredAdapterIds(adapter, 'summaries', 'summaryId', limits.summarySections);
  const checklistValues = readChecklistValues(card, adapter, limits.checklistGroups, limits.checklistItemsPerGroup);
  const maximum = {
    budget,
    limits,
    availableFieldIds: fields.map(createKanbanFieldId),
    availableSummaryIds: summaries.map(createKanbanFieldId),
    availableChecklistIds: checklistValues.map(({ checklistId }) => createKanbanChecklistId(checklistId)),
  };
  const snapshot = snapshotKanbanCardPresentation(card, adapter, {
    maximum,
    visualState: {
      focused: context.focused,
      selected: context.selected,
      rangeAnchor: false,
      readOnly: context.readOnly,
      invalid: context.operation === 'rejected',
      operation: context.operation,
    },
    formatting: context.formatting,
    checklistValues,
  });
  if (snapshot.cardKey !== context.cardKey || snapshot.presentationRevision !== context.presentationRevision) {
    throw new KanbanInvalidDescriptorError();
  }
  return composeStandardKanbanCard(snapshot, {
    width: context.width,
    rowBudget: Math.min(context.rowBudget, budget.cardRows),
    theme: context.theme,
    capabilities: context.capabilities,
  });
}
