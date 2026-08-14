import { KanbanInvalidSavedViewError } from '../contract/error.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import type { KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import { parseKanbanSavedView } from './saved-view-codec.js';
import type {
  KanbanDurableViewStateV1,
  KanbanReconciledSavedView,
  KanbanSavedColumnV1,
  KanbanSavedFilterV1,
  KanbanSavedGroupingV1,
  KanbanSavedPresentationV1,
  KanbanSavedQuickFilterV1,
  KanbanSavedSortV1,
  KanbanSavedSwimlaneV1,
  KanbanSavedViewCaptureOptions,
  KanbanSavedViewProvenance,
  KanbanSavedViewStore,
  KanbanSavedViewStoreOptions,
  KanbanSavedViewStoreResult,
  KanbanSavedViewV1,
} from './saved-view-types.js';
import { KANBAN_SAVED_VIEW_KIND } from './saved-view-types.js';
import type { KanbanViewController, KanbanViewState, KanbanViewTransitionResult } from './types.js';

/** Weak ownership avoids retaining disposed controllers solely for saved-view provenance. */
const CONTROLLER_PROVENANCE = new WeakMap<KanbanViewController, KanbanSavedViewProvenance>();

/** Returns semantic equality for already validated immutable saved-view facets. */
function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Converts current filters to durable directives without a missing-reference override. */
function currentFilters(state: KanbanViewState): readonly KanbanSavedFilterV1[] {
  return state.filters.map((filter) => Object.freeze({ ...filter }));
}

/** Converts current quick filters to durable directives without a missing-reference override. */
function currentQuickFilters(state: KanbanViewState): readonly KanbanSavedQuickFilterV1[] {
  return state.quickFilters.map((filter) => Object.freeze({ ...filter }));
}

/** Converts current sort state to durable directives without a missing-reference override. */
function currentSort(state: KanbanViewState): readonly KanbanSavedSortV1[] {
  return state.sort.map((sort) => Object.freeze({ ...sort }));
}

/** Converts current grouping state to one durable directive. */
function currentGrouping(state: KanbanViewState): KanbanSavedGroupingV1 | undefined {
  return state.grouping === undefined ? undefined : Object.freeze({ ...state.grouping });
}

/** Keeps the original raw facet only while its resolved baseline remains unchanged. */
function preserveFacet<T>(current: T, baseline: T | undefined, raw: T | undefined): T {
  return baseline !== undefined && raw !== undefined && equal(current, baseline) ? raw : current;
}

/** Merges current columns with raw widths and unavailable raw identities in stable raw order. */
function preserveColumns(
  state: KanbanViewState,
  provenance: KanbanSavedViewProvenance | undefined,
): readonly KanbanSavedColumnV1[] {
  if (provenance === undefined) return state.columns.items.map((item) => Object.freeze({ ...item }));
  const current = new Map(state.columns.items.map((item) => [item.columnId, item]));
  const result: KanbanSavedColumnV1[] = [];
  const seen = new Set<string>();
  for (const rawItem of provenance.raw.view.columns.items) {
    const currentItem = current.get(rawItem.columnId);
    if (currentItem === undefined) result.push(rawItem);
    else {
      result.push(
        Object.freeze({
          columnId: currentItem.columnId,
          visible: currentItem.visible,
          collapsed: currentItem.collapsed,
          ...(rawItem.width === undefined
            ? currentItem.width === undefined
              ? {}
              : { width: currentItem.width }
            : { width: rawItem.width }),
          ...(currentItem.alignment === undefined ? {} : { alignment: currentItem.alignment }),
          ...(rawItem.onMissing === undefined ? {} : { onMissing: rawItem.onMissing }),
        }),
      );
    }
    seen.add(rawItem.columnId);
  }
  for (const currentItem of state.columns.items) {
    if (!seen.has(currentItem.columnId)) result.push(Object.freeze({ ...currentItem }));
  }
  return Object.freeze(result);
}

