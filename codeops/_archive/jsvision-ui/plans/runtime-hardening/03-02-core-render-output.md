# Core Render & Output Hardening: Runtime Hardening (RD-13)

> **Document**: 03-02-core-render-output.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-05, HR-17, HR-18, HR-19, HR-20, HR-21, HR-25
> **Files**: `packages/core/src/engine/render/{buffer.ts,glyphs.ts,serialize.ts,width.ts,osc.ts}`

## Overview

Closes the cell-grid + damage-diff output boundary: no raw control byte can enter a cell or the
serialized ANSI stream, wide/combining glyphs keep columns consistent, and the clipboard payload is
byte-exact.

## Implementation Details

### HR-05 — C0 controls at the grid boundary (Major) *(Decision per PA-5)*

**Defect** (`safety/sanitize.ts:41-44` keeps `\t`/`\n` — correct for the logger — but
`render/buffer.ts:109-128` stores them as width-1 cells holding the raw byte): serialized output
contains literal `\t`, desyncing terminal column addressing for the frame's life (reproduced).

**Fix spec (PA-5).** The **grid boundary** (`ScreenBuffer.text` and `set`) replaces every C0
control (incl. `\t`, `\n`, and DEL) with a **single space cell** before storing. One input char = one
cell, so caller column math is preserved and the serialized stream can never contain a raw control.
The logger's own newline-preserving sanitize is untouched. Oracle: writing `'a\tb'`, `'a\nb'`, a
lone `'\t'` → serialized bytes contain no C0, glyph positions match the space-replaced string.

### HR-17 — Combining marks attach to the base cell

**Defect** (`buffer.ts:123-127`): zero-width combining marks are stored as standalone width-1(0)
cells — `'é'` (e + U+0301) loses the accent (reproduced).

**Fix spec.** In the `text()` storage loop, a `charWidth === 0` combining mark **appends to the
preceding cell's glyph string** (cluster stays one cell, width unchanged). A combining mark with no
preceding cell in the write (row start) is dropped (nothing to compose onto — consistent with the
allowlist posture). Interaction with HR-05 is ordered: C0 replacement happens first, so a mark never
attaches to a control char.

### HR-18 — Wide-glyph fallback keeps two columns *(Decision per PA-11)*

**Defect** (`glyphs.ts:100-103` + `serialize.ts:87-94`): under `unicode.utf8:false` a width-2 lead
falls back to a single `?` while the run still assumes 2 columns → column drift.

**Fix spec (PA-11).** A wide glyph's fallback emits **two cells: `'?'` then `' '`** (lead + pad),
preserving the 2-column footprint. The continuation cell of a fallen-back pair serializes as the
space pad.

### HR-19 — Complete the WIDE table from Unicode EAW *(Decision per PA-18)*

**Defect** (`width.ts:48-65`): the WIDE table misses many EAW `W`/`F` code points (`U+2B50`,
`U+231A/B`, `U+23E9–23F3`, `U+2705`, `U+2728`, `U+274C`, `U+1F004`, `U+1F200–1F2FF`, Tangut
`U+17000+`, emoji, …).

**Fix spec (PA-18).** A dev-side generation script (not shipped, not a build step) derives the
`W`/`F` ranges from the Unicode EastAsianWidth data file and emits a checked-in, documented `const`
range table replacing the hand-maintained one. `charWidth` logic is unchanged — only the table data
grows. Zero runtime deps preserved; the script and its source-data version are cited in the table's
JSDoc.

### HR-20 — Continuation damage re-emits its lead *(Decision per PA-14)*

**Defect** (`serialize.ts:80-99`): a changed continuation cell with an unchanged lead serializes to
an empty styled run — the recolor never reaches the terminal (reproduced via `shadow()` over a wide
glyph).

**Fix spec (PA-14).** When a damage run starts on a continuation cell, extend the run's left edge to
include the lead cell so the visible glyph is re-emitted with the new style. Never emit a
zero-glyph styled run.

### HR-21 — Byte-exact clipboard payload *(Decision per PA-7)*

**Defect** (`osc.ts:47-51`): `setClipboard` sanitizes before base64, mutating content (CR stripped —
reproduced).

**Fix spec (PA-7).** Remove the pre-encode `sanitize` call: `Buffer.from(text, 'utf8')` → base64.
Base64 output (`[A-Za-z0-9+/=]`) cannot break out of the OSC 52 frame, so the frame stays
injection-safe with zero mutation. JSDoc updated to state the exact-bytes guarantee.

### HR-25 — Width-aware `box()` title centering

**Defect** (`buffer.ts:198-202`): title centering counts code points, so CJK/emoji titles
mis-center and can overflow the box.

**Fix spec.** Center by **display width** (the buffer's existing width machinery) and clip the
title to the box's interior width. Same class as HR-30 (`ui` draw-context) — the two fixes share
the oracle shape but not code (packages don't share internals).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| C0 control in a grid write | replaced by one space cell | **PA-5** |
| Combining mark at row start / after nothing | dropped | RD HR-17 (pinned) + allowlist posture |
| Wide glyph unrenderable | `'? '` two-cell fallback | **PA-11** |
| Damage run starting mid-glyph | run extended to the lead | **PA-14** |
| Clipboard text with CR/controls | encoded verbatim (base64-framed) | **PA-7** |

## Testing Requirements

- Spec oracles ST-2.2, ST-5.c–g,k ([07-testing-strategy.md](07-testing-strategy.md)); HR-19 is
  table-driven over the RD's listed code points (AC-5).
- Impl tests: HR-05×HR-17 ordering; serialize runs across mixed wide/fallback rows; box titles at
  exact-fit and overflow widths.
