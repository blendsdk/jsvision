import type { DispatchEvent, View } from '@jsvision/ui';
import type { CodeEditorDocumentModel } from '../document/model.js';
import { sourceRunRange } from './editing-operations.js';
import type { CodeEditorFrame } from './projection.js';
import type { CodeEditorViewport } from './viewport.js';

/**
 * Owns one editor's pointer-capture and drag-selection lifecycle.
 *
 * The helper deliberately receives the current projected frame for exact cell-to-offset mapping.
 * During edge auto-scroll that frame is stale, so mapping falls back to document geometry.
 */
export class CodeEditorMouseSelection {
  #dragAnchor: number | undefined;

  public constructor(
    private readonly owner: View,
    private readonly document: CodeEditorDocumentModel,
    private readonly viewport: CodeEditorViewport,
    private readonly selectionChanged: () => void,
  ) {}

  /** Routes one mouse envelope and returns whether the editor consumed it. */
  public route(event: DispatchEvent, frame: CodeEditorFrame | undefined): boolean {
    if (event.event.type !== 'mouse' || event.local === undefined) return false;
    const local = event.local;

    if (event.event.kind === 'down') {
      if (event.event.button !== 0) return false;
      event.focusView?.(this.owner);
      event.setCapture?.(this.owner);
      const offset = this.viewport.documentOffsetAt(local, frame);
      const range = event.clickCount === 2 ? sourceRunRange(this.document.text, offset) : { from: offset, to: offset };
      this.#dragAnchor = range.from;
      this.document.setSelection({ anchor: range.from, head: range.to });
      this.selectionChanged();
      return true;
    }

    if (event.event.kind === 'drag' || event.event.kind === 'move') {
      if (this.#dragAnchor === undefined) return false;
      if (event.hasCapture !== undefined && !event.hasCapture(this.owner)) {
        this.#dragAnchor = undefined;
        return false;
      }
      const metrics = this.viewport.metrics;
      const dx = local.x < 0 ? -1 : local.x >= metrics.width ? 1 : 0;
      const dy = local.y < 0 ? -1 : local.y >= metrics.height ? 1 : 0;
      this.viewport.scrollBy(dx, dy);
      const offset = this.viewport.documentOffsetAt(local, dx === 0 && dy === 0 ? frame : undefined);
      this.document.setSelection({ anchor: this.#dragAnchor, head: offset });
      this.selectionChanged();
      return true;
    }

    if (event.event.kind !== 'up' || this.#dragAnchor === undefined) return false;
    this.#dragAnchor = undefined;
    event.releaseCapture?.();
    return true;
  }
}
