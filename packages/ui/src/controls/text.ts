/**
 * A non-focusable block of static text — a caption, paragraph, or a live read-out of some state.
 * Tab skips it. Content is word-wrapped to the view's width and left-aligned.
 *
 * Give it a plain string, or a getter (`() => string`) to make it reactive: when a signal the getter
 * reads changes, the text repaints automatically.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import { glyphWidth } from './measure.js';

/**
 * Word-wrap `content` to `width` display columns. Each output line is a verbatim slice of the
 * source, so whitespace *between* words and leading indentation are preserved, not collapsed. The
 * wrap breaks after the last whole word that fits; a single word wider than the view is hard-broken
 * at the width boundary; the spaces at a break are dropped from the start of the next line. An
 * explicit `\n` always forces a line break.
 *
 * @param content The text to wrap.
 * @param width   The view width in display columns.
 * @returns The wrapped lines (at least one, possibly empty, per source paragraph).
 */
function wrapText(content: string, width: number): string[] {
  const lines: string[] = [];
  if (width <= 0) return lines;
  for (const paragraph of content.split('\n')) {
    const n = paragraph.length;
    if (n === 0) {
      lines.push(''); // a blank source line stays a blank output line
      continue;
    }
    let i = 0; // the start index of the current output line
    while (i < n) {
      let p = i;
      let w = 0;
      let lastWordEnd = -1; // index just past the last whole word that fits within `width`
      let fitsAll = true;
      while (p < n) {
        const ch = paragraph[p] ?? ' ';
        const cw = glyphWidth(ch);
        if (w + cw > width) {
          fitsAll = false;
          break;
        }
        w += cw;
        p += 1;
        if (ch !== ' ' && (p >= n || paragraph[p] === ' ')) lastWordEnd = p; // just passed a word-end
      }
      let end: number; // exclusive end of this line's verbatim source
      if (fitsAll) {
        end = n;
      } else if (lastWordEnd > i) {
        end = lastWordEnd; // back up to break after the last whole word that fit
      } else {
        end = p > i ? p : i + 1; // one word wider than the view: hard-break at the width edge
      }
      lines.push(paragraph.slice(i, end)); // verbatim — whitespace between words is kept
      let next = end;
      while (next < n && paragraph[next] === ' ') next += 1; // drop the break spaces before the next line
      i = fitsAll ? n : next;
    }
  }
  return lines;
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
 */
export class Text extends View {
  /** The literal text, or a reactive getter that repaints the view when its signals change. */
  protected readonly content: string | (() => string);

  /**
   * @param content A literal string, or a getter (`() => string`) that repaints `Text` on change.
   */
  constructor(content: string | (() => string)) {
    super();
    this.content = content;
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
  override draw(ctx: DrawContext): void {
    const content = typeof this.content === 'function' ? this.content() : this.content;
    const style = ctx.color('staticText');
    const { width, height } = ctx.size;
    ctx.fillRect(0, 0, width, height, ' ', style); // clear the whole field first
    const lines = wrapText(content, width);
    for (let y = 0; y < height && y < lines.length; y += 1) {
      const line = lines[y];
      if (line !== undefined && line !== '') ctx.text(0, y, line, style);
    }
  }
}
