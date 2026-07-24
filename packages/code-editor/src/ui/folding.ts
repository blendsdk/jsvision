import type { CodeEditorController } from '../controller.js';
import type { CodeEditorDocumentModel } from '../document/model.js';

/** A validated structural region expressed as inclusive logical line numbers. */
export interface CodeEditorFoldRegion {
  readonly from: number;
  readonly to: number;
}

interface IndexedCollapsedRegion extends CodeEditorFoldRegion {
  readonly hiddenBefore: number;
  readonly hiddenAfter: number;
  readonly visibleHeader: number;
}

/**
 * Immutable mapping between source lines and the rows that remain visible after folding.
 *
 * Collapsed headers stay visible and their interior rows disappear. Every viewport consumer uses
 * this mapping so a hidden line cannot remain reachable through a different coordinate path.
 */
export class CodeEditorVisibleRows {
  readonly #lineCount: number;
  readonly #document: CodeEditorDocumentModel;
  readonly #topLevelCollapsed: readonly IndexedCollapsedRegion[];
  readonly #collapsedByHeader: ReadonlyMap<number, CodeEditorFoldRegion>;
  readonly #foldableByHeader: ReadonlyMap<number, CodeEditorFoldRegion>;
  #maximumVisualColumn: number | undefined;

  /** Builds a bounded row map from the controller's current, revision-safe collapsed regions. */
  public constructor(controller: CodeEditorController) {
    const collapsed = [...controller.folds].sort((left, right) => left.from - right.from || right.to - left.to);
    this.#collapsedByHeader = new Map(collapsed.map((region) => [region.from, region]));
    this.#foldableByHeader = new Map(controller.foldableRegions.map((region) => [region.from, region]));
    this.#lineCount = controller.document.snapshot.lineCount;
    this.#document = controller.document;
    const topLevel: IndexedCollapsedRegion[] = [];
    let hiddenBefore = 0;
    for (const region of collapsed) {
      const parent = topLevel.at(-1);
      if (parent !== undefined && region.from <= parent.to) continue;
      const hidden = region.to - region.from;
      topLevel.push(
        Object.freeze({
          ...region,
          hiddenBefore,
          hiddenAfter: hiddenBefore + hidden,
          visibleHeader: region.from - hiddenBefore,
        }),
      );
      hiddenBefore += hidden;
    }
    this.#topLevelCollapsed = Object.freeze(topLevel);
  }

  /** Number of terminal rows needed to display the current folded document. */
  public get count(): number {
    return this.#lineCount - (this.#topLevelCollapsed.at(-1)?.hiddenAfter ?? 0);
  }

  /** Maximum visual width among rows that remain reachable through the folded viewport. */
  public get maximumVisualColumn(): number {
    if (this.#topLevelCollapsed.length === 0) return this.#document.maximumVisualColumn;
    if (this.#maximumVisualColumn !== undefined) return this.#maximumVisualColumn;
    let maximum = 0;
    let nextVisibleLine = 0;
    for (const region of this.#topLevelCollapsed) {
      maximum = Math.max(maximum, this.#maximumWidthBetween(nextVisibleLine, region.from + 1));
      nextVisibleLine = region.to + 1;
    }
    maximum = Math.max(maximum, this.#maximumWidthBetween(nextVisibleLine, this.#lineCount));
    this.#maximumVisualColumn = maximum;
    return this.#maximumVisualColumn;
  }

  /** Returns the logical source line at a visible row, clamped to the document. */
  public logicalLineAt(visibleRow: number): number {
    const row = clampInteger(visibleRow, 0, Math.max(0, this.count - 1));
    const preceding = lastMatching(this.#topLevelCollapsed, (region) => region.visibleHeader < row);
    const logical = row + (preceding?.hiddenAfter ?? 0);
    return Math.min(logical, Math.max(0, this.#lineCount - 1));
  }

  /**
   * Returns the visible row for a logical source line.
   *
   * A hidden line resolves to its nearest visible fold header. This keeps stale host selections
   * safe until the controller can relocate them after fresh language analysis.
   */
  public visibleRowAt(logicalLine: number): number {
    const line = clampInteger(logicalLine, 0, Math.max(0, this.#lineCount - 1));
    const preceding = lastMatching(this.#topLevelCollapsed, (region) => region.from < line);
    if (preceding === undefined) return line;
    if (line <= preceding.to) return preceding.visibleHeader;
    return line - preceding.hiddenAfter;
  }

  /** Returns the next visible logical line in one vertical direction. */
  public adjacentLogicalLine(logicalLine: number, delta: -1 | 1): number {
    const current = this.visibleRowAt(logicalLine);
    return this.logicalLineAt(current + delta);
  }

  /** Returns the collapsed region whose header occupies the logical line, if any. */
  public collapsedAt(logicalLine: number): CodeEditorFoldRegion | undefined {
    return this.#collapsedByHeader.get(logicalLine);
  }

  /** Returns the validated foldable region whose header occupies the logical line, if any. */
  public foldableAt(logicalLine: number): CodeEditorFoldRegion | undefined {
    return this.#foldableByHeader.get(logicalLine);
  }

  #maximumWidthBetween(from: number, to: number): number {
    let maximum = 0;
    for (let lineNumber = from; lineNumber < to; lineNumber += 1) {
      const line = this.#document.snapshot.line(lineNumber);
      maximum = Math.max(maximum, this.#document.visualColumnAt(Number(line.to)));
    }
    return maximum;
  }
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const finite = Number.isFinite(value) ? Math.trunc(value) : minimum;
  return Math.max(minimum, Math.min(finite, maximum));
}

const visibleRowsCache = new WeakMap<
  CodeEditorController,
  {
    readonly documentRevision: number;
    readonly foldableRegions: readonly CodeEditorFoldRegion[];
    readonly collapsedRegions: readonly CodeEditorFoldRegion[];
    readonly rows: CodeEditorVisibleRows;
  }
>();

/**
 * Returns the canonical folded-row mapping for one controller snapshot.
 *
 * The stable controller arrays make this cache allocation-free during repeated projection,
 * navigation, mouse mapping, and viewport synchronization.
 */
export function codeEditorVisibleRows(controller: CodeEditorController): CodeEditorVisibleRows {
  const documentRevision = Number(controller.document.identity.revision);
  const foldableRegions = controller.foldableRegions;
  const collapsedRegions = controller.folds;
  const cached = visibleRowsCache.get(controller);
  if (
    cached !== undefined &&
    cached.documentRevision === documentRevision &&
    cached.foldableRegions === foldableRegions &&
    cached.collapsedRegions === collapsedRegions
  )
    return cached.rows;
  const rows = new CodeEditorVisibleRows(controller);
  visibleRowsCache.set(controller, { documentRevision, foldableRegions, collapsedRegions, rows });
  return rows;
}

function lastMatching<T>(values: readonly T[], predicate: (value: T) => boolean): T | undefined {
  let low = 0;
  let high = values.length - 1;
  let match: T | undefined;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const value = values[middle];
    if (value !== undefined && predicate(value)) {
      match = value;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match;
}
