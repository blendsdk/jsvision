import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidPresentationError } from '../contract/error.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanFieldId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import { KANBAN_LIMITS, KANBAN_STRUCTURE_PRESENTATION_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import { KANBAN_THEME_ROLES } from '../card/theme.js';
import type { KanbanThemeRole } from '../card/theme.js';
import {
  KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH,
  KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH,
  KANBAN_DEFAULT_COLUMN_PREFERRED_WIDTH,
} from '../layout/width-solver.js';
import type {
  KanbanDefinitionOfDone,
  KanbanStructureCapability,
  KanbanStructureStyle,
  KanbanSwimlaneMeta,
  KanbanWipPolicy,
} from '../source/types.js';

/** Complete validated terminal-cell width preference for one workflow column. */
export interface KanbanColumnWidthPreference {
  /** Smallest usable column surface width. */
  readonly minimumWidth: number;
  /** Desired column surface width when room is available. */
  readonly preferredWidth: number;
  /** Largest column surface width allocated by the responsive solver. */
  readonly maximumWidth: number;
}

/** View-owned presentation policy for one stable workflow column. */
export interface KanbanColumnPolicy {
  /** Stable application-owned column identity. */
  readonly columnId: string;
  /** Whether the column participates in the visible scene. */
  readonly visible?: boolean;
  /** Whether the header remains visible while the card region is suppressed. */
  readonly collapsed?: boolean;
  /** Optional responsive width preference. */
  readonly width?: KanbanColumnWidthPreference;
  /** Optional workflow count policy used by pure eligibility evaluation. */
  readonly wip?: KanbanWipPolicy;
  /** Optional compact and complete definition-of-done text. */
  readonly definitionOfDone?: KanbanDefinitionOfDone;
  /** Package-understood presentation capabilities. */
  readonly capabilities?: readonly KanbanStructureCapability[];
  /** Optional allowlisted semantic style. */
  readonly style?: KanbanStructureStyle;
}

/** Built-in swimlane chrome strategies with identical semantic membership. */
export type KanbanSwimlanePresentationVariant = 'hybrid' | 'separator' | 'band' | 'rail';

/** Safe semantic context supplied once for one visible swimlane presentation revision. */
export interface KanbanSwimlanePresentationContext {
  /** Stable semantic swimlane identity. */
  readonly swimlaneId: string;
  /** Sanitized visible label. */
  readonly label: string;
  /** Equality-only presentation revision. */
  readonly revision: KanbanRevision;
  /** Available horizontal terminal cells. */
  readonly availableWidth: number;
}

/** Application-owned custom swimlane chrome producer validated before rendering. */
export interface KanbanCustomSwimlanePresentation {
  /** Discriminator separating custom chrome from built-in variants. */
  readonly kind: 'custom';
  /** Equality-only revision of the renderer and its configuration. */
  readonly revision: KanbanRevision;
  /** Produces untrusted renderer-neutral chrome input for bounded validation. */
  readonly render: (context: KanbanSwimlanePresentationContext) => unknown;
}

/** Built-in or bounded custom swimlane presentation input. */
export type KanbanSwimlanePresentationInput = KanbanSwimlanePresentationVariant | KanbanCustomSwimlanePresentation;

