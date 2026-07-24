import { signal, type Point, type Signal } from '@jsvision/ui';

import type { CodeEditorDocumentModel } from '../document/model.js';
import type { CodeEditorFrame } from './projection.js';

/** Immutable public snapshot of editor viewport geometry and scroll limits. */
export interface CodeEditorViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly gutterWidth: number;
  readonly textWidth: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly maxScrollX: number;
  readonly maxScrollY: number;
}

/**
 * Owns the editor's terminal viewport offsets, limits, and document-coordinate conversion.
 *
 * Scrollbars remain passive views bound to `x` and `y`. This controller clamps all writes against
 * the current document and viewport, while caret tracking is opt-in so a manual scroll may leave
 * the caret off-screen until the next editing or navigation action.
 */
export class CodeEditorViewport {
  public readonly x: Signal<number> = signal(0);
  public readonly y: Signal<number> = signal(0);
  readonly #maxX: Signal<number> = signal(0);
  readonly #maxY: Signal<number> = signal(0);
  readonly #document: CodeEditorDocumentModel;
  #width = 0;
  #height = 0;
  #gutterWidth = 0;

  /** @param document Document whose line and caret geometry this viewport presents. */
  public constructor(document: CodeEditorDocumentModel) {
    this.#document = document;
  }

  /** Returns a reactive immutable snapshot used by window chrome and host inspection. */
  public get metrics(): CodeEditorViewportMetrics {
    return Object.freeze({
      width: this.#width,
      height: this.#height,
      gutterWidth: this.#gutterWidth,
      textWidth: this.textWidth,
      scrollX: this.x(),
      scrollY: this.y(),
      maxScrollX: this.#maxX(),
      maxScrollY: this.#maxY(),
    });
  }

  /** Returns the source-text width after the fixed line-number gutter. */
  public get textWidth(): number {
    return Math.max(0, this.#width - this.#gutterWidth);
  }

  /**
   * Applies new terminal dimensions and re-fits the caret when the usable viewport changed.
   *
   * @returns `true` when width, height, or gutter width changed.
   */
  public resize(width: number, height: number, gutterWidth: number): boolean {
    const changed = width !== this.#width || height !== this.#height || gutterWidth !== this.#gutterWidth;
    this.#width = width;
    this.#height = height;
    this.#gutterWidth = gutterWidth;
    this.synchronize(changed);
    return changed;
  }

  /**
   * Recomputes scroll limits, clamps external writes, and optionally reveals the active caret.
   */
  public synchronize(followCaret: boolean): void {
    const textWidth = this.textWidth;
    const maximumX =
      textWidth <= 0
        ? 0
        : Math.max(
            0,
            this.#document.maximumVisualColumn - textWidth + (this.#document.maximumVisualColumn > 0 ? 1 : 0),
          );
    const maximumY = Math.max(0, this.#document.snapshot.lineCount - this.#height);
    this.#maxX.set(maximumX);
    this.#maxY.set(maximumY);
    if (followCaret && this.#width > 0 && this.#height > 0) this.#revealCaret();
    this.#setClamped(this.x(), this.y());
  }

  /** Scrolls the matching axis by a signed number of terminal cells. */
  public scrollBy(dx: number, dy: number): void {
    this.#setClamped(this.x() + dx, this.y() + dy);
  }

  /**
   * Maps a local editor cell to a validated document offset.
   *
   * The latest projected frame is the primary mapping because it already accounts for tabs, wide
   * glyph continuations, sanitization, the fixed gutter, and both scroll axes. Cells past the end
   * of a line resolve to that line's end; gutter cells resolve to its start. During edge dragging,
   * coordinates outside the frame use a bounded visual-column fallback.
   */
  public documentOffsetAt(local: Point, frame: CodeEditorFrame | undefined): number {
    const snapshot = this.#document.snapshot;
    const localRow = clamp(local.y, 0, Math.max(0, this.#height - 1));
    const row = clamp(this.y() + localRow, 0, snapshot.lineCount - 1);
    const line = snapshot.line(row);
    if (local.x >= 0 && local.x < this.#gutterWidth) return Number(line.from);
    if (local.y >= 0 && local.y < this.#height && local.x >= 0 && local.x < this.#width) {
      const mapped = frame?.cells[local.y]?.[local.x]?.documentOffset;
      if (mapped !== undefined) return mapped;
    }
    const textColumn = clamp(local.x - this.#gutterWidth, 0, Math.max(0, this.textWidth - 1));
    const visualColumn = Math.max(0, this.x() + textColumn);
    return this.#document.offsetAtVisualColumn(row, visualColumn);
  }

  #revealCaret(): void {
    const snapshot = this.#document.snapshot;
    const head = Number(this.#document.selection.head);
    const line = snapshot.lineAt(head);
    const visual = this.#document.visualColumnAt(head);
    let nextX = this.x();
    let nextY = this.y();
    if (visual < nextX) nextX = visual;
    else if (this.textWidth > 0 && visual >= nextX + this.textWidth) nextX = visual - this.textWidth + 1;
    const lineNumber = Number(line.number);
    if (lineNumber < nextY) nextY = lineNumber;
    else if (lineNumber >= nextY + this.#height) nextY = lineNumber - this.#height + 1;
    this.#setClamped(nextX, nextY);
  }

  #setClamped(x: number, y: number): void {
    this.x.set(clampInteger(x, 0, this.#maxX()));
    this.y.set(clampInteger(y, 0, this.#maxY()));
  }
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const finite = Number.isFinite(value) ? Math.trunc(value) : 0;
  return clamp(finite, minimum, maximum);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
