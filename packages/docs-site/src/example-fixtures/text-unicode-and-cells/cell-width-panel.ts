import { ScreenBuffer } from '@jsvision/core';
import { View, stringWidth, wrapText } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

const STYLE = { fg: 'default' as const, bg: 'default' as const };
const WRAP_WIDTHS = [12, 8, 4, 1] as const;

interface WidthSample {
  /** Short learner-facing name shown beside the current sample. */
  readonly name: string;
  /** Exact text measured and wrapped by the public helpers. */
  readonly text: string;
}

const SAMPLES: readonly WidthSample[] = [
  { name: 'mixed ASCII + CJK', text: 'A界 B' },
  { name: 'combining mark', text: 'Cafe\u0301 menu' },
  { name: 'wide emoji', text: 'Build 😀 ready' },
  { name: 'ZWJ sequence', text: '👩‍💻 ships' },
];

/**
 * Interactive width evidence for the Text, Unicode & terminal cells course.
 *
 * The panel derives every number from public JSVision helpers and exposes its current state for the
 * same headless assertions that protect the live course.
 */
export class CellWidthPanel extends View {
  /** Stable teaching label used by the focused course specification. */
  public readonly lessonName = 'Cell width';

  /** Current cell budget supplied to `wrapText()`. */
  public wrapWidth: number = WRAP_WIDTHS[0];

  protected sampleIndex = 0;
  protected actionSource = 'ready';

  /**
   * Move to the next bounded wrap width and repaint the evidence.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public cycleWrapWidth(source: 'keyboard' | 'mouse'): void {
    const index = WRAP_WIDTHS.findIndex((width) => width === this.wrapWidth);
    this.wrapWidth = WRAP_WIDTHS[(index + 1) % WRAP_WIDTHS.length] ?? WRAP_WIDTHS[0];
    this.actionSource = source;
    this.invalidate();
  }

  /**
   * Select the joined-emoji sample so its code-point wrapping boundary is visible.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public showZwjSample(source: 'keyboard' | 'mouse'): void {
    this.sampleIndex = SAMPLES.findIndex((sample) => sample.name === 'ZWJ sequence');
    this.actionSource = source;
    this.invalidate();
  }

  /**
   * Advance to the next deterministic sample.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public nextSample(source: 'keyboard' | 'mouse'): void {
    this.sampleIndex = (this.sampleIndex + 1) % SAMPLES.length;
    this.actionSource = source;
    this.invalidate();
  }

  /** Paint width, storage, wrapping, and clipping evidence without relying on color alone. */
  public override draw(ctx: DrawContext): void {
    const style = ctx.color('staticText');
    ctx.fill(' ', style);

    const buffer = new ScreenBuffer(4, 2, STYLE);
    buffer.text(0, 0, '界', STYLE);
    buffer.text(0, 1, 'e\u0301', STYLE);
    buffer.set(3, 0, '😀', STYLE);
    const sample = SAMPLES[this.sampleIndex] ?? SAMPLES[0];
    const wrapped = wrapText(sample.text, this.wrapWidth);

    ctx.text(0, 0, `ASCII A: ${stringWidth('A')} · JavaScript length: ${'😀'.length}`, style);
    ctx.text(0, 1, `Combining e + ◌́: ${stringWidth('e\u0301')} · CJK 界: ${stringWidth('界')}`, style);
    ctx.text(0, 2, `Emoji 😀: ${stringWidth('😀')} · ZWJ 👩‍💻: ${stringWidth('👩‍💻')} cells`, style);
    ctx.text(
      0,
      3,
      `Lead width: ${buffer.get(0, 0)?.width ?? '?'} · Continuation width: ${buffer.get(1, 0)?.width ?? '?'}`,
      style,
    );
    ctx.text(0, 4, `Last-column wide: ${buffer.get(3, 0)?.char === ' ' ? 'space' : 'unexpected glyph'}`, style);
    ctx.text(0, 5, `Wrap width: ${this.wrapWidth} cells · Lines: ${wrapped.length}`, style);
    ctx.text(0, 6, `Sample: ${sample.name} · ${sample.text}`, style);
    ctx.text(0, 7, 'Wrap boundary: code points (not graphemes)', style);
    ctx.text(0, 8, `Action source: ${this.actionSource}`, style);
  }
}