/** View-owned policy for the sole query-selected grouping field. */
export interface KanbanGroupingPolicy<TCard> {
  /** Field that must equal the active query grouping field. */
  readonly fieldId: KanbanFieldId;
  /** Stable group used only for missing or unmapped values. */
  readonly unassigned: KanbanSwimlaneMeta;
  /** Stable local group used when an application resolver fails. */
  readonly resolverFallback?: KanbanSwimlaneMeta;
  /** Optional visible-group allowlist. Hidden membership remains detached. */
  readonly visibleSwimlaneIds?: readonly string[];
  /** Visible groups whose headers remain while card regions are suppressed. */
  readonly collapsedSwimlaneIds?: readonly string[];
  /** Optional semantic group order applied after source or registry normalization. */
  readonly order?: readonly string[];
  /** Whether normalized-equal labels may be shown with distinct disambiguators. */
  readonly allowDuplicateLabels?: boolean;
  /** Visible disambiguators keyed by stable semantic group identity. */
  readonly disambiguators?: Readonly<Record<string, string>>;
  /** Built-in or bounded custom presentation selected for this grouping. */
  readonly presentation?: KanbanSwimlanePresentationInput;
  /** Preferred width of the rail variant before responsive degradation. */
  readonly railWidth?: number;
  /** Optional card identity resolver for records without a conventional `id` data property. */
  readonly cardKeyOf?: (card: TCard) => CardKey;
}

/** Complete reactive structure policy snapshotted before scene projection. */
export interface KanbanStructurePolicy<TCard> {
  /** Equality-only revision covering every layout-affecting policy value. */
  readonly revision: KanbanRevision;
  /** Per-column policy keyed by stable identity. */
  readonly columns: readonly KanbanColumnPolicy[];
  /** Optional policy for the query-owned grouping field. */
  readonly grouping?: KanbanGroupingPolicy<TCard>;
}

/** Accepted members of one top-level structure policy. */
const STRUCTURE_KEYS = new Set(['revision', 'columns', 'grouping']);
/** Accepted members of one workflow-column policy. */
const COLUMN_KEYS = new Set([
  'columnId',
  'visible',
  'collapsed',
  'width',
  'wip',
  'definitionOfDone',
  'capabilities',
  'style',
]);
/** Accepted members of one column width preference. */
const WIDTH_KEYS = new Set(['minimumWidth', 'preferredWidth', 'maximumWidth']);
/** Accepted members of one WIP policy. */
const WIP_KEYS = new Set(['minimum', 'maximum', 'mode', 'countDone']);
/** Accepted members of one definition-of-done value. */
const DOD_KEYS = new Set(['summary', 'details']);
/** Accepted members of one semantic structure style. */
const STYLE_KEYS = new Set(['role']);
/** Accepted members of one grouping policy. */
const GROUPING_KEYS = new Set([
  'fieldId',
  'unassigned',
  'resolverFallback',
  'visibleSwimlaneIds',
  'collapsedSwimlaneIds',
  'order',
  'allowDuplicateLabels',
  'disambiguators',
  'presentation',
  'railWidth',
  'cardKeyOf',
]);
/** Accepted members of a semantic swimlane record used by policy. */
const SWIMLANE_KEYS = new Set(['swimlaneId', 'label', 'revision']);
/** Accepted members of one custom presentation producer. */
const CUSTOM_PRESENTATION_KEYS = new Set(['kind', 'revision', 'render']);
/** Closed structural capability inventory. */
const STRUCTURE_CAPABILITIES = new Set<KanbanStructureCapability>([
  'collapse',
  'configure',
  'add-card',
  'rename',
  'reorder',
  'delete',
]);
/** Closed semantic style inventory. */
const THEME_ROLES = new Set<KanbanThemeRole>(KANBAN_THEME_ROLES);

/** Converts any hostile inspection or invalid value into one payload-free public error. */
function invalidPolicy(): never {
  throw new KanbanInvalidPresentationError();
}

/** Returns one non-negative safe integer within a central package ceiling. */
function boundedInteger(value: unknown, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    return invalidPolicy();
  }
  return value;
}

/** Sanitizes bounded single-line policy text without retaining control characters. */
function policyText(value: unknown): string {
  if (typeof value !== 'string') return invalidPolicy();
  const text = sanitizeContractText(value, KANBAN_LIMITS.semanticStringBytes.safe)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (text.length === 0 || new TextEncoder().encode(text).byteLength > KANBAN_LIMITS.semanticStringBytes.safe) {
    return invalidPolicy();
  }
  return text;
}

