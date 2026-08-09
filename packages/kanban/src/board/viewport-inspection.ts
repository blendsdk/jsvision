import type {
  KanbanActionTarget,
  KanbanDamageRegion,
  KanbanInspectedCard,
  KanbanInspectedCell,
  KanbanInspectedColumn,
  KanbanLayoutRegion,
} from '../layout/hit-map.js';
import type { KanbanCellState } from '../source/states.js';
import type { KanbanViewportProjection } from './viewport-projector.js';
import type { KanbanViewportSourceSnapshot } from './viewport-source.js';

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
  });
}

/**
 * Creates detached inspection evidence without retaining application records or cursor objects.
 */
export function createKanbanViewportInspection<TCard>(
  source: KanbanViewportSourceSnapshot<TCard> | undefined,
  projection: KanbanViewportProjection | undefined,
  damage: readonly KanbanDamageRegion[],
): KanbanViewportInspection {
  if (source === undefined) return createEmptyKanbanViewportInspection();
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
  });
}
