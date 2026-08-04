import type { KanbanCardStyleSelection, KanbanCardVisualState } from './adapter.js';
import type { KanbanCardCue, KanbanCardTerminalCapabilities } from './descriptor.js';
import { measureKanbanCardText } from './text-layout.js';
import type { KanbanThemeRole } from './theme.js';

/** Fully resolved semantic roles and non-color marker for one card descriptor. */
export interface KanbanResolvedCardStyle {
  /** Card interior role after application override and state fallback. */
  readonly surfaceRole: KanbanThemeRole;
  /** Card boundary role after application override and surface fallback. */
  readonly borderRole: KanbanThemeRole;
  /** Primary marker role after application override and state fallback. */
  readonly markerRole: KanbanThemeRole;
  /** One terminal-cell primary marker glyph. */
  readonly markerGlyph: string;
  /** All compatible non-color cues in deterministic order. */
  readonly cues: readonly KanbanCardCue[];
}

/** Primary semantic distinction selected by the documented precedence. */
interface PrimaryCardCue {
  readonly role: KanbanThemeRole;
  readonly ascii: string;
  readonly unicode: string;
}

/** Selects the highest-precedence semantic cue without discarding compatible cue metadata. */
function primaryCue(state: KanbanCardVisualState): PrimaryCardCue {
  if (state.invalid || state.operation === 'rejected') {
    return { role: 'operation.rejected', ascii: '!', unicode: '×' };
  }
  if (state.operation === 'pending') return { role: 'operation.pending', ascii: '~', unicode: '…' };
  if (state.operation === 'grabbed') return { role: 'card.grabbed', ascii: '@', unicode: '◆' };
  if (state.focused && state.selected) return { role: 'card.focused-selected', ascii: '%', unicode: '◈' };
  if (state.focused) return { role: 'card.focused', ascii: '>', unicode: '▶' };
  if (state.selected || state.rangeAnchor) return { role: 'card.selected', ascii: '*', unicode: '●' };
  if (state.readOnly) return { role: 'card.read-only', ascii: '#', unicode: '◇' };
  return { role: 'content.status', ascii: '|', unicode: '│' };
}

/** Builds the complete compatible cue inventory without duplicates. */
function compatibleCues(state: KanbanCardVisualState): readonly KanbanCardCue[] {
  const cues: KanbanCardCue[] = [];
  const add = (cue: KanbanCardCue): void => {
    if (!cues.includes(cue)) cues.push(cue);
  };
  if (state.invalid || state.operation === 'rejected') add('rejected');
  if (state.operation === 'pending') add('pending');
  if (state.operation === 'grabbed') add('grabbed');
  if (state.focused) add('focused');
  if (state.selected || state.rangeAnchor) add('selected');
  if (state.readOnly) add('read-only');
  return Object.freeze(cues);
}

/** Chooses Unicode only when requested/supported and the glyph occupies exactly one terminal cell. */
function markerGlyph(
  cue: PrimaryCardCue,
  selection: KanbanCardStyleSelection,
  capabilities: Readonly<KanbanCardTerminalCapabilities>,
): string {
  const wantsUnicode =
    selection.glyphFamily === 'unicode' ||
    (selection.glyphFamily !== 'ascii' && capabilities.boxDrawing && !capabilities.ambiguousWide);
  return wantsUnicode && measureKanbanCardText(cue.unicode, capabilities.widthMode) === 1 ? cue.unicode : cue.ascii;
}

/** Resolves semantic state styling while keeping raw colors outside the card contract. */
export function resolveKanbanCardStyle(
  selection: KanbanCardStyleSelection,
  state: KanbanCardVisualState,
  capabilities: Readonly<KanbanCardTerminalCapabilities>,
): KanbanResolvedCardStyle {
  const primary = primaryCue(state);
  const surfaceRole = selection.surfaceRole ?? (primary.role === 'content.status' ? 'card.normal' : primary.role);
  return Object.freeze({
    surfaceRole,
    borderRole: selection.borderRole ?? surfaceRole,
    markerRole: selection.markerRole ?? primary.role,
    markerGlyph: markerGlyph(primary, selection, capabilities),
    cues: compatibleCues(state),
  });
}
