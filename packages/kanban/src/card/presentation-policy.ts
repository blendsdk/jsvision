import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import type { KanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidPresentationError } from '../contract/error.js';
import { createKanbanChecklistId, createKanbanFieldId } from '../contract/identity.js';
import type { KanbanChecklistId, KanbanFieldId, KanbanIdentityKind } from '../contract/identity.js';
import { KANBAN_LIMITS, KANBAN_PRESENTATION_PRESET_DEFAULTS, validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitManifest, KanbanPresentationPresetDefault, KanbanResolvedLimits } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanCardDensity, KanbanCardSectionKind } from './descriptor.js';

/** Checklist detail rendered by the standard card pipeline. */
export type KanbanChecklistMode = 'hidden' | 'progress' | 'preview';

/**
 * Caller-defined card presentation budget before validation and normalization.
 *
 * @example
 * ```ts
 * const policy: KanbanCustomPresentation = {
 *   revision: 1, cardRows: 8, cardGap: 1, metadataFields: 3,
 *   labelRows: 1, summarySections: 1, checklistMode: 'hidden', checklistPreviewItems: 0,
 * };
 * ```
 */
export interface KanbanCustomPresentation {
  /** Equality-only revision for the complete custom policy. */
  readonly revision: KanbanRevision;
  /** Maximum descriptor rows, including mandatory title and status rows. */
  readonly cardRows: number;
  /** Empty terminal rows reserved between adjacent cards by scene geometry. */
  readonly cardGap: number;
  /** Maximum selected metadata fields. */
  readonly metadataFields: number;
  /** Maximum rows used to wrap labels. */
  readonly labelRows: number;
  /** Maximum selected summary sections. */
  readonly summarySections: number;
  /** Checklist detail available to the standard renderer. */
  readonly checklistMode: KanbanChecklistMode;
  /** Maximum checklist items displayed across selected groups. */
  readonly checklistPreviewItems: number;
  /** Optional string candidates validated into a closed low-to-high optional-section removal order. */
  readonly degradationOrder?: readonly string[];
}

/** Preset name or complete custom presentation policy accepted by the public resolver. */
export type KanbanPresentationInput = KanbanCardDensity | KanbanCustomPresentation;

/**
 * Immutable card budget consumed by snapshot, composition, and scene geometry.
 *
 * @example
 * ```ts
 * const budget = resolveKanbanPresentation('comfortable');
 * ```
 */
export interface ResolvedKanbanPresentationBudget {
  /** Preset that supplied the values, or `custom` for caller data. */
  readonly preset: KanbanCardDensity | 'custom';
  /** Equality-only normalized policy revision. */
  readonly revision: KanbanRevision;
  /** Maximum descriptor rows. */
  readonly cardRows: number;
  /** Empty scene rows between adjacent cards. */
  readonly cardGap: number;
  /** Maximum selected metadata fields. */
  readonly metadataFields: number;
  /** Maximum label wrapping rows. */
  readonly labelRows: number;
  /** Maximum selected summary sections. */
  readonly summarySections: number;
  /** Resolved checklist detail mode. */
  readonly checklistMode: KanbanChecklistMode;
  /** Maximum checklist preview items across selected groups. */
  readonly checklistPreviewItems: number;
  /** Complete low-to-high removal order for optional sections. */
  readonly degradationOrder: readonly KanbanCardSectionKind[];
}

/**
 * Optional card-specific ordering and subset request.
 *
 * @example
 * ```ts
 * const selection: KanbanCardPresentationSelection = { fieldIds: ['priority', 'assignee'] };
 * ```
 */
export interface KanbanCardPresentationSelection {
  /** Requested metadata field order and subset. */
  readonly fieldIds?: readonly KanbanFieldId[];
  /** Requested summary order and subset. */
  readonly summaryIds?: readonly KanbanFieldId[];
  /** Requested checklist-group order and subset. */
  readonly checklistIds?: readonly KanbanChecklistId[];
}

