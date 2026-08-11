import type { Point, Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanMovePosition } from '../contract/request.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
import { snapshotKanbanMovePosition } from '../operation/placement.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanCellAddress } from '../source/types.js';
import type {
  KanbanCardDropMap,
  KanbanCardDropTarget,
  KanbanCardDropTargetKind,
  KanbanDragPrefetchHint,
} from './drag-types.js';

/** Largest target set accepted by the pure projector, including two halves per retained card. */
const ABSOLUTE_TARGET_LIMIT = KANBAN_LIMITS.retainedDescriptors.absolute * 2;
/** Normal target budget leaves room for both halves of every standard retained descriptor. */
const DEFAULT_TARGET_LIMIT = KANBAN_LIMITS.retainedDescriptors.standard * 2;
/** Shared immutable result used when no policy-specific eligibility was supplied. */
const ALLOWED: KanbanEligibility = Object.freeze({ kind: 'allowed' });
/** Unknown source windows are intentionally not dispatchable until new evidence is published. */
const PLACEMENT_LOADING: KanbanEligibility = Object.freeze({ kind: 'unavailable', code: 'placement-loading' });

/** One semantic rectangle and placement owned by a cell edge or resting gap. */
export interface KanbanDropRegionInput {
  /** Current clipped viewport-local geometry. */
  readonly rect: Readonly<Rect>;
  /** Revision-bound semantic placement represented by the geometry. */
  readonly position: KanbanMovePosition;
  /** Optional pure policy result; omitted regions are allowed. */
  readonly eligibility?: KanbanEligibility;
}

/** One resident card whose visible halves can act as fallback drop targets. */
export interface KanbanDropCardInput {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Current clipped viewport-local card rectangle. */
  readonly rect: Readonly<Rect>;
  /** Placement before the card. */
  readonly before: KanbanMovePosition;
  /** Placement after the card. */
  readonly after: KanbanMovePosition;
  /** Optional policy result for the upper half. */
  readonly beforeEligibility?: KanbanEligibility;
  /** Optional policy result for the lower half. */
  readonly afterEligibility?: KanbanEligibility;
}

/** Source completeness that controls whether logical cell edges are authoritative. */
export interface KanbanDropCellCompleteness {
  /** Whether logical start is known. */
  readonly leading: boolean;
  /** Whether logical end is known. */
  readonly trailing: boolean;
  /** Whether the complete cell is known to contain no cards. */
  readonly empty: boolean;
}

/** One unavailable loaded-window edge that may request bounded source evidence. */
export interface KanbanUnknownDropEdgeInput extends KanbanDropRegionInput {
  /** Bounded request used only while this edge remains the current target. */
  readonly prefetch: KanbanDragPrefetchHint;
}

/** Post-layout geometry and semantic evidence for one visible board cell. */
export interface KanbanDropCellInput {
  /** Workflow column and optional swimlane owning the cell. */
  readonly address: KanbanCellAddress;
  /** Clipped card-content rectangle. */
  readonly content: Readonly<Rect>;
  /** Header/chrome rectangle retained only to make its inert ownership explicit. */
  readonly header: Readonly<Rect>;
  /** Separate first slot immediately below header/chrome. */
  readonly postHeader?: KanbanDropRegionInput;
  /** Bounded logical-start zone. */
  readonly leading?: KanbanDropRegionInput;
  /** Bounded logical-end zone. */
  readonly trailing?: KanbanDropRegionInput;
  /** Visible resident cards in deterministic source order. */
  readonly cards: readonly KanbanDropCardInput[];
  /** Full-width resting gaps available outside compact density. */
  readonly gutters: readonly KanbanDropRegionInput[];
  /** Current source completeness for this cell. */
  readonly complete: KanbanDropCellCompleteness;
  /** Optional unavailable edge before the retained source window. */
  readonly unknownLeading?: KanbanUnknownDropEdgeInput;
  /** Optional unavailable edge after the retained source window. */
  readonly unknownTrailing?: KanbanUnknownDropEdgeInput;
  /** Optional policy result for a known empty cell. */
  readonly emptyEligibility?: KanbanEligibility;
}

