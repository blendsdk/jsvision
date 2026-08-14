import type {
  KanbanActionTarget,
  KanbanDamageRegion,
  KanbanInspectedCard,
  KanbanInspectedCardDescriptor,
  KanbanInspectedCell,
  KanbanInspectedColumn,
  KanbanLayoutRegion,
} from '../layout/hit-map.js';
import type { KanbanCardDensity, KanbanCardDescriptor } from '../card/descriptor.js';
import { snapshotKanbanFocusTarget } from '../interaction/reconciliation.js';
import { KANBAN_NEUTRAL_FOCUSED_DETAIL_SNAPSHOT, KANBAN_NEUTRAL_INTERACTION_SNAPSHOT } from '../interaction/types.js';
import type {
  KanbanFocusedDetailSnapshot,
  KanbanInteractionFeedback,
  KanbanInteractionSnapshot,
  KanbanRangeAnchor,
} from '../interaction/types.js';
import type { KanbanCellState } from '../source/states.js';
import type { KanbanStructureState } from '../structure/model.js';
import type { KanbanViewportProjection } from './viewport-projector.js';
import type { KanbanViewportSourceSnapshot } from './viewport-source.js';

/**
 * Reuses detached density-enriched descriptors while their immutable source descriptor remains live.
 *
 * Inspection callers rely on descriptor identity to distinguish a card-local rebuild from an
 * unrelated viewport publication. A weak cache preserves that evidence without extending the
 * lifetime of viewport-owned descriptors.
 */
const INSPECTED_DESCRIPTORS = new WeakMap<
  KanbanCardDescriptor,
  Map<KanbanCardDensity, KanbanInspectedCardDescriptor>
>();

/** Adds projection density once while preserving stable inspection identity for unchanged cards. */
function inspectedDescriptor(
  descriptor: KanbanCardDescriptor,
  density: KanbanCardDensity,
): KanbanInspectedCardDescriptor {
  let densities = INSPECTED_DESCRIPTORS.get(descriptor);
  if (densities === undefined) {
    densities = new Map();
    INSPECTED_DESCRIPTORS.set(descriptor, densities);
  }
  const retained = densities.get(density);
  if (retained !== undefined) return retained;
  const created = Object.freeze({ ...descriptor, density });
  densities.set(density, created);
  return created;
}

/** Detached controller evidence exposed without application records or host handles. */
export interface KanbanInteractionInspection {
  /** Equality-only controller publication revision. */
  readonly revision: number;
  /** Current stable focus target. */
  readonly focused: KanbanInteractionSnapshot['focused'];
  /** Ordered type-preserving loaded selection identities. */
  readonly selectedCardKeys: KanbanInteractionSnapshot['selectedCardKeys'];
  /** Number of loaded selected identities. */
  readonly selectedCount: number;
  /** Honest active selection scope. */
  readonly selectionScope: 'loaded' | 'server';
  /** Explicit cell-local range anchor when range extension is active. */
  readonly rangeAnchor?: KanbanRangeAnchor;
  /** Current bounded acquisition kind without retaining its request target. */
  readonly pendingNavigationKind?: 'reveal' | 'acquire';
  /** Exact most recent prune count when prune feedback is active. */
  readonly lastPruneCount?: number;
  /** Safe localized payload-free interaction feedback. */
  readonly feedback?: KanbanInteractionFeedback;
}

/** Detached viewport evidence for tests and modeless diagnostics. */
export interface KanbanViewportInspection {
  /** Retained source cells and their safe lifecycle states. */
  readonly cells: readonly KanbanInspectedCell[];
  /** Complete sanitized source columns intersecting the viewport. */
  readonly visibleColumns: readonly KanbanInspectedColumn[];
  /** Resident cards projected in the viewport. */
  readonly visibleCards: readonly KanbanInspectedCard[];
  /** Clipped semantic geometry kept separate from active hit-test entries. */
  readonly regions: readonly KanbanLayoutRegion[];
  /** Bounded changed rectangles from the latest completed projection. */
  readonly damage: readonly KanbanDamageRegion[];
  /** Bounded closed-scope targets; deferred drag and insertion kinds are not representable. */
  readonly actionTargets: readonly KanbanActionTarget[];
  /** Resident card widgets; scene rendering deliberately keeps this at zero. */
  readonly mountedCardViews: 0;
  /** Board-level semantic structure state when one is active. */
  readonly structureState?: KanbanStructureState;
  /** Detached current controller state and bounded selection evidence. */
  readonly interaction: KanbanInteractionInspection;
  /** Complete bounded safe values for the currently focused target. */
  readonly focusedDetail: KanbanFocusedDetailSnapshot;
  /** Safe mutation-availability evidence for a standalone read viewport. */
  readonly operation?: { readonly kind: 'unavailable'; readonly code: 'dispatcher-unavailable' };
}

/** Copies one range anchor without retaining controller-owned address objects. */
function detachedRangeAnchor(anchor: KanbanRangeAnchor): KanbanRangeAnchor {
  return Object.freeze({ cardKey: anchor.cardKey, address: Object.freeze({ ...anchor.address }) });
}

