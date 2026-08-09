import { KanbanInvalidGeometryError } from '../contract/error.js';
import { canonicalizeKanbanCellAddress } from '../source/address.js';
import {
  canonicalizeKanbanFocusTarget,
  resolveInitialKanbanFocus,
  snapshotKanbanFocusTarget,
  snapshotKanbanNavigationSnapshot,
} from './reconciliation.js';
import type {
  KanbanFocusTarget,
  KanbanNavigationDirection,
  KanbanNavigationSnapshot,
  KanbanNavigationTarget,
} from './types.js';

/** Every programmatic spatial direction accepted by the pure resolver. */
const NAVIGATION_DIRECTIONS = new Set<KanbanNavigationDirection>([
  'up',
  'down',
  'left',
  'right',
  'home',
  'end',
  'page-up',
  'page-down',
  'board-start',
  'board-end',
  'previous-column',
  'next-column',
]);

/** A navigation target whose semantic focus is known to be a card. */
type KanbanCardNavigationTarget = KanbanNavigationTarget & {
  readonly target: KanbanFocusTarget & { readonly kind: 'card' };
};

/** Input for one pure spatial-navigation resolution. */
export interface ResolveKanbanNavigationOptions {
  /** Current stable semantic focus. */
  readonly current: KanbanFocusTarget;
  /** Requested navigation operation. */
  readonly direction: KanbanNavigationDirection;
  /** Current detached visible scene geometry. */
  readonly scene: KanbanNavigationSnapshot;
  /** Preferred visual center retained across horizontal column movement. */
  readonly preferredCenterRow?: number;
}

/** Pure navigation settlement consumed by the interaction controller. */
export interface KanbanNavigationResolution {
  /** Whether the visible semantic focus changed. */
  readonly kind: 'changed' | 'unchanged';
  /** Stable detached target after local resolution. */
  readonly focused: KanbanFocusTarget;
  /** Visual row retained for the next horizontal movement. */
  readonly preferredCenterRow?: number;
  /** Whether the controller must minimally reveal the resolved card rectangle. */
  readonly reveal: boolean;
  /** Direction that reached the current loaded scene boundary. */
  readonly boundary?: KanbanNavigationDirection;
}

/** Returns whether one bounded target represents a card. */
function isCard(entry: KanbanNavigationTarget): entry is KanbanCardNavigationTarget {
  return entry.target.kind === 'card';
}

/** Returns only enabled targets in validated source scene order. */
function enabledTargets(scene: KanbanNavigationSnapshot): readonly KanbanNavigationTarget[] {
  return scene.targets.filter((entry) => entry.enabled);
}

/** Finds one enabled entry by stable semantic identity. */
function findTarget(
  targets: readonly KanbanNavigationTarget[],
  target: KanbanFocusTarget,
): KanbanNavigationTarget | undefined {
  const key = canonicalizeKanbanFocusTarget(target);
  return targets.find((entry) => canonicalizeKanbanFocusTarget(entry.target) === key);
}

/** Returns whether two card targets occupy the same semantic cell. */
function sameCell(left: KanbanCardNavigationTarget, right: KanbanCardNavigationTarget): boolean {
  return canonicalizeKanbanCellAddress(left.target.address) === canonicalizeKanbanCellAddress(right.target.address);
}

/** Returns a finite preferred row, falling back to current geometry. */
function preferredRow(value: number | undefined, current: KanbanNavigationTarget | undefined): number {
  if (value === undefined) return current?.centerRow ?? 0;
  if (!Number.isFinite(value)) throw new KanbanInvalidGeometryError();
  return Object.is(value, -0) ? 0 : value;
}

/** Returns visible column identities in source scene order. */
function columnIds(targets: readonly KanbanNavigationTarget[]): readonly string[] {
  return targets.flatMap((entry) => (entry.target.kind === 'column-header' ? [entry.target.columnId] : []));
}

/** Returns visible swimlane identities in source scene order. */
function swimlaneIds(targets: readonly KanbanNavigationTarget[]): readonly string[] {
  return targets.flatMap((entry) => (entry.target.kind === 'swimlane-header' ? [entry.target.swimlaneId] : []));
}

/** Returns the adjacent visible identity for one ordered structural axis. */
function adjacentId(values: readonly string[], current: string, offset: -1 | 1): string | undefined {
  const index = values.indexOf(current);
  return index < 0 ? undefined : values[index + offset];
}

/** Returns the workflow header for one visible column. */
function columnHeader(
  targets: readonly KanbanNavigationTarget[],
  columnId: string,
): KanbanNavigationTarget | undefined {
  return targets.find((entry) => entry.target.kind === 'column-header' && entry.target.columnId === columnId);
}

