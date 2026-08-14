import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';

import { KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH, KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH } from '../layout/width-solver.js';
import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanQuery } from '../source/types.js';
import { snapshotKanbanStructurePolicy } from '../structure/policy.js';
import type {
  KanbanColumnPolicy,
  KanbanColumnWidthPreference,
  KanbanGroupingPolicy,
  KanbanStructurePolicy,
} from '../structure/policy.js';
import type { KanbanViewController, KanbanViewState } from './types.js';

/** Legacy board getters retained behind one controller-aware composition boundary. */
export interface KanbanBoardViewLegacyChannels<TCard> {
  /** Existing application query getter, used only when no controller owns the board view. */
  readonly query: () => KanbanQuery;
  /** Existing density getter retained for boards without a controller. */
  readonly density?: () => KanbanCardDensity;
  /** Existing structure policy whose non-view behavior remains application-owned. */
  readonly structure?: () => KanbanStructurePolicy<TCard>;
  /** Existing compatibility collapse getter. */
  readonly collapsedColumnIds?: () => readonly string[];
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
    minimumWidth: Math.min(base?.minimumWidth ?? KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH, preferredWidth),
    preferredWidth,
    maximumWidth: Math.max(base?.maximumWidth ?? KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH, preferredWidth),
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
    revision: composeKanbanViewRevision(base?.revision, state.revision),
    columns,
    ...(grouping === undefined ? {} : { grouping }),
  });
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
  readonly #query: Signal<KanbanQuery>;
  readonly #controller: KanbanViewController;
  #unsubscribe: (() => void) | undefined;
  #disposed = false;

  /** Captures the initial pair without retaining external lifecycle resources. */
  constructor(controller: KanbanViewController, legacy: KanbanBoardViewLegacyChannels<TCard>) {
    this.#controller = controller;
    this.#legacy = legacy;
    this.#state = signal(controller.state());
    this.#query = signal(controller.query());
  }

  /** Synchronizes the latest pair and subscribes once after board construction succeeds. */
  activate(): void {
    if (this.#disposed || this.#unsubscribe !== undefined) return;
    this.#state.set(this.#controller.state());
    this.#query.set(this.#controller.query());
    this.#unsubscribe = this.#controller.subscribe((state, query) => {
      if (this.#disposed) return;
      this.#state.set(state);
      this.#query.set(query);
    });
  }

  /** Returns the controller's last complete source query. */
  query(): KanbanQuery {
    return this.#query();
  }

  /** Returns the controller-owned density from the same committed state revision. */
  density(): KanbanCardDensity {
    return this.#state().presentation.density;
  }

  /** Returns application workflow semantics overlaid by the complete controller view facets. */
  structure(): KanbanStructurePolicy<TCard> {
    return composeStructure(this.#legacy.structure?.(), this.#state());
  }

  /**
   * Preserves compatibility collapse values only for identities the controller does not own.
   *
   * Controller collapse is represented in the structure policy so its header remains visible;
   * the older collapse getter suppresses the complete column and therefore cannot represent it.
   */
  collapsedColumnIds(): readonly string[] | undefined {
    const legacy = this.#legacy.collapsedColumnIds?.();
    const state = this.#state();
    if (state.columns.items.length === 0) return legacy;
    const owned = new Set(state.columns.items.map((item) => item.columnId));
    const retained = legacy?.filter((columnId) => !owned.has(columnId)) ?? [];
    return retained.length === 0 ? undefined : Object.freeze(retained);
  }

  /** Releases controller observation while freezing the last committed effective snapshot. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }
}
