import type { KanbanCardDensity } from '../card/descriptor.js';
import { snapshotKanbanDataArray, snapshotKanbanDataProperties } from '../contract/data-snapshot.js';
import {
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanFieldId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import { KANBAN_LIMITS, KANBAN_STRUCTURE_PRESENTATION_LIMITS } from '../contract/limits.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { snapshotKanbanSemanticValue } from '../contract/semantic-query.js';
import { snapshotKanbanQuery } from '../source/validation.js';
import type {
  KanbanColumnViewItem,
  KanbanColumnViewState,
  KanbanGroupingSelection,
  KanbanQuickFilterSelection,
  KanbanSearchPolicy,
  KanbanSwimlaneViewItem,
  KanbanSwimlaneViewState,
  KanbanViewPresentation,
  KanbanViewState,
  KanbanViewTransition,
} from './types.js';

/** Exact members accepted for a complete view snapshot. */
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
  'revision',
]);
/** Exact members accepted for one grouping selection. */
const GROUPING_KEYS = new Set(['fieldId', 'variantId']);
/** Exact members accepted for one quick-filter selection. */
const QUICK_FILTER_KEYS = new Set(['id', 'value']);
/** Exact members accepted for one column view item. */
const COLUMN_KEYS = new Set(['columnId', 'visible', 'collapsed', 'width', 'alignment']);
/** Exact members accepted for one swimlane view item. */
const SWIMLANE_KEYS = new Set(['swimlaneId', 'visible', 'collapsed']);
/** Exact members accepted for one ordered item envelope. */
const ITEMS_KEYS = new Set(['items']);
/** Exact members accepted for view presentation. */
const PRESENTATION_KEYS = new Set(['density', 'cardFieldIds', 'checklist']);
/** UTF-8 encoder used for committed search bounds. */
const ENCODER = new TextEncoder();

/** Rejects state input without retaining or echoing caller values. */
function invalidState(): never {
  throw new TypeError('Invalid Kanban view state.');
}

/** Verifies that an exact data envelope contains no unknown members. */
function exactProperties(value: unknown, keys: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  const properties = snapshotKanbanDataProperties(value, keys.size);
  if (Object.keys(properties).some((key) => !keys.has(key))) return invalidState();
  return properties;
}

/** Snapshots a bounded dense array with one validator per entry. */
function arrayOf<T>(value: unknown, maximum: number, snapshot: (entry: unknown) => T): readonly T[] {
  return Object.freeze(snapshotKanbanDataArray(value, maximum).map(snapshot));
}

/** Validates one named density. */
function snapshotDensity(value: unknown): KanbanCardDensity {
  if (value !== 'compact' && value !== 'comfortable' && value !== 'spacious') return invalidState();
  return value;
}

/** Validates one search persistence policy. */
function snapshotSearchPolicy(value: unknown): KanbanSearchPolicy {
  if (value !== 'transient' && value !== 'durable') return invalidState();
  return value;
}

/** Validates safe bounded committed search text. */
function snapshotSearch(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > KANBAN_LIMITS.semanticStringBytes.safe ||
    ENCODER.encode(value).byteLength > KANBAN_LIMITS.semanticStringBytes.safe
  ) {
    return invalidState();
  }
  return value;
}

/** Snapshots one named quick-filter selection. */
function snapshotQuickFilter(value: unknown): KanbanQuickFilterSelection {
  const properties = exactProperties(value, QUICK_FILTER_KEYS);
  if (typeof properties.id !== 'string') return invalidState();
  return Object.freeze({
    id: createKanbanExtensionId(properties.id),
    ...(properties.value === undefined ? {} : { value: snapshotKanbanSemanticValue(properties.value) }),
  });
}

/** Snapshots the optional one-dimensional grouping selection. */
function snapshotGrouping(value: unknown): KanbanGroupingSelection {
  const properties = exactProperties(value, GROUPING_KEYS);
  if (
    typeof properties.fieldId !== 'string' ||
    (properties.variantId !== undefined && typeof properties.variantId !== 'string')
  ) {
    return invalidState();
  }
  return Object.freeze({
    fieldId: createKanbanFieldId(properties.fieldId),
    ...(properties.variantId === undefined ? {} : { variantId: createKanbanExtensionId(properties.variantId) }),
  });
}

/** Snapshots one complete column view item. */
function snapshotColumnItem(value: unknown): KanbanColumnViewItem {
  const properties = exactProperties(value, COLUMN_KEYS);
  if (
    typeof properties.columnId !== 'string' ||
    typeof properties.visible !== 'boolean' ||
    typeof properties.collapsed !== 'boolean' ||
    (properties.width !== undefined &&
      (typeof properties.width !== 'number' ||
        !Number.isSafeInteger(properties.width) ||
        properties.width < 1 ||
        properties.width > KANBAN_STRUCTURE_PRESENTATION_LIMITS.columnWidthCells)) ||
    (properties.alignment !== undefined && properties.alignment !== 'start' && properties.alignment !== 'center')
  ) {
    return invalidState();
  }
  return Object.freeze({
    columnId: createKanbanColumnId(properties.columnId),
    visible: properties.visible,
    collapsed: properties.collapsed,
    ...(properties.width === undefined ? {} : { width: properties.width }),
    ...(properties.alignment === undefined ? {} : { alignment: properties.alignment }),
  });
}

/** Snapshots one complete swimlane view item. */
function snapshotSwimlaneItem(value: unknown): KanbanSwimlaneViewItem {
  const properties = exactProperties(value, SWIMLANE_KEYS);
  if (
    typeof properties.swimlaneId !== 'string' ||
    typeof properties.visible !== 'boolean' ||
    typeof properties.collapsed !== 'boolean'
  ) {
    return invalidState();
  }
  return Object.freeze({
    swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
    visible: properties.visible,
    collapsed: properties.collapsed,
  });
}

