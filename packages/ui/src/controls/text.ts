/**
 * A non-focusable block of static text — a caption, paragraph, or a live read-out of some state.
 * Tab skips it. Content is word-wrapped to the view's width and left-aligned.
 *
 * Give it a plain string, or a getter (`() => string`) to make it reactive: when a signal the getter
 * reads changes, the text repaints automatically.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { stringWidth, wrapText } from './measure.js';

/**
 * A semantic severity for a {@link Text} — selects a danger/warning colour in place of the default
 * static-text role. `'error'` paints danger-red, `'warning'` amber.
 */
export type TextSeverity = 'error' | 'warning';

/** Construction options for a {@link Text}. */
export interface TextOptions {
  /**
   * Paint the text in a semantic severity colour instead of the default static-text role:
   * `'error'` → danger-red, `'warning'` → amber. Omit for the normal static-text colour.
   */
  readonly severity?: TextSeverity;
}

/**
 * A static, non-focusable text view. Paints word-wrapped, left-aligned text; give it a getter for a
 * value that updates itself reactively.
 *
 * Note: like every view, `Text` only occupies the bounds its parent lays out for it — give it a
 * width and height in your container so it has room to draw.
 *
 * @example
 * import { Group, Text, signal } from '@jsvision/ui';
 *
 * const count = signal(0);
 * const panel = new Group();
 *
 * // A fixed caption.
 * const caption = new Text('Press + to increment.');
 * caption.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 30, height: 1 } };
 * panel.add(caption);
 *
 * // A live read-out that repaints whenever `count` changes.
 * const readout = new Text(() => `Count: ${count()}`);
 * readout.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 30, height: 1 } };
 * panel.add(readout);
 *
 * // A validation error, painted danger-red via the severity option.
 * const error = new Text('Email is required.', { severity: 'error' });
 * error.layout = { position: 'absolute', rect: { x: 1, y: 2, width: 30, height: 1 } };
 * panel.add(error);
 */
export class Text extends View {
  /** The literal text, or a reactive getter that repaints the view when its signals change. */
  protected readonly content: string | (() => string);

  /** The severity colour override (`'error'`/`'warning'`), or undefined for the static-text role. */
  protected readonly severity?: TextSeverity;

  /**
   * @param content A literal string, or a getter (`() => string`) that repaints `Text` on change.
   * @param opts    Optional settings — `severity` recolours the text (`'error'`/`'warning'`).
   */
  constructor(content: string | (() => string), opts?: TextOptions) {
    super();
    this.content = content;
    this.severity = opts?.severity;
    if (typeof content === 'function') {
      // Subscribe on mount, not in the constructor: the reactive scope that owns this view's
      // subscriptions only exists once the view is mounted into a live tree.
      this.onMount(() => this.bind(content));
    }
  }

  /**
   * Paint the (resolved) content word-wrapped to the view width; rows beyond the view height are
   * clipped.
   *
   * @param ctx The clipped, view-local paint context.
   */
  /**
   * The content's natural display size: the widest line's display width by its line count. A flex/flow
   * layout uses it to self-size the text (e.g. a status bar or a data-grid footer widget row); an
   * absolute layout sets an explicit rect and ignores it. The reactive getter (if any) is evaluated.
   *
   * @returns The natural `{ width, height }` in terminal cells.
   */
  override measure(): Size2D {
    const content = typeof this.content === 'function' ? this.content() : this.content;
    const lines = content.split('\n');
    let width = 0;
    for (const line of lines) width = Math.max(width, stringWidth(line));
    return { width, height: Math.max(1, lines.length) };
  }

  override draw(ctx: DrawContext): void {
    const content = typeof this.content === 'function' ? this.content() : this.content;
    // Map the semantic severity to its theme role; unset falls back to the plain static-text colour.
    const role = this.severity === 'error' ? 'dangerText' : this.severity === 'warning' ? 'warningText' : 'staticText';
    const style = ctx.color(role);
    const { width, height } = ctx.size;
    ctx.fillRect(0, 0, width, height, ' ', style); // clear the whole field first
    const lines = wrapText(content, width);
    for (let y = 0; y < height && y < lines.length; y += 1) {
      const line = lines[y];
      if (line !== undefined && line !== '') ctx.text(0, y, line, style);
    }
  }
}
