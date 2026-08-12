import type { Rect } from '@jsvision/ui';

import { KanbanInvalidGeometryError } from '../contract/error.js';
import type { KanbanViewportProjection } from './viewport-projector.js';

/** Inputs for containing one projection pass-ceiling violation. */
export interface ResolveKanbanProjectionConvergenceFailureOptions {
  /** Complete current-frame compatibility fingerprint. */
  readonly fingerprint: string;
  /** Fingerprint owning the previous completed authoritative projection. */
  readonly completedFingerprint?: string;
  /** Previous completed authoritative projection, when one exists. */
  readonly completed?: KanbanViewportProjection;
  /** Latest current-frame attempt used to retain safe chrome and state. */
  readonly latest?: KanbanViewportProjection;
  /** Exact current viewport-local bounds. */
  readonly bounds: Readonly<Rect>;
}

/** Contained projection plus whether a fully compatible completed frame was reused. */
export interface KanbanProjectionConvergenceContainment {
  /** Safe authoritative projection selected for publication. */
  readonly projection: KanbanViewportProjection;
  /** True only when the prior completed projection matched every fingerprint member. */
  readonly reusedCompleted: boolean;
}

/**
 * Selects compatible completed geometry or creates a current-bounds noninteractive fallback.
 *
 * The fallback retains workflow chrome and source-state messages but removes every card, cell,
 * action target, and transient overlay so malformed convergence cannot publish stale authority.
 */
export function resolveKanbanProjectionConvergenceFailure(
  options: ResolveKanbanProjectionConvergenceFailureOptions,
): KanbanProjectionConvergenceContainment {
  if (options.completedFingerprint === options.fingerprint && options.completed !== undefined) {
    return Object.freeze({ projection: options.completed, reusedCompleted: true });
  }
  const source = options.latest ?? options.completed;
  if (source === undefined) throw new KanbanInvalidGeometryError();
  const retainedRegions = Object.freeze(
    source.regions.filter((region) => region.kind !== 'card' && region.kind !== 'cell'),
  );
  const geometry =
    source.geometry === undefined
      ? undefined
      : Object.freeze({
          ...source.geometry,
          cells: Object.freeze([]),
          cards: Object.freeze([]),
          regions: Object.freeze(
            source.geometry.regions.filter((region) => region.kind !== 'card' && region.kind !== 'cell'),
          ),
          changedRegions: Object.freeze([Object.freeze({ ...options.bounds })]),
        });
  const scene =
    source.scene === undefined
      ? undefined
      : Object.freeze({
          ...source.scene,
          cells: Object.freeze([]),
          cards: Object.freeze([]),
        });
  const projection: KanbanViewportProjection = Object.freeze({
    ...(scene === undefined ? {} : { scene }),
    ...(geometry === undefined ? {} : { geometry }),
    columns: source.columns,
    cards: Object.freeze([]),
    regions: retainedRegions,
    actionTargets: Object.freeze([]),
    states: source.states,
  });
  return Object.freeze({ projection, reusedCompleted: false });
}
