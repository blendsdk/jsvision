import { charWidth, sanitize } from '@jsvision/core';
import type { Rect } from '@jsvision/ui';

import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { sanitizeContractText } from '../contract/text-safety.js';
import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanActionTarget, KanbanLayoutRegion } from './hit-map.js';
import { KanbanSparseHeightIndex } from './sparse-height-index.js';
import type { KanbanSparseHeightPosition } from './sparse-height-index.js';

/** Bounded card extent consumed by the pure vertical projector. */
export interface KanbanVerticalCardInput {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Validated descriptor height in terminal rows. */
  readonly height: number;
  /** Global logical position required when a sparse height projection is supplied. */
  readonly logicalIndex?: number;
}

/** One retained card row detached from a mutable sparse height index. */
export interface KanbanVerticalHeightProjectionRow {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Global logical position in the owning semantic cell. */
  readonly logicalIndex: number;
  /** Descriptor-only row before density-owned resting gaps are added. */
  readonly descriptorRow: KanbanSparseHeightPosition;
}

/** Immutable bounded sparse-height evidence shared by projection and metrics. */
export interface KanbanVerticalHeightProjection {
  /** Complete logical card count represented arithmetically rather than by allocation. */
  readonly logicalLength: number;
  /** Bounded retained rows needed by the current visible and overscan window. */
  readonly rows: readonly KanbanVerticalHeightProjectionRow[];
  /** Descriptor-only aggregate extent at the logical end boundary. */
  readonly descriptorExtent: KanbanSparseHeightPosition;
  /** Revisions that make every retained row and the aggregate extent compatible. */
  readonly revisions: {
    readonly source: KanbanRevision;
    readonly cursor: KanbanRevision;
    readonly presentation: KanbanRevision;
  };
}

/** Inputs for creating one bounded immutable height projection. */
export interface CreateKanbanVerticalHeightProjectionOptions {
  /** Mutable sparse index sampled synchronously into detached evidence. */
  readonly index: KanbanSparseHeightIndex;
  /** Source-ordered retained card identities and their global logical positions. */
  readonly cards: readonly Pick<KanbanVerticalHeightProjectionRow, 'cardKey' | 'logicalIndex'>[];
}

/** Aggregate vertical content extent after density-owned gaps are applied. */
export interface KanbanVerticalProjectionExtent {
  /** Saturated card-content height in terminal rows. */
  readonly value: number;
  /** Exact only when the complete descriptor prefix is exact. */
  readonly quality: 'exact' | 'unknown';
}

/** Inputs for one pure vertical card-stack projection. */
export interface ProjectKanbanVerticalGeometryOptions {
  /** Exact rectangle assigned to the retained column. */
  readonly bounds: Readonly<Rect>;
  /** Sticky workflow-header rows at the top of the rectangle. */
  readonly stickyHeaderHeight: number;
  /** Optional swimlane-header rows below the workflow header. */
  readonly swimlaneHeaderHeight?: number;
  /** Requested vertical card-content offset. */
  readonly scrollOffset: number;
  /** Logical row occupied by the first retained card in a sparse source window. */
  readonly contentOrigin?: number;
  /** Optional immutable sparse row evidence for global variable-height placement. */
  readonly heightProjection?: KanbanVerticalHeightProjection;
  /** Resting card-spacing policy. */
  readonly density: KanbanCardDensity;
  /** Source-ordered retained cards. */
  readonly cards: readonly KanbanVerticalCardInput[];
  /** Finite extra card rows retained around the visible range. */
  readonly verticalOverscan: number;
  /** Whether to expose non-actionable future insertion geometry for inspection. */
  readonly projectInsertionGutters?: boolean;
}

