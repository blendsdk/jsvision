# Authoring a custom widget

When no catalog widget fits, subclass `View` — the sanctioned escape hatch. You implement three
things and get reactive, clipped, sanitized drawing for free.

## The contract

- **`measure(available): { width, height }`** — return a non-zero intrinsic size, or an `auto` slot
  collapses the view to `{0,0}` (gotcha 1). Ignore `available` if your size is fixed.
- **`draw(ctx: DrawContext): void`** — paint with view-local coordinates (`(0,0)` is your top-left).
  Every write is auto-clipped to your rect and sanitized, so you can't corrupt the screen.
- **`onEvent(ev): void`** (optional) — handle input; set `ev.handled = true` to consume it. Set
  `override focusable = true` if the widget takes focus.

Bind any reactive input in **`onMount`**, never the constructor (gotcha 2). `draw()` re-reads your
signals, so the bind usually just subscribes and requests a repaint.

## The DrawContext

- `ctx.size` — your content size in cells (draw against this, not `bounds`).
- `ctx.text(x, y, str, style?)` — write a run of cells.
- `ctx.fillRect(x, y, w, h, char, style?)` / `ctx.fill(char, style?)` — fill.
- `ctx.box(x, y, w, h, style?, title?)` — a framed box.
- `ctx.color(role)` — resolve a theme role name (e.g. `'staticText'`, `'button'`) to a style.
- `ctx.caps` — capability profile, e.g. `ctx.caps.unicode.utf8` to pick Unicode vs ASCII glyphs.

## Repaint vs reflow

- `this.invalidate()` — request a repaint (pixels changed). `bind` uses this by default.
- `this.invalidateLayout()` — request a reflow (size/position changed). Use `bind(reader, apply, {
relayout: true })` to make a bound change reflow.
- `this.setLayout({ … })` — the preferred way to change layout props: it merges (shallowly) into
  `this.layout` instead of replacing it, and reflows for you. Prefer it over assigning `this.layout`,
  which drops every prop you leave out and never reflows.

## Conventions

Give every public export user-facing JSDoc with an `@example`. Comment the _why_ of any non-obvious
drawing math. New widgets have no Turbo Vision counterpart, so there is no fidelity obligation — just
make it correct and clear.

## Worked example — `Sparkline`

A real, useful widget: it plots a numeric series as block glyphs, scaling each value between the
series min and max, with an ASCII fallback. The full runnable module is
`packages/examples/recipes/custom-widget.ts`.

```ts
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
```

**Adapt it:** change `measure()` to your size, swap the glyph ramp, and read whatever signal your
widget needs. The `onMount(() => this.bind(...))` line is what makes an external `values.set(...)`
repaint the widget.