/** Validated view maximum against which one card selection is intersected. */
export interface KanbanCardPresentationMaximum {
  /** Resolved immutable numeric presentation budget. */
  readonly budget: ResolvedKanbanPresentationBudget;
  /** Active immutable resource ceilings selected by the board. */
  readonly limits: KanbanResolvedLimits;
  /** Configured metadata fields available to this card. */
  readonly availableFieldIds: readonly KanbanFieldId[];
  /** Configured summaries available to this card. */
  readonly availableSummaryIds: readonly KanbanFieldId[];
  /** Configured checklist groups available to this card. */
  readonly availableChecklistIds: readonly KanbanChecklistId[];
}

/** Detached immutable section selection used by the standard card pipeline. */
export interface ResolvedKanbanCardPresentationSelection {
  /** Exact resolved budget supplied by the maximum. */
  readonly budget: ResolvedKanbanPresentationBudget;
  /** Exact active limits supplied by the maximum. */
  readonly limits: KanbanResolvedLimits;
  /** Known metadata IDs after intersection and cardinality capping. */
  readonly fieldIds: readonly KanbanFieldId[];
  /** Known summary IDs after intersection and cardinality capping. */
  readonly summaryIds: readonly KanbanFieldId[];
  /** Known checklist-group IDs after intersection. */
  readonly checklistIds: readonly KanbanChecklistId[];
}

/** Optional section kinds in their deterministic first-removed order. */
const DEFAULT_DEGRADATION_ORDER = Object.freeze<KanbanCardSectionKind[]>([
  'custom',
  'checklist-preview',
  'checklist-progress',
  'summary',
  'labels',
  'metadata',
]);
/** Allowlist for a custom policy envelope. */
const CUSTOM_POLICY_KEYS = new Set([
  'revision',
  'cardRows',
  'cardGap',
  'metadataFields',
  'labelRows',
  'summarySections',
  'checklistMode',
  'checklistPreviewItems',
  'degradationOrder',
]);
/** Required custom policy members. */
const REQUIRED_CUSTOM_POLICY_KEYS = Object.freeze([...CUSTOM_POLICY_KEYS].filter((key) => key !== 'degradationOrder'));
/** Allowlist for a resolved presentation budget. */
const RESOLVED_BUDGET_KEYS = new Set(['preset', ...CUSTOM_POLICY_KEYS]);
/** Allowlist for per-card selection. */
const SELECTION_KEYS = new Set(['fieldIds', 'summaryIds', 'checklistIds']);
/** Allowlist for a view maximum. */
const MAXIMUM_KEYS = new Set(['budget', 'limits', 'availableFieldIds', 'availableSummaryIds', 'availableChecklistIds']);
/** Standard resource ceilings used when the caller does not supply lowered limits. */
const STANDARD_LIMITS = validateKanbanLimitOptions({ class: 'standard' });

/** Converts every hostile structural inspection failure into the package presentation error. */
function dataProperties(value: unknown, maximumProperties: number): KanbanDataProperties {
  try {
    return snapshotKanbanDataProperties(value, maximumProperties);
  } catch {
    throw new KanbanInvalidPresentationError();
  }
}

/** Rejects unknown members without exposing their names. */
function requireAllowedKeys(properties: KanbanDataProperties, allowed: ReadonlySet<string>): void {
  try {
    validateKanbanDataKeys(properties, allowed);
  } catch {
    throw new KanbanInvalidPresentationError();
  }
}

/** Copies a dense ordinary array without invoking caller-defined element accessors. */
function dataArray(value: unknown, maximumEntries: number): readonly unknown[] {
  try {
    return snapshotKanbanDataArray(value, maximumEntries);
  } catch {
    throw new KanbanInvalidPresentationError();
  }
}

/** Validates that an active limit object is a complete frozen result-shaped value. */
function assertResolvedLimits(value: unknown): asserts value is KanbanResolvedLimits {
  const properties = dataProperties(value, Object.keys(KANBAN_LIMITS).length);
  requireAllowedKeys(properties, new Set(Object.keys(KANBAN_LIMITS)));
  if (Object.keys(properties).length !== Object.keys(KANBAN_LIMITS).length) {
    throw new KanbanInvalidPresentationError();
  }
  try {
    if (!Object.isFrozen(value)) throw new KanbanInvalidPresentationError();
  } catch {
    throw new KanbanInvalidPresentationError();
  }
  for (const key of Object.keys(KANBAN_LIMITS) as (keyof KanbanLimitManifest)[]) {
    const candidate = properties[key];
    if (
      typeof candidate !== 'number' ||
      !Number.isSafeInteger(candidate) ||
      candidate < 0 ||
      candidate > KANBAN_LIMITS[key].absolute
    ) {
      throw new KanbanInvalidPresentationError();
    }
  }
}