/** Stable card position used to preserve vertical identity through recomputation. */
export interface KanbanVerticalCardAnchor {
  /** Stable card identity. */
  readonly cardKey: CardKey;
  /** Logical top row in the unscrolled card stack. */
  readonly logicalRow: number;
  /** Descriptor height in terminal rows. */
  readonly height: number;
  /** Global logical position when sparse height evidence owns placement. */
  readonly logicalIndex?: number;
  /** Whether the logical row is exact or still estimated. */
  readonly quality?: KanbanSparseHeightPosition['quality'];
}

/** Immutable result of one bounded vertical projection. */
export interface KanbanVerticalGeometry {
  /** Clipped semantic regions visible in the assigned rectangle. */
  readonly regions: readonly KanbanLayoutRegion[];
  /** Actionable targets; deliberately empty in Phase A. */
  readonly actionTargets: readonly KanbanActionTarget[];
  /** Complete unscrolled height including sticky chrome and resting gaps. */
  readonly contentHeight: number;
  /** Confidence in the card-content portion of `contentHeight`. */
  readonly extentQuality: 'exact' | 'unknown';
  /** Greatest valid vertical card-content offset. */
  readonly scrollExtent: number;
  /** Clamped offset used for this projection. */
  readonly scrollOffset: number;
  /** First retained source-card index. */
  readonly retainedStart: number;
  /** Exclusive retained source-card index. */
  readonly retainedEnd: number;
  /** Source-ordered stable anchors independent of clipping. */
  readonly anchors: readonly KanbanVerticalCardAnchor[];
}

/** Inputs for safe impossible-geometry feedback projection. */
export interface ProjectKanbanMinimumGeometryOptions {
  /** Parent-assigned rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Smallest usable board width. */
  readonly requiredWidth: number;
  /** Smallest usable board height. */
  readonly requiredHeight: number;
  /** Localized untrusted feedback text. */
  readonly message: string;
}

/** One clipped minimum-size message rectangle. */
export interface KanbanMinimumMessage {
  /** Sanitized cell-safe visible text. */
  readonly text: string;
  /** Visible message width in terminal cells. */
  readonly width: number;
  /** Visible message height in terminal rows. */
  readonly height: number;
}

/** Atomic impossible-geometry projection with no partial targets. */
export interface KanbanMinimumGeometry {
  /** Stable degraded-state discriminator. */
  readonly kind: 'minimum-size';
  /** Parent-assigned rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Required usable dimensions. */
  readonly required: { readonly width: number; readonly height: number };
  /** Bounded visible feedback. */
  readonly message: KanbanMinimumMessage;
  /** No partial header/card regions are exposed. */
  readonly inspectionRegions: readonly KanbanLayoutRegion[];
  /** No partial actions are exposed. */
  readonly actionTargets: readonly KanbanActionTarget[];
}

/** Validates a non-negative safe terminal-cell count. */
function cellCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Adds safe non-negative terminal-cell counts. */
function addCells(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < left) throw new KanbanInvalidGeometryError();
  return result;
}

/** Adds non-negative geometry and saturates before integer precision can be lost. */
function saturatedAddCells(left: number, right: number): number {
  if (left > Number.MAX_SAFE_INTEGER - right) return Number.MAX_SAFE_INTEGER;
  return left + right;
}

/** Multiplies non-negative geometry and saturates before integer precision can be lost. */
function saturatedMultiplyCells(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  if (left > Math.floor(Number.MAX_SAFE_INTEGER / right)) return Number.MAX_SAFE_INTEGER;
  return left * right;
}

/** Converts one logical content row to a viewport row without overflowing at saturated extents. */
function projectedViewportRow(viewportOrigin: number, logicalRow: number, scrollOffset: number): number {
  if (logicalRow >= scrollOffset) return saturatedAddCells(viewportOrigin, logicalRow - scrollOffset);
  return viewportOrigin - (scrollOffset - logicalRow);
}

/** Reads one own data property without invoking accessors. */
function ownValue(record: object, key: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new KanbanInvalidGeometryError();
  return descriptor?.value;
}

