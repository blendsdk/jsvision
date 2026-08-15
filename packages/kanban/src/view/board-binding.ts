import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';

import { KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH, KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH } from '../layout/width-solver.js';
import type { KanbanCardDensity } from '../card/descriptor.js';
import { resolveKanbanPresentation } from '../card/presentation-policy.js';
import type { KanbanPresentationInput } from '../card/presentation-policy.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions } from '../contract/limits.js';
import type { KanbanQuery } from '../source/types.js';
import type { KanbanPreparedViewportView } from '../board/kanban-viewport.js';
import type { KanbanViewportCardPresentation } from '../board/viewport-projector.js';
import { snapshotKanbanStructurePolicy } from '../structure/policy.js';
import type {
  KanbanColumnPolicy,
  KanbanColumnWidthPreference,
  KanbanGroupingPolicy,
  KanbanStructurePolicy,
} from '../structure/policy.js';
import type { KanbanViewController, KanbanViewState } from './types.js';
import { attachKanbanViewProjectionParticipant } from './controller.js';
import type { KanbanPreparedViewProjection } from './controller.js';
import { createKanbanViewSummary, createUnboundKanbanViewSummary } from './summary.js';
import type { KanbanViewSummary, KanbanViewSummaryEvidence } from './summary.js';

/** Legacy board getters retained behind one controller-aware composition boundary. */
export interface KanbanBoardViewLegacyChannels<TCard> {
  /** Existing application query getter, used only when no controller owns the board view. */
  readonly query: () => KanbanQuery;
  /** Existing density getter retained for boards without a controller. */
  readonly density?: () => KanbanCardDensity;
  /** Existing rich-card budget composed with controller-owned checklist detail. */
  readonly presentation?: () => KanbanPresentationInput;
  /** Existing record-local selection and visual-state projection. */
  readonly cardPresentation?: (card: TCard) => KanbanViewportCardPresentation | undefined;
  /** Existing resource limits used to bound the effective rich-card budget. */
  readonly limits?: KanbanLimitOptions;
  /** Existing structure policy whose non-view behavior remains application-owned. */
  readonly structure?: () => KanbanStructurePolicy<TCard>;
  /** Existing compatibility collapse getter. */
  readonly collapsedColumnIds?: () => readonly string[];
}

/** Viewport-side transaction and evidence bridge attached after board construction. */
export interface KanbanBoardViewProjectionBridge<TCard> {
  /** Stages one isolated candidate source using prospective controller-owned facets. */
  readonly prepare: (candidate: {
    readonly query: KanbanQuery;
    readonly density: KanbanCardDensity;
    readonly presentation: KanbanPresentationInput;
    readonly structure: KanbanStructurePolicy<TCard>;
    readonly collapsedColumnIds?: readonly string[];
  }) => KanbanPreparedViewportView;
  /** Reads summary evidence from the committed source and viewport projection. */
  readonly summary: () => KanbanViewSummaryEvidence | undefined;
}

/** Creates a collision-safe equality revision that preserves number/string identity. */
export function composeKanbanViewRevision(base: string | number | undefined, view: string | number): string {
  return JSON.stringify([
    ['base', base === undefined ? 'undefined' : typeof base, base ?? null],
    ['view', typeof view, view],
  ]);
}

/** Converts one user preferred width into a complete ordered structure-policy width triple. */
function composeWidth(
  preferredWidth: number,
  base: KanbanColumnWidthPreference | undefined,
): KanbanColumnWidthPreference {
  return Object.freeze({
    minimumWidth: base?.minimumWidth ?? KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH,
    preferredWidth: Math.max(
      base?.minimumWidth ?? KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH,
      Math.min(preferredWidth, base?.maximumWidth ?? KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH),
    ),
    maximumWidth: base?.maximumWidth ?? KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH,
  });
}

/** Overlays controller-owned display facets while preserving application workflow semantics. */
function composeColumn(
  base: KanbanColumnPolicy | undefined,
  item: KanbanViewState['columns']['items'][number],
): KanbanColumnPolicy {
  return Object.freeze({
    ...(base ?? {}),
    columnId: item.columnId,
    visible: item.visible,
    collapsed: item.collapsed,
    ...(item.width === undefined ? {} : { width: composeWidth(item.width, base?.width) }),
    ...(item.alignment === undefined ? {} : { headerAlignment: item.alignment }),
  });
}

/** Overlays view-owned swimlane order and visibility on a matching application grouping policy. */
function composeGrouping<TCard>(
  base: KanbanGroupingPolicy<TCard> | undefined,
  state: KanbanViewState,
): KanbanGroupingPolicy<TCard> | undefined {
  if (base === undefined || state.grouping === undefined || base.fieldId !== state.grouping.fieldId) return base;
  if (state.swimlanes.items.length === 0) return base;
  return Object.freeze({
    ...base,
    order: Object.freeze(state.swimlanes.items.map((item) => item.swimlaneId)),
    visibleSwimlaneIds: Object.freeze(
      state.swimlanes.items.filter((item) => item.visible).map((item) => item.swimlaneId),
    ),
    collapsedSwimlaneIds: Object.freeze(
      state.swimlanes.items.filter((item) => item.collapsed).map((item) => item.swimlaneId),
    ),
  });
}