/** One compact-density gap created only for the current semantic proposal. */
export interface KanbanActiveDropGapInput extends KanbanDropRegionInput {
  /** Cell whose stack owns the temporary row. */
  readonly address: KanbanCellAddress;
}

/** Inputs for one bounded immutable semantic drop-map projection. */
export interface ProjectKanbanCardDropMapOptions {
  /** Density controlling whether resting gutters exist. */
  readonly density: KanbanCardDensity;
  /** Visible cells in deterministic scene order. */
  readonly cells: readonly KanbanDropCellInput[];
  /** Current geometry generation; defaults to the first generation. */
  readonly geometryGeneration?: number;
  /** Optional viewport clip applied to every target rectangle. */
  readonly bounds?: Readonly<Rect>;
  /** Optional compact-density current proposal gap. */
  readonly activeGap?: KanbanActiveDropGapInput;
  /** Caller-selected target ceiling bounded by the package absolute limit. */
  readonly maximumTargets?: number;
}

/** Reads one own data property without invoking a caller accessor. */
function ownValue(value: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new KanbanInvalidGeometryError();
    return descriptor?.value;
  } catch (error) {
    if (error instanceof KanbanInvalidGeometryError) throw error;
    throw new KanbanInvalidGeometryError();
  }
}

/** Validates one safe integer without retaining rejected geometry. */
function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Detaches a finite non-empty half-open rectangle. */
function snapshotRect(value: unknown): Readonly<Rect> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const x = integer(ownValue(value, 'x'), Number.MIN_SAFE_INTEGER);
  const y = integer(ownValue(value, 'y'), Number.MIN_SAFE_INTEGER);
  const width = integer(ownValue(value, 'width'), 1);
  const height = integer(ownValue(value, 'height'), 1);
  if (!Number.isSafeInteger(x + width) || !Number.isSafeInteger(y + height)) {
    throw new KanbanInvalidGeometryError();
  }
  return Object.freeze({ x, y, width, height });
}

/** Returns a non-empty rectangle clipped to optional viewport bounds. */
function clippedRect(value: unknown, bounds: Readonly<Rect> | undefined): Readonly<Rect> | undefined {
  const rect = snapshotRect(value);
  if (bounds === undefined) return rect;
  const x = Math.max(rect.x, bounds.x);
  const y = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  if (right <= x || bottom <= y) return undefined;
  return Object.freeze({ x, y, width: right - x, height: bottom - y });
}

/** Validates a caller-supplied eligibility without retaining params or hostile objects. */
function snapshotEligibility(value: unknown): KanbanEligibility {
  if (value === undefined) return ALLOWED;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const kind = ownValue(value, 'kind');
  if (kind === 'allowed') return ALLOWED;
  if (kind !== 'warning' && kind !== 'blocked' && kind !== 'unavailable') throw new KanbanInvalidGeometryError();
  const code = ownValue(value, 'code');
  if (typeof code !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(code)) throw new KanbanInvalidGeometryError();
  // Drop geometry does not need policy parameters. Retaining them here would duplicate semantic data
  // and make a viewport-local map an accidental application-record owner.
  return Object.freeze({ kind, code });
}

/** Creates one stable collision-safe identity without exposing opaque placement tokens. */
function slotId(address: KanbanCellAddress, position: KanbanMovePosition): string {
  const addressKey = canonicalizeKanbanCellAddress(address);
  const semantic =
    position.kind === 'between'
      ? ['between', position.beforeCardKey, position.afterCardKey]
      : position.kind === 'window-edge'
        ? ['window-edge', position.edge, position.neighborCardKey]
        : [position.kind];
  return JSON.stringify(['kanban-drop-slot', addressKey, ...semantic, position.cursorRevision]);
}

