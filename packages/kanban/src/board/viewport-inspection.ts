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

/** Detached non-actionable viewport evidence for tests and modeless diagnostics. */
export interface KanbanViewportInspection {
  /** Retained source cells and their safe lifecycle states. */
  readonly cells: readonly KanbanInspectedCell[];
  /** Complete sanitized source columns intersecting the viewport. */
  readonly visibleColumns: readonly KanbanInspectedColumn[];
  /** Resident cards projected in the viewport. */
  readonly visibleCards: readonly KanbanInspectedCard[];
  /** Clipped semantic geometry that is explicitly non-actionable in Phase A. */
  readonly regions: readonly KanbanLayoutRegion[];
  /** Bounded changed rectangles from the latest completed projection. */
  readonly damage: readonly KanbanDamageRegion[];
  /** Phase A exposes no card, insertion, drop, or card-action pointer targets. */
  readonly actionTargets: readonly KanbanActionTarget[];
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
    actionTargets: projection?.actionTargets ?? Object.freeze([]),
  });
}