/** Snapshots one dense structural-ID list with stable ordering and no duplicates. */
function swimlaneIds(value: unknown): readonly string[] {
  const ids = snapshotKanbanDataArray(value, KANBAN_LIMITS.swimlanes.safe).map((entry) => {
    if (typeof entry !== 'string') return invalidPolicy();
    try {
      return createKanbanSwimlaneId(entry);
    } catch {
      return invalidPolicy();
    }
  });
  if (new Set(ids).size !== ids.length) return invalidPolicy();
  return Object.freeze(ids);
}

/** Snapshots one source-independent swimlane identity and display record. */
function swimlaneMeta(value: unknown): KanbanSwimlaneMeta {
  const properties = snapshotKanbanDataProperties(value, SWIMLANE_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_KEYS);
  if (Object.keys(properties).length !== SWIMLANE_KEYS.size || typeof properties.swimlaneId !== 'string') {
    return invalidPolicy();
  }
  try {
    return Object.freeze({
      swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
      label: policyText(properties.label),
      revision: snapshotKanbanRevision(properties.revision),
    });
  } catch {
    return invalidPolicy();
  }
}

/** Resolves an optional column width triple to complete ordered bounds. */
function columnWidth(value: unknown): KanbanColumnWidthPreference {
  const properties = snapshotKanbanDataProperties(value, WIDTH_KEYS.size);
  validateKanbanDataKeys(properties, WIDTH_KEYS);
  const maximum = KANBAN_STRUCTURE_PRESENTATION_LIMITS.columnWidthCells;
  const minimumWidth = boundedInteger(properties.minimumWidth ?? KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH, maximum);
  const preferredWidth = boundedInteger(properties.preferredWidth ?? KANBAN_DEFAULT_COLUMN_PREFERRED_WIDTH, maximum);
  const maximumWidth = boundedInteger(properties.maximumWidth ?? KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH, maximum);
  if (minimumWidth === 0 || minimumWidth > preferredWidth || preferredWidth > maximumWidth) return invalidPolicy();
  return Object.freeze({ minimumWidth, preferredWidth, maximumWidth });
}

/** Snapshots one optional min/max WIP policy. */
function wipPolicy(value: unknown): KanbanWipPolicy {
  const properties = snapshotKanbanDataProperties(value, WIP_KEYS.size);
  validateKanbanDataKeys(properties, WIP_KEYS);
  const minimum = properties.minimum;
  const maximum = properties.maximum;
  if (
    (minimum !== undefined && (typeof minimum !== 'number' || !Number.isSafeInteger(minimum) || minimum < 0)) ||
    (maximum !== undefined && (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 0)) ||
    (minimum !== undefined && maximum !== undefined && minimum > maximum) ||
    (properties.mode !== 'informational' && properties.mode !== 'advisory' && properties.mode !== 'blocking') ||
    (properties.countDone !== 'include' && properties.countDone !== 'exclude')
  ) {
    return invalidPolicy();
  }
  return Object.freeze({
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    mode: properties.mode,
    countDone: properties.countDone,
  });
}

/** Snapshots compact and optional complete definition-of-done text. */
function definitionOfDone(value: unknown): KanbanDefinitionOfDone {
  const properties = snapshotKanbanDataProperties(value, DOD_KEYS.size);
  validateKanbanDataKeys(properties, DOD_KEYS);
  const summary = policyText(properties.summary);
  const details = properties.details === undefined ? undefined : policyText(properties.details);
  return Object.freeze({ summary, ...(details === undefined ? {} : { details }) });
}

/** Snapshots a duplicate-free ordered structural capability list. */
function capabilities(value: unknown): readonly KanbanStructureCapability[] {
  const result = snapshotKanbanDataArray(value, STRUCTURE_CAPABILITIES.size).map((entry) => {
    if (typeof entry !== 'string' || !STRUCTURE_CAPABILITIES.has(entry as KanbanStructureCapability)) {
      return invalidPolicy();
    }
    return entry as KanbanStructureCapability;
  });
  if (new Set(result).size !== result.length) return invalidPolicy();
  return Object.freeze(result);
}

