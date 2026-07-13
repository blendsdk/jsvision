# 07 — Testing Strategy

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

Spec-first (CodeOps): **spec oracles RED → implement → GREEN → impl tests**. `*.spec.test.ts` are
**immutable oracles** derived from RD-18's ACs (lines 274-326) — a failing spec after implementation
means the **code** is wrong. Because RD-18 has no TV component to diff (AR-186), the "fidelity" oracles
(ST-2, ST-3, ST-7, ST-8, ST-11) encode the **grounded-in-TV pieces** (the Block-Element/braille glyph
tables, the caps-driven fallback, the extension colours pinned in the GATE-1 decodes, PA-2…PA-5).

Widgets are exercised the shipped way — construct through a `createEventLoop({width,height},{caps})` +
`loop.mount(root)`, read `loop.renderRoot.buffer()` (the `tab-strip.spec` idiom) — so `ctx.caps` flows
automatically and the AC-3/AC-8 fallback oracles just pass a Unicode-off `resolveCapabilities` override.

## Specification test cases (ST-*)

| ST | AC | File | Input → Expected (oracle) |
|----|----|------|---------------------------|
| **ST-1** | AC-1 | `progress-bar.spec` | `ProgressBar({value})`, width 10; `value.set(0.5)` → half the cells filled; re-set `0.8` → more filled (repaint tracks value). |
| **ST-2** | AC-2 | `progress-bar.spec` | Full-Unicode caps. For pinned `(value,width)` pairs assert the exact row cell-by-cell pre-`serialize`: `e=round(v·w·8); full=floor(e/8); part=e%8` → `full`×`█`(U+2588), then if `part∈1..7` one `PARTIAL[part]` (U+258F…U+2589), then `░`(U+2591). Cases incl. `part==0` (no partial — e.g. `v=0.3,w=10`→`e=24`→3×`█`+7×`░`), `v=1` (all `█`), `v=0` (all `░`), a mid partial (e.g. `v=0.28,w=10`→`e=round(22.4)=22`→2×`█`+`▊`(part6=U+258A)+7×`░`). Assert the `progressFill`/`progressTrack` styles on the cells. |
| **ST-3** | AC-3 | `progress-bar.spec` | `resolveCapabilities` override with `unicode.utf8=false` (or `glyphs.halfBlocks=false`). Bar renders **whole-cell** `#` fill + `-` track, distinct chars, **no partials**, **no throw**. |
| **ST-4** | AC-4 | `progress-bar.spec` | `caption:true`, `value 0.45`, width ≥ 6 → centred ` 45% ` over the bar in `staticText`; `caption` default (omitted) → no caption. Tiny width → caption width-clipped, no overrun. Percent clamped `0..100`. |
| **ST-5** | AC-5 | `progress-bar.spec` | `value` = `NaN` → 0 filled; `-1` → 0; `2` → all filled; `Infinity` → all. Never exceeds width / never OOB. |
| **ST-6** | AC-6 | `spinner.spec` | `Spinner({frame})` default `dots`; `frame 0`→`⠋`, `frame 1`→`⠙`, `frame 10`→`⠋` (mod 10), **`frame -1`→`⠏`** (negative-safe, last frame). |
| **ST-7** | AC-7 | `spinner.spec` | `SPINNERS.dots/line/blocks` are frozen arrays with the pinned code points (dots=`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, line=`\|/-\`, blocks=`▏▎▍▌▋▊▉█`); default preset is `dots`; `Object.isFrozen(SPINNERS)` + each array frozen. |
| **ST-8** | AC-8 | `spinner.spec` | Unicode-off caps: `preset:'dots'`→ renders `line` glyphs; `preset:'blocks'`→ `line`; `preset:'line'`→ `line` (unchanged). Advancing `frame` still animates (glyph changes), never static. No throw. |
| **ST-9** | AC-9 | `spinner.spec` | `label:'Loading…'` → drawn at column 2 in `label` role, right of the glyph; a label longer than the width is clipped; an escape-bearing label is sanitized (no raw sequence in the buffer). |
| **ST-10** | AC-10 | `run-spinner.impl` | Fake `TimerSeam` (records armed callbacks). `runSpinner(frame,{intervalMs:80,timer})`; fire the pending callback 3× → `frame` advanced 0→3, each arm requested with `ms==80`; `stop()` → pending timer cleared; firing after `stop()` (or a second `stop()`) → **no further advance** (idempotent, no wall-clock used). |
| **ST-11** | AC-11 | `feedback-theme.spec` | `defaultTheme.progressFill`/`progressTrack` present; `encode(role.fg/bg, caps)` does not throw at every depth; a snapshot of the **pre-existing** role set is unchanged (no existing role mutated). |
| **ST-12** | AC-12 | `feedback.packaging.spec` | `ProgressBar`/`Spinner`/`runSpinner`/`SPINNERS` + the types re-export from `@jsvision/ui`; `check:deps` clean (asserted via the shipped packaging-test pattern); each `src/feedback/*.ts` ≤ 500 lines. |
| **ST-13** | AC-13 | `kitchen-sink.smoke` + `feedback-demo.e2e` | Both stories mount headlessly, paint ≥1 non-blank cell, unique ids `feedback/progress-bar` + `feedback/spinner`, required metadata; `demo:feedback` runs headless and emits the expected ASCII frames (bar 0→33→66→100, spinner steps). |
| **ST-14** | AC-14 | `progress-bar.spec` + `spinner.spec` + `run-spinner.impl` | Aggregate security oracle: value/frame bounds-checked (ST-5/ST-6), caption/label sanitized + width-clipped (ST-4/ST-9), `runSpinner.stop()` clears the timer (ST-10). |

## Implementation tests (`*.impl.test.ts`)

- **`progress-bar.impl`** — `clamp`/`clampNaN` units (`NaN`/`±∞`/`-0`/boundary `0`,`1`); rounding
  boundaries (`v·w·8` just below/above a multiple of 8 → correct `full`/`part` split, e.g. the
  `v=0.99,w=1`→`e=8`→1 full/no partial and `v·w≈2.98`→3 full cases from PF-002); `percent` getter;
  caption centring at even/odd widths; `asciiOnly` truth table (`utf8`×`halfBlocks`).
- **`spinner.impl`** — negative-safe mod over a range of frames incl. large negatives; preset code-point
  identity (frozen, exact length); empty/undefined label → glyph only; reactive-getter label repaint;
  preset-swap matrix (`{dots,line,blocks} × asciiOnly∈{T,F}`).
- **`run-spinner.impl`** — default `intervalMs` (omitted → 80); `stop()` before the first fire; double
  `stop()` idempotent; no timer armed after `stop()`; handle nulled (no leak).

## Verification

- **Per phase / task:** `yarn verify` (typecheck + build + test across packages) — the gate for every
  Deliverable block.
- **Packaging:** `yarn check:deps` (zero runtime deps).
- **Showcase:** `kitchen-sink.smoke.spec` + `feedback-demo.e2e` (headless, no TTY).
- **GATE-1 AFTER-diff** (tasks 3.1.1): cell-by-cell buffer diff of the bar fill glyphs/colours + the
  spinner presets/fallback against the PA-2…PA-5 decodes, recorded in code/commit.