/** Merges current swimlanes with unavailable raw identities in stable raw order. */
function preserveSwimlanes(
  state: KanbanViewState,
  provenance: KanbanSavedViewProvenance | undefined,
): readonly KanbanSavedSwimlaneV1[] {
  if (provenance === undefined) return state.swimlanes.items.map((item) => Object.freeze({ ...item }));
  const current = new Map(state.swimlanes.items.map((item) => [item.swimlaneId, item]));
  const result: KanbanSavedSwimlaneV1[] = [];
  const seen = new Set<string>();
  for (const rawItem of provenance.raw.view.swimlanes.items) {
    const currentItem = current.get(rawItem.swimlaneId);
    result.push(
      currentItem === undefined
        ? rawItem
        : Object.freeze({
            ...currentItem,
            ...(rawItem.onMissing === undefined ? {} : { onMissing: rawItem.onMissing }),
          }),
    );
    seen.add(rawItem.swimlaneId);
  }
  for (const currentItem of state.swimlanes.items) {
    if (!seen.has(currentItem.swimlaneId)) result.push(Object.freeze({ ...currentItem }));
  }
  return Object.freeze(result);
}

/** Creates durable presentation state from the current controller snapshot. */
function currentPresentation(state: KanbanViewState): KanbanSavedPresentationV1 {
  return Object.freeze({
    density: state.presentation.density,
    cardFieldIds: state.presentation.cardFieldIds,
    summaryIds: state.presentation.summaryIds,
    checklist: state.presentation.checklist,
  });
}

/** Captures current state while preserving unchanged raw directives and clamped geometry provenance. */
function preserveDurableState(
  state: KanbanViewState,
  provenance: KanbanSavedViewProvenance | undefined,
): KanbanDurableViewStateV1 {
  const baseline = provenance?.resolved;
  const raw = provenance?.raw.view;
  const filters = preserveFacet(currentFilters(state), baseline?.filters, raw?.filters);
  const quickFilters = preserveFacet(currentQuickFilters(state), baseline?.quickFilters, raw?.quickFilters);
  const sort = preserveFacet(currentSort(state), baseline?.sort, raw?.sort);
  const grouping = preserveFacet(currentGrouping(state), baseline?.grouping, raw?.grouping);
  return Object.freeze({
    searchPolicy: state.searchPolicy,
    ...(state.searchPolicy === 'durable' ? { search: state.search } : {}),
    filters,
    quickFilters,
    sort,
    ...(grouping === undefined ? {} : { grouping }),
    columns: Object.freeze({ items: preserveColumns(state, provenance) }),
    swimlanes: Object.freeze({ items: preserveSwimlanes(state, provenance) }),
    presentation: currentPresentation(state),
  });
}

/** Captures only current resolved state and deliberately drops retained raw provenance. */
function resavedDurableState(state: KanbanViewState): KanbanDurableViewStateV1 {
  return Object.freeze({
    searchPolicy: state.searchPolicy,
    ...(state.searchPolicy === 'durable' ? { search: state.search } : {}),
    filters: currentFilters(state),
    quickFilters: currentQuickFilters(state),
    sort: currentSort(state),
    ...(state.grouping === undefined ? {} : { grouping: currentGrouping(state) }),
    columns: Object.freeze({ items: state.columns.items.map((item) => Object.freeze({ ...item })) }),
    swimlanes: Object.freeze({ items: state.swimlanes.items.map((item) => Object.freeze({ ...item })) }),
    presentation: currentPresentation(state),
  });
}

/**
 * Captures one controller's durable semantic view without dispatching an application request.
 *
 * Ordinary capture preserves safe unavailable IDs and raw width values from the last reconciled view.
 * Use `mode: 'resave'` only when the user explicitly chooses to replace those raw values.
 *
 * @example
 * ```ts
 * const view = captureKanbanSavedView(controller, { name: 'My work' });
 * ```
 */
