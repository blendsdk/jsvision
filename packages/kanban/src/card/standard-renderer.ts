import { KanbanInvalidDescriptorError } from '../contract/error.js';
import type { KanbanCardAdapter } from './adapter.js';
import { readKanbanCardAdapter } from './adapter.js';
import type { KanbanCardCue, KanbanCardDescriptor, KanbanCardRenderContext } from './descriptor.js';
import { clipKanbanCardText, measureKanbanCardText, normalizeKanbanCardText } from './text-layout.js';

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