/** Copies a caller rectangle into a validated frozen value. */
function snapshotRect(value: unknown): Readonly<Rect> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const x = cellCount(ownValue(value, 'x'));
  const y = cellCount(ownValue(value, 'y'));
  const width = cellCount(ownValue(value, 'width'));
  const height = cellCount(ownValue(value, 'height'));
  addCells(x, width);
  addCells(y, height);
  return Object.freeze({ x, y, width, height });
}

/** Clips one rectangle to a non-empty containing rectangle. */
function clipRegion(region: KanbanLayoutRegion, clip: Readonly<Rect>): KanbanLayoutRegion | undefined {
  const x = Math.max(region.x, clip.x);
  const y = Math.max(region.y, clip.y);
  const right = Math.min(region.x + region.width, clip.x + clip.width);
  const bottom = Math.min(region.y + region.height, clip.y + clip.height);
  if (right <= x || bottom <= y) return undefined;
  return Object.freeze({ ...region, x, y, width: right - x, height: bottom - y });
}

/** Returns the standard one-row resting gap owned by every named density policy. */
function densityGap(density: unknown): number {
  if (density === 'compact' || density === 'comfortable' || density === 'spacious') return 1;
  throw new KanbanInvalidGeometryError();
}

/** Snapshots one retained card without reading caller fields twice. */
function snapshotCard(value: unknown): KanbanVerticalCardInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const rawCardKey = ownValue(value, 'cardKey');
  if (typeof rawCardKey !== 'string' && typeof rawCardKey !== 'number') throw new KanbanInvalidGeometryError();
  let cardKey: CardKey;
  try {
    cardKey = createKanbanCardKey(rawCardKey);
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  const height = cellCount(ownValue(value, 'height'));
  if (height === 0 || height > KANBAN_LIMITS.descriptorRows.absolute) throw new KanbanInvalidGeometryError();
  const rawLogicalIndex = ownValue(value, 'logicalIndex');
  const logicalIndex = rawLogicalIndex === undefined ? undefined : cellCount(rawLogicalIndex);
  return Object.freeze({ cardKey, height, ...(logicalIndex === undefined ? {} : { logicalIndex }) });
}

/** Snapshots one sparse position without retaining caller-owned data. */
function snapshotSparsePosition(value: unknown): KanbanSparseHeightPosition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const position = cellCount(ownValue(value, 'value'));
  const quality = ownValue(value, 'quality');
  if (quality !== 'exact' && quality !== 'estimated') throw new KanbanInvalidGeometryError();
  return Object.freeze({ value: position, quality });
}

/**
 * Validates and detaches one bounded sparse-height projection.
 *
 * @example
 * ```ts
 * const detached = snapshotKanbanVerticalHeightProjection(projection);
 * ```
 */