export function captureKanbanSavedView(
  controller: KanbanViewController,
  options: KanbanSavedViewCaptureOptions = {},
): KanbanSavedViewV1 {
  try {
    if (options.mode !== undefined && options.mode !== 'preserve' && options.mode !== 'resave') {
      throw new KanbanInvalidSavedViewError();
    }
    const state = controller.state();
    const provenance = CONTROLLER_PROVENANCE.get(controller);
    const raw = provenance?.raw;
    const candidate = {
      kind: KANBAN_SAVED_VIEW_KIND,
      version: 1,
      ...(options.name === undefined ? (raw?.name === undefined ? {} : { name: raw.name }) : { name: options.name }),
      view: options.mode === 'resave' ? resavedDurableState(state) : preserveDurableState(state, provenance),
      ...(options.extensions === undefined
        ? raw?.extensions === undefined
          ? {}
          : { extensions: raw.extensions }
        : { extensions: options.extensions }),
    };
    const parsed = parseKanbanSavedView(candidate);
    if (parsed.kind !== 'parsed') throw new KanbanInvalidSavedViewError();
    if (options.mode === 'resave') {
      CONTROLLER_PROVENANCE.set(controller, Object.freeze({ raw: parsed.value, resolved: state }));
    }
    return parsed.value;
  } catch (error) {
    if (error instanceof KanbanInvalidSavedViewError) throw error;
    throw new KanbanInvalidSavedViewError();
  }
}

/**
 * Applies one reconciled artifact through a controller's single atomic replacement boundary.
 *
 * Capture provenance is installed only when the controller accepted or already held the resolved state.
 *
 * @example
 * ```ts
 * if (reconciled.kind === 'reconciled') applyKanbanSavedView(controller, reconciled);
 * ```
 */
export function applyKanbanSavedView(
  controller: KanbanViewController,
  reconciled: KanbanReconciledSavedView,
): KanbanViewTransitionResult {
  try {
    if (reconciled.kind !== 'reconciled') return Object.freeze({ kind: 'rejected', code: 'invalid-saved-view' });
    const result = controller.replace(reconciled.resolved);
    if (result.kind === 'changed' || result.kind === 'unchanged') {
      CONTROLLER_PROVENANCE.set(controller, reconciled.provenance);
    }
    return result;
  } catch {
    return Object.freeze({ kind: 'rejected', code: 'invalid-saved-view' });
  }
}

/** Returns the fixed unavailable result used after store disposal. */
function disposedStore(): KanbanSavedViewStoreResult {
  return Object.freeze({ kind: 'unavailable', code: 'saved-view-store-disposed' });
}

/** Dispatches one exact proposal while containing application callback failures. */
async function requestStore(
  request: (proposal: KanbanRequestProposal) => KanbanRequestResult | Promise<KanbanRequestResult>,
  proposal: unknown,
): Promise<KanbanSavedViewStoreResult> {
  try {
    const snapshot = snapshotKanbanRequestProposal(proposal);
    return await request(snapshot);
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'saved-view-store-request-failed' });
  }
}

/**
 * Creates a disposable helper that routes persistence proposals through application authority.
 *
 * The helper owns no saved-view records. It only validates save, rename, and delete proposals before
 * forwarding them to the supplied board or application request seam.
 *
 * @example
 * ```ts
 * const store = createKanbanSavedViewStore({ request: (proposal) => board.request(proposal) });
 * await store.save('daily', captureKanbanSavedView(controller));
 * store.dispose();
 * ```
 */
export function createKanbanSavedViewStore(options: KanbanSavedViewStoreOptions): KanbanSavedViewStore {
  if (typeof options?.request !== 'function') throw new KanbanInvalidSavedViewError();
  let disposed = false;
  return Object.freeze({
    save: async (viewId: string, view: KanbanSavedViewV1) =>
      disposed ? disposedStore() : await requestStore(options.request, { kind: 'saved-view-save', viewId, data: view }),
    rename: async (viewId: string, label: string) =>
      disposed ? disposedStore() : await requestStore(options.request, { kind: 'saved-view-rename', viewId, label }),
    delete: async (viewId: string) =>
      disposed ? disposedStore() : await requestStore(options.request, { kind: 'saved-view-delete', viewId }),
    dispose: () => {
      disposed = true;
    },
  });
}
