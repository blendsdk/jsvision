/**
 * `DigitalClock` — a large block-glyph `HH:MM:SS` readout for the `demo:amiga-clock` showcase.
 *
 * A plain `@jsvision/ui` `View`: `measure()` claims the window interior and `draw(ctx)` stamps a
 * 5-row bitmap font built from the full block `█`. It binds to a reactive `Date` signal, so the
 * timer repaints it; the colon blinks each second (lit for the first half, blank for the second) as
 * a subtle liveness cue. Novel art — outside the TV-fidelity gate.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '@jsvision/ui';
import type { DrawContext, Size2D } from '@jsvision/ui';
import { Attr } from '@jsvision/core';
import type { Style } from '@jsvision/core';

const ON = '█';
const BG = '#000000';
const INK = '#33ff66'; // phosphor green

/** 5-row × 3-col bitmap font for the digits and the colon (colon is 1 col wide). */
const FONT: Readonly<Record<string, readonly string[]>> = {
  '0': ['███', '█ █', '█ █', '█ █', '███'],
  '1': ['  █', '  █', '  █', '  █', '  █'],
  '2': ['███', '  █', '███', '█  ', '███'],
  '3': ['███', '  █', '███', '  █', '███'],
  '4': ['█ █', '█ █', '███', '  █', '  █'],
  '5': ['███', '█  ', '███', '  █', '███'],
  '6': ['███', '█  ', '███', '█ █', '███'],
  '7': ['███', '  █', '  █', '  █', '  █'],
  '8': ['███', '█ █', '███', '█ █', '███'],
  '9': ['███', '█ █', '███', '  █', '███'],
  ':': [' ', '█', ' ', '█', ' '],
};

const GLYPH_ROWS = 5;
const GAP = 1;

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export class DigitalClock extends View {
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

  /** Claim the full window interior so the background fill covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const { width, height } = ctx.size;
    ctx.fill(' ', { fg: INK, bg: BG });

    const chars = `${pad2(this.now.getHours())}:${pad2(this.now.getMinutes())}:${pad2(this.now.getSeconds())}`;

    const totalWidth = [...chars].reduce((w, ch) => w + (FONT[ch]?.[0].length ?? 0), 0) + GAP * (chars.length - 1);
    const startX = Math.floor((width - totalWidth) / 2);
    const startY = Math.floor((height - GLYPH_ROWS) / 2);
    const ink: Style = { fg: INK, bg: BG, attrs: Attr.bold };

    let x = startX;
    for (const ch of chars) {
      const glyph = FONT[ch];
      if (glyph === undefined) continue;
      const gw = glyph[0].length;
      for (let row = 0; row < GLYPH_ROWS; row += 1) {
        const line = glyph[row];
        for (let col = 0; col < gw; col += 1) {
          if (line[col] === ON) ctx.text(x + col, startY + row, ON, ink);
        }
      }
      x += gw + GAP;
    }
  }
}