/** Chooses a candidate closest to one visual row with scene order as the stable tie-breaker. */
function closestRow(
  candidates: readonly KanbanNavigationTarget[],
  centerRow: number,
): KanbanNavigationTarget | undefined {
  return [...candidates].sort(
    (left, right) =>
      Math.abs(left.centerRow - centerRow) - Math.abs(right.centerRow - centerRow) ||
      left.sceneIndex - right.sceneIndex,
  )[0];
}

/** Returns one detached navigation settlement. */
function resolution(
  current: KanbanFocusTarget,
  destination: KanbanNavigationTarget | KanbanFocusTarget,
  preferredCenterRow: number | undefined,
  boundary?: KanbanNavigationDirection,
): KanbanNavigationResolution {
  const focused = 'target' in destination ? destination.target : destination;
  const changed = canonicalizeKanbanFocusTarget(current) !== canonicalizeKanbanFocusTarget(focused);
  return Object.freeze({
    kind: changed ? 'changed' : 'unchanged',
    focused,
    ...(preferredCenterRow === undefined ? {} : { preferredCenterRow }),
    reveal: changed && focused.kind === 'card',
    ...(boundary === undefined ? {} : { boundary }),
  });
}

/** Resolves vertical movement inside a cell and across adjacent swimlane boundaries. */
function vertical(
  direction: 'up' | 'down',
  current: KanbanNavigationTarget,
  eligible: readonly KanbanNavigationTarget[],
  row: number,
): KanbanNavigationResolution {
  if (current.target.kind === 'column-header') {
    if (direction === 'up') return resolution(current.target, current, row, direction);
    const columnId = current.target.columnId;
    const first = eligible.filter(isCard).find((entry) => entry.target.address.columnId === columnId);
    return resolution(
      current.target,
      first ?? current,
      first?.centerRow ?? row,
      first === undefined ? direction : undefined,
    );
  }
  if (current.target.kind === 'swimlane-header') {
    const lanes = swimlaneIds(eligible);
    const laneId = direction === 'down' ? current.target.swimlaneId : adjacentId(lanes, current.target.swimlaneId, -1);
    const laneCards = eligible.filter(isCard).filter((entry) => entry.target.address.swimlaneId === laneId);
    const card = direction === 'down' ? laneCards[0] : laneCards[laneCards.length - 1];
    if (card !== undefined) return resolution(current.target, card, card.centerRow);
    const header = direction === 'up' ? eligible.find((entry) => entry.target.kind === 'column-header') : undefined;
    return resolution(current.target, header ?? current, row, header === undefined ? direction : undefined);
  }
  if (!isCard(current)) return resolution(current.target, current, row, direction);

  const cards = eligible.filter(isCard).filter((entry) => sameCell(entry, current));
  const currentIndex = cards.findIndex(
    (entry) => canonicalizeKanbanFocusTarget(entry.target) === canonicalizeKanbanFocusTarget(current.target),
  );
  const candidate = cards[currentIndex + (direction === 'down' ? 1 : -1)];
  if (candidate !== undefined) return resolution(current.target, candidate, candidate.centerRow);

  if (direction === 'up') {
    const header =
      current.target.address.swimlaneId === undefined
        ? columnHeader(eligible, current.target.address.columnId)
        : eligible.find(
            (entry) =>
              entry.target.kind === 'swimlane-header' && entry.target.swimlaneId === current.target.address.swimlaneId,
          );
    return resolution(current.target, header ?? current, row, header === undefined ? direction : undefined);
  }

  const laneId = current.target.address.swimlaneId;
  if (laneId !== undefined) {
    const columnId = current.target.address.columnId;
    const nextLane = adjacentId(swimlaneIds(eligible), laneId, 1);
    const nextCard = eligible
      .filter(isCard)
      .find((entry) => entry.target.address.columnId === columnId && entry.target.address.swimlaneId === nextLane);
    if (nextCard !== undefined) return resolution(current.target, nextCard, nextCard.centerRow);
    const nextHeader = eligible.find(
      (entry) => entry.target.kind === 'swimlane-header' && entry.target.swimlaneId === nextLane,
    );
    if (nextHeader !== undefined) return resolution(current.target, nextHeader, row);
  }
  return resolution(current.target, current, row, direction);
}

