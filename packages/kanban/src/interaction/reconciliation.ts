import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanColumnId, createKanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type {
  KanbanFocusTarget,
  KanbanInteractionReconcileReason,
  KanbanNavigationSnapshot,
  KanbanNavigationTarget,
} from './types.js';
import { KANBAN_NEUTRAL_FOCUS_TARGET } from './types.js';

/** Exact members accepted by each focus-target variant. */
const FOCUS_KEYS = Object.freeze({
  board: new Set(['kind']),
  column: new Set(['kind', 'columnId']),
  swimlane: new Set(['kind', 'swimlaneId']),
  card: new Set(['kind', 'cardKey', 'address']),
});
/** Exact members accepted by one navigation target. */
const NAVIGATION_TARGET_KEYS = new Set(['target', 'sceneIndex', 'centerColumn', 'centerRow', 'enabled']);
/** Exact members accepted by one navigation snapshot. */
const NAVIGATION_SNAPSHOT_KEYS = new Set(['revision', 'targets', 'viewportContentHeight']);
/** Maximum detached focus targets possible under the package's structural ceilings. */
const MAXIMUM_NAVIGATION_TARGETS =
  KANBAN_LIMITS.retainedDescriptors.absolute + KANBAN_LIMITS.columns.absolute + KANBAN_LIMITS.swimlanes.absolute + 1;

/** Input needed to reconcile one retained semantic focus identity. */
export interface ReconcileKanbanFocusOptions {
  /** Current stable focus identity. */
  readonly current: KanbanFocusTarget;
  /** Current visible and enabled navigation evidence. */
  readonly scene: KanbanNavigationSnapshot;
  /** Prior scene used to locate next and previous surviving neighbors after removal. */
  readonly previousScene?: KanbanNavigationSnapshot;
  /** Preferred visual center retained across column movement. */
  readonly preferredCenterRow?: number;
  /** Cause that determines whether an absent card is hidden, deleted, or merely unloaded. */
  readonly reason: KanbanInteractionReconcileReason;
}

/** Pure focus-reconciliation outcome consumed by the interaction controller. */
export interface KanbanFocusReconciliation {
  /** Whether focus stayed visible, moved to a fallback, or needs bounded acquisition. */
  readonly kind: 'retained' | 'changed' | 'acquire';
  /** Stable detached focus identity to retain or publish. */
  readonly focused: KanbanFocusTarget;
}

/** Raises the bounded error used when geometry-owned interaction evidence is malformed. */
function invalidGeometry(): never {
  throw new KanbanInvalidGeometryError();
}

/** Returns a finite viewport coordinate or rejects the complete evidence snapshot. */
function coordinate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalidGeometry();
  return Object.is(value, -0) ? 0 : value;
}

/** Returns a non-negative safe integer or rejects the complete evidence snapshot. */
function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalidGeometry();
  return value;
}

/** Validates, detaches, and freezes one semantic focus target. */
export function snapshotKanbanFocusTarget(value: unknown): KanbanFocusTarget {
  try {
    const properties = snapshotKanbanDataProperties(value, FOCUS_KEYS.card.size);
    if (properties.kind === 'board-state') {
      validateKanbanDataKeys(properties, FOCUS_KEYS.board);
      return KANBAN_NEUTRAL_FOCUS_TARGET;
    }
    if (properties.kind === 'column-header') {
      validateKanbanDataKeys(properties, FOCUS_KEYS.column);
      if (typeof properties.columnId !== 'string') return invalidGeometry();
      return Object.freeze({ kind: properties.kind, columnId: createKanbanColumnId(properties.columnId) });
    }
    if (properties.kind === 'swimlane-header') {
      validateKanbanDataKeys(properties, FOCUS_KEYS.swimlane);
      if (typeof properties.swimlaneId !== 'string') return invalidGeometry();
      return Object.freeze({ kind: properties.kind, swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) });
    }
    if (properties.kind === 'card') {
      validateKanbanDataKeys(properties, FOCUS_KEYS.card);
      if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
        return invalidGeometry();
      }
      return Object.freeze({
        kind: properties.kind,
        cardKey: createKanbanCardKey(properties.cardKey),
        address: snapshotKanbanCellAddress(properties.address),
      });
    }
    return invalidGeometry();
  } catch (error) {
    if (error instanceof KanbanInvalidGeometryError) throw error;
    return invalidGeometry();
  }
}