/** Validates one non-negative integer against its active ceiling. */
function boundedInteger(value: unknown, maximum: number, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) {
    throw new KanbanInvalidPresentationError();
  }
  return value;
}

/** Validates an equality-only revision while translating the lower-level source error. */
function presentationRevision(value: unknown): KanbanRevision {
  try {
    return snapshotKanbanRevision(value);
  } catch {
    throw new KanbanInvalidPresentationError();
  }
}

/** Builds a complete degradation order from an optional caller prefix. */
function normalizeDegradationOrder(value: unknown): readonly KanbanCardSectionKind[] {
  if (value === undefined) return DEFAULT_DEGRADATION_ORDER;
  const entries = dataArray(value, DEFAULT_DEGRADATION_ORDER.length);
  const selected: KanbanCardSectionKind[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') throw new KanbanInvalidPresentationError();
    const kind = DEFAULT_DEGRADATION_ORDER.find((candidate) => candidate === entry);
    if (kind === undefined || selected.includes(kind)) throw new KanbanInvalidPresentationError();
    selected.push(kind);
  }
  for (const kind of DEFAULT_DEGRADATION_ORDER) {
    if (!selected.includes(kind)) selected.push(kind);
  }
  return Object.freeze(selected);
}

/** Validates one checklist mode without coercing caller data. */
function checklistMode(value: unknown): KanbanChecklistMode {
  if (value !== 'hidden' && value !== 'progress' && value !== 'preview') {
    throw new KanbanInvalidPresentationError();
  }
  return value;
}

/** Validates the complete order carried by an already-resolved budget. */
function assertCompleteDegradationOrder(value: unknown): void {
  const normalized = normalizeDegradationOrder(value);
  const supplied = dataArray(value, DEFAULT_DEGRADATION_ORDER.length);
  if (supplied.length !== DEFAULT_DEGRADATION_ORDER.length) throw new KanbanInvalidPresentationError();
  for (let index = 0; index < supplied.length; index += 1) {
    if (supplied[index] !== normalized[index]) throw new KanbanInvalidPresentationError();
  }
  try {
    if (!Object.isFrozen(value)) throw new KanbanInvalidPresentationError();
  } catch {
    throw new KanbanInvalidPresentationError();
  }
}

/** Resolves the row ceiling appropriate for one named or custom budget. */
function rowCeiling(preset: KanbanCardDensity | 'custom', limits: KanbanResolvedLimits): number {
  if (preset === 'compact') return limits.cardRowsCompact;
  if (preset === 'comfortable') return limits.cardRowsComfortable;
  if (preset === 'spacious') return limits.cardRowsSpacious;
  return limits.descriptorRows;
}

/** Validates all numeric budget dimensions against the active caller ceilings. */
function validateBudgetValues(properties: KanbanDataProperties, limits: KanbanResolvedLimits): void {
  const preset = properties.preset;
  if (preset !== 'compact' && preset !== 'comfortable' && preset !== 'spacious' && preset !== 'custom') {
    throw new KanbanInvalidPresentationError();
  }
  presentationRevision(properties.revision);
  boundedInteger(properties.cardRows, rowCeiling(preset, limits), true);
  boundedInteger(properties.cardGap, limits.descriptorRows);
  boundedInteger(properties.metadataFields, limits.cardFields);
  boundedInteger(properties.labelRows, limits.descriptorRows);
  boundedInteger(properties.summarySections, limits.summarySections);
  boundedInteger(properties.checklistPreviewItems, limits.checklistItemsPerGroup);
  checklistMode(properties.checklistMode);
}