/** Snapshots one allowlisted semantic structure role. */
function structureStyle(value: unknown): KanbanStructureStyle {
  const properties = snapshotKanbanDataProperties(value, STYLE_KEYS.size);
  validateKanbanDataKeys(properties, STYLE_KEYS);
  if (typeof properties.role !== 'string' || !THEME_ROLES.has(properties.role as KanbanThemeRole)) {
    return invalidPolicy();
  }
  return Object.freeze({ role: properties.role as KanbanThemeRole });
}

/** Snapshots one column policy without retaining caller-owned arrays or objects. */
function columnPolicy(value: unknown): KanbanColumnPolicy {
  const properties = snapshotKanbanDataProperties(value, COLUMN_KEYS.size);
  validateKanbanDataKeys(properties, COLUMN_KEYS);
  if (typeof properties.columnId !== 'string') return invalidPolicy();
  if (properties.visible !== undefined && typeof properties.visible !== 'boolean') return invalidPolicy();
  if (properties.collapsed !== undefined && typeof properties.collapsed !== 'boolean') return invalidPolicy();
  try {
    return Object.freeze({
      columnId: createKanbanColumnId(properties.columnId),
      ...(properties.visible === undefined ? {} : { visible: properties.visible }),
      ...(properties.collapsed === undefined ? {} : { collapsed: properties.collapsed }),
      ...(properties.width === undefined ? {} : { width: columnWidth(properties.width) }),
      ...(properties.wip === undefined ? {} : { wip: wipPolicy(properties.wip) }),
      ...(properties.definitionOfDone === undefined
        ? {}
        : { definitionOfDone: definitionOfDone(properties.definitionOfDone) }),
      ...(properties.capabilities === undefined ? {} : { capabilities: capabilities(properties.capabilities) }),
      ...(properties.style === undefined ? {} : { style: structureStyle(properties.style) }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidPresentationError) throw error;
    return invalidPolicy();
  }
}

/** Snapshots visible disambiguators keyed by validated swimlane identity. */
function disambiguators(value: unknown): Readonly<Record<string, string>> {
  const properties = snapshotKanbanDataProperties(value, KANBAN_LIMITS.swimlanes.safe);
  const result: Record<string, string> = {};
  for (const [key, label] of Object.entries(properties)) {
    try {
      result[createKanbanSwimlaneId(key)] = policyText(label);
    } catch {
      return invalidPolicy();
    }
  }
  return Object.freeze(result);
}

/** Snapshots a built-in variant or wraps one custom renderer without invoking it. */
function presentation(value: unknown): KanbanSwimlanePresentationInput {
  if (value === 'hybrid' || value === 'separator' || value === 'band' || value === 'rail') return value;
  const properties = snapshotKanbanDataProperties(value, CUSTOM_PRESENTATION_KEYS.size);
  validateKanbanDataKeys(properties, CUSTOM_PRESENTATION_KEYS);
  if (properties.kind !== 'custom' || typeof properties.render !== 'function') return invalidPolicy();
  const render = properties.render;
  const safeRender = (context: KanbanSwimlanePresentationContext): unknown =>
    Reflect.apply(render, undefined, [context]);
  try {
    return Object.freeze({ kind: 'custom', revision: snapshotKanbanRevision(properties.revision), render: safeRender });
  } catch {
    return invalidPolicy();
  }
}

/** Wraps an application card-key callback so every result is validated before publication. */
function cardKeyResolver<TCard>(value: unknown): ((card: TCard) => CardKey) | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'function') return invalidPolicy();
  return (card: TCard): CardKey => {
    try {
      const key: unknown = Reflect.apply(value, undefined, [card]);
      if (typeof key !== 'string' && typeof key !== 'number') return invalidPolicy();
      return createKanbanCardKey(key);
    } catch (error) {
      if (error instanceof KanbanInvalidPresentationError) throw error;
      return invalidPolicy();
    }
  };
}