/** Validates and freezes one geometry-owned navigation target. */
function snapshotNavigationTarget(value: unknown): KanbanNavigationTarget {
  const properties = snapshotKanbanDataProperties(value, NAVIGATION_TARGET_KEYS.size);
  validateKanbanDataKeys(properties, NAVIGATION_TARGET_KEYS);
  if (Object.keys(properties).length !== NAVIGATION_TARGET_KEYS.size || typeof properties.enabled !== 'boolean') {
    return invalidGeometry();
  }
  return Object.freeze({
    target: snapshotKanbanFocusTarget(properties.target),
    sceneIndex: nonNegativeInteger(properties.sceneIndex),
    centerColumn: coordinate(properties.centerColumn),
    centerRow: coordinate(properties.centerRow),
    enabled: properties.enabled,
  });
}

/**
 * Validates and detaches one bounded navigation snapshot before pure interaction logic consumes it.
 */
export function snapshotKanbanNavigationSnapshot(value: unknown): KanbanNavigationSnapshot {
  try {
    const properties = snapshotKanbanDataProperties(value, NAVIGATION_SNAPSHOT_KEYS.size);
    validateKanbanDataKeys(properties, NAVIGATION_SNAPSHOT_KEYS);
    if (Object.keys(properties).length !== NAVIGATION_SNAPSHOT_KEYS.size) return invalidGeometry();
    const targets = Object.freeze(
      snapshotKanbanDataArray(properties.targets, MAXIMUM_NAVIGATION_TARGETS)
        .map(snapshotNavigationTarget)
        .sort((left, right) => left.sceneIndex - right.sceneIndex),
    );
    const semanticKeys = targets.map((entry) => canonicalizeKanbanFocusTarget(entry.target));
    if (
      new Set(targets.map((entry) => entry.sceneIndex)).size !== targets.length ||
      new Set(semanticKeys).size !== semanticKeys.length
    ) {
      return invalidGeometry();
    }
    return Object.freeze({
      revision: snapshotKanbanRevision(properties.revision),
      targets,
      viewportContentHeight: nonNegativeInteger(properties.viewportContentHeight),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidGeometryError) throw error;
    return invalidGeometry();
  }
}

/** Creates a collision-safe identity key for one validated semantic focus target. */
export function canonicalizeKanbanFocusTarget(target: KanbanFocusTarget): string {
  if (target.kind === 'board-state') return JSON.stringify([target.kind]);
  if (target.kind === 'column-header') return JSON.stringify([target.kind, target.columnId]);
  if (target.kind === 'swimlane-header') return JSON.stringify([target.kind, target.swimlaneId]);
  return JSON.stringify([
    target.kind,
    typeof target.cardKey,
    target.cardKey,
    canonicalizeKanbanCellAddress(target.address),
  ]);
}

/** Returns only enabled targets in their validated source scene order. */
function enabledTargets(scene: KanbanNavigationSnapshot): readonly KanbanNavigationTarget[] {
  return scene.targets.filter((entry) => entry.enabled);
}

/** Returns a frozen reconciliation result. */
function result(kind: KanbanFocusReconciliation['kind'], focused: KanbanFocusTarget): KanbanFocusReconciliation {
  return Object.freeze({ kind, focused });
}

/**
 * Chooses deterministic focus for the first usable scene.
 *
 * Visible cards take precedence over workflow headers regardless of chrome projection order. A scene
 * without either target uses the stable board-state surface.
 */
export function resolveInitialKanbanFocus(scene: KanbanNavigationSnapshot): KanbanFocusTarget {
  const safeScene = snapshotKanbanNavigationSnapshot(scene);
  const eligible = enabledTargets(safeScene);
  return (
    eligible.find((entry) => entry.target.kind === 'card')?.target ??
    eligible.find((entry) => entry.target.kind === 'column-header')?.target ??
    KANBAN_NEUTRAL_FOCUS_TARGET
  );
}

/** Returns the target with the requested identity when it remains enabled. */
function eligibleIdentity(
  targets: readonly KanbanNavigationTarget[],
  target: KanbanFocusTarget,
): KanbanNavigationTarget | undefined {
  const key = canonicalizeKanbanFocusTarget(target);
  return targets.find((entry) => canonicalizeKanbanFocusTarget(entry.target) === key);
}

/** Returns whether two card targets occupy the same semantic source cell. */
function sameCell(left: KanbanFocusTarget, right: KanbanFocusTarget): boolean {
  return (
    left.kind === 'card' &&
    right.kind === 'card' &&
    canonicalizeKanbanCellAddress(left.address) === canonicalizeKanbanCellAddress(right.address)
  );
}

/** Finds next then previous surviving card identity from the prior same-cell scene order. */
function survivingLocalNeighbor(
  current: KanbanFocusTarget & { readonly kind: 'card' },
  previous: readonly KanbanNavigationTarget[],
  eligible: readonly KanbanNavigationTarget[],
): KanbanNavigationTarget | undefined {
  const oldIndex = previous.findIndex(
    (entry) => canonicalizeKanbanFocusTarget(entry.target) === canonicalizeKanbanFocusTarget(current),
  );
  if (oldIndex < 0) return eligible.find((entry) => sameCell(entry.target, current));
  for (let index = oldIndex + 1; index < previous.length; index += 1) {
    const candidate = previous[index];
    if (candidate !== undefined && sameCell(candidate.target, current)) {
      const survivor = eligibleIdentity(eligible, candidate.target);
      if (survivor !== undefined) return survivor;
    }
  }
  for (let index = oldIndex - 1; index >= 0; index -= 1) {
    const candidate = previous[index];
    if (candidate !== undefined && sameCell(candidate.target, current)) {
      const survivor = eligibleIdentity(eligible, candidate.target);
      if (survivor !== undefined) return survivor;
    }
  }
  return eligible.find((entry) => sameCell(entry.target, current));
}

/** Finds next then previous surviving target of the same semantic kind in prior scene order. */
function survivingPeer(
  current: KanbanFocusTarget,
  previous: readonly KanbanNavigationTarget[],
  eligible: readonly KanbanNavigationTarget[],
): KanbanNavigationTarget | undefined {
  const oldIndex = previous.findIndex(
    (entry) => canonicalizeKanbanFocusTarget(entry.target) === canonicalizeKanbanFocusTarget(current),
  );
  if (oldIndex < 0) return eligible.find((entry) => entry.target.kind === current.kind);
  for (let index = oldIndex + 1; index < previous.length; index += 1) {
    const candidate = previous[index];
    if (candidate !== undefined && candidate.target.kind === current.kind) {
      const survivor = eligibleIdentity(eligible, candidate.target);
      if (survivor !== undefined) return survivor;
    }
  }
  for (let index = oldIndex - 1; index >= 0; index -= 1) {
    const candidate = previous[index];
    if (candidate !== undefined && candidate.target.kind === current.kind) {
      const survivor = eligibleIdentity(eligible, candidate.target);
      if (survivor !== undefined) return survivor;
    }
  }
  return eligible.find((entry) => entry.target.kind === current.kind);
}

/** Returns workflow-column IDs in current visible source order. */
function visibleColumnIds(targets: readonly KanbanNavigationTarget[]): readonly string[] {
  return targets.flatMap((entry) => (entry.target.kind === 'column-header' ? [entry.target.columnId] : []));
}

/** Finds immediate next then previous visible columns around the vanished current column. */
function neighboringColumnIds(
  columnId: string,
  current: readonly KanbanNavigationTarget[],
  previous: readonly KanbanNavigationTarget[],
): readonly string[] {
  const visible = visibleColumnIds(current);
  const visibleSet = new Set(visible);
  const currentIndex = visible.indexOf(columnId);
  if (currentIndex >= 0) {
    return Object.freeze([visible[currentIndex + 1], visible[currentIndex - 1]].filter((value) => value !== undefined));
  }
  const oldColumns = visibleColumnIds(previous);
  const oldIndex = oldColumns.indexOf(columnId);
  if (oldIndex < 0) return Object.freeze(visible.slice(0, 1));
  const result: string[] = [];
  for (let index = oldIndex + 1; index < oldColumns.length; index += 1) {
    const candidate = oldColumns[index];
    if (candidate !== undefined && visibleSet.has(candidate)) {
      result.push(candidate);
      break;
    }
  }
  for (let index = oldIndex - 1; index >= 0; index -= 1) {
    const candidate = oldColumns[index];
    if (candidate !== undefined && visibleSet.has(candidate)) {
      result.push(candidate);
      break;
    }
  }
  return Object.freeze(result);
}

/** Chooses the nearest card in the first neighboring column that contains an eligible card. */
function neighboringCard(
  current: KanbanFocusTarget & { readonly kind: 'card' },
  columnIds: readonly string[],
  eligible: readonly KanbanNavigationTarget[],
  preferredCenterRow: number,
): KanbanNavigationTarget | undefined {
  for (const columnId of columnIds) {
    const columnCards = eligible.filter(
      (entry) => entry.target.kind === 'card' && entry.target.address.columnId === columnId,
    );
    const sameSwimlane =
      current.address.swimlaneId === undefined
        ? columnCards
        : columnCards.filter(
            (entry) => entry.target.kind === 'card' && entry.target.address.swimlaneId === current.address.swimlaneId,
          );
    const candidates = sameSwimlane.length > 0 ? sameSwimlane : columnCards;
    const nearest = [...candidates].sort(
      (left, right) =>
        Math.abs(left.centerRow - preferredCenterRow) - Math.abs(right.centerRow - preferredCenterRow) ||
        left.sceneIndex - right.sceneIndex,
    )[0];
    if (nearest !== undefined) return nearest;
  }
  return undefined;
}

/** Returns the prior visible center row for a vanished focus target when available. */
function priorCenterRow(
  current: KanbanFocusTarget,
  previous: readonly KanbanNavigationTarget[],
  preferredCenterRow: number | undefined,
): number {
  if (preferredCenterRow !== undefined) return coordinate(preferredCenterRow);
  return (
    previous.find((entry) => canonicalizeKanbanFocusTarget(entry.target) === canonicalizeKanbanFocusTarget(current))
      ?.centerRow ?? 0
  );
}

/**
 * Reconciles focus from the vanished local identity outward to a deterministic global fallback.
 *
 * Cursor unloading is the only absence that retains the card identity for bounded acquisition. View
 * exclusion and deletion settle once onto a surviving target, so later scene expansion cannot steal
 * focus back to the old identity.
 */
export function reconcileKanbanFocus(options: ReconcileKanbanFocusOptions): KanbanFocusReconciliation {
  const current = snapshotKanbanFocusTarget(options.current);
  const scene = snapshotKanbanNavigationSnapshot(options.scene);
  const previous =
    options.previousScene === undefined
      ? Object.freeze([])
      : snapshotKanbanNavigationSnapshot(options.previousScene).targets;
  const eligible = enabledTargets(scene);
  const retained = eligibleIdentity(eligible, current);

  if (current.kind !== 'board-state' && retained !== undefined) return result('retained', retained.target);
  if (current.kind === 'card' && options.reason === 'cursor-unload') return result('acquire', current);
  if (current.kind === 'board-state') {
    const initial = resolveInitialKanbanFocus(scene);
    return result(
      canonicalizeKanbanFocusTarget(initial) === canonicalizeKanbanFocusTarget(current) ? 'retained' : 'changed',
      initial,
    );
  }

  if (current.kind === 'card') {
    const local = survivingLocalNeighbor(current, previous, eligible);
    if (local !== undefined) return result('changed', local.target);
    const neighborIds = neighboringColumnIds(current.address.columnId, eligible, previous);
    const crossColumn = neighboringCard(
      current,
      neighborIds,
      eligible,
      priorCenterRow(current, previous, options.preferredCenterRow),
    );
    if (crossColumn !== undefined) return result('changed', crossColumn.target);
    const containingHeader = eligible.find(
      (entry) => entry.target.kind === 'column-header' && entry.target.columnId === current.address.columnId,
    );
    if (containingHeader !== undefined) return result('changed', containingHeader.target);
    for (const columnId of neighborIds) {
      const header = eligible.find(
        (entry) => entry.target.kind === 'column-header' && entry.target.columnId === columnId,
      );
      if (header !== undefined) return result('changed', header.target);
    }
  }

  const sameKindSurvivor = survivingPeer(current, previous, eligible);
  if (sameKindSurvivor !== undefined) return result('changed', sameKindSurvivor.target);

  const header = eligible.find((entry) => entry.target.kind === 'column-header');
  return result('changed', header?.target ?? KANBAN_NEUTRAL_FOCUS_TARGET);
}
