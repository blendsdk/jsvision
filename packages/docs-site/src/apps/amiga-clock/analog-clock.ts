/**
 * `AnalogClock` — a round, Workbench-style analog clock face for the `demo:amiga-clock` showcase.
 *
 * A plain `@jsvision/ui` `View` (the disciplined-hybrid escape hatch): `measure()` claims the whole
 * window interior, and `draw(ctx)` plots the face + three hands against the clipped, view-local
 * `DrawContext`. It binds to a reactive `Date` signal in `onMount`, so the timer just calls
 * `signal.set(new Date())` and the hands repaint with no manual redraw.
 *
 * Geometry note: terminal cells are ~twice as tall as they are wide, so every horizontal offset is
 * multiplied by {@link ASPECT} to keep the face visually circular rather than an ellipse.
 *
 * This is novel Amiga-flavored art, not a Turbo Vision component — it sits outside the TV-fidelity
 * gate. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';
import { Attr } from '@jsvision/core';
import type { Style } from '@jsvision/core';

/** Cell aspect ratio: a cell is ~half as wide as tall, so scale x by 2 to draw a true circle. */
const ASPECT = 2;

const BG = '#00004a'; // deep Amiga blue face
const RIM = '#8899cc'; // cool steel rim ticks
const NUMERAL = '#ffffff';
const HAND_HOUR = '#ffdd55'; // amber
const HAND_MIN = '#66ddff'; // cyan
const HAND_SEC = '#ff5555'; // red
const HUB = '#ffffff';

/** The cardinal numerals drawn at 12/3/6/9; other hours are plain rim ticks. */
const CARDINALS: Readonly<Record<number, string>> = { 0: '12', 3: '3', 6: '6', 9: '9' };

export class AnalogClock extends View {
  /** Current time, updated by the bound `Date` signal. */
  private now = new Date(0);

  /**
   * @param readNow Reactive accessor for the current `Date` (call it to subscribe).
   */
  constructor(private readonly readNow: () => Date) {
    super();
    this.onMount(() => {
      this.bind(
        () => this.readNow(),
        (d) => {
          this.now = d;
        },
      );
    });
  }

  /** Claim the full window interior so the face fill covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    const face: Style = { fg: RIM, bg: BG };
    ctx.fill(' ', face);
    if (width < 5 || height < 5) return;

    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    // Vertical radius in cell-units; horizontal extent is `r * ASPECT` so the face reads circular.
    const r = Math.max(2, Math.min(cy - 0.5, (width - 1) / 2 / ASPECT - 0.5));

    // Plot `str` centered on the polar point at fraction `frac` of a turn and radius `rad`.
    const plot = (frac: number, rad: number, str: string, style: Style): void => {
      const ang = frac * Math.PI * 2;
      const x = Math.round(cx + Math.sin(ang) * rad * ASPECT - (str.length - 1) / 2);
      const y = Math.round(cy - Math.cos(ang) * rad);
      ctx.text(x, y, str, style);
    };

    // 12 hour ticks; the cardinals get numerals, the rest a rim dot.
    for (let i = 0; i < 12; i += 1) {
      const numeral = CARDINALS[i];
      if (numeral !== undefined) plot(i / 12, r, numeral, { fg: NUMERAL, bg: BG, attrs: Attr.bold });
      else plot(i / 12, r, '·', face);
    }

    const ms = this.now.getMilliseconds();
    const s = this.now.getSeconds() + ms / 1000;
    const m = this.now.getMinutes() + s / 60;
    const h = (this.now.getHours() % 12) + m / 60;

    // Hands, short→long so the fast second hand paints on top. Solid squares (`■`) for the whiskers.
    this.drawHand(ctx, cx, cy, r, h / 12, 0.5, '■', { fg: HAND_HOUR, bg: BG, attrs: Attr.bold });
    this.drawHand(ctx, cx, cy, r, m / 60, 0.78, '■', { fg: HAND_MIN, bg: BG, attrs: Attr.bold });
    this.drawHand(ctx, cx, cy, r, s / 60, 0.9, '■', { fg: HAND_SEC, bg: BG, attrs: Attr.bold });

    ctx.text(Math.round(cx), Math.round(cy), '■', { fg: HUB, bg: BG, attrs: Attr.bold });
  }

  /**
   * Plot a hand as a run of glyphs from the hub outward.
   *
   * @param frac Fraction of a full turn (0 = 12 o'clock, clockwise).
   * @param lengthFrac Hand length as a fraction of the face radius.
   */
  private drawHand(
    ctx: DrawContext,
    cx: number,
    cy: number,
    r: number,
    frac: number,
    lengthFrac: number,
    glyph: string,
    style: Style,
  ): void {
    const ang = frac * Math.PI * 2;
    const steps = Math.max(2, Math.round(lengthFrac * r * 2));
    for (let k = 1; k <= steps; k += 1) {
      const rad = (k / steps) * lengthFrac * r;
      const x = Math.round(cx + Math.sin(ang) * rad * ASPECT);
      const y = Math.round(cy - Math.cos(ang) * rad);
      ctx.text(x, y, glyph, style);
    }
  }
}