/**
 * Snapshots the sole query-owned grouping policy without invoking card callbacks.
 *
 * @example
 * ```ts
 * const policy = snapshotKanbanGroupingPolicy({
 *   fieldId: 'team',
 *   unassigned: { swimlaneId: 'unassigned', label: 'Unassigned', revision: 'u1' },
 * });
 * ```
 */
export function snapshotKanbanGroupingPolicy<TCard>(value: unknown): KanbanGroupingPolicy<TCard> {
  const properties = snapshotKanbanDataProperties(value, GROUPING_KEYS.size);
  validateKanbanDataKeys(properties, GROUPING_KEYS);
  if (typeof properties.fieldId !== 'string') return invalidPolicy();
  if (properties.allowDuplicateLabels !== undefined && typeof properties.allowDuplicateLabels !== 'boolean') {
    return invalidPolicy();
  }
  const railWidth =
    properties.railWidth === undefined
      ? undefined
      : boundedInteger(properties.railWidth, KANBAN_STRUCTURE_PRESENTATION_LIMITS.railWidth);
  if (railWidth === 0) return invalidPolicy();
  const cardKeyOf = cardKeyResolver<TCard>(properties.cardKeyOf);
  try {
    return Object.freeze({
      fieldId: createKanbanFieldId(properties.fieldId),
      unassigned: swimlaneMeta(properties.unassigned),
      ...(properties.resolverFallback === undefined
        ? {}
        : { resolverFallback: swimlaneMeta(properties.resolverFallback) }),
      ...(properties.visibleSwimlaneIds === undefined
        ? {}
        : { visibleSwimlaneIds: swimlaneIds(properties.visibleSwimlaneIds) }),
      ...(properties.collapsedSwimlaneIds === undefined
        ? {}
        : { collapsedSwimlaneIds: swimlaneIds(properties.collapsedSwimlaneIds) }),
      ...(properties.order === undefined ? {} : { order: swimlaneIds(properties.order) }),
      ...(properties.allowDuplicateLabels === undefined
        ? {}
        : { allowDuplicateLabels: properties.allowDuplicateLabels }),
      ...(properties.disambiguators === undefined ? {} : { disambiguators: disambiguators(properties.disambiguators) }),
      ...(properties.presentation === undefined ? {} : { presentation: presentation(properties.presentation) }),
      ...(railWidth === undefined ? {} : { railWidth }),
      ...(cardKeyOf === undefined ? {} : { cardKeyOf }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidPresentationError) throw error;
    return invalidPolicy();
  }
}

/**
 * Validates and detaches a complete reactive structure policy before it affects scene projection.
 *
 * @example
 * ```ts
 * const policy = snapshotKanbanStructurePolicy({
 *   revision: 'board-policy-v1',
 *   columns: [{ columnId: 'doing', collapsed: true }],
 * });
 * ```
 */
export function snapshotKanbanStructurePolicy<TCard>(value: unknown): KanbanStructurePolicy<TCard> {
  try {
    const properties = snapshotKanbanDataProperties(value, STRUCTURE_KEYS.size);
    validateKanbanDataKeys(properties, STRUCTURE_KEYS);
    const columns = snapshotKanbanDataArray(properties.columns, KANBAN_LIMITS.columns.safe).map(columnPolicy);
    if (new Set(columns.map((entry) => entry.columnId)).size !== columns.length) return invalidPolicy();
    return Object.freeze({
      revision: snapshotKanbanRevision(properties.revision),
      columns: Object.freeze(columns),
      ...(properties.grouping === undefined
        ? {}
        : { grouping: snapshotKanbanGroupingPolicy<TCard>(properties.grouping) }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidPresentationError) throw error;
    return invalidPolicy();
  }
}
