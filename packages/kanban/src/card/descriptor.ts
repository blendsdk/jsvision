import type { ColorDepth, WidthMode } from '@jsvision/core';

import { KanbanInvalidDescriptorError } from '../contract/error.js';
import type { CardKey, KanbanExtensionId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanCardFormattingContext } from './formatting.js';
import { measureKanbanCardText } from './text-layout.js';
import { KANBAN_THEME_ROLES } from './theme.js';
import type { KanbanTheme, KanbanThemeRole } from './theme.js';

/** Supported vertical spacing policies for a rendered card. */
export type KanbanCardDensity = 'compact' | 'comfortable' | 'spacious';

/** Interaction or persistence state that can affect one card's presentation. */
export type KanbanCardOperationState = 'idle' | 'grabbed' | 'pending' | 'rejected';

/** Terminal features that affect text measurement and presentation fallback. */
export interface KanbanCardTerminalCapabilities {
  /** Effective terminal color depth. */
  readonly colorDepth: ColorDepth;
  /** Width algorithm used for Unicode code points. */
  readonly widthMode: WidthMode;
  /** Whether box-drawing glyphs are safe to use. */
  readonly boxDrawing: boolean;
  /** Whether ambiguous-width code points occupy two cells. */
  readonly ambiguousWide: boolean;
}

/** Bounded immutable values supplied to one pure card-render operation. */
export interface KanbanCardRenderContext {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Equality-only revision for presentation-affecting card data. */
  readonly presentationRevision?: KanbanRevision;
  /** Exact card width in terminal cells. */
  readonly width: number;
  /** Maximum rows the renderer may return. */
  readonly rowBudget: number;
  /** Requested card spacing density. */
  readonly density: KanbanCardDensity;
  /** Whether the card owns keyboard focus. */
  readonly focused: boolean;
  /** Whether the card belongs to the active selection. */
  readonly selected: boolean;
  /** Whether mutation commands are disabled for this card. */
  readonly readOnly: boolean;
  /** Current drag or persistence operation state. */
  readonly operation: KanbanCardOperationState;
  /** Fully resolved semantic theme. */
  readonly theme: Readonly<KanbanTheme>;
  /** Terminal features used for deterministic rendering. */
  readonly capabilities: Readonly<KanbanCardTerminalCapabilities>;
  /** Application-owned locale formatters. */
  readonly formatting: Readonly<KanbanCardFormattingContext>;
}

/** Pure application-supplied projection from a card to bounded terminal rows. */
export interface KanbanCardRenderer<TCard> {
  /** Produces one descriptor without mutating the card or render context. */
  render(card: TCard, context: KanbanCardRenderContext): KanbanCardDescriptor;
}

/** Semantic content category used for degradation and layout decisions. */
export type KanbanCardSectionKind =
  | 'title'
  | 'status'
  | 'metadata'
  | 'labels'
  | 'summary'
  | 'checklist-progress'
  | 'checklist-preview'
  | 'feedback'
  | 'custom';

/** Non-color card state represented by a marker or equivalent visual cue. */
export type KanbanCardCue = 'focused' | 'selected' | 'read-only' | 'grabbed' | 'pending' | 'rejected';

/** One sanitized styled run positioned within a descriptor row. */
export interface KanbanCardSpan {
  /** Zero-based terminal-cell column. */
  readonly column: number;
  /** Sanitized single-line display text. */
  readonly text: string;
  /** Semantic theme role used to draw the text. */
  readonly role: KanbanThemeRole;
}

/** One terminal row belonging to a semantic card section. */
export interface KanbanCardRow {
  /** Semantic section represented by this row. */
  readonly section: KanbanCardSectionKind;
  /** Ordered non-overlapping styled spans. */
  readonly spans: readonly KanbanCardSpan[];
}