/** Copies current controller state into the bounded modeless inspection contract. */
function interactionInspection(snapshot: KanbanInteractionSnapshot): KanbanInteractionInspection {
  const feedback =
    snapshot.feedback === undefined
      ? undefined
      : Object.freeze({
          code: snapshot.feedback.code,
          label: snapshot.feedback.label,
          ...(snapshot.feedback.count === undefined ? {} : { count: snapshot.feedback.count }),
          ...(snapshot.feedback.retry === undefined ? {} : { retry: snapshot.feedback.retry }),
        });
  return Object.freeze({
    revision: snapshot.revision,
    focused: snapshotKanbanFocusTarget(snapshot.focused),
    selectedCardKeys: Object.freeze([...snapshot.selectedCardKeys]),
    selectedCount: snapshot.selectedCardKeys.length,
    selectionScope: snapshot.serverSelection === undefined ? 'loaded' : 'server',
    ...(snapshot.rangeAnchor === undefined ? {} : { rangeAnchor: detachedRangeAnchor(snapshot.rangeAnchor) }),
    ...(snapshot.pendingNavigation === undefined ? {} : { pendingNavigationKind: snapshot.pendingNavigation.kind }),
    ...(feedback?.code === 'selection-pruned' && feedback.count !== undefined
      ? { lastPruneCount: feedback.count }
      : {}),
    ...(feedback === undefined ? {} : { feedback }),
  });
}

/** Copies one closed action scope so inspection cannot retain active hit-map objects. */
function detachedScope(scope: KanbanActionTarget['scope']): KanbanActionTarget['scope'] {
  if (scope.kind === 'cell') return Object.freeze({ kind: scope.kind, address: Object.freeze({ ...scope.address }) });
  if (scope.kind === 'card') {
    return Object.freeze({ kind: scope.kind, cardKey: scope.cardKey, address: Object.freeze({ ...scope.address }) });
  }
  if (scope.kind === 'state') {
    return Object.freeze({
      kind: scope.kind,
      state: scope.state,
      ...(scope.address === undefined ? {} : { address: Object.freeze({ ...scope.address }) }),
    });
  }
  return Object.freeze({ ...scope });
}

/** Detaches one clipped action target from the active hit-map collection. */
function detachedActionTarget(target: KanbanActionTarget): KanbanActionTarget {
  return Object.freeze({
    ...target,
    scope: detachedScope(target.scope),
    ...(target.address === undefined ? {} : { address: Object.freeze({ ...target.address }) }),
  });
}

/** Creates one immutable empty inspection snapshot before first projection. */
export function createEmptyKanbanViewportInspection(): KanbanViewportInspection {
  return Object.freeze({
    cells: Object.freeze([]),
    visibleColumns: Object.freeze([]),
    visibleCards: Object.freeze([]),
    regions: Object.freeze([]),
    damage: Object.freeze([]),
    actionTargets: Object.freeze([]),
    mountedCardViews: 0,
    interaction: interactionInspection(KANBAN_NEUTRAL_INTERACTION_SNAPSHOT),
    focusedDetail: KANBAN_NEUTRAL_FOCUSED_DETAIL_SNAPSHOT,
  });
}

/**
 * Creates detached inspection evidence without retaining application records or cursor objects.
 */
export function createKanbanViewportInspection<TCard>(
  source: KanbanViewportSourceSnapshot<TCard> | undefined,
  projection: KanbanViewportProjection | undefined,
  damage: readonly KanbanDamageRegion[],
  interaction: KanbanInteractionSnapshot = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT,
  focusedDetail: KanbanFocusedDetailSnapshot = KANBAN_NEUTRAL_FOCUSED_DETAIL_SNAPSHOT,
): KanbanViewportInspection {
  if (source === undefined) {
    return Object.freeze({
      ...createEmptyKanbanViewportInspection(),
      interaction: interactionInspection(interaction),
      focusedDetail,
    });
  }
  const cells = Object.freeze(
    source.cells.map((cell) => {
      const sourceState = cell.cursor.state();
      const loaded = cell.cursor.counts().loaded;
      const state: KanbanCellState =
        sourceState.kind === 'partial' &&
        (cell.cursor.hasRange(cell.range.start, cell.range.end) ||
          (loaded.quality === 'exact' && loaded.value >= cell.range.end - cell.range.start))
          ? Object.freeze({ kind: 'ready' })
          : sourceState;
      return Object.freeze({ address: cell.address, state });
    }),
  );
  const visibleColumns = Object.freeze(
    (projection?.columns ?? source.visibleColumns).map((column) =>
      Object.freeze({ columnId: column.columnId, label: column.label }),
    ),
  );
  const visibleCards = Object.freeze(
    (projection?.cards ?? []).map((card) => {
      const title = card.descriptor.rows
        .filter((row) => row.section === 'title')
        .flatMap((row) => row.spans.map((span) => span.text))
        .join(' ');
      return Object.freeze({
        cardKey: card.descriptor.cardKey,
        columnId: card.columnId,
        address: Object.freeze({
          columnId: card.columnId,
          ...(card.swimlaneId === undefined ? {} : { swimlaneId: card.swimlaneId }),
        }),
        descriptor: inspectedDescriptor(card.descriptor, card.density ?? 'comfortable'),
        title,
        marker: Object.freeze({ cues: Object.freeze([...card.descriptor.marker.cues]) }),
      });
    }),
  );
  return Object.freeze({
    cells,
    visibleColumns,
    visibleCards,
    regions: projection?.regions ?? Object.freeze([]),
    damage: Object.freeze([...damage]),
    actionTargets: Object.freeze((projection?.actionTargets ?? []).map(detachedActionTarget)),
    mountedCardViews: 0,
    interaction: interactionInspection(interaction),
    focusedDetail,
    ...(source.visibleColumns.length === 0
      ? {
          structureState: Object.freeze({
            code: 'no-columns' as const,
            scope: Object.freeze({ kind: 'board' as const }),
            actions: Object.freeze([]),
          }),
        }
      : {}),
  });
}