/** Creates one immutable target after semantic and geometry validation. */
function target(
  kind: KanbanCardDropTargetKind,
  addressValue: unknown,
  positionValue: unknown,
  rect: Readonly<Rect>,
  geometryGeneration: number,
  eligibilityValue?: unknown,
  cardKeyValue?: unknown,
  prefetch?: KanbanDragPrefetchHint,
): KanbanCardDropTarget {
  const address = snapshotKanbanCellAddress(addressValue);
  const position = snapshotKanbanMovePosition(positionValue);
  const cardKey =
    cardKeyValue === undefined
      ? undefined
      : typeof cardKeyValue === 'string' || typeof cardKeyValue === 'number'
        ? createKanbanCardKey(cardKeyValue)
        : (() => {
            throw new KanbanInvalidGeometryError();
          })();
  return Object.freeze({
    kind,
    slotId: slotId(address, position),
    address,
    position,
    eligibility: snapshotEligibility(eligibilityValue),
    rect,
    geometryGeneration,
    ...(cardKey === undefined ? {} : { cardKey }),
    ...(prefetch === undefined ? {} : { prefetch }),
  });
}

/** Snapshots a bounded prefetch hint without retaining caller-owned values. */
function prefetchHint(value: unknown): KanbanDragPrefetchHint {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const count = integer(ownValue(value, 'count'), 1);
  if (count > KANBAN_LIMITS.ensureRangeCards.absolute) throw new KanbanInvalidGeometryError();
  return Object.freeze({
    address: snapshotKanbanCellAddress(ownValue(value, 'address')),
    start: integer(ownValue(value, 'start'), 0),
    count,
    revision: snapshotKanbanRevision(ownValue(value, 'revision')),
  });
}

/** Tests a point against a half-open target rectangle without arithmetic overflow. */
function contains(rect: Readonly<Rect>, point: Readonly<Point>): boolean {
  return point.x >= rect.x && point.x - rect.x < rect.width && point.y >= rect.y && point.y - rect.y < rect.height;
}

/** Splits visible card geometry into non-empty upper and lower fallback regions. */
function cardHalves(rect: Readonly<Rect>): readonly [Readonly<Rect>, Readonly<Rect>] {
  const upperHeight = Math.ceil(rect.height / 2);
  return Object.freeze([
    Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: upperHeight }),
    Object.freeze({ x: rect.x, y: rect.y + upperHeight, width: rect.width, height: rect.height - upperHeight }),
  ]);
}

/** Reads and validates one optional semantic region. */
function region(
  value: unknown,
  bounds: Readonly<Rect> | undefined,
): { readonly rect: Readonly<Rect>; readonly position: unknown; readonly eligibility: unknown } | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const rect = clippedRect(ownValue(value, 'rect'), bounds);
  if (rect === undefined) return undefined;
  return Object.freeze({
    rect,
    position: ownValue(value, 'position'),
    eligibility: ownValue(value, 'eligibility'),
  });
}

/** Adds a target only while the configured finite output budget has room. */
function append(targets: KanbanCardDropTarget[], value: KanbanCardDropTarget, maximum: number): void {
  if (targets.length < maximum) targets.push(value);
}

/**
 * Projects semantic card destinations independently from ordinary action hit testing.
 *
 * Targets are returned in overlap-priority order. `targetAt` therefore gives a full-width resting
 * gutter or active compact gap precedence over overlapping card halves.
 *
 * @example
 * ```ts
 * const map = projectKanbanCardDropMap({ density: 'comfortable', cells });
 * const destination = map.targetAt({ x: 12, y: 8 });
 * ```
 */
