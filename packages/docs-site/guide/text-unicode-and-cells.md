---
title: Text, Unicode & terminal cells
description: A beginner-to-advanced JSVision course on Unicode text, terminal-cell width, wide and combining glyphs, wrapping, clipping, and capability-aware ASCII fallbacks.
---

# Text, Unicode & terminal cells

Text is data, but a terminal draws a grid. The gap between those models explains why a JavaScript
string can fit in memory yet misalign a table, clip a border, or become unreadable on a different
terminal. This course teaches you to bridge that gap deliberately.

## Who this course is for

This course is for developers who already know how to place views with the
[Layout course](/guide/layout) and now need to put real-world text inside those rectangles. You
should be comfortable with terminal cells and explicit view bounds; no prior Unicode expertise is
required.

By the end, you will be able to build cell-correct text regions, explain the difference between
code points, graphemes, and display cells, diagnose wrapping and clipping failures, and verify
Unicode, adapted-chrome, and ASCII-safe results. The motivating problem is a status table or
workspace that looks aligned with short English labels but becomes misaligned, clipped, or
unreadable when it receives CJK, accented, or emoji text.

The beginner boundary is measuring and wrapping text in terminal cells. The intermediate boundary
is reasoning about wide glyphs, combining marks, clipping, and component limitations. The advanced
boundary is capability-aware rendering, ambiguous-width adaptation, safe degradation, and
production diagnosis across terminals.

## Mental model

Keep three units separate:

```text
JavaScript string
      │ iterate
      ▼
Unicode code points ── grouped by a reader/segmenter ──> grapheme clusters
      │ charWidth()
      ▼
terminal display cells: 0, 1, or 2 columns per code point
      │ ScreenBuffer
      ▼
lead cells + continuation cells ── serialize with capabilities ──> terminal
```

- A **code unit** is one element counted by JavaScript `string.length`. UTF-16 uses two code units
  for many emoji.
- A **code point** is one Unicode scalar value. JavaScript `for...of` walks whole code points.
- A **grapheme cluster** is what a reader often perceives as one character, such as `e` plus a
  combining acute mark or a joined emoji sequence.
- A **terminal cell** is one column in the rendered grid. A code point may advance zero, one, or
  two cells.

These units answer different questions. String storage and caret indices are not automatically
display geometry. JSVision's general width scan is code-point based, while specialist text
surfaces may add their own grapheme-aware navigation.

| Sample | JavaScript length | Code points | Typical graphemes | JSVision cells (`wcwidth`) |
| ------ | ----------------: | ----------: | ----------------: | -------------------------: |
| `A`    |                 1 |           1 |                 1 |                          1 |
| `é`    |                 2 |           2 |                 1 |                          1 |
| `界`   |                 1 |           1 |                 1 |                          2 |
| `😀`   |                 2 |           1 |                 1 |                          2 |
| `👩‍💻`   |                 5 |           3 |                 1 |                          4 |

The last row is the important warning: a zero-width joiner does not make the general width helper
fully grapheme-aware. The component emoji are still measured as separate code points.

## Your first cell-width result

Use `stringWidth()` whenever a number will become terminal geometry. Do not substitute
`string.length`.

```ts
import { stringWidth } from '@jsvision/ui';

stringWidth('Status'); // 6
stringWidth('状態'); // 4: two wide CJK code points
stringWidth('e\u0301'); // 1: base plus combining acute
stringWidth('😀'); // 2
```

This helper uses the same default `wcwidth` rules as normal JSVision buffer and view drawing.
Typical narrow code points occupy one cell, the documented combining and zero-width subset occupies
zero, and East Asian Wide, Fullwidth, and supported emoji ranges occupy two.

Use the lower-level `charWidth()` when you need to inspect one code point or compare width modes:

```ts
import { charWidth } from '@jsvision/core';

charWidth('A'.codePointAt(0)!, 'wcwidth'); // 1
charWidth(0x0301, 'wcwidth'); // 0: combining acute
charWidth('界'.codePointAt(0)!, 'wcwidth'); // 2
charWidth(0x00a1, 'ambiguous-wide'); // 2
```

`'ambiguous-wide'` changes code points in JSVision's documented East Asian Ambiguous subset from
one cell to two. Pass a terminal's resolved `unicode.widthMode` when writing low-level host-aware
measurement. Higher-level `stringWidth()` and `wrapText()` currently use the fixed default
`'wcwidth'` model.