export function snapshotKanbanVerticalHeightProjection(value: unknown): KanbanVerticalHeightProjection {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  const logicalLength = cellCount(ownValue(value, 'logicalLength'));
  const rawRows = ownValue(value, 'rows');
  if (!Array.isArray(rawRows)) throw new KanbanInvalidGeometryError();
  const rowCount = cellCount(ownValue(rawRows, 'length'));
  if (rowCount > KANBAN_LIMITS.ensureRangeCards.absolute) throw new KanbanInvalidGeometryError();
  const rows: KanbanVerticalHeightProjectionRow[] = [];
  const keys = new Set<CardKey>();
  let previousIndex = -1;
  for (let index = 0; index < rowCount; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(rawRows, index)) throw new KanbanInvalidGeometryError();
    const rawRow = ownValue(rawRows, String(index));
    if (typeof rawRow !== 'object' || rawRow === null || Array.isArray(rawRow)) {
      throw new KanbanInvalidGeometryError();
    }
    const rawCardKey = ownValue(rawRow, 'cardKey');
    if (typeof rawCardKey !== 'string' && typeof rawCardKey !== 'number') throw new KanbanInvalidGeometryError();
    let cardKey: CardKey;
    try {
      cardKey = createKanbanCardKey(rawCardKey);
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    const logicalIndex = cellCount(ownValue(rawRow, 'logicalIndex'));
    if (logicalIndex >= logicalLength || logicalIndex <= previousIndex || keys.has(cardKey)) {
      throw new KanbanInvalidGeometryError();
    }
    const descriptorRow = snapshotSparsePosition(ownValue(rawRow, 'descriptorRow'));
    rows.push(Object.freeze({ cardKey, logicalIndex, descriptorRow }));
    keys.add(cardKey);
    previousIndex = logicalIndex;
  }
  const rawRevisions = ownValue(value, 'revisions');
  if (typeof rawRevisions !== 'object' || rawRevisions === null || Array.isArray(rawRevisions)) {
    throw new KanbanInvalidGeometryError();
  }
  let revisions: KanbanVerticalHeightProjection['revisions'];
  try {
    revisions = Object.freeze({
      source: snapshotKanbanRevision(ownValue(rawRevisions, 'source')),
      cursor: snapshotKanbanRevision(ownValue(rawRevisions, 'cursor')),
      presentation: snapshotKanbanRevision(ownValue(rawRevisions, 'presentation')),
    });
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  return Object.freeze({
    logicalLength,
    rows: Object.freeze(rows),
    descriptorExtent: snapshotSparsePosition(ownValue(value, 'descriptorExtent')),
    revisions,
  });
}

/** Resolves one already-snapshotted descriptor extent with global density gaps. */
function projectionExtent(projection: KanbanVerticalHeightProjection, gap: number): KanbanVerticalProjectionExtent {
  const gapCount = Math.max(0, projection.logicalLength - 1);
  return Object.freeze({
    value: saturatedAddCells(projection.descriptorExtent.value, saturatedMultiplyCells(gapCount, gap)),
    quality: projection.descriptorExtent.quality === 'exact' ? 'exact' : 'unknown',
  });
}

/**
 * Samples retained rows and the logical end boundary from one sparse index.
 *
 * The returned snapshot allocates only for the supplied retained cards. It can safely outlive the
 * mutable index and is revision-consistent for one synchronous projection pass.
 *
 * @example
 * ```ts
 * const projection = createKanbanVerticalHeightProjection({
 *   index: heights,
 *   cards: [{ cardKey: 'A-42', logicalIndex: 42 }],
 * });
 * ```
 */
export function createKanbanVerticalHeightProjection(
  options: CreateKanbanVerticalHeightProjectionOptions,
): KanbanVerticalHeightProjection {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new KanbanInvalidGeometryError();
  }
  const index = ownValue(options, 'index');
  const rawCards = ownValue(options, 'cards');
  if (!(index instanceof KanbanSparseHeightIndex) || !Array.isArray(rawCards)) {
    throw new KanbanInvalidGeometryError();
  }
  const count = cellCount(ownValue(rawCards, 'length'));
  if (count > KANBAN_LIMITS.ensureRangeCards.absolute) throw new KanbanInvalidGeometryError();
  const before = index.snapshot();
  const rows: KanbanVerticalHeightProjectionRow[] = [];
  let previousIndex = -1;
  const keys = new Set<CardKey>();
  for (let position = 0; position < count; position += 1) {
    if (!Object.prototype.hasOwnProperty.call(rawCards, position)) throw new KanbanInvalidGeometryError();
    const rawCard = ownValue(rawCards, String(position));
    if (typeof rawCard !== 'object' || rawCard === null || Array.isArray(rawCard)) {
      throw new KanbanInvalidGeometryError();
    }
    const rawCardKey = ownValue(rawCard, 'cardKey');
    if (typeof rawCardKey !== 'string' && typeof rawCardKey !== 'number') throw new KanbanInvalidGeometryError();
    let cardKey: CardKey;
    try {
      cardKey = createKanbanCardKey(rawCardKey);
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    const logicalIndex = cellCount(ownValue(rawCard, 'logicalIndex'));
    if (logicalIndex >= before.logicalLength || logicalIndex <= previousIndex || keys.has(cardKey)) {
      throw new KanbanInvalidGeometryError();
    }
    rows.push(Object.freeze({ cardKey, logicalIndex, descriptorRow: index.rowAt(logicalIndex) }));
    keys.add(cardKey);
    previousIndex = logicalIndex;
  }
  const descriptorExtent = index.rowAt(before.logicalLength);
  const after = index.snapshot();
  if (
    before.logicalLength !== after.logicalLength ||
    before.revisions.source !== after.revisions.source ||
    before.revisions.cursor !== after.revisions.cursor ||
    before.revisions.presentation !== after.revisions.presentation
  ) {
    throw new KanbanInvalidGeometryError();
  }
  return Object.freeze({
    logicalLength: before.logicalLength,
    rows: Object.freeze(rows),
    descriptorExtent,
    revisions: Object.freeze({ ...before.revisions }),
  });
}

/**
 * Adds density-owned global resting gaps to a detached sparse descriptor extent.
 *
 * Estimates remain `unknown`: an estimate is not silently promoted to a proven lower bound.
 *
 * @example
 * ```ts
 * const extent = resolveKanbanVerticalProjectionExtent(projection, 'comfortable');
 * ```
 */
export function resolveKanbanVerticalProjectionExtent(
  projection: KanbanVerticalHeightProjection,
  density: KanbanCardDensity,
): KanbanVerticalProjectionExtent {
  return projectionExtent(snapshotKanbanVerticalHeightProjection(projection), densityGap(density));
}

/**
 * Resolves sparse vertical extent with an already validated presentation gap.
 *
 * This variant lets mounted custom presentation policies use their exact gap instead of being
 * approximated by a named density preset.
 *
 * @example
 * ```ts
 * const extent = resolveKanbanVerticalProjectionExtentWithGap(projection, 2);
 * ```
 */
export function resolveKanbanVerticalProjectionExtentWithGap(
  projection: KanbanVerticalHeightProjection,
  cardGap: number,
): KanbanVerticalProjectionExtent {
  return projectionExtent(snapshotKanbanVerticalHeightProjection(projection), cellCount(cardGap));
}

/**
 * Projects sticky headers and a bounded source-ordered card stack into exact terminal cells.
 *
 * Returned regions are clipped to the assigned rectangle. Resting gaps are full-width and never
 * actionable; optional insertion geometry is inspection-only and does not consume a resting row.
 */
export function projectKanbanVerticalGeometry(options: ProjectKanbanVerticalGeometryOptions): KanbanVerticalGeometry {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new KanbanInvalidGeometryError();
  }
  const bounds = snapshotRect(ownValue(options, 'bounds'));
  const stickyHeaderHeight = cellCount(ownValue(options, 'stickyHeaderHeight'));
  const swimlaneHeaderHeight = cellCount(ownValue(options, 'swimlaneHeaderHeight') ?? 0);
  const requestedOffset = cellCount(ownValue(options, 'scrollOffset'));
  const contentOrigin = cellCount(ownValue(options, 'contentOrigin') ?? 0);
  const rawHeightProjection = ownValue(options, 'heightProjection');
  const heightProjection =
    rawHeightProjection === undefined ? undefined : snapshotKanbanVerticalHeightProjection(rawHeightProjection);
  if (heightProjection !== undefined && contentOrigin !== 0) throw new KanbanInvalidGeometryError();
  const gap = densityGap(ownValue(options, 'density'));
  const verticalOverscan = cellCount(ownValue(options, 'verticalOverscan'));
  if (verticalOverscan > KANBAN_LIMITS.verticalOverscan.absolute) throw new KanbanInvalidGeometryError();
  const projectInsertionGutters = ownValue(options, 'projectInsertionGutters') ?? false;
  if (typeof projectInsertionGutters !== 'boolean') throw new KanbanInvalidGeometryError();
  const rawCards = ownValue(options, 'cards');
  if (!Array.isArray(rawCards)) throw new KanbanInvalidGeometryError();
  const rawLength = cellCount(ownValue(rawCards, 'length'));
  if (rawLength > KANBAN_LIMITS.ensureRangeCards.absolute) throw new KanbanInvalidGeometryError();

  const cards: KanbanVerticalCardInput[] = [];
  for (let index = 0; index < rawLength; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(rawCards, index)) throw new KanbanInvalidGeometryError();
    cards.push(snapshotCard(ownValue(rawCards, String(index))));
  }

  const chromeHeight = addCells(stickyHeaderHeight, swimlaneHeaderHeight);
  let cardContentHeight = contentOrigin;
  let extentQuality: KanbanVerticalGeometry['extentQuality'] = 'exact';
  const anchors: KanbanVerticalCardAnchor[] = [];
  if (heightProjection === undefined) {
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      if (card === undefined) throw new KanbanInvalidGeometryError();
      anchors.push(Object.freeze({ cardKey: card.cardKey, logicalRow: cardContentHeight, height: card.height }));
      cardContentHeight = addCells(cardContentHeight, card.height);
      if (index < cards.length - 1) cardContentHeight = addCells(cardContentHeight, gap);
    }
  } else {
    if (heightProjection.rows.length !== cards.length) throw new KanbanInvalidGeometryError();
    const extent = projectionExtent(heightProjection, gap);
    cardContentHeight = extent.value;
    extentQuality = extent.quality;
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const row = heightProjection.rows[index];
      if (
        card === undefined ||
        row === undefined ||
        card.logicalIndex === undefined ||
        card.cardKey !== row.cardKey ||
        card.logicalIndex !== row.logicalIndex
      ) {
        throw new KanbanInvalidGeometryError();
      }
      const logicalRow = saturatedAddCells(row.descriptorRow.value, saturatedMultiplyCells(row.logicalIndex, gap));
      anchors.push(
        Object.freeze({
          cardKey: card.cardKey,
          logicalRow,
          height: card.height,
          logicalIndex: row.logicalIndex,
          quality: row.descriptorRow.quality,
        }),
      );
      cardContentHeight = Math.max(cardContentHeight, saturatedAddCells(logicalRow, card.height));
    }
  }
  const cardViewportHeight = Math.max(0, bounds.height - chromeHeight);
  const scrollExtent = Math.max(0, cardContentHeight - cardViewportHeight);
  const scrollOffset = Math.min(requestedOffset, scrollExtent);
  const cardClip: Readonly<Rect> = Object.freeze({
    x: bounds.x,
    y: addCells(bounds.y, chromeHeight),
    width: bounds.width,
    height: cardViewportHeight,
  });
  const regions: KanbanLayoutRegion[] = [];

  if (stickyHeaderHeight > 0) {
    const header = clipRegion(
      {
        kind: 'workflow-header',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: stickyHeaderHeight,
        actionable: false,
      },
      bounds,
    );
    if (header !== undefined) regions.push(header);
  }
  if (swimlaneHeaderHeight > 0) {
    const header = clipRegion(
      {
        kind: 'swimlane-header',
        x: bounds.x,
        y: addCells(bounds.y, stickyHeaderHeight),
        width: bounds.width,
        height: swimlaneHeaderHeight,
        actionable: false,
      },
      bounds,
    );
    if (header !== undefined) regions.push(header);
  }
  if (projectInsertionGutters && cardViewportHeight > 0) {
    regions.push(
      Object.freeze({
        kind: 'insertion-gutter',
        x: cardClip.x,
        y: cardClip.y,
        width: cardClip.width,
        height: 1,
        actionable: false,
      }),
    );
  }

  let retainedStart = cards.length;
  let retainedEnd = 0;
  const retainedTop = Math.max(0, scrollOffset - verticalOverscan);
  const retainedBottom = saturatedAddCells(saturatedAddCells(scrollOffset, cardViewportHeight), verticalOverscan);
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const anchor = anchors[index];
    if (card === undefined || anchor === undefined) throw new KanbanInvalidGeometryError();
    const logicalBottom = saturatedAddCells(anchor.logicalRow, card.height);
    if (logicalBottom > retainedTop && anchor.logicalRow < retainedBottom) {
      retainedStart = Math.min(retainedStart, index);
      retainedEnd = index + 1;
    }
    const cardRegion = clipRegion(
      {
        kind: 'card',
        cardKey: card.cardKey,
        x: cardClip.x,
        y: projectedViewportRow(cardClip.y, anchor.logicalRow, scrollOffset),
        width: cardClip.width,
        height: card.height,
        actionable: false,
      },
      cardClip,
    );
    if (cardRegion !== undefined) regions.push(cardRegion);
    const ownsFollowingGap =
      gap > 0 &&
      (heightProjection === undefined
        ? index < cards.length - 1
        : anchor.logicalIndex !== undefined && anchor.logicalIndex < heightProjection.logicalLength - 1);
    if (ownsFollowingGap) {
      const gapRegion = clipRegion(
        {
          kind: 'card-gap',
          x: cardClip.x,
          y: projectedViewportRow(cardClip.y, logicalBottom, scrollOffset),
          width: cardClip.width,
          height: gap,
          actionable: false,
        },
        cardClip,
      );
      if (gapRegion !== undefined) regions.push(gapRegion);
    }
  }
  if (retainedEnd === 0) retainedStart = 0;

  return Object.freeze({
    regions: Object.freeze(regions),
    actionTargets: Object.freeze([]),
    contentHeight: saturatedAddCells(chromeHeight, cardContentHeight),
    extentQuality,
    scrollExtent,
    scrollOffset,
    retainedStart,
    retainedEnd,
    anchors: Object.freeze(anchors),
  });
}