/** Builds one detached effective structure snapshot from legacy semantics and controller view facets. */
function composeStructure<TCard>(
  baseInput: KanbanStructurePolicy<TCard> | undefined,
  state: KanbanViewState,
): KanbanStructurePolicy<TCard> {
  const base = baseInput === undefined ? undefined : snapshotKanbanStructurePolicy<TCard>(baseInput);
  const baseColumns = new Map(base?.columns.map((column) => [column.columnId, column]) ?? []);
  const viewIds = new Set(state.columns.items.map((item) => item.columnId));
  const columns = Object.freeze([
    ...state.columns.items.map((item) => composeColumn(baseColumns.get(item.columnId), item)),
    ...(base?.columns.filter((column) => !viewIds.has(column.columnId)) ?? []),
  ]);
  const grouping = composeGrouping(base?.grouping, state);
  return Object.freeze({
    revision: composeKanbanViewRevision(base?.revision, structureFacetKey(state)),
    columns,
    ...(grouping === undefined ? {} : { grouping }),
  });
}

/** Returns the semantic key that owns descriptor presentation, independent of search/filter revisions. */
function presentationFacetKey(state: KanbanViewState): string {
  return JSON.stringify(state.presentation);
}

/** Returns the semantic key that owns board structure, independent of search/filter revisions. */
function structureFacetKey(state: KanbanViewState): string {
  return JSON.stringify([state.columns, state.swimlanes, state.grouping ?? null]);
}

/**
 * Holds the effective controller-owned board channels as reactive, immutable snapshots.
 *
 * Activation is explicit so a board can finish constructing every owned resource before it retains
 * an external subscription. Disposal only releases that subscription: the signals intentionally
 * retain the last committed values so a mounted board never falls back to unrelated legacy state.
 */
export class KanbanBoardViewBinding<TCard> {
  readonly #legacy: KanbanBoardViewLegacyChannels<TCard>;
  readonly #state: Signal<KanbanViewState>;
  readonly #presentationState: Signal<KanbanViewState>;
  readonly #structureState: Signal<KanbanViewState>;
  readonly #query: Signal<KanbanQuery>;
  readonly #summary: Signal<KanbanViewSummary>;
  readonly #controller: KanbanViewController;
  #bridge: KanbanBoardViewProjectionBridge<TCard> | undefined;
  #detachParticipant: (() => void) | undefined;
  #disposed = false;
  #presentationKey: string;
  #structureKey: string;

  /** Captures the initial pair without retaining external lifecycle resources. */
  constructor(controller: KanbanViewController, legacy: KanbanBoardViewLegacyChannels<TCard>) {
    this.#controller = controller;
    this.#legacy = legacy;
    const initial = controller.state();
    this.#state = signal(initial);
    this.#presentationState = signal(initial);
    this.#structureState = signal(initial);
    this.#presentationKey = presentationFacetKey(initial);
    this.#structureKey = structureFacetKey(initial);
    this.#query = signal(controller.query());
    this.#summary = signal(createUnboundKanbanViewSummary());
  }

  /** Attaches the exact viewport bridge before controller activation. */
  connect(bridge: KanbanBoardViewProjectionBridge<TCard>): void {
    if (this.#disposed || this.#bridge !== undefined) throw new TypeError('Kanban view binding is already connected.');
    this.#bridge = bridge;
  }

  /** Synchronizes the latest pair and acquires one exclusive controller participant lease. */
  activate(): void {
    if (this.#disposed || this.#detachParticipant !== undefined) return;
    const current = this.#controller.state();
    this.#state.set(current);
    this.#presentationState.set(current);
    this.#structureState.set(current);
    this.#presentationKey = presentationFacetKey(current);
    this.#structureKey = structureFacetKey(current);
    this.#query.set(this.#controller.query());
    this.#detachParticipant = attachKanbanViewProjectionParticipant(this.#controller, {
      prepare: (state, query) => this.#prepare(state, query),
      summary: () => this.#summary(),
    });
  }