export function projectKanbanCardDropMap(options: ProjectKanbanCardDropMapOptions): KanbanCardDropMap {
  const geometryGeneration = integer(options.geometryGeneration ?? 1, 1);
  const maximum = integer(options.maximumTargets ?? DEFAULT_TARGET_LIMIT, 1);
  if (maximum > ABSOLUTE_TARGET_LIMIT || !Array.isArray(options.cells)) throw new KanbanInvalidGeometryError();
  if (options.cells.length > KANBAN_LIMITS.retainedDescriptors.absolute) throw new KanbanInvalidGeometryError();
  if (options.density !== 'compact' && options.density !== 'comfortable' && options.density !== 'spacious') {
    throw new KanbanInvalidGeometryError();
  }
  const bounds = options.bounds === undefined ? undefined : snapshotRect(options.bounds);
  const targets: KanbanCardDropTarget[] = [];

  if (options.density === 'compact' && options.activeGap !== undefined) {
    const active = region(options.activeGap, bounds);
    if (active !== undefined) {
      append(
        targets,
        target(
          'active-gap',
          options.activeGap.address,
          active.position,
          active.rect,
          geometryGeneration,
          active.eligibility,
        ),
        maximum,
      );
    }
  }

  for (const cell of options.cells) {
    const address = snapshotKanbanCellAddress(cell.address);
    // Snapshot both rectangles even though headers are deliberately inert. This catches stale or
    // hostile geometry at the projection boundary instead of silently accepting a malformed scene.
    clippedRect(cell.content, bounds);
    clippedRect(cell.header, bounds);

    if (options.density !== 'compact') {
      if (!Array.isArray(cell.gutters) || cell.gutters.length > KANBAN_LIMITS.retainedDescriptors.absolute) {
        throw new KanbanInvalidGeometryError();
      }
      for (const value of cell.gutters) {
        const gutter = region(value, bounds);
        if (gutter !== undefined) {
          append(
            targets,
            target('resting-gutter', address, gutter.position, gutter.rect, geometryGeneration, gutter.eligibility),
            maximum,
          );
        }
      }
    }

    for (const [kind, value] of [
      ['unknown-edge', cell.unknownLeading],
      ['unknown-edge', cell.unknownTrailing],
    ] as const) {
      const edge = region(value, bounds);
      if (edge !== undefined && value !== undefined) {
        append(
          targets,
          target(
            kind,
            address,
            edge.position,
            edge.rect,
            geometryGeneration,
            PLACEMENT_LOADING,
            undefined,
            prefetchHint(value.prefetch),
          ),
          maximum,
        );
      }
    }

    const postHeader = region(cell.postHeader, bounds);
    if (postHeader !== undefined) {
      append(
        targets,
        target(
          'post-header',
          address,
          postHeader.position,
          postHeader.rect,
          geometryGeneration,
          postHeader.eligibility,
        ),
        maximum,
      );
    }

    const content = clippedRect(cell.content, bounds);
    if (cell.complete.empty && content !== undefined) {
      const postHeaderPosition = cell.postHeader?.position;
      const leadingPosition = cell.leading?.position;
      const position = postHeaderPosition ?? leadingPosition;
      if (position !== undefined) {
        append(
          targets,
          target('empty-cell', address, position, content, geometryGeneration, cell.emptyEligibility),
          maximum,
        );
      }
    }

    if (!Array.isArray(cell.cards) || cell.cards.length > KANBAN_LIMITS.retainedDescriptors.absolute) {
      throw new KanbanInvalidGeometryError();
    }
    for (const card of cell.cards) {
      const rect = clippedRect(card.rect, bounds);
      if (rect === undefined) continue;
      const [upper, lower] = cardHalves(rect);
      append(
        targets,
        target('card-before', address, card.before, upper, geometryGeneration, card.beforeEligibility, card.cardKey),
        maximum,
      );
      if (lower.height > 0) {
        append(
          targets,
          target('card-after', address, card.after, lower, geometryGeneration, card.afterEligibility, card.cardKey),
          maximum,
        );
      }
    }

    // Card halves precede complete edge zones where their rectangles overlap. The edge rectangles
    // remain deliberately wider, so their exposed side cells still provide substantial start/end hits.
    const leading = cell.complete.leading ? region(cell.leading, bounds) : undefined;
    if (leading !== undefined) {
      append(
        targets,
        target('cell-leading', address, leading.position, leading.rect, geometryGeneration, leading.eligibility),
        maximum,
      );
    }
    const trailing = cell.complete.trailing ? region(cell.trailing, bounds) : undefined;
    if (trailing !== undefined) {
      append(
        targets,
        target('cell-trailing', address, trailing.position, trailing.rect, geometryGeneration, trailing.eligibility),
        maximum,
      );
    }
  }

  const frozenTargets = Object.freeze(targets);
  return Object.freeze({
    geometryGeneration,
    density: options.density,
    targets: frozenTargets,
    targetAt(point: Readonly<Point>): KanbanCardDropTarget | undefined {
      const x = integer(point.x, Number.MIN_SAFE_INTEGER);
      const y = integer(point.y, Number.MIN_SAFE_INTEGER);
      return frozenTargets.find((candidate) => contains(candidate.rect, { x, y }));
    },
  });
}
