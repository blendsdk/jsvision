import type { Rect } from '@jsvision/ui';

import { KanbanInvalidGeometryError } from '../contract/error.js';
import { KANBAN_STRUCTURE_PRESENTATION_LIMITS } from '../contract/limits.js';

/** Default terminal-cell width reserved by the built-in swimlane rail. */
export const KANBAN_DEFAULT_SWIMLANE_RAIL_WIDTH = 10;

/** Inputs for deterministic rail reservation and responsive fallback. */
export interface ResolveKanbanSwimlaneRailOptions {
  /** Complete parent-assigned scene rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Number of visible workflow columns. */
  readonly visibleColumnCount: number;
  /** Effective minimum width for every card column. */
  readonly minimumColumnWidth: number;
  /** Requested rail width, defaulting to ten cells. */
  readonly railWidth?: number;
  /** Focused-column layouts use horizontal hybrid chrome instead of a permanent rail. */
  readonly focused: boolean;
}

/** Immutable rail allocation or its responsive hybrid fallback. */
export interface KanbanSwimlaneRailResolution {
  /** Effective presentation after responsive resolution. */
  readonly resolvedVariant: 'rail' | 'hybrid';
  /** Whether the requested rail was removed. */
  readonly degraded: boolean;
  /** Effective reserved width, or zero after fallback. */
  readonly railWidth: number;
  /** Exact rectangle available to card columns and workflow headers. */
  readonly cardBounds: Readonly<Rect>;
}

function integer(value: unknown, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/**
 * Reserves a bounded left swimlane rail without changing the board's minimum usable width.
 *
 * The rail falls back to hybrid whenever it would make a card column narrower than its effective
 * minimum. Focused-column mode also uses hybrid so the single working column keeps the full compact
 * viewport and resize/restore remains deterministic.
 *
 * @example
 * ```ts
 * const rail = resolveKanbanSwimlaneRail({
 *   bounds: { x: 0, y: 0, width: 80, height: 24 },
 *   visibleColumnCount: 2,
 *   minimumColumnWidth: 18,
 *   focused: false,
 * });
 * ```
 */
export function resolveKanbanSwimlaneRail(options: ResolveKanbanSwimlaneRailOptions): KanbanSwimlaneRailResolution {
  const { bounds } = options;
  const x = integer(bounds.x);
  const y = integer(bounds.y);
  const width = integer(bounds.width, true);
  const height = integer(bounds.height, true);
  const visibleColumnCount = integer(options.visibleColumnCount, true);
  const minimumColumnWidth = integer(options.minimumColumnWidth, true);
  const railWidth = integer(options.railWidth ?? KANBAN_DEFAULT_SWIMLANE_RAIL_WIDTH, true);
  if (railWidth > KANBAN_STRUCTURE_PRESENTATION_LIMITS.railWidth) throw new KanbanInvalidGeometryError();
  const requiredCardWidth = visibleColumnCount * minimumColumnWidth;
  if (!Number.isSafeInteger(requiredCardWidth)) throw new KanbanInvalidGeometryError();
  const degraded = options.focused || width - railWidth < requiredCardWidth;
  const effectiveRailWidth = degraded ? 0 : railWidth;
  return Object.freeze({
    resolvedVariant: degraded ? 'hybrid' : 'rail',
    degraded,
    railWidth: effectiveRailWidth,
    cardBounds: Object.freeze({ x: x + effectiveRailWidth, y, width: width - effectiveRailWidth, height }),
  });
}
