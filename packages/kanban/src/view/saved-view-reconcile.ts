import {
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanFieldId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import { snapshotKanbanDataArray, snapshotKanbanDataProperties } from '../contract/data-snapshot.js';
import type { KanbanFieldId } from '../contract/identity.js';
import type { KanbanFilter, KanbanSort } from '../source/types.js';
import { snapshotKanbanViewState } from './state.js';
import { parseKanbanSavedView } from './saved-view-codec.js';
import { KANBAN_SAVED_VIEW_LIMITS } from './saved-view-limits.js';
import type {
  KanbanReconciledSavedView,
  KanbanSavedColumnV1,
  KanbanSavedSwimlaneV1,
  KanbanSavedViewColumnDefinition,
  KanbanSavedViewDiagnostic,
  KanbanSavedViewFieldDefinition,
  KanbanSavedViewReconciliationContext,
  KanbanSavedViewReconciliationResult,
  KanbanSavedViewReferenceCategory,
  KanbanSavedViewSwimlaneDefinition,
  KanbanSavedViewV1,
} from './saved-view-types.js';
import type {
  KanbanColumnViewItem,
  KanbanGroupingSelection,
  KanbanQuickFilterSelection,
  KanbanSwimlaneViewItem,
} from './types.js';

/** Mutable bounded diagnostic accumulator used only during one reconciliation call. */
interface DiagnosticCollector {
  /** Sanitized diagnostics in deterministic discovery order. */
  readonly values: KanbanSavedViewDiagnostic[];
  /** Adds one missing-reference diagnostic while enforcing the fixed result bound. */
  dropped(category: KanbanSavedViewReferenceCategory, id: string): void;
}

/** Exact members accepted for one current field definition. */
const FIELD_DEFINITION_KEYS = new Set(['fieldId', 'operators', 'comparators']);
/** Exact members accepted for one current workflow-column definition. */
const COLUMN_DEFINITION_KEYS = new Set([
  'columnId',
  'visible',
  'collapsed',
  'minimumWidth',
  'maximumWidth',
  'alignment',
]);
/** Exact members accepted for one current semantic-swimlane definition. */
const SWIMLANE_DEFINITION_KEYS = new Set(['swimlaneId', 'visible', 'collapsed']);

/** Internal sentinel used to return an exact required-reference rejection through nested helpers. */
class MissingRequiredReferenceError extends Error {
  /** Missing semantic category. */
  readonly category: KanbanSavedViewReferenceCategory;
  /** Stable missing identity. */
  readonly id: string;

  /** Creates a payload-bounded sentinel containing stable identities only. */
  constructor(category: KanbanSavedViewReferenceCategory, id: string) {
    super('Missing required saved-view reference.');
    this.name = 'MissingRequiredReferenceError';
    this.category = category;
    this.id = id;
  }
}

/** Rejects invalid reconciliation metadata without exposing application values. */
function invalidReconciliation(): never {
  throw new TypeError('Invalid Kanban saved-view reconciliation context.');
}

/** Reads one exact plain reconciliation object without invoking accessors. */
function exactProperties(value: unknown, keys: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  try {
    const properties = snapshotKanbanDataProperties(value, keys.size);
    if (Object.keys(properties).some((key) => !keys.has(key))) return invalidReconciliation();
    return properties;
  } catch {
    return invalidReconciliation();
  }
}

/** Copies one dense reconciliation array before reading its entries. */
function dataArray(value: unknown, maximum: number): readonly unknown[] {
  try {
    return snapshotKanbanDataArray(value, maximum);
  } catch {
    return invalidReconciliation();
  }
}

/** Creates one bounded deterministic diagnostic collector. */
function createDiagnostics(): DiagnosticCollector {
  const values: KanbanSavedViewDiagnostic[] = [];
  return {
    values,
    dropped(category, id) {
      if (values.length >= KANBAN_SAVED_VIEW_LIMITS.diagnostics) return invalidReconciliation();
      values.push(Object.freeze({ code: 'missing-reference-dropped', category, id }));
    },
  };
}

/** Validates a finite unique identity list before lookup. */
function identitySet(
  values: readonly string[] | undefined,
  create: (value: string) => string,
): ReadonlySet<string> | undefined {
  if (values === undefined) return undefined;
  const identities = dataArray(values, KANBAN_SAVED_VIEW_LIMITS.registeredIds).map((value) => {
    if (typeof value !== 'string') return invalidReconciliation();
    return create(value);
  });
  if (new Set(identities).size !== identities.length) return invalidReconciliation();
  return new Set(identities);
}

/** Validates current field metadata and indexes it by stable identity. */
function fieldDefinitions(
  values: readonly KanbanSavedViewFieldDefinition[] | undefined,
): ReadonlyMap<KanbanFieldId, KanbanSavedViewFieldDefinition> {
  if (values === undefined) return new Map();
  const result = new Map<KanbanFieldId, KanbanSavedViewFieldDefinition>();
  for (const value of dataArray(values, KANBAN_SAVED_VIEW_LIMITS.registeredIds)) {
    const properties = exactProperties(value, FIELD_DEFINITION_KEYS);
    if (typeof properties.fieldId !== 'string') return invalidReconciliation();
    const fieldId = createKanbanFieldId(properties.fieldId);
    if (result.has(fieldId)) return invalidReconciliation();
    const operators = dataArray(properties.operators, KANBAN_SAVED_VIEW_LIMITS.registeredIds).map((entry) => {
      if (typeof entry !== 'string') return invalidReconciliation();
      return createKanbanExtensionId(entry);
    });
    const comparators = dataArray(properties.comparators, KANBAN_SAVED_VIEW_LIMITS.registeredIds).map((entry) => {
      if (typeof entry !== 'string') return invalidReconciliation();
      return createKanbanExtensionId(entry);
    });
    if (new Set(operators).size !== operators.length || new Set(comparators).size !== comparators.length) {
      return invalidReconciliation();
    }
    result.set(
      fieldId,
      Object.freeze({ fieldId, operators: Object.freeze(operators), comparators: Object.freeze(comparators) }),
    );
  }
  return result;
}

/** Validates one current workflow-column definition. */
function columnDefinition(value: unknown): KanbanSavedViewColumnDefinition {
  const properties = exactProperties(value, COLUMN_DEFINITION_KEYS);
  if (typeof properties.columnId !== 'string') return invalidReconciliation();
  const columnId = createKanbanColumnId(properties.columnId);
  if (
    typeof properties.visible !== 'boolean' ||
    typeof properties.collapsed !== 'boolean' ||
    typeof properties.minimumWidth !== 'number' ||
    typeof properties.maximumWidth !== 'number' ||
    !Number.isSafeInteger(properties.minimumWidth) ||
    !Number.isSafeInteger(properties.maximumWidth) ||
    properties.minimumWidth < 1 ||
    properties.maximumWidth < properties.minimumWidth ||
    properties.maximumWidth > KANBAN_SAVED_VIEW_LIMITS.columnWidthCells ||
    (properties.alignment !== undefined && properties.alignment !== 'start' && properties.alignment !== 'center')
  ) {
    return invalidReconciliation();
  }
  return Object.freeze({
    columnId,
    visible: properties.visible,
    collapsed: properties.collapsed,
    minimumWidth: properties.minimumWidth,
    maximumWidth: properties.maximumWidth,
    ...(properties.alignment === undefined ? {} : { alignment: properties.alignment }),
  });
}

/** Validates one current semantic-swimlane definition. */
function swimlaneDefinition(value: unknown): KanbanSavedViewSwimlaneDefinition {
  const properties = exactProperties(value, SWIMLANE_DEFINITION_KEYS);
  if (
    typeof properties.swimlaneId !== 'string' ||
    typeof properties.visible !== 'boolean' ||
    typeof properties.collapsed !== 'boolean'
  ) {
    return invalidReconciliation();
  }
  return Object.freeze({
    swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
    visible: properties.visible,
    collapsed: properties.collapsed,
  });
}

/** Validates and indexes ordered current structure definitions. */
function structureDefinitions<T extends object>(
  values: unknown,
  maximum: number,
  snapshot: (value: unknown) => T,
  id: (value: T) => string,
): { readonly ordered: readonly T[]; readonly byId: ReadonlyMap<string, T> } {
  const ordered = Object.freeze(dataArray(values, maximum).map(snapshot));
  const byId = new Map<string, T>();
  for (const value of ordered) {
    const identity = id(value);
    if (byId.has(identity)) return invalidReconciliation();
    byId.set(identity, value);
  }
  return { ordered, byId };
}

/** Applies the primary-reference drop policy or raises one conservative rejection. */
function missingPrimary(
  policy: 'drop' | 'reject' | undefined,
  category: KanbanSavedViewReferenceCategory,
  id: string,
  diagnostics: DiagnosticCollector,
): false {
  if (policy !== 'reject') {
    diagnostics.dropped(category, id);
    return false;
  }
  throw new MissingRequiredReferenceError(category, id);
}

/** Requires one executable semantic identity, which cannot be weakened by a directive drop policy. */
function requireExecutable(available: boolean, category: KanbanSavedViewReferenceCategory, id: string): void {
  if (!available) throw new MissingRequiredReferenceError(category, id);
}

/** Resolves saved filters against current field/operator metadata. */
function resolveFilters(
  raw: KanbanSavedViewV1,
  fields: ReadonlyMap<KanbanFieldId, KanbanSavedViewFieldDefinition>,
  diagnostics: DiagnosticCollector,
): readonly KanbanFilter[] {
  const resolved: KanbanFilter[] = [];
  for (const filter of raw.view.filters) {
    const field = fields.get(filter.fieldId);
    if (field === undefined) {
      missingPrimary(filter.onMissing, 'filter-field', filter.fieldId, diagnostics);
      continue;
    }
    requireExecutable(field.operators.includes(filter.operatorId), 'operator', filter.operatorId);
    resolved.push(Object.freeze({ fieldId: filter.fieldId, operatorId: filter.operatorId, value: filter.value }));
  }
  return Object.freeze(resolved);
}

/** Resolves saved quick filters against the immutable behavior registry. */
function resolveQuickFilters(
  raw: KanbanSavedViewV1,
  context: KanbanSavedViewReconciliationContext,
): readonly KanbanQuickFilterSelection[] {
  return Object.freeze(
    raw.view.quickFilters.map((quickFilter) => {
      requireExecutable(context.registry.quickFilter(quickFilter.id) !== undefined, 'quick-filter', quickFilter.id);
      return Object.freeze({
        id: quickFilter.id,
        ...(quickFilter.value === undefined ? {} : { value: quickFilter.value }),
      });
    }),
  );
}

/** Resolves saved ordering against current field/comparator metadata. */
function resolveSort(
  raw: KanbanSavedViewV1,
  fields: ReadonlyMap<KanbanFieldId, KanbanSavedViewFieldDefinition>,
  diagnostics: DiagnosticCollector,
): readonly KanbanSort[] {
  const resolved: KanbanSort[] = [];
  for (const sort of raw.view.sort) {
    const field = fields.get(sort.fieldId);
    if (field === undefined) {
      missingPrimary(sort.onMissing, 'sort-field', sort.fieldId, diagnostics);
      continue;
    }
    if (sort.comparatorId !== undefined) {
      requireExecutable(field.comparators.includes(sort.comparatorId), 'comparator', sort.comparatorId);
    }
    resolved.push(
      Object.freeze({
        fieldId: sort.fieldId,
        ...(sort.comparatorId === undefined ? {} : { comparatorId: sort.comparatorId }),
        direction: sort.direction,
      }),
    );
  }
  return Object.freeze(resolved);
}

/** Resolves optional grouping field and variant identities. */
function resolveGrouping(
  raw: KanbanSavedViewV1,
  fields: ReadonlyMap<KanbanFieldId, KanbanSavedViewFieldDefinition>,
  variants: ReadonlySet<string> | undefined,
  diagnostics: DiagnosticCollector,
): KanbanGroupingSelection | undefined {
  const grouping = raw.view.grouping;
  if (grouping === undefined) return undefined;
  if (!fields.has(grouping.fieldId)) {
    missingPrimary(grouping.onMissing, 'grouping-field', grouping.fieldId, diagnostics);
    return undefined;
  }
  if (grouping.variantId !== undefined && variants !== undefined) {
    requireExecutable(variants.has(grouping.variantId), 'grouping-variant', grouping.variantId);
  }
  return Object.freeze({
    fieldId: grouping.fieldId,
    ...(grouping.variantId === undefined ? {} : { variantId: grouping.variantId }),
  });
}

/** Clamps one raw column against current runtime geometry without changing the raw envelope. */
function resolveColumn(raw: KanbanSavedColumnV1, current: KanbanSavedViewColumnDefinition): KanbanColumnViewItem {
  const width =
    raw.width === undefined ? undefined : Math.max(current.minimumWidth, Math.min(raw.width, current.maximumWidth));
  return Object.freeze({
    columnId: raw.columnId,
    visible: raw.visible,
    collapsed: raw.collapsed,
    ...(width === undefined ? {} : { width }),
    ...(raw.alignment === undefined ? {} : { alignment: raw.alignment }),
  });
}

/** Resolves ordered columns and appends new current columns in current order. */
function resolveColumns(
  raw: KanbanSavedViewV1,
  current: ReturnType<typeof currentColumns>,
  diagnostics: DiagnosticCollector,
): readonly KanbanColumnViewItem[] {
  const resolved: KanbanColumnViewItem[] = [];
  const seen = new Set<string>();
  for (const item of raw.view.columns.items) {
    const definition = current.byId.get(item.columnId);
    if (definition === undefined) {
      missingPrimary(item.onMissing, 'column', item.columnId, diagnostics);
      continue;
    }
    resolved.push(resolveColumn(item, definition));
    seen.add(item.columnId);
  }
  for (const definition of current.ordered) {
    if (seen.has(definition.columnId)) continue;
    resolved.push(
      Object.freeze({
        columnId: definition.columnId,
        visible: definition.visible,
        collapsed: definition.collapsed,
        ...(definition.alignment === undefined ? {} : { alignment: definition.alignment }),
      }),
    );
  }
  return Object.freeze(resolved);
}

/** Resolves one saved swimlane into current controller state. */
function resolveSwimlane(raw: KanbanSavedSwimlaneV1): KanbanSwimlaneViewItem {
  return Object.freeze({ swimlaneId: raw.swimlaneId, visible: raw.visible, collapsed: raw.collapsed });
}

/** Resolves ordered swimlanes and appends new current swimlanes in current order. */
function resolveSwimlanes(
  raw: KanbanSavedViewV1,
  current: ReturnType<typeof currentSwimlanes>,
  diagnostics: DiagnosticCollector,
): readonly KanbanSwimlaneViewItem[] {
  const resolved: KanbanSwimlaneViewItem[] = [];
  const seen = new Set<string>();
  for (const item of raw.view.swimlanes.items) {
    if (!current.byId.has(item.swimlaneId)) {
      missingPrimary(item.onMissing, 'swimlane', item.swimlaneId, diagnostics);
      continue;
    }
    resolved.push(resolveSwimlane(item));
    seen.add(item.swimlaneId);
  }
  for (const definition of current.ordered) {
    if (seen.has(definition.swimlaneId)) continue;
    resolved.push(resolveSwimlane(definition));
  }
  return Object.freeze(resolved);
}

/** Validates current ordered column definitions. */
function currentColumns(values: readonly KanbanSavedViewColumnDefinition[]) {
  return structureDefinitions(values, KANBAN_SAVED_VIEW_LIMITS.columns, columnDefinition, (value) => value.columnId);
}

/** Validates current ordered swimlane definitions. */
function currentSwimlanes(values: readonly KanbanSavedViewSwimlaneDefinition[]) {
  return structureDefinitions(
    values,
    KANBAN_SAVED_VIEW_LIMITS.swimlanes,
    swimlaneDefinition,
    (value) => value.swimlaneId,
  );
}

/** Drops missing presentation identities in stable saved order. */
function resolvePresentationIds(
  values: readonly KanbanFieldId[],
  available: ReadonlySet<string> | undefined,
  category: 'card-field' | 'summary',
  diagnostics: DiagnosticCollector,
): readonly KanbanFieldId[] {
  if (available === undefined) return values;
  const resolved: KanbanFieldId[] = [];
  for (const value of values) {
    if (available.has(value)) resolved.push(value);
    else diagnostics.dropped(category, value);
  }
  return Object.freeze(resolved);
}

/** Returns one payload-free invalid-input reconciliation result. */
function invalidResult(): KanbanSavedViewReconciliationResult {
  return Object.freeze({ kind: 'rejected', diagnostic: Object.freeze({ code: 'invalid-view' }) });
}

/**
 * Resolves one parsed raw envelope against current application registries and structures.
 *
 * The function is pure: it retains the raw detached envelope for provenance and returns a separate
 * controller-ready state. Missing optional structures produce bounded diagnostics; missing executable
 * semantics reject the whole result before any live controller can observe it.
 *
 * @example
 * ```ts
 * const result = reconcileKanbanSavedView(parsed.value, {
 *   registry,
 *   fields,
 *   columns,
 *   swimlanes,
 * });
 * if (result.kind === 'reconciled') applyKanbanSavedView(controller, result);
 * ```
 */
export function reconcileKanbanSavedView(
  input: KanbanSavedViewV1,
  context: KanbanSavedViewReconciliationContext,
): KanbanSavedViewReconciliationResult {
  try {
    const parsed = parseKanbanSavedView(input);
    if (parsed.kind !== 'parsed') return invalidResult();
    const raw = parsed.value;
    const diagnostics = createDiagnostics();
    const fields = fieldDefinitions(context.fields);
    const columns = currentColumns(context.columns);
    const swimlanes = currentSwimlanes(context.swimlanes);
    const cardFieldIds = identitySet(context.cardFieldIds, createKanbanFieldId);
    const summaryIds = identitySet(context.summaryIds, createKanbanFieldId);
    const variants = identitySet(context.groupingVariantIds, createKanbanExtensionId);
    const resolved = snapshotKanbanViewState(
      {
        searchPolicy: raw.view.searchPolicy,
        search: raw.view.search ?? '',
        filters: resolveFilters(raw, fields, diagnostics),
        quickFilters: resolveQuickFilters(raw, context),
        sort: resolveSort(raw, fields, diagnostics),
        grouping: resolveGrouping(raw, fields, variants, diagnostics),
        columns: { items: resolveColumns(raw, columns, diagnostics) },
        swimlanes: { items: resolveSwimlanes(raw, swimlanes, diagnostics) },
        presentation: {
          density: raw.view.presentation.density,
          cardFieldIds: resolvePresentationIds(
            raw.view.presentation.cardFieldIds,
            cardFieldIds,
            'card-field',
            diagnostics,
          ),
          summaryIds: resolvePresentationIds(raw.view.presentation.summaryIds, summaryIds, 'summary', diagnostics),
          checklist: raw.view.presentation.checklist,
        },
        revision: 0,
      },
      0,
    );
    const provenance = Object.freeze({ raw, resolved });
    return Object.freeze<KanbanReconciledSavedView>({
      kind: 'reconciled',
      raw,
      resolved,
      provenance,
      diagnostics: Object.freeze(diagnostics.values),
    });
  } catch (error) {
    if (error instanceof MissingRequiredReferenceError) {
      return Object.freeze({
        kind: 'rejected',
        diagnostic: Object.freeze({
          code: 'missing-required-reference',
          category: error.category,
          id: error.id,
        }),
      });
    }
    return invalidResult();
  }
}