/** Clips sanitized text without splitting a wide terminal glyph. */
function clipMessage(text: string, width: number): string {
  let result = '';
  let cells = 0;
  const safe = sanitize(sanitizeContractText(text, KANBAN_LIMITS.semanticStringBytes.safe))
    .replace(/[\t\n]+/gu, ' ')
    .replace(/[\u202a-\u202e\u2066-\u2069]/gu, '');
  for (const glyph of safe) {
    const glyphCells = charWidth(glyph.codePointAt(0) ?? 0, 'wcwidth');
    if (glyphCells === 0) {
      if (result.length > 0) result += glyph;
      continue;
    }
    if (cells + glyphCells > width) break;
    result += glyph;
    cells += glyphCells;
  }
  return result.length > 0 || width === 0 ? result : '?';
}

/**
 * Produces one atomic bounded minimum-size state with no partial inspection or action targets.
 */
export function projectKanbanMinimumGeometry(options: ProjectKanbanMinimumGeometryOptions): KanbanMinimumGeometry {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new KanbanInvalidGeometryError();
  }
  const bounds = snapshotRect(ownValue(options, 'bounds'));
  const requiredWidth = cellCount(ownValue(options, 'requiredWidth'));
  const requiredHeight = cellCount(ownValue(options, 'requiredHeight'));
  const rawMessage = ownValue(options, 'message');
  if (typeof rawMessage !== 'string') throw new KanbanInvalidGeometryError();
  const text = clipMessage(rawMessage, bounds.width);
  let width = 0;
  for (const glyph of text) width += charWidth(glyph.codePointAt(0) ?? 0, 'wcwidth');
  return Object.freeze({
    kind: 'minimum-size',
    bounds,
    required: Object.freeze({ width: requiredWidth, height: requiredHeight }),
    message: Object.freeze({ text, width, height: bounds.height > 0 && text.length > 0 ? 1 : 0 }),
    inspectionRegions: Object.freeze([]),
    actionTargets: Object.freeze([]),
  });
}