## Code points, graphemes, and cells

A grapheme can contain several code points. Examples include combining accents, emoji plus a skin
tone, regional-indicator flags, and emoji joined with a zero-width joiner (ZWJ). A correct string
operation therefore starts by naming the unit it needs:

| Task                                     | Required unit                              | Suitable tool                                |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| Store or transmit exact text             | Code units/bytes with an encoding contract | JavaScript string or UTF-8 boundary          |
| Visit whole Unicode scalar values        | Code points                                | `for...of`, spread, `codePointAt()`          |
| Move an editor caret as a reader expects | Grapheme clusters                          | A grapheme-aware specialist surface          |
| Align, wrap, or place terminal content   | Display cells                              | `stringWidth()`, `wrapText()`, `charWidth()` |

Do not promote one unit into a universal definition of “character.” A terminal renderer needs cell
width; an editor needs navigation boundaries; a protocol may need exact bytes.

Plain Input is not wide- or grapheme-aware for arbitrary Unicode caret geometry; it currently uses
JavaScript string indices as display positions. Use the
[`Input` component](/components/controls/input) for bounded text whose character profile fits that
contract. The
[Code Editor specialist course](/components/code-editor/) owns grapheme-aware document editing,
selection, and navigation; this Guide does not duplicate those algorithms.

## Wide glyphs and combining marks

`ScreenBuffer` makes the cell model explicit. A wide glyph occupies a width-2 lead cell followed by
an empty width-0 continuation cell. The continuation reserves the second column; it is not another
copy of the glyph.

```ts
import { ScreenBuffer } from '@jsvision/core';

const style = { fg: 'white' as const, bg: 'blue' as const };
const buffer = new ScreenBuffer(8, 1, style);

buffer.text(0, 0, '界e\u0301', style);
buffer.get(0, 0); // { char: '界', width: 2, ... }
buffer.get(1, 0); // { char: '', width: 0, ... }
buffer.get(2, 0); // { char: 'é', width: 1, ... }
```

During `text()`, a zero-cell combining mark composes onto the previous base cell and leaves its
width unchanged. A leading combining mark is dropped because there is no prior base in that write.
The built-in zero-width table is a documented practical subset, not a claim to cover every Unicode
mark ever assigned.

In the last column, a wide glyph cannot fit because its continuation would fall outside the
buffer. `ScreenBuffer.set()` stores a width-1 space there—never a half glyph. Overwriting either
half of an existing wide glyph also clears the orphaned partner so stale terminal state cannot
remain.

<PlayExample id="guides/cell-width" title="Cell Width Laboratory" blurb="Compare ASCII, wide, combining, emoji, and ZWJ samples; change the wrap width and observe width-2 leads, width-0 continuations, and safe clipping." />

The laboratory's objective is to connect the abstract units to visible buffer evidence. Use
**Alt+W** to change the cell budget, **Alt+G** to jump to the ZWJ sample, and **Alt+N** or the
button to cycle all samples. The status names the action source so mouse and keyboard behavior are
equally observable.

## Wrapping and clipping

`wrapText()` is the same word-wrap used by the `Text` component. A UTF-16 surrogate pair is never
split. The helper counts display cells, preserves explicit newlines and internal whitespace,
prefers whole-word boundaries, and hard-breaks a word when needed.

```ts
import { wrapText } from '@jsvision/ui';

wrapText('the quick brown fox', 10);
// ['the quick', 'brown fox']

wrapText('日本語', 4);
// ['日本', '語']
```

The scan never splits a UTF-16 surrogate pair. It is still code-point wrapping, not fully
grapheme-aware wrapping: a ZWJ sequence, skin-tone sequence, or flag may split between its code
points. When such a grapheme must remain visually indivisible, give it enough width or use a
specialist text layout that explicitly owns grapheme segmentation.

A width-2 glyph given a one-cell wrap width is emitted alone so the algorithm always makes
progress. That output line can therefore measure wider than the requested width. Treat a one-cell
region as incompatible with wide content rather than expecting the glyph to be divided.

