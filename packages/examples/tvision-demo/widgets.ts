/**
 * Custom content views for the `demo:tvision` showcase.
 *
 * These are plain `@jsvision/ui` `View` subclasses (the disciplined-hybrid escape hatch): each
 * implements `draw(ctx)` against the clipped, view-local `DrawContext`, and `measure()` so a single
 * child fills its `Window` interior (an `auto` leaf with no `measure` collapses to `{0,0}`).
 *
 * The reactive ones ({@link GradientView}, {@link LiveView}) bind to a signal in `onMount`: the bind
 * effect re-runs on every change, stores the new value, and invalidates the view — so a timer that
 * just calls `signal.set(...)` repaints the screen with no manual redraw. That live, signal-driven
 * repaint is the thing classic Turbo Vision had to do by hand.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View, Attr } from '@jsvision/ui';
import type { DrawContext, Size2D, Style } from '@jsvision/ui';
import { hsv } from './colors.js';

/**
 * Reusable ink colors. Turbo Vision's default window is **blue** (`cpBlueWindow`), so content text
 * uses the light-on-blue convention — lightGray body, yellow/cyan highlights, bright accents — that
 * stays legible over the blue interior.
 */
const INK_LIGHT = '#aaaaaa'; // lightGray — body text on the blue window
const INK_WHITE = '#ffffff';
const INK_BLACK = '#000000'; // only for the truecolor legend chip, which sits on its own black field
const INK_YELLOW = '#ffff55';
const INK_CYAN = '#55ffff'; // brightCyan — readable highlight on blue
const INK_GREEN = '#55ff55'; // brightGreen — readable accent on blue

/**
 * A static, themed block of help text. Lines beginning with two spaces (the key/action rows) are
 * tinted yellow for a subtle two-tone, mirroring Turbo Vision's keyed help panels.
 */
export class HelpView extends View {
  /**
   * @param lines The text lines to render, top-down from the view origin.
   */
  constructor(private readonly lines: readonly string[]) {
    super();
  }

  /** Claim the full window interior so the background fill covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const bg = ctx.role('window').bg;
    const body: Style = { fg: INK_LIGHT, bg };
    const keyed: Style = { fg: INK_YELLOW, bg };
    ctx.fill(' ', body);
    this.lines.forEach((line, i) => {
      ctx.text(0, i, line, line.startsWith('  ') ? keyed : body);
    });
  }
}

/**
 * A full-interior 24-bit gradient. The hue offset is bound to a frame signal, so the gradient
 * animates purely by the timer bumping that signal — no terminal could show this in 16 colors, and
 * no manual redraw drives it.
 */
export class GradientView extends View {
  /** Current hue offset in degrees, updated by the bound frame signal. */
  private hue = 0;

  /**
   * @param readFrame Reactive accessor for the frame counter (call it to subscribe).
   */
  constructor(private readonly readFrame: () => number) {
    super();
    this.onMount(() => {
      this.bind(
        () => this.readFrame(),
        (frame) => {
          this.hue = (frame * 3) % 360;
        },
      );
    });
  }

  /** Claim the full window interior so the gradient covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    const wSpan = Math.max(1, width - 1);
    const hSpan = Math.max(1, height - 1);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const h = (x / wSpan) * 260 + (y / hSpan) * 80 + this.hue;
        const color = hsv(h, 0.85, 0.95);
        ctx.text(x, y, ' ', { fg: color, bg: color });
      }
    }
    // A legend chip in the bottom-left, white-on-black so it reads over any hue.
    if (height > 0) {
      ctx.text(1, height - 1, ' 24-bit truecolor ', { fg: INK_WHITE, bg: INK_BLACK, attrs: Attr.bold });
    }
  }
}

/**
 * A live clock + frame counter + a bouncing indicator, all bound to signals. The timer updates the
 * signals; the binds invalidate this view; the loop repaints it — demonstrating reactive,
 * auto-repainting widgets (Turbo Vision repainted such gadgets manually).
 */
export class LiveView extends View {
  private time = '';
  private frame = 0;

  /**
   * @param readClock Reactive accessor for the formatted time string.
   * @param readFrame Reactive accessor for the frame counter.
   */
  constructor(
    private readonly readClock: () => string,
    private readonly readFrame: () => number,
  ) {
    super();
    this.onMount(() => {
      this.bind(
        () => this.readClock(),
        (t) => {
          this.time = t;
        },
      );
      this.bind(
        () => this.readFrame(),
        (f) => {
          this.frame = f;
        },
      );
    });
  }

  /** Claim the full window interior so the background fill covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const bg = ctx.role('window').bg;
    const body: Style = { fg: INK_LIGHT, bg };
    ctx.fill(' ', body);
    ctx.text(0, 0, 'Clock', { fg: INK_YELLOW, bg, attrs: Attr.bold });
    ctx.text(0, 1, this.time, { fg: INK_CYAN, bg, attrs: Attr.bold });
    ctx.text(0, 3, `frame #${this.frame}`, body);

    const width = Math.max(1, ctx.size.width);
    const period = width * 2;
    const phase = this.frame % period;
    const pos = phase < width ? phase : period - phase;
    if (ctx.size.height > 5) {
      ctx.text(0, 5, '·'.repeat(width), { fg: INK_LIGHT, bg });
      ctx.text(Math.min(width - 1, pos), 5, '◆', { fg: INK_YELLOW, bg });
    }
    if (ctx.size.height > 7) {
      ctx.text(0, 7, 'live · signals repaint', { fg: INK_GREEN, bg, attrs: Attr.bold });
    }
  }
}
