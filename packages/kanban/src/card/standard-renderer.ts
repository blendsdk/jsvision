import { KanbanInvalidDescriptorError } from '../contract/error.js';
import type { KanbanCardAdapter } from './adapter.js';
import { readKanbanCardAdapter } from './adapter.js';
import type {
  KanbanCardCue,
  KanbanCardDescriptor,
  KanbanCardRenderContext,
  KanbanCardSectionKind,
  KanbanCardTerminalCapabilities,
} from './descriptor.js';
import type { KanbanCardPresentationSnapshot } from './presentation-snapshot.js';
import { createStandardKanbanSectionCandidates } from './standard-sections.js';
import { clipKanbanCardText, measureKanbanCardText, normalizeKanbanCardText } from './text-layout.js';
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
}

/** Returns a stable surface role for the detached rich-card visual state. */
function snapshotSurfaceRole(snapshot: KanbanCardPresentationSnapshot): KanbanCardDescriptor['surfaceRole'] {
  if (snapshot.style.surfaceRole !== undefined) return snapshot.style.surfaceRole;
  if (snapshot.visualState.readOnly) return 'card.read-only';
  if (snapshot.visualState.focused && snapshot.visualState.selected) return 'card.focused-selected';
  if (snapshot.visualState.focused) return 'card.focused';
  if (snapshot.visualState.selected) return 'card.selected';
  return 'card.normal';
}

/** Builds deterministic non-color cues from the detached rich-card visual state. */
function snapshotCues(snapshot: KanbanCardPresentationSnapshot): readonly KanbanCardCue[] {
  const cues: KanbanCardCue[] = [];
  if (snapshot.visualState.focused) cues.push('focused');
  if (snapshot.visualState.selected) cues.push('selected');
  if (snapshot.visualState.readOnly) cues.push('read-only');
  if (snapshot.visualState.operation !== 'idle') cues.push(snapshot.visualState.operation);
  return Object.freeze(cues);
}

/** Records one section kind once while preserving first-omission order. */
function recordOmission(omitted: KanbanCardSectionKind[], kind: KanbanCardSectionKind): void {
  if (!omitted.includes(kind)) omitted.push(kind);
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
  });
  const retained = [...candidates];
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
  const surfaceRole = snapshotSurfaceRole(snapshot);
  const cues = snapshotCues(snapshot);
  const markerGlyph = snapshot.visualState.focused
    ? '>'
    : snapshot.visualState.selected
      ? '*'
      : snapshot.visualState.readOnly
        ? '#'
        : '|';
  return Object.freeze({
    cardKey: snapshot.cardKey,
    ...(snapshot.presentationRevision === undefined ? {} : { presentationRevision: snapshot.presentationRevision }),
    width: context.width,
    measuredHeight: rows.length,
    surfaceRole,
    borderRole: snapshot.style.borderRole ?? surfaceRole,
    marker: Object.freeze({
      row: 0,
      column: 0,
      glyph: markerGlyph,
      role: snapshot.style.markerRole ?? surfaceRole,
      cues,
    }),
    rows,
    sections,
    actions: Object.freeze([]),
    regions: Object.freeze([]),
    degradation: Object.freeze({
      level: omitted.length === 0 ? 'none' : rows.length === 2 ? 'minimum' : 'reduced',
      omittedSections: Object.freeze(omitted),
    }),
  });
}

/** Selects the stable semantic surface role for the current interaction state. */
function cardSurfaceRole(context: KanbanCardRenderContext): KanbanCardDescriptor['surfaceRole'] {
  if (context.readOnly) return 'card.read-only';
  if (context.focused && context.selected) return 'card.focused-selected';
  if (context.focused) return 'card.focused';
  if (context.selected) return 'card.selected';
  return 'card.normal';
}

/** Builds the explicit non-color cue inventory for the current interaction state. */
function cardCues(context: KanbanCardRenderContext): readonly KanbanCardCue[] {
  const cues: KanbanCardCue[] = [];
  if (context.focused) cues.push('focused');
  if (context.selected) cues.push('selected');
  if (context.readOnly) cues.push('read-only');
  if (context.operation !== 'idle') cues.push(context.operation);
  return cues;
}

/**
 * Renders mandatory title and status values from an application-owned card through a typed adapter.
 *
 * The Phase A renderer emits no card actions, regions, or optional content sections. Inter-card
 * spacing belongs to board layout and therefore does not increase the descriptor height.
 *
 * @example
 * ```ts
 * const descriptor = renderStandardKanbanCard(card, adapter, renderContext);
 * ```
 */
export function renderStandardKanbanCard<TCard>(
  card: TCard,
  adapter: KanbanCardAdapter<TCard>,
  context: KanbanCardRenderContext,
): KanbanCardDescriptor {
  if (!Number.isSafeInteger(context.width) || context.width < 2 || context.rowBudget < 2) {
    throw new KanbanInvalidDescriptorError();
  }
  const snapshot = readKanbanCardAdapter(card, adapter);
  if (snapshot.cardKey !== context.cardKey || snapshot.presentationRevision !== context.presentationRevision) {
    throw new KanbanInvalidDescriptorError();
  }
  const title = normalizeKanbanCardText(snapshot.title);
  const status = normalizeKanbanCardText(snapshot.status);
  if (
    title.length === 0 ||
    status.length === 0 ||
    measureKanbanCardText(title, context.capabilities.widthMode) === 0 ||
    measureKanbanCardText(status, context.capabilities.widthMode) === 0
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  const maximumTextCells = context.width - 1;
  const clippedTitle = clipKanbanCardText(title, maximumTextCells, context.capabilities.widthMode).text;
  const clippedStatus = clipKanbanCardText(status, maximumTextCells, context.capabilities.widthMode).text;
  if (
    clippedTitle.length === 0 ||
    clippedStatus.length === 0 ||
    measureKanbanCardText(clippedTitle, context.capabilities.widthMode) === 0 ||
    measureKanbanCardText(clippedStatus, context.capabilities.widthMode) === 0
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  const surfaceRole = cardSurfaceRole(context);
  const cues = cardCues(context);
  const markerGlyph = context.focused ? '>' : context.selected ? '*' : context.readOnly ? '#' : '|';
  return {
    cardKey: snapshot.cardKey,
    ...(snapshot.presentationRevision === undefined ? {} : { presentationRevision: snapshot.presentationRevision }),
    width: context.width,
    measuredHeight: 2,
    surfaceRole,
    borderRole: surfaceRole,
    marker: { row: 0, column: 0, glyph: markerGlyph, role: surfaceRole, cues },
    rows: [
      { section: 'title', spans: [{ column: 1, text: clippedTitle, role: 'content.title' }] },
      { section: 'status', spans: [{ column: 1, text: clippedStatus, role: 'content.status' }] },
    ],
    sections: [
      { id: 'title', kind: 'title', startRow: 0, rowCount: 1, priority: 0 },
      { id: 'status', kind: 'status', startRow: 1, rowCount: 1, priority: 1 },
    ],
    actions: [],
    regions: [],
    degradation: { level: 'none', omittedSections: [] },
  };
}