Wrapping chooses lines; clipping enforces rectangles. `Text` draws only the wrapped rows that fit
its assigned height. `DrawContext.text()` clips at view and ancestor cell boundaries, and a wide
glyph that would cross the final cell is omitted or represented by the buffer's safe space rather
than split.

```ts
import { Text, at, wrapText } from '@jsvision/ui';

const copy = 'Deployment finished with warnings.';
const width = 18;
const visibleRows = 2;
const wrappedRows = wrapText(copy, width);

panel.add(at(new Text(copy), 0, 0, width, visibleRows));
const clipped = wrappedRows.length > visibleRows;
```

Show an explicit continuation cue or use a scrollable surface when `clipped` is true. A rectangle
that silently hides required instructions is not a responsive layout.

## Capability-aware glyphs

Text support has two related but different layers:

1. `unicode` reports whether UTF-8 output is usable and which width model the host selected.
2. `glyphs` reports whether specific UI chrome families—box drawing, half blocks, and
   ambiguous-width arrows or marks—are safe.

Resolve a profile at the host boundary and treat it as immutable:

```ts
import { resolveCapabilities } from '@jsvision/core';

const { profile: caps, reasons } = resolveCapabilities();

if (!caps.glyphs.boxDrawing) {
  console.error(`Box drawing degraded by ${reasons.glyphs}`);
}
```

Do not infer support from a terminal name inside a widget. `DrawContext.caps` exposes the same
resolved profile during rendering, so a custom view can choose a semantic fallback at paint time:

```ts
import { View } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

class StateMark extends View {
  override draw(ctx: DrawContext): void {
    const mark = ctx.caps.unicode.utf8 ? '✓' : 'OK';
    ctx.text(0, 0, mark, ctx.color('staticText'));
  }
}
```

The renderer also applies `fallbackGlyph()` to known chrome:

| Capability condition         | Unicode input                 | Serialized fallback            |
| ---------------------------- | ----------------------------- | ------------------------------ |
| `boxDrawing: false`          | `┌ ─ │`                       | plus, hyphen, and vertical bar |
| `glyphs.ambiguousWide: true` | `▲ ◄ ►`                       | `^ < >`                        |
| `halfBlocks: false`          | `█ ▒`                         | `# #`                          |
| `unicode.utf8: false`        | generic non-ASCII such as `é` | `?`                            |

Use the public helper when a custom view needs to preview that exact substitution:

```ts
import { degradeCapsFully, fallbackGlyph, isAsciiSafe, resolveCapabilities } from '@jsvision/core';

const utf8 = resolveCapabilities().profile;
const asciiChrome = degradeCapsFully(utf8);

fallbackGlyph('┌', asciiChrome); // '+'
fallbackGlyph('█', asciiChrome); // '#'
isAsciiSafe(asciiChrome); // true
```

`degradeCapsFully()` turns off box drawing and half blocks and enables ambiguous-width fallback. It
does not turn off or change `unicode.utf8`; generic text such as `é` therefore stays Unicode under
that profile. A standalone generic non-ASCII glyph such as precomposed `é` becomes `?` only when
UTF-8 output itself is false. Fallback examines the leading code point of each stored cell,
however. A decomposed
`e\u0301` is stored as one cell beginning with ASCII `e`, so its combining suffix may still be
serialized. `isAsciiSafe()` means the host can skip the ambiguous-width chrome probe because UTF-8
is off or the chrome families are already fully degraded; it does not promise pure ASCII for
arbitrary application content. When pure ASCII is mandatory, supply application-owned ASCII
wording or transliterate before drawing.

<PlayExample id="guides/glyph-fallback" title="Glyph Fallback Laboratory" blurb="Cycle real UTF-8, adapted-chrome, and ASCII-safe profiles, then turn UTF-8 off to observe exact box, arrow, block, and text substitutions." />

The laboratory's objective is to distinguish selective adaptation from full degradation. Use
**Alt+P** to move through UTF-8, adapted chrome, and ASCII-safe chrome. Use **Alt+U** to turn UTF-8
off in the current deterministic profile. No visitor terminal or browser capability is probed.

## Composition and integration

Text geometry crosses several JSVision boundaries:

- **Layout** assigns the rectangle. Measure labels in cells, reserve wrapped height, and retest
  after resize or translation.
