import { snapshotKanbanDataArray, snapshotKanbanDataProperties } from '../contract/data-snapshot.js';
import { KanbanInvalidSavedViewError } from '../contract/error.js';
import {
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanFieldId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import { canonicalizeKanbanSemanticValue, snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { KANBAN_SAVED_VIEW_LIMITS } from './saved-view-limits.js';
import { KANBAN_SAVED_VIEW_KIND, KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS } from './saved-view-types.js';
import type {
  KanbanDurableViewStateV1,
  KanbanSavedColumnV1,
  KanbanSavedFilterV1,
  KanbanSavedGroupingV1,
  KanbanSavedPresentationV1,
  KanbanSavedQuickFilterV1,
  KanbanSavedSortV1,
  KanbanSavedSwimlaneV1,
  KanbanSavedViewMissingPolicy,
  KanbanSavedViewParseResult,
  KanbanSavedViewV1,
} from './saved-view-types.js';

/** Exact envelope members accepted by the current schema. */
const ENVELOPE_KEYS = new Set(['kind', 'version', 'name', 'view', 'extensions']);
/** Exact durable-state members accepted by the current schema. */
const VIEW_KEYS = new Set([
  'searchPolicy',
  'search',
  'filters',
  'quickFilters',
  'sort',
  'grouping',
  'columns',
  'swimlanes',
  'presentation',
]);
/** Exact filter members accepted by the current schema. */
const FILTER_KEYS = new Set(['fieldId', 'operatorId', 'value', 'onMissing']);
/** Exact quick-filter members accepted by the current schema. */
const QUICK_FILTER_KEYS = new Set(['id', 'value', 'onMissing']);
/** Exact sort members accepted by the current schema. */
const SORT_KEYS = new Set(['fieldId', 'comparatorId', 'direction', 'onMissing']);
/** Exact grouping members accepted by the current schema. */
const GROUPING_KEYS = new Set(['fieldId', 'variantId', 'onMissing']);
/** Exact column members accepted by the current schema. */
const COLUMN_KEYS = new Set(['columnId', 'visible', 'collapsed', 'width', 'alignment', 'onMissing']);
/** Exact swimlane members accepted by the current schema. */
const SWIMLANE_KEYS = new Set(['swimlaneId', 'visible', 'collapsed', 'onMissing']);
/** Exact ordered-list envelope accepted by the current schema. */
const ITEMS_KEYS = new Set(['items']);
/** Exact card-presentation members accepted by the current schema. */
const PRESENTATION_KEYS = new Set(['density', 'cardFieldIds', 'summaryIds', 'checklist']);
/** UTF-8 encoder shared by text and bounded-string checks. */
const ENCODER = new TextEncoder();

/** Converts every validation failure into one payload-free package error. */
function invalidView(): never {
  throw new KanbanInvalidSavedViewError();
}

/** Reads an exact plain data object without invoking accessors. */
function exactProperties(value: unknown, keys: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  try {
    const properties = snapshotKanbanDataProperties(value, keys.size);
    if (Object.keys(properties).some((key) => !keys.has(key))) return invalidView();
    return properties;
  } catch {
    return invalidView();
  }
}

/** Snapshots a bounded dense array and freezes the validated result. */
function arrayOf<T>(value: unknown, maximum: number, snapshot: (entry: unknown) => T): readonly T[] {
  try {
    return Object.freeze(snapshotKanbanDataArray(value, maximum).map(snapshot));
  } catch {
    return invalidView();
  }
}

/** Rejects duplicate stable identities after a complete bounded snapshot exists. */
function unique<T>(items: readonly T[], identity: (item: T) => string): readonly T[] {
  if (new Set(items.map(identity)).size !== items.length) return invalidView();
  return items;
}

/** Validates one optional explicit missing-reference policy. */
function missingPolicy(value: unknown): KanbanSavedViewMissingPolicy | undefined {
  if (value === undefined) return undefined;
  if (value !== 'drop' && value !== 'reject') return invalidView();
  return value;
}

/** Adds a validated missing-reference policy without materializing an absent member. */
function policyProperty(value: unknown): { readonly onMissing?: KanbanSavedViewMissingPolicy } {
  const policy = missingPolicy(value);
  return policy === undefined ? {} : { onMissing: policy };
}

/** Validates one bounded string without returning rejected content in diagnostics. */
function boundedString(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > KANBAN_SAVED_VIEW_LIMITS.stringBytes ||
    ENCODER.encode(value).byteLength > KANBAN_SAVED_VIEW_LIMITS.stringBytes
  ) {
    return invalidView();
  }
  return value;
}

/** Snapshots one saved field filter. */
function snapshotFilter(value: unknown): KanbanSavedFilterV1 {
  const properties = exactProperties(value, FILTER_KEYS);
  if (typeof properties.fieldId !== 'string' || typeof properties.operatorId !== 'string') return invalidView();
  return Object.freeze({
    fieldId: createKanbanFieldId(properties.fieldId),
    operatorId: createKanbanExtensionId(properties.operatorId),
    value: snapshotKanbanSemanticValue(properties.value),
    ...policyProperty(properties.onMissing),
  });
}

/** Snapshots one saved named quick-filter selection. */
function snapshotQuickFilter(value: unknown): KanbanSavedQuickFilterV1 {
  const properties = exactProperties(value, QUICK_FILTER_KEYS);
  if (typeof properties.id !== 'string') return invalidView();
  return Object.freeze({
    id: createKanbanExtensionId(properties.id),
    ...(properties.value === undefined ? {} : { value: snapshotKanbanSemanticValue(properties.value) }),
    ...policyProperty(properties.onMissing),
  });
}

/** Snapshots one saved sort directive. */
function snapshotSort(value: unknown): KanbanSavedSortV1 {
  const properties = exactProperties(value, SORT_KEYS);
  if (
    typeof properties.fieldId !== 'string' ||
    (properties.comparatorId !== undefined && typeof properties.comparatorId !== 'string') ||
    (properties.direction !== 'ascending' && properties.direction !== 'descending')
  ) {
    return invalidView();
  }
  return Object.freeze({
    fieldId: createKanbanFieldId(properties.fieldId),
    ...(properties.comparatorId === undefined
      ? {}
      : { comparatorId: createKanbanExtensionId(properties.comparatorId) }),
    direction: properties.direction,
    ...policyProperty(properties.onMissing),
  });
}

/** Snapshots the optional saved semantic grouping. */
function snapshotGrouping(value: unknown): KanbanSavedGroupingV1 {
  const properties = exactProperties(value, GROUPING_KEYS);
  if (
    typeof properties.fieldId !== 'string' ||
    (properties.variantId !== undefined && typeof properties.variantId !== 'string')
  ) {
    return invalidView();
  }
  return Object.freeze({
    fieldId: createKanbanFieldId(properties.fieldId),
    ...(properties.variantId === undefined ? {} : { variantId: createKanbanExtensionId(properties.variantId) }),
    ...policyProperty(properties.onMissing),
  });
}

/** Snapshots one saved workflow-column facet. */
function snapshotColumn(value: unknown): KanbanSavedColumnV1 {
  const properties = exactProperties(value, COLUMN_KEYS);
  if (
    typeof properties.columnId !== 'string' ||
    typeof properties.visible !== 'boolean' ||
    typeof properties.collapsed !== 'boolean' ||
    (properties.width !== undefined &&
      (typeof properties.width !== 'number' ||
        !Number.isSafeInteger(properties.width) ||
        properties.width < 1 ||
        properties.width > KANBAN_SAVED_VIEW_LIMITS.columnWidthCells)) ||
    (properties.alignment !== undefined && properties.alignment !== 'start' && properties.alignment !== 'center')
  ) {
    return invalidView();
  }
  return Object.freeze({
    columnId: createKanbanColumnId(properties.columnId),
    visible: properties.visible,
    collapsed: properties.collapsed,
    ...(properties.width === undefined ? {} : { width: properties.width }),
    ...(properties.alignment === undefined ? {} : { alignment: properties.alignment }),
    ...policyProperty(properties.onMissing),
  });
}

/** Snapshots one saved semantic-swimlane facet. */
function snapshotSwimlane(value: unknown): KanbanSavedSwimlaneV1 {
  const properties = exactProperties(value, SWIMLANE_KEYS);
  if (
    typeof properties.swimlaneId !== 'string' ||
    typeof properties.visible !== 'boolean' ||
    typeof properties.collapsed !== 'boolean'
  ) {
    return invalidView();
  }
  return Object.freeze({
    swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
    visible: properties.visible,
    collapsed: properties.collapsed,
    ...policyProperty(properties.onMissing),
  });
}

/** Snapshots one ordered item envelope. */
function snapshotItems<T>(value: unknown, maximum: number, snapshot: (entry: unknown) => T): readonly T[] {
  const properties = exactProperties(value, ITEMS_KEYS);
  return arrayOf(properties.items, maximum, snapshot);
}

/** Snapshots durable card-presentation facets. */
function snapshotPresentation(value: unknown): KanbanSavedPresentationV1 {
  const properties = exactProperties(value, PRESENTATION_KEYS);
  if (properties.density !== 'compact' && properties.density !== 'comfortable' && properties.density !== 'spacious') {
    return invalidView();
  }
  if (properties.checklist !== 'hidden' && properties.checklist !== 'progress' && properties.checklist !== 'preview') {
    return invalidView();
  }
  const cardFieldIds = unique(
    arrayOf(properties.cardFieldIds, KANBAN_SAVED_VIEW_LIMITS.fieldDirectives, (entry) => {
      if (typeof entry !== 'string') return invalidView();
      return createKanbanFieldId(entry);
    }),
    (entry) => entry,
  );
  const summaryIds = unique(
    arrayOf(properties.summaryIds, KANBAN_SAVED_VIEW_LIMITS.summaries, (entry) => {
      if (typeof entry !== 'string') return invalidView();
      return createKanbanFieldId(entry);
    }),
    (entry) => entry,
  );
  return Object.freeze({ density: properties.density, cardFieldIds, summaryIds, checklist: properties.checklist });
}

/** Snapshots the complete durable view payload. */
function snapshotDurableView(value: unknown): KanbanDurableViewStateV1 {
  const properties = exactProperties(value, VIEW_KEYS);
  if (properties.searchPolicy !== 'transient' && properties.searchPolicy !== 'durable') return invalidView();
  if (properties.searchPolicy === 'transient' && properties.search !== undefined) return invalidView();
  const filters = unique(
    arrayOf(properties.filters, KANBAN_SAVED_VIEW_LIMITS.fieldDirectives, snapshotFilter),
    (entry) => `${entry.fieldId}\u0000${entry.operatorId}`,
  );
  const quickFilters = unique(
    arrayOf(properties.quickFilters, KANBAN_SAVED_VIEW_LIMITS.fieldDirectives, snapshotQuickFilter),
    (entry) => entry.id,
  );
  const sort = unique(
    arrayOf(properties.sort, KANBAN_SAVED_VIEW_LIMITS.fieldDirectives, snapshotSort),
    (entry) => entry.fieldId,
  );
  const columns = unique(
    snapshotItems(properties.columns, KANBAN_SAVED_VIEW_LIMITS.columns, snapshotColumn),
    (entry) => entry.columnId,
  );
  const swimlanes = unique(
    snapshotItems(properties.swimlanes, KANBAN_SAVED_VIEW_LIMITS.swimlanes, snapshotSwimlane),
    (entry) => entry.swimlaneId,
  );
  return Object.freeze({
    searchPolicy: properties.searchPolicy,
    ...(properties.search === undefined ? {} : { search: boundedString(properties.search) }),
    filters,
    quickFilters,
    sort,
    ...(properties.grouping === undefined ? {} : { grouping: snapshotGrouping(properties.grouping) }),
    columns: Object.freeze({ items: columns }),
    swimlanes: Object.freeze({ items: swimlanes }),
    presentation: snapshotPresentation(properties.presentation),
  });
}

/** Snapshots inert namespaced extension JSON without interpreting it. */
function snapshotExtensions(value: unknown): Readonly<Record<string, KanbanSemanticValue>> {
  const properties = exactProperties(
    value,
    new Set(Object.keys(snapshotKanbanDataProperties(value, KANBAN_SAVED_VIEW_LIMITS.extensions))),
  );
  const extensions: Record<string, KanbanSemanticValue> = {};
  for (const [id, extension] of Object.entries(properties)) {
    extensions[createKanbanExtensionId(id)] = snapshotKanbanSemanticValue(extension);
  }
  return Object.freeze(extensions);
}

/** Validates and detaches one already JSON-safe current envelope. */
function snapshotEnvelope(value: unknown): KanbanSavedViewV1 {
  const properties = exactProperties(value, ENVELOPE_KEYS);
  if (properties.kind !== KANBAN_SAVED_VIEW_KIND || properties.version !== 1) return invalidView();
  if (properties.name !== undefined) boundedString(properties.name);
  return Object.freeze({
    kind: KANBAN_SAVED_VIEW_KIND,
    version: 1,
    ...(properties.name === undefined ? {} : { name: boundedString(properties.name) }),
    view: snapshotDurableView(properties.view),
    ...(properties.extensions === undefined ? {} : { extensions: snapshotExtensions(properties.extensions) }),
  });
}

/**
 * Converts bounded text or object input into one detached JSON-like semantic snapshot.
 *
 * This internal package seam is shared by current parsing and legacy migration so persisted text
 * never bypasses the cheap pre-parse size guard.
 */
export function snapshotKanbanSavedViewInput(input: unknown): KanbanSemanticValue {
  let value = input;
  if (typeof input === 'string') {
    if (
      input.length > KANBAN_SAVED_VIEW_LIMITS.encodedBytes ||
      ENCODER.encode(input).byteLength > KANBAN_SAVED_VIEW_LIMITS.encodedBytes
    ) {
      return invalidView();
    }
    try {
      value = JSON.parse(input);
    } catch {
      return invalidView();
    }
  }
  return snapshotKanbanSemanticValue(value);
}

/**
 * Parses unknown text or object input into an exact detached current saved-view envelope.
 *
 * Rejected input is never echoed in the result, and accessors or executable-like values are never
 * invoked. Newer and older schema versions return a structured compatibility result.
 *
 * @example
 * ```ts
 * const parsed = parseKanbanSavedView(jsonText);
 * if (parsed.kind === 'parsed') restore(parsed.value);
 * ```
 */
export function parseKanbanSavedView(input: unknown): KanbanSavedViewParseResult {
  try {
    const detached = snapshotKanbanSavedViewInput(input);
    const properties = exactProperties(detached, ENVELOPE_KEYS);
    if (properties.kind !== KANBAN_SAVED_VIEW_KIND) return invalidView();
    if (typeof properties.version !== 'number' || !Number.isSafeInteger(properties.version)) return invalidView();
    if (properties.version !== 1) {
      return Object.freeze({
        kind: 'unsupported-version',
        version: properties.version,
        supported: KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS,
      });
    }
    return Object.freeze({ kind: 'parsed', value: snapshotEnvelope(detached) });
  } catch {
    return Object.freeze({ kind: 'rejected', diagnostic: Object.freeze({ code: 'invalid-view' }) });
  }
}

/**
 * Serializes one current saved-view envelope into deterministic canonical JSON.
 *
 * @throws {KanbanInvalidSavedViewError} when the input is not an exact current envelope.
 *
 * @example
 * ```ts
 * const jsonText = serializeKanbanSavedView(captureKanbanSavedView(controller));
 * ```
 */
export function serializeKanbanSavedView(value: unknown): string {
  try {
    return canonicalizeKanbanSemanticValue(snapshotEnvelope(snapshotKanbanSemanticValue(value)));
  } catch {
    throw new KanbanInvalidSavedViewError();
  }
}
