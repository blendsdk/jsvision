import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_STRUCTURE_PRESENTATION_LIMITS } from '../contract/limits.js';
import type { KanbanSwimlaneChromeDescriptor } from '../structure/swimlane-presentation.js';

/** One application-produced, already semantic-scoped custom swimlane descriptor. */
export interface KanbanSceneCustomChromeInput {
  /** Stable swimlane identity receiving this chrome. */
  readonly swimlaneId: string;
  /** Bounded renderer-neutral descriptor returned by the presentation resolver. */
  readonly descriptor: KanbanSwimlaneChromeDescriptor;
}

/** Geometry-only custom chrome values safe to consume during scene projection. */
export interface KanbanResolvedCustomSwimlaneGeometry {
  /** Stable validated swimlane identity. */
  readonly swimlaneId: string;
  /** Horizontal rows reserved above this swimlane's cards. */
  readonly rows: number;
  /** Left cells reserved beside every card column. */
  readonly railWidth: number;
  /** Bounded header-only regions copied away from application ownership. */
  readonly regions: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
}

/** Inputs for validating custom chrome against current responsive geometry. */
export interface ResolveKanbanCustomSwimlaneGeometryOptions {
  /** Application-produced semantic-scoped descriptor. */
  readonly chrome: KanbanSceneCustomChromeInput;
  /** Complete available viewport width. */
  readonly availableWidth: number;
  /** Number of visible card columns. */
  readonly visibleColumnCount: number;
  /** Effective minimum width of every card column. */
  readonly minimumColumnWidth: number;
}

function integer(value: unknown, maximum: number, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/**
 * Copies custom swimlane chrome into a bounded geometry-only snapshot.
 *
 * The descriptor may reserve header rows and a left rail, but it cannot supply absolute card
 * positions. Invalid or too-wide geometry is rejected before any partial region becomes visible.
 *
 * @example
 * ```ts
 * const custom = resolveKanbanCustomSwimlaneGeometry({
 *   chrome: { swimlaneId: 'team-a', descriptor },
 *   availableWidth: 80,
 *   visibleColumnCount: 2,
 *   minimumColumnWidth: 18,
 * });
 * ```
 */
export function resolveKanbanCustomSwimlaneGeometry(
  options: ResolveKanbanCustomSwimlaneGeometryOptions,
): KanbanResolvedCustomSwimlaneGeometry {
  try {
    const swimlaneId = createKanbanSwimlaneId(options.chrome.swimlaneId);
    const descriptor = options.chrome.descriptor;
    const availableWidth = integer(options.availableWidth, Number.MAX_SAFE_INTEGER, true);
    const visibleColumnCount = integer(options.visibleColumnCount, Number.MAX_SAFE_INTEGER, true);
    const minimumColumnWidth = integer(options.minimumColumnWidth, Number.MAX_SAFE_INTEGER, true);
    const rows = integer(descriptor.rows, KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorRows, true);
    const railWidth = integer(descriptor.railWidth, KANBAN_STRUCTURE_PRESENTATION_LIMITS.railWidth);
    const requiredWidth = visibleColumnCount * minimumColumnWidth;
    if (!Number.isSafeInteger(requiredWidth) || availableWidth - railWidth < requiredWidth) {
      throw new KanbanInvalidGeometryError();
    }
    if (
      !Array.isArray(descriptor.regions) ||
      descriptor.regions.length > KANBAN_STRUCTURE_PRESENTATION_LIMITS.descriptorRegions
    ) {
      throw new KanbanInvalidGeometryError();
    }
    const regions = Object.freeze(
      descriptor.regions.map((region) => {
        const x = integer(region.x, availableWidth);
        const y = integer(region.y, rows);
        const width = integer(region.width, availableWidth, true);
        const height = integer(region.height, rows, true);
        if (x + width > availableWidth || y + height > rows) throw new KanbanInvalidGeometryError();
        return Object.freeze({ x, y, width, height });
      }),
    );
    return Object.freeze({ swimlaneId, rows, railWidth, regions });
  } catch (error) {
    if (error instanceof KanbanInvalidGeometryError) throw error;
    throw new KanbanInvalidGeometryError();
  }
}