- **Reactivity** updates content, but a repaint does not automatically renegotiate a parent's
  geometry. Keep changing text within a stable budget or trigger deliberate reflow.
- **Focus and commands** must not rely on a glyph or color alone. Pair icons with words, hotkeys,
  and visible focus cues.
- **Theming** supplies semantic colors, while capabilities decide whether a glyph family is safe.
  A monochrome theme and an ASCII-safe profile solve different problems.
- **Internationalization** can change both string length and cell width. Measure the translated
  result rather than the source-language placeholder.
- **Components** own their interaction details. The [`Text` component](/components/controls/text)
  owns static wrapping; Input owns simple one-line editing; specialist editors own grapheme-aware
  navigation.

For custom views, keep measurement and drawing on the same unit. If `measure()` reports
`string.length` but `draw()` writes through the width-aware buffer, siblings will be placed using
one geometry while the glyphs occupy another.

## Advanced behavior

### Ambiguous width and host adaptation

East Asian Ambiguous code points are commonly one cell but can render as two under a CJK locale or
font fallback. JSVision's startup width probe tests bounded chrome groups. When adaptation is
enabled, a wide arrow group enables ambiguous-glyph substitution; a wide box/shade group disables
box drawing and half blocks. The effective profile is downgrade-only.

The probe is best-effort and host-owned. A silent or non-TTY environment cannot provide a measured
answer. `JSVISION_ASCII` forces fully degraded chrome and skips the probe. Treat the resulting
capability and its reason as evidence; do not present a probe result as a universal terminal
guarantee.

### Serialization preserves cell footprints

The buffer keeps real Unicode glyphs. Substitution happens during serialization, so one application
frame can target several capability profiles. When a width-2 glyph falls back to one ASCII
character, serialization emits a padding space for its continuation. The two-cell footprint stays
stable and later columns do not drift.

### Sanitization is separate from Unicode correctness

Width-correct text can still be unsafe text. Buffer and draw-context writes sanitize terminal
control bytes so a displayed string cannot inject an escape sequence into the frame. Validation,
redaction, and destination-specific escaping remain separate responsibilities. Continue with
[Displaying untrusted text safely](/guide/untrusted-text) before rendering external diagnostics or
interpreted content.

### Accessibility is part of the state model

Never encode a state only as `✓`, red text, or a shaded block. Include a word such as `Ready`,
`Warning`, or `Disabled`; keep the action keyboard reachable; and preserve visible focus. An
ASCII-safe or monochrome profile should reduce decoration without removing meaning.

## Failure modes and diagnosis

Use cell and capability evidence to distinguish similar symptoms.

| Symptom                                       | Cause                                                                             | Correction or fix                                                           | Evidence                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Columns drift after CJK or emoji appears      | Width was calculated with `string.length`                                         | Measure with `stringWidth()`                                                | Sum of solved column widths matches rendered display cells             |
| Accent appears detached or missing            | A combining mark was written without its base or split at an application boundary | Keep base and mark in one text write; use grapheme segmentation for editing | Base cell contains the combining sequence and still has width 1        |
| Border disappears beside a wide glyph         | A fixed rectangle ended at a width-2 glyph boundary                               | Reserve both cells or clip before the border                                | Final border cell remains intact; no half glyph is stored              |
| One-cell wrap line exceeds its budget         | A width-2 glyph cannot fit but `wrapText()` must make progress                    | Require at least two cells or reject that content profile                   | The emitted line has one whole glyph and `stringWidth(line) === 2`     |
| Joined emoji breaks across rows               | General wrapping follows code points, not extended graphemes                      | Allocate enough width or use a grapheme-aware specialist                    | ZWJ/skin-tone/flag sequence stays together in the selected surface     |
| Input caret and text columns disagree         | Plain Input uses JavaScript string indices                                        | Constrain the input profile or choose the Code Editor                       | Wide/grapheme samples reproduce only on the simple Input path          |
| Arrows shear chrome but text remains readable | Ambiguous chrome rendered double width                                            | Enable host adaptation or force ASCII-safe chrome                           | Resolved glyph profile swaps arrows while preserving box/text families |
| Boxes become ASCII but `é` remains            | `degradeCapsFully()` changed chrome, not UTF-8                                    | Keep it when text is supported; turn UTF-8 off only from real host evidence | `unicode.utf8` remains true and `fallbackGlyph('é')` returns `é`       |
| A standalone precomposed `é` becomes `?`      | UTF-8 output is unavailable                                                       | Provide ASCII wording or transliteration at the application boundary        | Profile reports UTF-8 off and generic fallback returns `?`             |
| A decomposed accent still emits its suffix    | Cell fallback examined the leading ASCII base                                     | Transliterate the complete application string before drawing                | Serialized output still contains the combining code point              |
| Status meaning disappears in mono/ASCII       | Meaning depended on color or a decorative glyph                                   | Add an ASCII text cue and keyboard-visible state                            | `Ready`, `Error`, or another label survives both profiles              |