/** One-cell state marker retained when color is unavailable. */
export interface KanbanCardMarker {
  /** Zero-based descriptor row. */
  readonly row: number;
  /** Zero-based terminal-cell column. */
  readonly column: number;
  /** Sanitized glyph occupying exactly one terminal cell. */
  readonly glyph: string;
  /** Semantic theme role used to draw the marker. */
  readonly role: KanbanThemeRole;
  /** State distinctions redundantly conveyed by the marker. */
  readonly cues: readonly KanbanCardCue[];
}

/** Geometry and priority metadata for one semantic section. */
export interface KanbanCardSection {
  /** Descriptor-local stable section identity. */
  readonly id: string;
  /** Semantic content category. */
  readonly kind: KanbanCardSectionKind;
  /** First zero-based row occupied by the section. */
  readonly startRow: number;
  /** Number of consecutive rows occupied by the section. */
  readonly rowCount: number;
  /** Lower values are retained first as space becomes constrained. */
  readonly priority: number;
}

/** Declarative card command advertised by a custom renderer. */
export interface KanbanCardAction {
  /** Application-namespaced action identity. */
  readonly actionId: KanbanExtensionId;
  /** Sanitized localized label. */
  readonly label: string;
  /** Whether input may currently invoke the action. */
  readonly enabled: boolean;
}

/** Bounded hit-test rectangle within a card descriptor. */
export interface KanbanCardRegion {
  /** Descriptor-local stable region identity. */
  readonly regionId: string;
  /** Semantic purpose of the rectangle. */
  readonly kind: 'section' | 'action';
  /** Zero-based terminal-cell column. */
  readonly x: number;
  /** Zero-based descriptor row. */
  readonly y: number;
  /** Positive width in terminal cells. */
  readonly width: number;
  /** Positive height in rows. */
  readonly height: number;
  /** Action invoked by an action region. */
  readonly actionId?: KanbanExtensionId;
}

/** Inspectable record of content omitted to fit available geometry. */
export interface KanbanCardDegradation {
  /** Overall amount of presentation reduction. */
  readonly level: 'none' | 'reduced' | 'minimum' | 'fallback';
  /** Semantic sections intentionally left out of this projection. */
  readonly omittedSections: readonly KanbanCardSectionKind[];
}

/** Immutable, renderer-neutral description of one terminal card. */
export interface KanbanCardDescriptor {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Equality-only revision used to create this descriptor. */
  readonly presentationRevision?: KanbanRevision;
  /** Exact width in terminal cells. */
  readonly width: number;
  /** Number of rows occupied by this descriptor. */
  readonly measuredHeight: number;
  /** Semantic role for the card interior. */
  readonly surfaceRole: KanbanThemeRole;
  /** Semantic role for the stable card boundary. */
  readonly borderRole: KanbanThemeRole;
  /** Non-color state marker. */
  readonly marker: KanbanCardMarker;
  /** Styled terminal rows. */
  readonly rows: readonly KanbanCardRow[];
  /** Semantic section geometry. */
  readonly sections: readonly KanbanCardSection[];
  /** Declarative card actions. */
  readonly actions: readonly KanbanCardAction[];
  /** Mouse hit-test regions. */
  readonly regions: readonly KanbanCardRegion[];
  /** Content omitted because of available geometry. */
  readonly degradation: KanbanCardDegradation;
}

const THEME_ROLES = new Set<string>(KANBAN_THEME_ROLES);
const SECTION_KINDS = new Set<string>([
  'title',
  'status',
  'metadata',
  'labels',
  'summary',
  'checklist-progress',
  'checklist-preview',
  'feedback',
  'custom',
]);
const CUES = new Set<string>(['focused', 'selected', 'read-only', 'grabbed', 'pending', 'rejected']);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const BIDI_CONTROL_CHARACTERS = /[\u202a-\u202e\u2066-\u2069]/u;
const EXTENSION_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const RESERVED_EXTENSION_PREFIX = 'jsvision.';
const MAX_DESCRIPTOR_ROWS = 32;
const DESCRIPTOR_TEXT_ENCODER = new TextEncoder();