/** Resolves card/header movement into the adjacent visible workflow column. */
function horizontal(
  direction: 'left' | 'right' | 'previous-column' | 'next-column',
  current: KanbanNavigationTarget,
  eligible: readonly KanbanNavigationTarget[],
  row: number,
): KanbanNavigationResolution {
  const offset = direction === 'left' || direction === 'previous-column' ? -1 : 1;
  const currentColumn =
    current.target.kind === 'card'
      ? current.target.address.columnId
      : current.target.kind === 'column-header'
        ? current.target.columnId
        : undefined;
  if (currentColumn === undefined) return resolution(current.target, current, row, direction);
  const adjacentColumn = adjacentId(columnIds(eligible), currentColumn, offset);
  if (adjacentColumn === undefined) return resolution(current.target, current, row, direction);
  if (current.target.kind === 'column-header') {
    const header = columnHeader(eligible, adjacentColumn);
    return resolution(current.target, header ?? current, row, header === undefined ? direction : undefined);
  }

  if (!isCard(current)) return resolution(current.target, current, row, direction);

  const sameCellCards = eligible.filter(
    (entry) =>
      isCard(entry) &&
      entry.target.address.columnId === adjacentColumn &&
      entry.target.address.swimlaneId === current.target.address.swimlaneId,
  );
  const card = closestRow(sameCellCards, row);
  if (card !== undefined) return resolution(current.target, card, row);
  const header = columnHeader(eligible, adjacentColumn);
  return resolution(current.target, header ?? current, row, header === undefined ? direction : undefined);
}

/** Resolves Home or End inside the current semantic cell. */
function cellEdge(
  direction: 'home' | 'end',
  current: KanbanNavigationTarget,
  eligible: readonly KanbanNavigationTarget[],
  row: number,
): KanbanNavigationResolution {
  if (!isCard(current)) return resolution(current.target, current, row, direction);
  const cards = eligible.filter(isCard).filter((entry) => sameCell(entry, current));
  const destination = direction === 'home' ? cards[0] : cards[cards.length - 1];
  return resolution(
    current.target,
    destination ?? current,
    destination?.centerRow ?? row,
    destination === undefined ? direction : undefined,
  );
}

/** Resolves PageUp or PageDown by viewport content height inside the current cell. */
function page(
  direction: 'page-up' | 'page-down',
  current: KanbanNavigationTarget,
  scene: KanbanNavigationSnapshot,
  eligible: readonly KanbanNavigationTarget[],
  row: number,
): KanbanNavigationResolution {
  if (!isCard(current)) return resolution(current.target, current, row, direction);
  if (scene.viewportContentHeight === 0) return resolution(current.target, current, row, direction);
  const sign = direction === 'page-down' ? 1 : -1;
  const directional = eligible
    .filter(isCard)
    .filter((entry) => sameCell(entry, current))
    .filter((entry) => sign * (entry.centerRow - current.centerRow) > 0);
  const destination = closestRow(directional, current.centerRow + sign * scene.viewportContentHeight);
  return resolution(
    current.target,
    destination ?? current,
    destination?.centerRow ?? row,
    destination === undefined ? direction : undefined,
  );
}

/** Resolves first or last visible board target in deterministic source scene order. */
function boardEdge(
  direction: 'board-start' | 'board-end',
  current: KanbanNavigationTarget,
  eligible: readonly KanbanNavigationTarget[],
  row: number,
): KanbanNavigationResolution {
  const semantic = eligible.filter((entry) => entry.target.kind !== 'board-state');
  const candidates = semantic.length > 0 ? semantic : eligible;
  const destination = direction === 'board-start' ? candidates[0] : candidates[candidates.length - 1];
  return resolution(
    current.target,
    destination ?? current,
    destination?.target.kind === 'card' ? destination.centerRow : row,
    destination === undefined ? direction : undefined,
  );
}

/**
 * Resolves one programmatic navigation command against immutable visible geometry.
 *
 * The function never invents unloaded cards. A boundary marker lets the owning controller decide
 * whether source policy can acquire more data before it publishes a fallback or unavailable result.
 */
export function resolveKanbanNavigation(options: ResolveKanbanNavigationOptions): KanbanNavigationResolution {
  if (!NAVIGATION_DIRECTIONS.has(options.direction)) throw new KanbanInvalidGeometryError();
  const scene = snapshotKanbanNavigationSnapshot(options.scene);
  const currentTarget = snapshotKanbanFocusTarget(options.current);
  const eligible = enabledTargets(scene);
  const current = findTarget(eligible, currentTarget);
  if (current === undefined) {
    const initial = resolveInitialKanbanFocus(scene);
    return resolution(currentTarget, initial, options.preferredCenterRow);
  }
  const row = preferredRow(options.preferredCenterRow, current);
  if (options.direction === 'up' || options.direction === 'down') {
    return vertical(options.direction, current, eligible, row);
  }
  if (
    options.direction === 'left' ||
    options.direction === 'right' ||
    options.direction === 'previous-column' ||
    options.direction === 'next-column'
  ) {
    return horizontal(options.direction, current, eligible, row);
  }
  if (options.direction === 'home' || options.direction === 'end') {
    return cellEdge(options.direction, current, eligible, row);
  }
  if (options.direction === 'page-up' || options.direction === 'page-down') {
    return page(options.direction, current, scene, eligible, row);
  }
  return boardEdge(options.direction, current, eligible, row);
}