Record the sample, its code points, measured cells, solved rectangle, capability fields, and
generic outcome. Do not log sensitive user text merely to debug width.

## Best practices

- **Name the unit.** Say code unit, code point, grapheme, or cell. “Character count” hides the
  decision and makes bugs hard to diagnose.
- **Measure terminal geometry with display-cell helpers.** JavaScript length is storage geometry,
  so using it for columns misplaces wide and combining text.
- **Keep measurement and drawing consistent.** A custom `measure()` and `draw()` must agree or
  responsive layout will drift.
- **Budget at least two cells for unrestricted Unicode.** A wide glyph cannot be safely divided
  into a one-cell rectangle.
- **Treat general wrapping as code-point based.** If extended graphemes must remain indivisible,
  choose a surface that explicitly guarantees that behavior.
- **Let the capability profile drive chrome.** Terminal names and assumptions go stale; resolved
  evidence supports deterministic tests and honest degradation.
- **Distinguish ASCII-safe chrome from UTF-8-off content.** They are separate states with different
  user-visible consequences.
- **Preserve meaning without color or decoration.** Text labels, visible focus, and keyboard paths
  survive monochrome and fallback profiles.
- **Test compact, resized, maximized, and restored geometry.** Width bugs often hide at startup and
  emerge only at a clipping edge.
- **Keep untrusted-text safety separate.** Correct width does not authorize raw control sequences,
  logs, shell input, or markup.

## Practice and next steps

1. Measure `A`, `e` plus a combining acute mark, `界`, `😀`, and `👩‍💻` with JavaScript length,
   code-point count, and `stringWidth()`. Explain every difference.
2. Draw a wide glyph and a combining sequence into `ScreenBuffer`. Inspect the width-2 lead,
   width-0 continuation, and composed width-1 base. Then attempt a last-column wide write and verify
   that a safe space appears instead of a half glyph.
3. Wrap a mixed English/CJK sentence at 12, 8, 4, and 1 cells. Resize the containing view and record
   when wrapping is sufficient and when height clipping needs an explicit continuation cue.
4. Compare normal UTF-8, ambiguous-arrow adaptation, fully degraded chrome, and UTF-8-off profiles.
   Verify box, arrow, block, and generic text fallback separately.
5. Repeat both laboratories using only keyboard actions. Switch to a monochrome theme and confirm
   every sample, profile, action, and status remains understandable without color.

Continue with [Scrolling, lists & large content](/guide/scrolling-lists-and-large-content) to place
large text collections inside bounded viewports. Use
[Theming & colour depth](/guide/theming-and-colour-depth) for semantic color roles,
[Accessibility & resilient interaction](/guide/accessibility) for non-color interaction design, and the
[Text component](/components/controls/text) for the focused static-text API.

## API reference

- [`ScreenBuffer`](/api/core/classes/ScreenBuffer) — width-correct cell storage and clipped writes.
- [`charWidth`](/api/core/functions/charWidth) — one code point under an explicit width mode.
- [`fallbackGlyph`](/api/core/functions/fallbackGlyph) — capability-driven chrome substitution.
- [`resolveCapabilities`](/api/core/functions/resolveCapabilities),
  [`degradeCapsFully`](/api/core/functions/degradeCapsFully), and
  [`isAsciiSafe`](/api/core/functions/isAsciiSafe) — host profile and degradation decisions.
- [`stringWidth`](/api/ui/functions/stringWidth) and [`wrapText`](/api/ui/functions/wrapText) —
  public cell measurement and wrapping.
- [`Text`](/api/ui/classes/Text) — bounded, reactive, non-focusable text rendering.
