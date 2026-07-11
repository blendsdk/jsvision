// Recipe: authoring a custom widget (the escape hatch).
//
// When no built-in view fits, subclass `View`: implement `measure()` (return a NON-zero size, or an
// `auto` layout slot collapses the view to {0,0}) and `draw(ctx)` (paint via the clipped, sanitizing
// DrawContext), and bind any reactive input in `onMount` (never the constructor) so updates repaint.
// `Sparkline` plots a numeric series as block glyphs — small, real, and fully reactive.

import { View } from '@jsvision/ui';
import type { DrawContext, Signal, Size2D } from '@jsvision/ui';

// #region example
const BARS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const BARS_ASCII = ['_', '.', '.', '-', '-', '=', '=', '#', '#'];

/** Options for {@link Sparkline}. */
export interface SparklineOptions {
  /** The data series to plot (one glyph per value). */
  values: Signal<number[]>;
  /** Optional fixed width in cells; defaults to the series length. */
  width?: number;
}

/**
 * A compact single-row sparkline: it plots a numeric series as block glyphs (`▁▂▃▄▅▆▇█`), scaling
 * each value between the series min and max, with an ASCII fallback when Unicode is unavailable.
 * Demonstrates the custom-widget escape hatch — subclass `View`, implement `measure`/`draw`, and bind
 * the data signal in `onMount` so a data change repaints.
 *
 * @example
 * const values = signal([3, 1, 4, 1, 5, 9, 2, 6]);
 * const spark = new Sparkline({ values });
 * group.add(spark);
 * values.set([9, 2, 6, 5, 3, 5]); // repaints automatically
 */
export class Sparkline extends View {
  private readonly values: Signal<number[]>;
  private readonly fixedWidth: number | undefined;

  constructor(opts: SparklineOptions) {
    super();
    this.values = opts.values;
    this.fixedWidth = opts.width;
    // Bind on mount, not in the constructor: the reactive scope only exists once the view is mounted.
    // draw() re-reads values(), so the bind just needs to subscribe and request a repaint.
    this.onMount(() =>
      this.bind(
        () => this.values(),
        () => undefined,
      ),
    );
  }

  /** Intrinsic size: one row, as wide as the series (or the fixed width). Never zero. */
  override measure(): Size2D {
    const width = this.fixedWidth ?? Math.max(1, this.values().length);
    return { width, height: 1 };
  }

  override draw(ctx: DrawContext): void {
    const data = this.values();
    if (data.length === 0) return;

    const style = ctx.color('staticText');
    const glyphs = ctx.caps.unicode.utf8 ? BARS : BARS_ASCII;
    const { width } = ctx.size;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1; // avoid divide-by-zero when every value is equal

    for (let x = 0; x < Math.min(width, data.length); x += 1) {
      const v = data[x];
      if (v === undefined) continue;
      const level = Math.round(((v - min) / span) * (glyphs.length - 1));
      ctx.text(x, 0, glyphs[level] ?? ' ', style);
    }
  }
}
// #endregion example