  /** Refreshes summary evidence only after the viewport publishes a committed projection. */
  refreshSummary(): void {
    if (this.#disposed) return;
    const evidence = this.#bridge?.summary();
    if (evidence !== undefined) this.#summary.set(createKanbanViewSummary(evidence));
  }

  /** Returns the controller's last complete source query. */
  query(): KanbanQuery {
    return this.#query();
  }

  /** Returns the controller-owned density from the same committed state revision. */
  density(): KanbanCardDensity {
    return this.#presentationState().presentation.density;
  }

  /** Returns the effective bounded card budget with controller-owned checklist detail. */
  presentation(): KanbanPresentationInput {
    return this.#presentationFor(this.#presentationState());
  }

  /** Composes one prospective state with the application budget before candidate source preparation. */
  #presentationFor(state: KanbanViewState): KanbanPresentationInput {
    const limits = validateKanbanLimitOptions(this.#legacy.limits);
    const base = resolveKanbanPresentation(this.#legacy.presentation?.() ?? state.presentation.density, limits);
    const previewItems = state.presentation.checklist === 'preview' ? Math.min(2, limits.checklistItemsPerGroup) : 0;
    return Object.freeze({
      revision: composeKanbanViewRevision(base.revision, presentationFacetKey(state)),
      cardRows: base.cardRows,
      cardGap: base.cardGap,
      metadataFields: base.metadataFields,
      labelRows: base.labelRows,
      summarySections: base.summarySections,
      checklistMode: state.presentation.checklist,
      checklistPreviewItems: previewItems,
      degradationOrder: base.degradationOrder,
    });
  }

  /** Composes controller-owned ordered subsets with record-local checklist and visual state. */
  cardPresentation(card: TCard): KanbanViewportCardPresentation | undefined {
    const base = this.#legacy.cardPresentation?.(card);
    const presentation = this.#presentationState().presentation;
    const fieldIds = presentation.cardFieldIds.length === 0 ? base?.selection?.fieldIds : presentation.cardFieldIds;
    const summaryIds = presentation.summaryIds.length === 0 ? base?.selection?.summaryIds : presentation.summaryIds;
    if (base === undefined && fieldIds === undefined && summaryIds === undefined) return undefined;
    return Object.freeze({
      selection: Object.freeze({
        ...(fieldIds === undefined ? {} : { fieldIds }),
        ...(summaryIds === undefined ? {} : { summaryIds }),
        ...(base?.selection?.checklistIds === undefined ? {} : { checklistIds: base.selection.checklistIds }),
      }),
      ...(base?.visualState === undefined ? {} : { visualState: base.visualState }),
    });
  }

  /** Returns application workflow semantics overlaid by the complete controller view facets. */
  structure(): KanbanStructurePolicy<TCard> {
    return composeStructure(this.#legacy.structure?.(), this.#structureState());
  }

  /**
   * Preserves compatibility collapse values only for identities the controller does not own.
   *
   * Controller collapse is represented in the structure policy so its header remains visible;
   * the older collapse getter suppresses the complete column and therefore cannot represent it.
   */
  collapsedColumnIds(): readonly string[] | undefined {
    return this.#collapsedColumnIdsFor(this.#structureState());
  }

  /** Releases controller observation while freezing the last committed effective snapshot. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#detachParticipant?.();
    this.#detachParticipant = undefined;
    this.#bridge = undefined;
  }

  /** Stages one complete source-backed candidate and composes binding writes around its lifecycle. */
  #prepare(state: KanbanViewState, query: KanbanQuery): KanbanPreparedViewProjection {
    const bridge = this.#bridge;
    const previousState = this.#state.peek();
    const previousPresentationState = this.#presentationState.peek();
    const previousStructureState = this.#structureState.peek();
    const previousPresentationKey = this.#presentationKey;
    const previousStructureKey = this.#structureKey;
    const previousQuery = this.#query.peek();
    const previousSummary = this.#summary.peek();
    const structure = composeStructure(this.#legacy.structure?.(), state);
    const collapsedColumnIds = this.#collapsedColumnIdsFor(state);
    const viewport = bridge?.prepare({
      query,
      density: state.presentation.density,
      presentation: this.#presentationFor(state),
      structure,
      ...(collapsedColumnIds === undefined ? {} : { collapsedColumnIds }),
    });
    const candidateSummary = viewport?.summary === undefined ? undefined : createKanbanViewSummary(viewport.summary);
    let installed = false;
    return Object.freeze({
      commit: () => {
        viewport?.commit();
        this.#state.set(state);
        const nextPresentationKey = presentationFacetKey(state);
        if (nextPresentationKey !== this.#presentationKey) {
          this.#presentationKey = nextPresentationKey;
          this.#presentationState.set(state);
        }
        const nextStructureKey = structureFacetKey(state);
        if (nextStructureKey !== this.#structureKey) {
          this.#structureKey = nextStructureKey;
          this.#structureState.set(state);
        }
        this.#query.set(query);
        if (candidateSummary !== undefined) this.#summary.set(candidateSummary);
        installed = true;
      },
      verify: () =>
        installed && this.#state.peek() === state && this.#query.peek() === query && (viewport?.verify() ?? true),
      rollback: () => {
        viewport?.rollback();
        this.#state.set(previousState);
        this.#presentationKey = previousPresentationKey;
        this.#structureKey = previousStructureKey;
        this.#presentationState.set(previousPresentationState);
        this.#structureState.set(previousStructureState);
        this.#query.set(previousQuery);
        this.#summary.set(previousSummary);
        installed = false;
      },
      abort: () => viewport?.abort(),
      retire: () => viewport?.retire(),
    });
  }

  /** Applies compatibility collapse only to identities the candidate controller does not own. */
  #collapsedColumnIdsFor(state: KanbanViewState): readonly string[] | undefined {
    const legacy = this.#legacy.collapsedColumnIds?.();
    if (state.columns.items.length === 0) return legacy;
    const owned = new Set(state.columns.items.map((item) => item.columnId));
    const retained = legacy?.filter((columnId) => !owned.has(columnId)) ?? [];
    return retained.length === 0 ? undefined : Object.freeze(retained);
  }
}
