import type { Rect } from '@jsvision/ui';

import { KanbanInvalidGeometryError } from '../contract/error.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanScene, KanbanSceneCard, KanbanSceneCell } from '../board/scene-model.js';
import type { KanbanCellAddress } from '../source/types.js';
import { resolveKanbanCustomSwimlaneGeometry } from './swimlane-custom.js';
import type { KanbanResolvedCustomSwimlaneGeometry, KanbanSceneCustomChromeInput } from './swimlane-custom.js';
import { resolveKanbanSwimlaneRail } from './swimlane-rail.js';

/** Scene presentation layouts supported by the geometry projector. */
export type KanbanSceneGeometryVariant = 'hybrid' | 'separator' | 'band' | 'rail' | 'custom';

/** Stable resize anchor retained independently from terminal rectangles. */
export interface KanbanSceneGeometryAnchor {
  /** Application-owned card identity. */
  readonly cardKey: CardKey;
  /** Preferred viewport row for the anchored card. */
  readonly preferredRow: number;
}

/** Semantic region kinds emitted by built-in scene geometry. */
export type KanbanSceneRegionKind =
  | 'workflow-header'
  | 'swimlane-header'
  | 'swimlane-band'
  | 'swimlane-separator'
  | 'swimlane-rail'
  | 'swimlane-custom'
  | 'cell'
  | 'card'
  | 'state';

/** One clipped positive-area region available to drawing, damage, and inspection. */
export interface KanbanSceneGeometryRegion extends Readonly<Rect> {
  /** Stable semantic purpose of this rectangle. */
  readonly kind: KanbanSceneRegionKind;
  /** Workflow column owning the region when applicable. */
  readonly columnId?: string;
  /** Swimlane owning the region when applicable. */
  readonly swimlaneId?: string;
  /** Card owning the region when applicable. */
  readonly cardKey?: CardKey;
  /** Resting geometry is non-actionable until hit projection closes its semantic scope. */
  readonly actionable: false;
}

/** One sticky workflow-column header rectangle. */
export interface KanbanSceneWorkflowHeaderGeometry extends Readonly<Rect> {
  /** Stable workflow-column identity. */
  readonly columnId: string;
  /** Sanitized source label. */
  readonly label: string;
  /** Workflow headers always remain vertically sticky. */
  readonly sticky: true;
}

/** One visible swimlane chrome rectangle. */
export interface KanbanSceneSwimlaneChromeGeometry extends Readonly<Rect> {
  /** Stable semantic swimlane identity. */
  readonly swimlaneId: string;
  /** Sanitized source label. */
  readonly label: string;
  /** Whether this active row is pinned beneath the workflow headers. */
  readonly sticky: boolean;
  /** Effective built-in visual treatment. */
  readonly variant: KanbanSceneGeometryVariant;
}

/** One projected sparse source cell. */
export interface KanbanSceneCellGeometry extends Readonly<Rect> {
  /** Stable semantic cell address. */
  readonly address: KanbanCellAddress;
}

/** One projected card descriptor rectangle. */
export interface KanbanSceneCardGeometry extends Readonly<Rect> {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Owning semantic cell address. */
  readonly address: KanbanCellAddress;
  /** Source cursor position. */
  readonly logicalIndex: number;
  /** Descriptor columns clipped from the left edge. */
  readonly descriptorColumnOffset: number;
  /** Descriptor rows clipped from the top edge. */
  readonly descriptorRowOffset: number;
}

/** Options for projecting one canonical scene into exact terminal cells. */
export interface ProjectKanbanSceneGeometryOptions {
  /** Parent-assigned viewport rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Requested built-in presentation. */
  readonly variant: KanbanSceneGeometryVariant;
  /** Independent requested horizontal and vertical content offsets. */
  readonly offsets: { readonly x: number; readonly y: number };
  /** Active swimlane whose visible chrome may pin beneath workflow headers. */
  readonly activeSwimlaneId?: string;
  /** Effective minimum width of each visible card column. */
  readonly minimumColumnWidth: number;
  /** Requested left rail width; defaults to ten terminal cells. */
  readonly railWidth?: number;
  /** Per-visible-swimlane descriptors required by the custom strategy. */
  readonly customChrome?: readonly KanbanSceneCustomChromeInput[];
  /** Optional focused workflow column; exactly this column remains visible. */
  readonly focusedColumnId?: string;
  /** Optional stable anchor preserved through responsive recomputation. */
  readonly anchor?: KanbanSceneGeometryAnchor;
}

