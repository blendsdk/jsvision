import { charWidth, sanitize } from '@jsvision/core';
import type { WidthMode } from '@jsvision/core';

import { KanbanInvalidDescriptorError } from '../contract/error.js';
import type { KanbanCardAdapter } from './adapter.js';
import { readKanbanCardAdapter } from './adapter.js';
import type { KanbanCardCue, KanbanCardDescriptor, KanbanCardRenderContext } from './descriptor.js';

/** Bidirectional formatting controls that can visually reorder otherwise safe terminal text. */
const BIDI_CONTROL_CHARACTERS = /[\u202a-\u202e\u2066-\u2069]/gu;

/** Converts untrusted application text to one safe display line. */
function normalizeCardText(value: string): string {
  return sanitize(value)
    .replace(BIDI_CONTROL_CHARACTERS, '')
    .replace(/[\t\n]+/gu, ' ')
    .trim();
}

/** Measures one normalized line using the active terminal width policy. */
function cardTextWidth(value: string, widthMode: WidthMode): number {
  let width = 0;
  for (const character of value) width += charWidth(character.codePointAt(0) ?? 0, widthMode);
  return width;
}

/** Clips text to terminal cells and appends an ellipsis without splitting a wide glyph. */
function clipCardText(value: string, maximumCells: number, widthMode: WidthMode): string {
  if (maximumCells < 1) return '';
  let used = 0;
  let complete = '';
  for (const character of value) {
    const width = charWidth(character.codePointAt(0) ?? 0, widthMode);
    if (used + width > maximumCells) {
      const ellipsisWidth = charWidth(0x2026, widthMode);
      if (ellipsisWidth > maximumCells) return complete;
      while (used + ellipsisWidth > maximumCells && complete.length > 0) {
        const characters = Array.from(complete);
        const removed = characters.pop();
        complete = characters.join('');
        used -= charWidth(removed?.codePointAt(0) ?? 0, widthMode);
      }
      return `${complete}…`;
    }
    complete += character;
    used += width;
  }
  return complete;
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
  const title = normalizeCardText(snapshot.title);
  const status = normalizeCardText(snapshot.status);
  if (
    title.length === 0 ||
    status.length === 0 ||
    cardTextWidth(title, context.capabilities.widthMode) === 0 ||
    cardTextWidth(status, context.capabilities.widthMode) === 0
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  const maximumTextCells = context.width - 1;
  const clippedTitle = clipCardText(title, maximumTextCells, context.capabilities.widthMode);
  const clippedStatus = clipCardText(status, maximumTextCells, context.capabilities.widthMode);
  if (
    clippedTitle.length === 0 ||
    clippedStatus.length === 0 ||
    cardTextWidth(clippedTitle, context.capabilities.widthMode) === 0 ||
    cardTextWidth(clippedStatus, context.capabilities.widthMode) === 0
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
