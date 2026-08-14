import { KanbanInvalidSavedViewError } from '../contract/error.js';
import { snapshotKanbanDataProperties } from '../contract/data-snapshot.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import type { KanbanRequestProposal, KanbanRequestResult } from '../contract/request.js';
import { parseKanbanSavedView, serializeKanbanSavedView } from './saved-view-codec.js';
import { kanbanViewStatesEqual, snapshotKanbanViewState } from './state.js';
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
/** Exact reconciled artifact members accepted before controller mutation. */
const RECONCILED_KEYS = new Set(['kind', 'raw', 'resolved', 'provenance', 'diagnostics']);
/** Exact provenance members accepted before controller mutation. */
const PROVENANCE_KEYS = new Set(['raw', 'resolved']);

/** Returns semantic equality for already validated immutable saved-view facets. */
function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Preserves unchanged raw directives individually and appends only raw directives unavailable at reconciliation.
 *
 * Current resolved directives define the durable order. A current directive retains its raw missing-policy
 * metadata only while it still matches one resolved baseline entry; editing that directive invalidates only
 * its own raw provenance.
 */
function preserveDirectives<TSaved, TCurrent>(
  current: readonly TCurrent[],
  baseline: readonly TCurrent[] | undefined,
  raw: readonly TSaved[] | undefined,
  resolveRaw: (value: TSaved) => TCurrent,
  saveCurrent: (value: TCurrent) => TSaved,
  savedIdentity: (value: TSaved) => string,
  currentIdentity: (value: TCurrent) => string,
): readonly TSaved[] {
  if (baseline === undefined || raw === undefined) return Object.freeze(current.map(saveCurrent));
  const usedRaw = new Set<number>();
  const rawByBaseline = baseline.map((baselineValue) => {
    const index = raw.findIndex(
      (rawValue, candidate) => !usedRaw.has(candidate) && equal(resolveRaw(rawValue), baselineValue),
    );
    if (index < 0) return undefined;
    usedRaw.add(index);
    return raw[index];
  });
  const usedBaseline = new Set<number>();
  const result: TSaved[] = current.map((currentValue) => {
    const index = baseline.findIndex(
      (baselineValue, candidate) => !usedBaseline.has(candidate) && equal(currentValue, baselineValue),
    );
    if (index < 0) return saveCurrent(currentValue);
    usedBaseline.add(index);
    return rawByBaseline[index] ?? saveCurrent(currentValue);
  });
  const currentIdentities = new Set(current.map(currentIdentity));
  for (const [index, rawValue] of raw.entries()) {
    if (!usedRaw.has(index) && !currentIdentities.has(savedIdentity(rawValue))) result.push(rawValue);
  }
  return Object.freeze(result);
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

/** Removes raw-only missing policy from one directive before baseline comparison. */
function withoutMissing<T extends { readonly onMissing?: unknown }>(value: T): Omit<T, 'onMissing'> {
  const { onMissing: _onMissing, ...resolved } = value;
  return resolved;
}

/** Merges current columns with raw widths and unavailable raw identities in stable raw order. */
function preserveColumns(
  state: KanbanViewState,
  provenance: KanbanSavedViewProvenance | undefined,
): readonly KanbanSavedColumnV1[] {
  if (provenance === undefined) return state.columns.items.map((item) => Object.freeze({ ...item }));
  const raw = new Map(provenance.raw.view.columns.items.map((item) => [item.columnId, item]));
  const result: KanbanSavedColumnV1[] = [];
  const seen = new Set<string>();
  for (const currentItem of state.columns.items) {
    const rawItem = raw.get(currentItem.columnId);
    result.push(
      rawItem === undefined
        ? Object.freeze({ ...currentItem })
        : Object.freeze({
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
    seen.add(currentItem.columnId);
  }
  for (const rawItem of provenance.raw.view.columns.items) {
    if (
      !seen.has(rawItem.columnId) &&
      !provenance.resolved.columns.items.some((item) => item.columnId === rawItem.columnId)
    ) {
      result.push(rawItem);
    }
  }
  return Object.freeze(result);
}

/** Merges current swimlanes with unavailable raw identities in stable raw order. */
function preserveSwimlanes(
  state: KanbanViewState,
  provenance: KanbanSavedViewProvenance | undefined,
): readonly KanbanSavedSwimlaneV1[] {
  if (provenance === undefined) return state.swimlanes.items.map((item) => Object.freeze({ ...item }));
  const raw = new Map(provenance.raw.view.swimlanes.items.map((item) => [item.swimlaneId, item]));
  const result: KanbanSavedSwimlaneV1[] = [];
  const seen = new Set<string>();
  for (const currentItem of state.swimlanes.items) {
    const rawItem = raw.get(currentItem.swimlaneId);
    result.push(
      rawItem === undefined
        ? Object.freeze({ ...currentItem })
        : Object.freeze({
            ...currentItem,
            ...(rawItem.onMissing === undefined ? {} : { onMissing: rawItem.onMissing }),
          }),
    );
    seen.add(currentItem.swimlaneId);
  }
  for (const rawItem of provenance.raw.view.swimlanes.items) {
    if (
      !seen.has(rawItem.swimlaneId) &&
      !provenance.resolved.swimlanes.items.some((item) => item.swimlaneId === rawItem.swimlaneId)
    ) {
      result.push(rawItem);
    }
  }
  return Object.freeze(result);
}

/** Keeps current presentation order while retaining only identities unavailable in the resolved baseline. */
function preservePresentationIds(
  current: readonly string[],
  baseline: readonly string[] | undefined,
  raw: readonly string[] | undefined,
): readonly string[] {
  if (baseline === undefined || raw === undefined) return current;
  const resolved = new Set(baseline);
  const result = [...current];
  const seen = new Set(current);
  for (const identity of raw) {
    if (!resolved.has(identity) && !seen.has(identity)) {
      result.push(identity);
      seen.add(identity);
    }
  }
  return Object.freeze(result);
}

/** Creates durable presentation state from the current controller snapshot and raw provenance. */
function currentPresentation(
  state: KanbanViewState,
  provenance?: KanbanSavedViewProvenance,
): KanbanSavedPresentationV1 {
  return Object.freeze({
    density: state.presentation.density,
    cardFieldIds: preservePresentationIds(
      state.presentation.cardFieldIds,
      provenance?.resolved.presentation.cardFieldIds,
      provenance?.raw.view.presentation.cardFieldIds,
    ),
    summaryIds: preservePresentationIds(
      state.presentation.summaryIds,
      provenance?.resolved.presentation.summaryIds,
      provenance?.raw.view.presentation.summaryIds,
    ),
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
  const filters = preserveDirectives(
    currentFilters(state),
    baseline?.filters,
    raw?.filters,
    withoutMissing,
    (value) => value,
    (value) => `${value.fieldId}\u0000${value.operatorId}`,
    (value) => `${value.fieldId}\u0000${value.operatorId}`,
  );
  const quickFilters = preserveDirectives(
    currentQuickFilters(state),
    baseline?.quickFilters,
    raw?.quickFilters,
    withoutMissing,
    (value) => value,
    (value) => value.id,
    (value) => value.id,
  );
  const sort = preserveDirectives(
    currentSort(state),
    baseline?.sort,
    raw?.sort,
    withoutMissing,
    (value) => value,
    (value) => value.fieldId,
    (value) => value.fieldId,
  );
  const grouping = preserveDirectives(
    currentGrouping(state) === undefined ? [] : [currentGrouping(state)!],
    baseline?.grouping === undefined ? [] : [baseline.grouping],
    raw?.grouping === undefined ? [] : [raw.grouping],
    withoutMissing,
    (value) => value,
    (value) => value.fieldId,
    (value) => value.fieldId,
  )[0];
  return Object.freeze({
    searchPolicy: state.searchPolicy,
    ...(state.searchPolicy === 'durable' ? { search: state.search } : {}),
    filters,
    quickFilters,
    sort,
    ...(grouping === undefined ? {} : { grouping }),
    columns: Object.freeze({ items: preserveColumns(state, provenance) }),
    swimlanes: Object.freeze({ items: preserveSwimlanes(state, provenance) }),
    presentation: currentPresentation(state, provenance),
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

/** Reads one exact data object without invoking accessors. */
function exactStoreProperties(value: unknown, keys: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  try {
    const properties = snapshotKanbanDataProperties(value, keys.size);
    const propertyKeys = Object.keys(properties);
    if (propertyKeys.length !== keys.size || propertyKeys.some((key) => !keys.has(key))) {
      throw new KanbanInvalidSavedViewError();
    }
    return properties;
  } catch {
    throw new KanbanInvalidSavedViewError();
  }
}

/** Detaches every apply-critical member and proves raw/resolved provenance consistency before mutation. */
function snapshotApplyArtifact(value: unknown): Readonly<{
  resolved: KanbanViewState;
  provenance: KanbanSavedViewProvenance;
}> {
  const properties = exactStoreProperties(value, RECONCILED_KEYS);
  if (properties.kind !== 'reconciled') throw new KanbanInvalidSavedViewError();
  const raw = parseKanbanSavedView(properties.raw);
  if (raw.kind !== 'parsed') throw new KanbanInvalidSavedViewError();
  const resolved = snapshotKanbanViewState(properties.resolved);
  const provenanceProperties = exactStoreProperties(properties.provenance, PROVENANCE_KEYS);
  const provenanceRaw = parseKanbanSavedView(provenanceProperties.raw);
  if (provenanceRaw.kind !== 'parsed') throw new KanbanInvalidSavedViewError();
  const provenanceResolved = snapshotKanbanViewState(provenanceProperties.resolved);
  if (
    serializeKanbanSavedView(raw.value) !== serializeKanbanSavedView(provenanceRaw.value) ||
    !kanbanViewStatesEqual(resolved, provenanceResolved)
  ) {
    throw new KanbanInvalidSavedViewError();
  }
  return Object.freeze({
    resolved,
    provenance: Object.freeze({ raw: provenanceRaw.value, resolved: provenanceResolved }),
  });
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
    const artifact = snapshotApplyArtifact(reconciled);
    const result = controller.replace(artifact.resolved);
    if (result.kind === 'changed' || result.kind === 'unchanged') {
      CONTROLLER_PROVENANCE.set(controller, artifact.provenance);
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