/** Complete immutable exact-cell projection of a canonical semantic scene. */
export interface KanbanSceneGeometry {
  /** Equality-only scene revision represented by this projection. */
  readonly revision: KanbanRevision;
  /** Requested presentation before responsive strategy resolution. */
  readonly requestedVariant: KanbanSceneGeometryVariant;
  /** Effective built-in presentation. */
  readonly resolvedVariant: KanbanSceneGeometryVariant;
  /** Source-ordered workflow columns retained by the projection. */
  readonly visibleColumnIds: readonly string[];
  /** Clamped offsets used for projection. */
  readonly offsets: { readonly x: number; readonly y: number };
  /** Greatest currently valid offsets. */
  readonly extents: { readonly x: number; readonly y: number };
  /** First cell below the sticky workflow-header row. */
  readonly contentOrigin: { readonly x: number; readonly y: number };
  /** Preserved stable anchor when one was supplied. */
  readonly anchor?: KanbanSceneGeometryAnchor;
  /** Sticky workflow-column header rectangles. */
  readonly workflowHeaders: readonly KanbanSceneWorkflowHeaderGeometry[];
  /** Source-ordered visible swimlane chrome rectangles. */
  readonly swimlaneChrome: readonly KanbanSceneSwimlaneChromeGeometry[];
  /** Sparse occupied cell rectangles. */
  readonly cells: readonly KanbanSceneCellGeometry[];
  /** Source-ordered card rectangles. */
  readonly cards: readonly KanbanSceneCardGeometry[];
  /** Positive-area semantic regions used by later drawing, hit, and damage projection. */
  readonly regions: readonly KanbanSceneGeometryRegion[];
  /** Regions changed relative to an optional future projection baseline. */
  readonly changedRegions: readonly Readonly<Rect>[];
}

interface ColumnPlacement {
  readonly columnId: string;
  readonly x: number;
  readonly width: number;
}

interface SwimlanePlacement {
  readonly swimlaneId: string;
  readonly top: number;
  readonly height: number;
  readonly cardHeight: number;
}

function integer(value: unknown, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

function add(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < left) throw new KanbanInvalidGeometryError();
  return value;
}

function rect(value: unknown): Readonly<Rect> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of ['x', 'y', 'width', 'height']) {
    const descriptor = descriptors[key];
    if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new KanbanInvalidGeometryError();
  }
  const x = integer(descriptors.x?.value);
  const y = integer(descriptors.y?.value);
  const width = integer(descriptors.width?.value, true);
  const height = integer(descriptors.height?.value, true);
  add(x, width);
  add(y, height);
  return Object.freeze({ x, y, width, height });
}

function point(value: unknown): { readonly x: number; readonly y: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.freeze({ x: integer(descriptors.x?.value), y: integer(descriptors.y?.value) });
}

function clip(value: Readonly<Rect>, bounds: Readonly<Rect>, minimumY = bounds.y): Readonly<Rect> | undefined {
  const x = Math.max(value.x, bounds.x);
  const y = Math.max(value.y, bounds.y, minimumY);
  const right = Math.min(add(value.x, value.width), add(bounds.x, bounds.width));
  const bottom = Math.min(add(value.y, value.height), add(bounds.y, bounds.height));
  if (right <= x || bottom <= y) return undefined;
  return Object.freeze({ x, y, width: right - x, height: bottom - y });
}

function cellsForSwimlane(scene: KanbanScene, swimlaneId: string): readonly KanbanSceneCell[] {
  return scene.cells.filter(({ address }) => address.swimlaneId === swimlaneId);
}

function stackHeight(cards: readonly KanbanSceneCard[]): number {
  let height = 0;
  for (let index = 0; index < cards.length; index += 1) {
    height = add(height, cards[index]?.descriptor.measuredHeight ?? 0);
    if (index + 1 < cards.length) height = add(height, 1);
  }
  return height;
}

