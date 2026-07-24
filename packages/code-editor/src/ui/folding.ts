import type { CodeEditorController } from '../controller.js';
import type { CodeEditorDocumentModel } from '../document/model.js';

/** A validated structural region expressed as inclusive logical line numbers. */
export interface CodeEditorFoldRegion {
  readonly from: number;
  readonly to: number;
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
  readonly #topLevelCollapsed: readonly CodeEditorFoldRegion[];
  readonly #collapsedByHeader: ReadonlyMap<number, CodeEditorFoldRegion>;
  readonly #foldableByHeader: ReadonlyMap<number, CodeEditorFoldRegion>;

  /** Builds a bounded row map from the controller's current, revision-safe collapsed regions. */
  public constructor(controller: CodeEditorController) {
    const collapsed = [...controller.folds].sort((left, right) => left.from - right.from || right.to - left.to);
    this.#collapsedByHeader = new Map(collapsed.map((region) => [region.from, region]));
    this.#foldableByHeader = new Map(controller.foldableRegions.map((region) => [region.from, region]));
    this.#lineCount = controller.document.snapshot.lineCount;
    this.#document = controller.document;
    const topLevel: CodeEditorFoldRegion[] = [];
    for (const region of collapsed) {
      const parent = topLevel.at(-1);
      if (parent === undefined || region.from > parent.to) topLevel.push(region);
    }
    this.#topLevelCollapsed = Object.freeze(topLevel);
  }

  /** Number of terminal rows needed to display the current folded document. */
  public get count(): number {
    return this.#lineCount - this.#topLevelCollapsed.reduce((hidden, region) => hidden + region.to - region.from, 0);
  }

  /** Maximum visual width among rows that remain reachable through the folded viewport. */
  public get maximumVisualColumn(): number {
    if (this.#topLevelCollapsed.length === 0) return this.#document.maximumVisualColumn;
    let maximum = 0;
    for (let row = 0; row < this.count; row += 1) {
      const line = this.#document.snapshot.line(this.logicalLineAt(row));
      maximum = Math.max(maximum, this.#document.visualColumnAt(Number(line.to)));
    }
    return maximum;
  }

  /** Returns the logical source line at a visible row, clamped to the document. */
  public logicalLineAt(visibleRow: number): number {
    const row = clampInteger(visibleRow, 0, Math.max(0, this.count - 1));
    let logical = row;
    let hiddenBefore = 0;
    for (const region of this.#topLevelCollapsed) {
      const visibleHeader = region.from - hiddenBefore;
      if (row <= visibleHeader) break;
      const hidden = region.to - region.from;
      logical += hidden;
      hiddenBefore += hidden;
    }
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
    let hiddenBefore = 0;
    for (const region of this.#topLevelCollapsed) {
      if (line <= region.from) break;
      if (line <= region.to) return region.from - hiddenBefore;
      hiddenBefore += region.to - region.from;
    }
    return line - hiddenBefore;
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
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const finite = Number.isFinite(value) ? Math.trunc(value) : minimum;
  return Math.max(minimum, Math.min(finite, maximum));
}

/** Creates the canonical folded-row mapping for one controller snapshot. */
export function codeEditorVisibleRows(controller: CodeEditorController): CodeEditorVisibleRows {
  return new CodeEditorVisibleRows(controller);
}