/** Validates a resolved budget without replacing its canonical identity. */
function assertResolvedBudget(
  value: unknown,
  limits: KanbanResolvedLimits,
): asserts value is ResolvedKanbanPresentationBudget {
  const properties = dataProperties(value, RESOLVED_BUDGET_KEYS.size);
  requireAllowedKeys(properties, RESOLVED_BUDGET_KEYS);
  if (Object.keys(properties).length !== RESOLVED_BUDGET_KEYS.size) throw new KanbanInvalidPresentationError();
  validateBudgetValues(properties, limits);
  assertCompleteDegradationOrder(properties.degradationOrder);
  try {
    if (!Object.isFrozen(value)) throw new KanbanInvalidPresentationError();
  } catch {
    throw new KanbanInvalidPresentationError();
  }
}

/** Creates one deeply frozen canonical named-preset budget. */
function createPresetBudget(
  preset: KanbanCardDensity,
  defaults: KanbanPresentationPresetDefault,
): ResolvedKanbanPresentationBudget {
  return Object.freeze({
    preset,
    revision: `jsvision-kanban-presentation-${preset}-${preset === 'compact' ? 'v2' : 'v1'}`,
    ...defaults,
    degradationOrder: DEFAULT_DEGRADATION_ORDER,
  });
}

/**
 * Canonical deeply frozen named presentation budgets.
 *
 * Object identity may be reused as a cache optimization. Consumers should compare the documented
 * revision and values when semantic equality matters.
 *
 * @example
 * ```ts
 * KANBAN_PRESENTATION_PRESETS.comfortable.cardGap; // 1
 * ```
 */
export const KANBAN_PRESENTATION_PRESETS: Readonly<Record<KanbanCardDensity, ResolvedKanbanPresentationBudget>> =
  Object.freeze({
    compact: createPresetBudget('compact', KANBAN_PRESENTATION_PRESET_DEFAULTS.compact),
    comfortable: createPresetBudget('comfortable', KANBAN_PRESENTATION_PRESET_DEFAULTS.comfortable),
    spacious: createPresetBudget('spacious', KANBAN_PRESENTATION_PRESET_DEFAULTS.spacious),
  });

/**
 * Resolves a named or custom presentation policy into one bounded immutable budget.
 *
 * @param input Named preset or complete custom policy. Comfortable is the default.
 * @param limits Active frozen resource ceilings selected for the board. Omit for standard ceilings.
 * @returns A canonical preset budget or detached frozen custom budget.
 * @throws {KanbanInvalidPresentationError} When any input is malformed or exceeds active limits.
 *
 * @example
 * ```ts
 * const budget = resolveKanbanPresentation('compact');
 * ```
 */
export function resolveKanbanPresentation(
  input: KanbanPresentationInput = 'comfortable',
  limits?: KanbanResolvedLimits,
): ResolvedKanbanPresentationBudget {
  const activeLimits = limits ?? STANDARD_LIMITS;
  assertResolvedLimits(activeLimits);
  if (input === 'compact' || input === 'comfortable' || input === 'spacious') {
    const preset = KANBAN_PRESENTATION_PRESETS[input];
    assertResolvedBudget(preset, activeLimits);
    return preset;
  }

  const properties = dataProperties(input, CUSTOM_POLICY_KEYS.size);
  requireAllowedKeys(properties, CUSTOM_POLICY_KEYS);
  if (REQUIRED_CUSTOM_POLICY_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(properties, key))) {
    throw new KanbanInvalidPresentationError();
  }
  const customProperties: KanbanDataProperties = Object.freeze({ ...properties, preset: 'custom' });
  validateBudgetValues(customProperties, activeLimits);
  const budget: ResolvedKanbanPresentationBudget = Object.freeze({
    preset: 'custom',
    revision: presentationRevision(properties.revision),
    cardRows: boundedInteger(properties.cardRows, activeLimits.descriptorRows, true),
    cardGap: boundedInteger(properties.cardGap, activeLimits.descriptorRows),
    metadataFields: boundedInteger(properties.metadataFields, activeLimits.cardFields),
    labelRows: boundedInteger(properties.labelRows, activeLimits.descriptorRows),
    summarySections: boundedInteger(properties.summarySections, activeLimits.summarySections),
    checklistMode: checklistMode(properties.checklistMode),
    checklistPreviewItems: boundedInteger(properties.checklistPreviewItems, activeLimits.checklistItemsPerGroup),
    degradationOrder: normalizeDegradationOrder(properties.degradationOrder),
  });
  return budget;
}