function region(
  kind: KanbanSceneRegionKind,
  value: Readonly<Rect>,
  identity: { readonly columnId?: string; readonly swimlaneId?: string; readonly cardKey?: CardKey } = {},
): KanbanSceneGeometryRegion {
  return Object.freeze({ kind, ...value, ...identity, actionable: false });
}

function snapshotAnchor(value: KanbanSceneGeometryAnchor | undefined): KanbanSceneGeometryAnchor | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const cardKey = descriptors.cardKey?.value;
  if (typeof cardKey !== 'string' && typeof cardKey !== 'number') throw new KanbanInvalidGeometryError();
  return Object.freeze({ cardKey, preferredRow: integer(descriptors.preferredRow?.value) });
}

/**
 * Projects hybrid, separator, and band swimlane strategies from one canonical semantic scene.
 *
 * All three strategies share card placement and a one-row swimlane heading. They differ only in the
 * semantic chrome region emitted for drawing, which keeps interaction and scrolling invariant.
 * Resting one-row card gaps and separator regions are deliberately non-actionable.
 *
 * @example
 * ```ts
 * const geometry = projectKanbanSceneGeometry(scene, {
 *   bounds: { x: 0, y: 0, width: 80, height: 24 },
 *   variant: 'hybrid',
 *   offsets: { x: 0, y: 0 },
 *   minimumColumnWidth: 18,
 * });
 * ```
 */
