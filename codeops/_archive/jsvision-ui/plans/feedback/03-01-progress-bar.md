# 03-01 — `ProgressBar` (determinate bar)

> **Document**: 03-01-progress-bar.md
> **Parent**: [Index](00-index.md)
> **Implements**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-14 · PA-2/PA-4/PA-8

## GATE-1 decode (BEFORE)

RD-18 has **no TV counterpart** (AR-186 — whole-tree search of `magiblot/tvision` returns no
progress/gauge class). So the fidelity work is **pinning the grounded-in-TV pieces**, not a `.cpp`
diff. Pinned here, to be recorded verbatim in the code JSDoc:

- **Fill glyphs** — full block `█` = **U+2588**; eighth-block partials `PARTIAL[1..7]` =
  `['▏','▎','▍','▌','▋','▊','▉']` = **U+258F, U+258E, U+258D, U+258C, U+258B, U+258A, U+2589**; track
  `░` = **U+2591**. Unicode **Block Elements** — the same CP437 shade/block convention TV uses for
  `TScrollBar` (`▒`/`■`) and the `▄█▀` shadow. (PA-4)
- **ASCII whole-cell form** — `#` fill / `-` track (distinct; the space-track variant is rejected —
  `-` reads as an empty track more clearly). Selected at the widget level when `asciiOnly(caps)`;
  **not** the serialize-time `fallbackGlyph` map (PF-001). (PA-2)
- **Colours** — `progressFill` (`0x1B` brightCyan-on-blue) for `█`/partials, `progressTrack` (`0x13`
  cyan-on-blue) for `░`; documented extension colours (see [03-03](03-03-theme-packaging.md) §GATE-1).
  The ASCII form uses the same two roles (fg carries the `#`/`-`). (PA-3)

## Public API

```ts
export interface ProgressBarOptions {
  /** Reactive progress in [0,1] (caller-owned; clamped on read). Writing it repaints. */
  readonly value: Signal<number>;
  /** Show a centred ` NN% ` caption over the bar. Default false. */
  readonly caption?: boolean;
}

export class ProgressBar extends View {
  constructor(opts: ProgressBarOptions);
  /** Write the bound signal (Should-Have). Clamped on read, so any number is safe. */
  set(value: number): void;
  /** round(clamp(value,0,1)·100) — the integer percent (Should-Have). */
  get percent(): number;
  override draw(ctx: DrawContext): void;
}
```

- **Caller-owned signal** (PA-8) — matches `Input`/`RadioGroup`/`TabView`. `set(v)` = `value.set(v)`.
- **Leaf** — no children, no `onEvent`; subscribes via `onMount(() => this.bind(() => this.value()))`
  so a `value` write repaints (the `Text` idiom, current-state §Leaf-View).

## `draw(ctx)` algorithm (the AC-2 oracle)

```
const { width, height } = ctx.size;
const v = clamp(this.value(), 0, 1);            // AC-5: NaN → 0 (clampNaN), <0 → 0, >1 → 1
const fillStyle  = ctx.color('progressFill');
const trackStyle = ctx.color('progressTrack');

if (asciiOnly(ctx.caps)) {                       // AC-3: PA-2 predicate
  const filled = Math.round(v * width);          // whole-cell only, no partials
  for each row y in 0..height-1:
     ctx.fillRect(0, y, filled,        1, '#', fillStyle);
     ctx.fillRect(filled, y, width-filled, 1, '-', trackStyle);
} else {                                          // AC-2: smooth sub-cell
  const e    = Math.round(v * width * 8);         // width in eighths (round-first, PA-4)
  const full = Math.floor(e / 8);
  const part = e % 8;                             // 0..7
  for each row y in 0..height-1:
     ctx.fillRect(0, y, full, 1, '█', fillStyle);            // U+2588 × full
     let x = full;
     if (part >= 1 && part <= 7) { ctx.text(x, y, PARTIAL[part], fillStyle); x += 1; }
     if (x < width) ctx.fillRect(x, y, width - x, 1, '░', trackStyle);   // U+2591 track
}

if (this.caption) drawCaption(ctx, v, width, height);   // AC-4
```

- **`clamp`** — `clampNaN(n) = Number.isNaN(n) ? 0 : n; clamp(n,0,1) = min(1, max(0, clampNaN(n)))`.
  Guarantees `full ∈ 0..width` and `part ∈ 0..7` → never overflows width or indexes out of range
  (AC-5/AC-14).
- **`PARTIAL`** is indexed `1..7`; index `0` (no partial) is never dereferenced. A frozen
  `readonly string[]` (length 8, index 0 = `''` sentinel so `PARTIAL[part]` is total-typed).
- **`asciiOnly`** is defined once here and exported for `spinner.ts` (PA-6):
  `export const asciiOnly = (caps: CapabilityProfile) => !caps.unicode.utf8 || !caps.glyphs.halfBlocks;`
- **Height** — the same row is drawn for every `y` (a taller bar repeats the row, RD-18 §Bar).

### Caption (AC-4)

```
const pct = Math.round(v * 100);                 // 0..100 (v already clamped)
const label = ` ${pct}% `;                        // e.g. " 45% "
const lx = Math.max(0, Math.floor((width - displayWidth(label)) / 2));
ctx.text(lx, Math.floor(height/2), clipToWidth(label, width), ctx.color('staticText'));
```

- Centred by **display width**; `clipToWidth` prevents overrun at tiny widths (the `Text`/`box` idiom).
- Drawn **after** the fill so it overlays the bar. Off by default (`caption !== true`).
- Reuses the existing `staticText` role — no new caption role (PA-3).

## Security (AC-14)

- `value` clamped on every read (`NaN`/`±∞`/out-of-range → `0`/`1`) → no overflow, no OOB index.
- The caption routes through `ctx.text` → core `sanitize` + buffer clip → no escape injection, no
  overflow. No caller string reaches the terminal raw.

## GATE-1 AFTER (diff task)

After implementation, diff the composed buffer **cell-by-cell** against this decode: for representative
`(value, width)` pairs assert the exact `█`/`PARTIAL[k]`/`░` sequence + the `progressFill`/`progressTrack`
styles pre-`serialize`; assert the ASCII branch yields distinct `#`/`-`. Record the result in the code
JSDoc/commit (execution plan task 3.1.1).

## File

`packages/ui/src/feedback/progress-bar.ts` (bar + `PARTIAL` + `clamp` + `asciiOnly` export + caption),
≤ 500 lines.