/** Throws the package's payload-free validation error when a condition is false. */
function requireDescriptor(condition: boolean): asserts condition {
  if (!condition) throw new KanbanInvalidDescriptorError();
}

/** Returns whether a value is a finite non-negative safe integer. */
function isCoordinate(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Returns whether text is non-empty, single-line, and free of terminal controls. */
function isSafeText(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= KANBAN_LIMITS.semanticStringBytes.safe &&
    !CONTROL_CHARACTERS.test(value) &&
    !BIDI_CONTROL_CHARACTERS.test(value) &&
    DESCRIPTOR_TEXT_ENCODER.encode(value).byteLength <= KANBAN_LIMITS.semanticStringBytes.safe
  );
}

/** Returns whether a renderer action uses the bounded application extension grammar. */
function isExtensionId(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length <= KANBAN_LIMITS.idBytes.safe &&
    DESCRIPTOR_TEXT_ENCODER.encode(value).byteLength <= KANBAN_LIMITS.idBytes.safe &&
    EXTENSION_ID.test(value) &&
    !value.startsWith(RESERVED_EXTENSION_PREFIX)
  );
}

/** Returns whether a descriptor-local identity is bounded and terminal-safe. */
function isLocalId(value: string): boolean {
  return (
    isSafeText(value) &&
    value.length <= KANBAN_LIMITS.idBytes.safe &&
    DESCRIPTOR_TEXT_ENCODER.encode(value).byteLength <= KANBAN_LIMITS.idBytes.safe
  );
}

/** Returns whether two positive rectangles overlap. */
function regionsOverlap(left: KanbanCardRegion, right: KanbanCardRegion): boolean {
  return (
    left.x < right.x + right.width &&
    right.x < left.x + left.width &&
    left.y < right.y + right.height &&
    right.y < left.y + left.height
  );
}

/**
 * Validates an untrusted renderer descriptor against its exact render context.
 *
 * The function retains no renderer objects and emits no diagnostics. Use
 * {@link renderKanbanCardSafely} when a caller needs local fallback behavior.
 */