export function projectKanbanSceneGeometry(
  scene: KanbanScene,
  options: ProjectKanbanSceneGeometryOptions,
): KanbanSceneGeometry {
  if (typeof scene !== 'object' || scene === null || typeof options !== 'object' || options === null) {
    throw new KanbanInvalidGeometryError();
  }
  const bounds = rect(options.bounds);
  const offsets = point(options.offsets);
  const minimumColumnWidth = integer(options.minimumColumnWidth, true);
  if (
    options.variant !== 'hybrid' &&
    options.variant !== 'separator' &&
    options.variant !== 'band' &&
    options.variant !== 'rail' &&
    options.variant !== 'custom'
  ) {
    throw new KanbanInvalidGeometryError();
  }
  const focused = options.focusedColumnId;
  const visibleColumns =
    focused === undefined ? scene.columns : scene.columns.filter(({ columnId }) => columnId === focused);
  if (focused !== undefined && visibleColumns.length !== 1) throw new KanbanInvalidGeometryError();
  if (visibleColumns.length === 0) throw new KanbanInvalidGeometryError();

  const customBySwimlane = new Map<string, KanbanResolvedCustomSwimlaneGeometry>();
  if (options.variant === 'custom') {
    if (!Array.isArray(options.customChrome) || options.customChrome.length !== scene.swimlanes.length) {
      throw new KanbanInvalidGeometryError();
    }
    for (const chrome of options.customChrome) {
      const resolved = resolveKanbanCustomSwimlaneGeometry({
        chrome,
        availableWidth: bounds.width,
        visibleColumnCount: visibleColumns.length,
        minimumColumnWidth,
      });
      if (customBySwimlane.has(resolved.swimlaneId)) throw new KanbanInvalidGeometryError();
      customBySwimlane.set(resolved.swimlaneId, resolved);
    }
    if (scene.swimlanes.some(({ swimlaneId }) => !customBySwimlane.has(swimlaneId))) {
      throw new KanbanInvalidGeometryError();
    }
  } else if (options.customChrome !== undefined) {
    throw new KanbanInvalidGeometryError();
  }
  const customRailWidth = Math.max(0, ...[...customBySwimlane.values()].map(({ railWidth }) => railWidth));
  const rail =
    options.variant === 'rail'
      ? resolveKanbanSwimlaneRail({
          bounds,
          visibleColumnCount: visibleColumns.length,
          minimumColumnWidth,
          railWidth: options.railWidth,
          focused: focused !== undefined,
        })
      : options.variant === 'custom'
        ? Object.freeze({
            resolvedVariant: 'custom' as const,
            railWidth: customRailWidth,
            cardBounds: Object.freeze({
              x: bounds.x + customRailWidth,
              y: bounds.y,
              width: bounds.width - customRailWidth,
              height: bounds.height,
            }),
          })
        : Object.freeze({ resolvedVariant: options.variant, railWidth: 0, cardBounds: bounds });
  const resolvedVariant = rail.resolvedVariant;
  const cardBounds = rail.cardBounds;
  const naturalColumnWidth = Math.max(minimumColumnWidth, Math.floor(cardBounds.width / visibleColumns.length));
  const totalWidth = add(0, naturalColumnWidth * visibleColumns.length);
  if (!Number.isSafeInteger(totalWidth)) throw new KanbanInvalidGeometryError();
  const extentX = Math.max(0, totalWidth - cardBounds.width);
  const offsetX = Math.min(offsets.x, extentX);
  const placements: readonly ColumnPlacement[] = Object.freeze(
    visibleColumns.map(({ columnId }, index) =>
      Object.freeze({ columnId, x: cardBounds.x + index * naturalColumnWidth - offsetX, width: naturalColumnWidth }),
    ),
  );

  const swimlanePlacements: SwimlanePlacement[] = [];
  let logicalTop = 0;
  for (const swimlane of scene.swimlanes) {
    const cellHeight = Math.max(
      0,
      ...cellsForSwimlane(scene, swimlane.swimlaneId).map(({ cards }) => stackHeight(cards)),
    );
    const customRows = customBySwimlane.get(swimlane.swimlaneId)?.rows;
    const height = resolvedVariant === 'rail' ? Math.max(1, cellHeight) : add(customRows ?? 1, cellHeight);
    swimlanePlacements.push(
      Object.freeze({ swimlaneId: swimlane.swimlaneId, top: logicalTop, height, cardHeight: cellHeight }),
    );
    logicalTop = add(logicalTop, height);
  }
  const contentHeight = logicalTop;
  const contentOriginY = add(bounds.y, 1);
  const viewportContentHeight = Math.max(0, bounds.height - 1);
  const extentY = Math.max(0, contentHeight - viewportContentHeight);
  const offsetY = Math.min(offsets.y, extentY);
  const contentOrigin = Object.freeze({ x: cardBounds.x, y: contentOriginY });
  const anchor = snapshotAnchor(options.anchor);
  const workflowHeaders: KanbanSceneWorkflowHeaderGeometry[] = [];
  const swimlaneChrome: KanbanSceneSwimlaneChromeGeometry[] = [];
  const cells: KanbanSceneCellGeometry[] = [];
  const cards: KanbanSceneCardGeometry[] = [];
  const regions: KanbanSceneGeometryRegion[] = [];

  for (const column of visibleColumns) {
    const placement = placements.find(({ columnId }) => columnId === column.columnId);
    if (placement === undefined) continue;
    const clipped = clip({ x: placement.x, y: bounds.y, width: placement.width, height: 1 }, cardBounds);
    if (clipped === undefined) continue;
    workflowHeaders.push(Object.freeze({ ...clipped, columnId: column.columnId, label: column.label, sticky: true }));
    regions.push(region('workflow-header', clipped, { columnId: column.columnId }));
  }

  for (const swimlane of scene.swimlanes) {
    const placement = swimlanePlacements.find(({ swimlaneId }) => swimlaneId === swimlane.swimlaneId);
    if (placement === undefined) continue;
    const naturalY = contentOriginY + placement.top - offsetY;
    const sticky = swimlane.swimlaneId === options.activeSwimlaneId;
    const chromeY = sticky ? Math.max(contentOriginY, naturalY) : naturalY;
    const customGeometry = customBySwimlane.get(swimlane.swimlaneId);
    const chromeRows = customGeometry?.rows ?? 1;
    const chromeRect =
      resolvedVariant === 'rail'
        ? { x: bounds.x, y: chromeY, width: rail.railWidth, height: placement.height }
        : { x: bounds.x, y: chromeY, width: bounds.width, height: chromeRows };
    const clippedChrome = clip(chromeRect, bounds, contentOriginY);
    if (clippedChrome !== undefined) {
      swimlaneChrome.push(
        Object.freeze({
          ...clippedChrome,
          swimlaneId: swimlane.swimlaneId,
          label: swimlane.label,
          sticky,
          variant: resolvedVariant,
        }),
      );
      const chromeKind =
        resolvedVariant === 'rail'
          ? 'swimlane-rail'
          : resolvedVariant === 'custom'
            ? 'swimlane-custom'
            : resolvedVariant === 'separator'
              ? 'swimlane-separator'
              : resolvedVariant === 'band'
                ? 'swimlane-band'
                : 'swimlane-header';
      regions.push(region(chromeKind, clippedChrome, { swimlaneId: swimlane.swimlaneId }));
    }

    if (customGeometry !== undefined) {
      for (const customRegion of customGeometry.regions) {
        const clippedCustomRegion = clip(
          {
            x: bounds.x + customRegion.x,
            y: chromeY + customRegion.y,
            width: customRegion.width,
            height: customRegion.height,
          },
          bounds,
          contentOriginY,
        );
        if (clippedCustomRegion !== undefined) {
          regions.push(region('swimlane-custom', clippedCustomRegion, { swimlaneId: swimlane.swimlaneId }));
        }
      }
      if (customGeometry.railWidth > 0 && placement.cardHeight > 0) {
        const customRail = clip(
          {
            x: bounds.x,
            y: naturalY + chromeRows,
            width: customGeometry.railWidth,
            height: placement.cardHeight,
          },
          bounds,
          contentOriginY,
        );
        if (customRail !== undefined) {
          regions.push(region('swimlane-custom', customRail, { swimlaneId: swimlane.swimlaneId }));
        }
      }
    }

    const cardMinimumY = sticky && resolvedVariant !== 'rail' ? contentOriginY + chromeRows : contentOriginY;
    const cardRowOffset = resolvedVariant === 'rail' ? 0 : chromeRows;
    for (const sourceCell of cellsForSwimlane(scene, swimlane.swimlaneId)) {
      const column = placements.find(({ columnId }) => columnId === sourceCell.address.columnId);
      if (column === undefined || placement.cardHeight === 0) continue;
      const cellRect = clip(
        {
          x: column.x,
          y: naturalY + cardRowOffset,
          width: column.width,
          height: placement.cardHeight,
        },
        bounds,
        cardMinimumY,
      );
      if (cellRect !== undefined) {
        cells.push(Object.freeze({ ...cellRect, address: sourceCell.address }));
        regions.push(region('cell', cellRect, sourceCell.address));
      }
      let cardTop = naturalY + cardRowOffset;
      for (const sourceCard of sourceCell.cards) {
        const cardWidth = Math.min(sourceCard.descriptor.width, column.width);
        const descriptorRect = {
          x: column.x,
          y: cardTop,
          width: cardWidth,
          height: sourceCard.descriptor.measuredHeight,
        };
        const cardRect = clip(descriptorRect, bounds, cardMinimumY);
        if (cardRect !== undefined) {
          cards.push(
            Object.freeze({
              ...cardRect,
              cardKey: sourceCard.cardKey,
              address: sourceCard.address,
              logicalIndex: sourceCard.logicalIndex,
              descriptorColumnOffset: cardRect.x - descriptorRect.x,
              descriptorRowOffset: cardRect.y - descriptorRect.y,
            }),
          );
          regions.push(
            region('card', cardRect, {
              columnId: sourceCard.address.columnId,
              swimlaneId: sourceCard.address.swimlaneId,
              cardKey: sourceCard.cardKey,
            }),
          );
        }
        cardTop = add(cardTop, add(sourceCard.descriptor.measuredHeight, 1));
      }
    }
  }

  return Object.freeze({
    revision: scene.revision,
    requestedVariant: options.variant,
    resolvedVariant,
    visibleColumnIds: Object.freeze(visibleColumns.map(({ columnId }) => columnId)),
    offsets: Object.freeze({ x: offsetX, y: offsetY }),
    extents: Object.freeze({ x: extentX, y: extentY }),
    contentOrigin,
    ...(anchor === undefined ? {} : { anchor }),
    workflowHeaders: Object.freeze(workflowHeaders),
    swimlaneChrome: Object.freeze(swimlaneChrome),
    cells: Object.freeze(cells),
    cards: Object.freeze(cards),
    regions: Object.freeze(regions),
    changedRegions: Object.freeze([]),
  });
}
