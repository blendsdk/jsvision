/**
 * The `line:col` status strip shown in an editor window's bottom border. See {@link Indicator}.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { IndicatorTarget } from './editor.js';

/** Find the nearest ancestor window's reactive "dragging" signal, if any. */
function findDragSignal(v: View): Signal<boolean> | null {
  let cur = v.parent;
  while (cur !== null) {
    const candidate = (cur as unknown as { dragging?: unknown }).dragging;
    if (typeof candidate === 'function') return candidate as Signal<boolean>;
    cur = cur.parent;
  }
  return null;
}

/**
 * The `line:col` status strip shown in an editor window's bottom border.
 *
 * It displays the caret's 1-based line and column (the colon is aligned to a fixed column) and a
 * `*` marker when the document has unsaved changes. It fills with a double line while resting and a
 * single line while the window is being dragged. `EditWindow` creates and positions one for you;
 * the editor pushes it fresh values via {@link setValue}. It is passive — it never takes focus.
 *
 * @example
 * import { Group, Editor, Indicator } from '@jsvision/ui';
 *
 * const editor = new Editor();
 * const indicator = new Indicator();
 * // Give the editor the indicator so it pushes the caret position/modified flag as you edit.
 * editor.attachGadgets(undefined, undefined, indicator);
 *
 * const root = new Group();
 * root.layout = { direction: 'col' };
 * editor.layout = { size: { kind: 'fr', weight: 1 } };
 * indicator.layout = { size: { kind: 'fixed', cells: 1 } };
 * root.add(editor);
 * root.add(indicator);
 */
export class Indicator extends View implements IndicatorTarget {
  override focusable = false;

  /** @internal The 1-based caret position to display. */
  protected readonly pos = signal({ line: 1, col: 1 });
  /** @internal The modified flag to display. */
  protected readonly modified = signal(false);
  /** @internal The ancestor window's drag signal, or `null` when there is no window ancestor. */
  protected drag: Signal<boolean> | null = null;

  constructor() {
    super();
    this.onMount(() => {
      this.drag = findDragSignal(this);
      // Repaint whenever the position, modified flag, or drag state changes (draw() is not auto-tracked).
      this.bind(() => [this.pos(), this.modified(), this.drag?.() ?? false] as const);
    });
  }

  /** Update the displayed caret position (1-based) and modified flag; the editor calls this after each edit. */
  setValue(pos: { line: number; col: number }, modified: boolean): void {
    this.pos.set({ line: pos.line, col: pos.col });
    this.modified.set(modified);
  }

  /** Paint the strip: the line fill, an optional `*` modified marker, and the aligned `line:col`. */
  override draw(ctx: DrawContext): void {
    const dragging = this.drag?.() ?? false;
    const style = ctx.color(dragging ? 'indicatorDragging' : 'indicatorNormal');
    const fill = dragging ? '─' : '═'; // a single line while the window is dragged, a double line at rest
    ctx.fill(fill, style);
    // A `*` marks unsaved changes. (The original used a sun glyph here, but its ambiguous display
    // width can leave a hole in the border on many fonts, so a plain narrow `*` is used instead.)
    if (this.modified()) ctx.text(0, 0, '*', style);
    const { line, col } = this.pos();
    const text = ` ${line}:${col} `;
    const colonIndex = text.indexOf(':');
    ctx.text(8 - colonIndex, 0, text, style); // right-align so the colon sits at a fixed column
  }
}