export function validateKanbanCardDescriptor(descriptor: KanbanCardDescriptor, context: KanbanCardRenderContext): void {
  requireDescriptor(descriptor.cardKey === context.cardKey);
  requireDescriptor(descriptor.presentationRevision === context.presentationRevision);
  requireDescriptor(Number.isSafeInteger(context.width) && context.width > 0);
  requireDescriptor(Number.isSafeInteger(context.rowBudget) && context.rowBudget > 0);
  requireDescriptor(descriptor.width === context.width);
  requireDescriptor(isCoordinate(descriptor.measuredHeight) && descriptor.measuredHeight > 0);
  requireDescriptor(descriptor.measuredHeight <= context.rowBudget);
  requireDescriptor(descriptor.measuredHeight <= MAX_DESCRIPTOR_ROWS);
  requireDescriptor(descriptor.rows.length === descriptor.measuredHeight);
  requireDescriptor(descriptor.sections.length <= MAX_DESCRIPTOR_ROWS);
  requireDescriptor(descriptor.actions.length <= KANBAN_LIMITS.cardFields.safe);
  requireDescriptor(descriptor.regions.length <= KANBAN_LIMITS.cardFields.safe);
  requireDescriptor(THEME_ROLES.has(descriptor.surfaceRole) && THEME_ROLES.has(descriptor.borderRole));

  requireDescriptor(isCoordinate(descriptor.marker.row) && descriptor.marker.row < descriptor.measuredHeight);
  requireDescriptor(isCoordinate(descriptor.marker.column) && descriptor.marker.column < descriptor.width);
  requireDescriptor(isSafeText(descriptor.marker.glyph));
  requireDescriptor(Array.from(descriptor.marker.glyph).length === 1);
  requireDescriptor(measureKanbanCardText(descriptor.marker.glyph, context.capabilities.widthMode) === 1);
  requireDescriptor(THEME_ROLES.has(descriptor.marker.role));
  requireDescriptor(descriptor.marker.cues.length <= CUES.size);
  requireDescriptor(new Set(descriptor.marker.cues).size === descriptor.marker.cues.length);
  requireDescriptor(descriptor.marker.cues.every((cue) => CUES.has(cue)));

  for (const row of descriptor.rows) {
    requireDescriptor(SECTION_KINDS.has(row.section));
    requireDescriptor(row.spans.length <= KANBAN_LIMITS.cardFields.safe);
    let previousEnd = 0;
    for (const span of row.spans) {
      requireDescriptor(isCoordinate(span.column) && span.column >= previousEnd && span.column < descriptor.width);
      requireDescriptor(isSafeText(span.text));
      requireDescriptor(measureKanbanCardText(span.text, context.capabilities.widthMode) > 0);
      requireDescriptor(THEME_ROLES.has(span.role));
      previousEnd = span.column + measureKanbanCardText(span.text, context.capabilities.widthMode);
      requireDescriptor(previousEnd <= descriptor.width);
    }
  }

  const sectionIds = new Set<string>();
  for (const section of descriptor.sections) {
    requireDescriptor(isLocalId(section.id) && !sectionIds.has(section.id));
    sectionIds.add(section.id);
    requireDescriptor(SECTION_KINDS.has(section.kind));
    requireDescriptor(isCoordinate(section.startRow));
    requireDescriptor(Number.isSafeInteger(section.rowCount) && section.rowCount > 0);
    requireDescriptor(section.startRow + section.rowCount <= descriptor.measuredHeight);
    requireDescriptor(Number.isSafeInteger(section.priority) && section.priority >= 0);
  }

  const actionIds = new Set<string>();
  for (const action of descriptor.actions) {
    requireDescriptor(isExtensionId(action.actionId) && !actionIds.has(action.actionId));
    actionIds.add(action.actionId);
    requireDescriptor(isSafeText(action.label));
    requireDescriptor(typeof action.enabled === 'boolean');
  }

  const regionIds = new Set<string>();
  for (let index = 0; index < descriptor.regions.length; index += 1) {
    const region = descriptor.regions[index];
    requireDescriptor(region !== undefined);
    requireDescriptor(isLocalId(region.regionId) && !regionIds.has(region.regionId));
    regionIds.add(region.regionId);
    requireDescriptor(isCoordinate(region.x) && isCoordinate(region.y));
    requireDescriptor(Number.isSafeInteger(region.width) && region.width > 0);
    requireDescriptor(Number.isSafeInteger(region.height) && region.height > 0);
    requireDescriptor(region.x + region.width <= descriptor.width);
    requireDescriptor(region.y + region.height <= descriptor.measuredHeight);
    requireDescriptor(region.kind === 'section' || region.kind === 'action');
    requireDescriptor(region.kind !== 'action' || (region.actionId !== undefined && actionIds.has(region.actionId)));
    requireDescriptor(region.kind !== 'section' || region.actionId === undefined);
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const other = descriptor.regions[otherIndex];
      requireDescriptor(other !== undefined && !regionsOverlap(region, other));
    }
  }

  requireDescriptor(
    descriptor.degradation.level === 'none' ||
      descriptor.degradation.level === 'reduced' ||
      descriptor.degradation.level === 'minimum' ||
      descriptor.degradation.level === 'fallback',
  );
  requireDescriptor(descriptor.degradation.omittedSections.length <= SECTION_KINDS.size);
  requireDescriptor(
    new Set(descriptor.degradation.omittedSections).size === descriptor.degradation.omittedSections.length,
  );
  requireDescriptor(descriptor.degradation.omittedSections.every((kind) => SECTION_KINDS.has(kind)));
}