/** Rejects duplicate identities after a complete bounded snapshot exists. */
function unique<T>(items: readonly T[], id: (item: T) => string): readonly T[] {
  if (new Set(items.map(id)).size !== items.length) return invalidState();
  return items;
}

/** Snapshots complete ordered column view state. */
function snapshotColumns(value: unknown): KanbanColumnViewState {
  const properties = exactProperties(value, ITEMS_KEYS);
  const items = unique(
    arrayOf(properties.items, KANBAN_LIMITS.columns.safe, snapshotColumnItem),
    (item) => item.columnId,
  );
  return Object.freeze({ items });
}

/** Snapshots complete ordered swimlane view state. */
function snapshotSwimlanes(value: unknown): KanbanSwimlaneViewState {
  const properties = exactProperties(value, ITEMS_KEYS);
  const items = unique(
    arrayOf(properties.items, KANBAN_LIMITS.swimlanes.safe, snapshotSwimlaneItem),
    (item) => item.swimlaneId,
  );
  return Object.freeze({ items });
}

/** Snapshots durable card-presentation facets. */
function snapshotPresentation(value: unknown): KanbanViewPresentation {
  const properties = exactProperties(value, PRESENTATION_KEYS);
  if (properties.checklist !== 'hidden' && properties.checklist !== 'progress' && properties.checklist !== 'preview') {
    return invalidState();
  }
  const cardFieldIds = unique(
    arrayOf(properties.cardFieldIds, KANBAN_LIMITS.cardFields.safe, (entry) => {
      if (typeof entry !== 'string') return invalidState();
      return createKanbanFieldId(entry);
    }),
    (entry) => entry,
  );
  return Object.freeze({ density: snapshotDensity(properties.density), cardFieldIds, checklist: properties.checklist });
}

/**
 * Validates and detaches a complete immutable view state, replacing its caller revision when requested.
 */
export function snapshotKanbanViewState(value: unknown, revision?: KanbanRevision): KanbanViewState {
  try {
    const properties = exactProperties(value, VIEW_KEYS);
    const propertyCount = Object.keys(properties).length;
    if (propertyCount !== VIEW_KEYS.size - 1 && propertyCount !== VIEW_KEYS.size) return invalidState();
    const query = snapshotKanbanQuery({ filters: properties.filters, sort: properties.sort });
    const quickFilters = unique(
      arrayOf(properties.quickFilters, KANBAN_LIMITS.cardFields.safe, snapshotQuickFilter),
      (entry) => entry.id,
    );
    const candidateRevision = revision ?? snapshotKanbanRevision(properties.revision);
    return Object.freeze({
      searchPolicy: snapshotSearchPolicy(properties.searchPolicy),
      search: snapshotSearch(properties.search),
      filters: query.filters ?? Object.freeze([]),
      quickFilters,
      sort: query.sort ?? Object.freeze([]),
      ...(properties.grouping === undefined ? {} : { grouping: snapshotGrouping(properties.grouping) }),
      columns: snapshotColumns(properties.columns),
      swimlanes: snapshotSwimlanes(properties.swimlanes),
      presentation: snapshotPresentation(properties.presentation),
      revision: candidateRevision,
    });
  } catch {
    return invalidState();
  }
}

/** Applies one typed transition and returns a fully detached candidate with the supplied next revision. */
export function transitionKanbanViewState(
  state: KanbanViewState,
  transition: KanbanViewTransition,
  revision: KanbanRevision,
): KanbanViewState {
  switch (transition.kind) {
    case 'set-search':
      return Object.freeze({ ...state, search: snapshotSearch(transition.search), revision });
    case 'set-search-policy':
      return Object.freeze({ ...state, searchPolicy: snapshotSearchPolicy(transition.policy), revision });
    case 'set-filters': {
      const filters = snapshotKanbanQuery({ filters: transition.filters, sort: [] }).filters ?? Object.freeze([]);
      return Object.freeze({ ...state, filters, revision });
    }
    case 'set-quick-filters': {
      const quickFilters = unique(
        arrayOf(transition.quickFilters, KANBAN_LIMITS.cardFields.safe, snapshotQuickFilter),
        (entry) => entry.id,
      );
      return Object.freeze({ ...state, quickFilters, revision });
    }
    case 'set-sort': {
      const sort = snapshotKanbanQuery({ filters: [], sort: transition.sort }).sort ?? Object.freeze([]);
      return Object.freeze({ ...state, sort, revision });
    }
    case 'set-grouping':
      return Object.freeze({
        ...state,
        grouping: transition.grouping === undefined ? undefined : snapshotGrouping(transition.grouping),
        revision,
      });
    case 'set-columns':
      return Object.freeze({ ...state, columns: snapshotColumns(transition.columns), revision });
    case 'set-swimlanes':
      return Object.freeze({ ...state, swimlanes: snapshotSwimlanes(transition.swimlanes), revision });
    case 'set-presentation':
      return Object.freeze({ ...state, presentation: snapshotPresentation(transition.presentation), revision });
    case 'set-density':
      return Object.freeze({
        ...state,
        presentation: Object.freeze({ ...state.presentation, density: snapshotDensity(transition.density) }),
        revision,
      });
    case 'clear-filters':
      return Object.freeze({
        ...state,
        search: '',
        filters: Object.freeze([]),
        quickFilters: Object.freeze([]),
        revision,
      });
  }
}

/** Returns semantic equality while deliberately ignoring local publication revision. */
export function kanbanViewStatesEqual(left: KanbanViewState, right: KanbanViewState): boolean {
  const { revision: _leftRevision, ...leftValue } = left;
  const { revision: _rightRevision, ...rightValue } = right;
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}