/** Validates, detaches, and de-duplicates one structural ID collection. */
function snapshotIds(
  value: unknown,
  kind: Extract<KanbanIdentityKind, 'field' | 'checklist'>,
  maximum: number,
): readonly string[] {
  const entries = dataArray(value, maximum);
  const result: string[] = [];
  try {
    for (const entry of entries) {
      if (typeof entry !== 'string') throw new KanbanInvalidPresentationError();
      result.push(kind === 'field' ? createKanbanFieldId(entry) : createKanbanChecklistId(entry));
    }
  } catch {
    throw new KanbanInvalidPresentationError();
  }
  if (new Set(result).size !== result.length) throw new KanbanInvalidPresentationError();
  return Object.freeze(result);
}

/** Returns an ordered requested subset after ignoring well-formed absent IDs. */
function intersectIds(requested: readonly string[], available: readonly string[], maximum: number): readonly string[] {
  const known = new Set(available);
  return Object.freeze(requested.filter((value) => known.has(value)).slice(0, maximum));
}

/**
 * Resolves one card's optional section order without changing numeric view maxima.
 *
 * @param selection Optional reordered subset. Omitted categories retain configured order.
 * @param maximum Resolved budget, active limits, and configured ID universes.
 * @returns A detached deeply frozen selection retaining the exact budget and limits objects.
 * @throws {KanbanInvalidPresentationError} When any structural input is malformed.
 *
 * @example
 * ```ts
 * const resolved = resolveKanbanCardPresentationSelection(undefined, maximum);
 * ```
 */
export function resolveKanbanCardPresentationSelection(
  selection: unknown,
  maximum: KanbanCardPresentationMaximum,
): ResolvedKanbanCardPresentationSelection {
  const maximumProperties = dataProperties(maximum, MAXIMUM_KEYS.size);
  requireAllowedKeys(maximumProperties, MAXIMUM_KEYS);
  if (Object.keys(maximumProperties).length !== MAXIMUM_KEYS.size) throw new KanbanInvalidPresentationError();

  const limits = maximumProperties.limits;
  assertResolvedLimits(limits);
  const budget = maximumProperties.budget;
  assertResolvedBudget(budget, limits);
  const availableFieldIds = snapshotIds(maximumProperties.availableFieldIds, 'field', limits.cardFields);
  const availableSummaryIds = snapshotIds(maximumProperties.availableSummaryIds, 'field', limits.summarySections);
  const availableChecklistIds = snapshotIds(
    maximumProperties.availableChecklistIds,
    'checklist',
    limits.checklistGroups,
  );

  const selectionProperties: KanbanDataProperties =
    selection === undefined ? Object.freeze({}) : dataProperties(selection, SELECTION_KEYS.size);
  requireAllowedKeys(selectionProperties, SELECTION_KEYS);
  const requestedFieldIds = Object.prototype.hasOwnProperty.call(selectionProperties, 'fieldIds')
    ? snapshotIds(selectionProperties.fieldIds, 'field', limits.cardFields)
    : availableFieldIds;
  const requestedSummaryIds = Object.prototype.hasOwnProperty.call(selectionProperties, 'summaryIds')
    ? snapshotIds(selectionProperties.summaryIds, 'field', limits.summarySections)
    : availableSummaryIds;
  const requestedChecklistIds = Object.prototype.hasOwnProperty.call(selectionProperties, 'checklistIds')
    ? snapshotIds(selectionProperties.checklistIds, 'checklist', limits.checklistGroups)
    : availableChecklistIds;

  return Object.freeze({
    budget,
    limits,
    fieldIds: intersectIds(requestedFieldIds, availableFieldIds, budget.metadataFields),
    summaryIds: intersectIds(requestedSummaryIds, availableSummaryIds, budget.summarySections),
    checklistIds:
      budget.checklistMode === 'hidden'
        ? Object.freeze<KanbanChecklistId[]>([])
        : intersectIds(requestedChecklistIds, availableChecklistIds, limits.checklistGroups),
  });
}
