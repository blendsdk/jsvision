# Buffer core: gap buffer + segmentation + navigation + EOL (pure)

> **Document**: 03-01-buffer-core.md
> **Parent**: [Index](00-index.md)
> **Files**: `packages/ui/src/editor/buffer/{gap.ts,segment.ts,navigate.ts,eol.ts,index.ts}`

## Overview

The view-free pure core of the whole family (AR-250/AR-251/AR-252): a movable-gap buffer over
UTF-16 code units, grapheme-cluster/CRLF-atomic navigation primitives transcribed from TV, and the
per-buffer EOL policy. Everything here is spec-testable without a render root (RD §Purity split).

## TV decode (GATE 1)

Positions are logical offsets `P ∈ [0, length]`; the gap sits at the cursor.

- **`bufPtr`** — `bufPtr(P) = P < curPtr ? P : P + gapLen` (`edits.cpp:21-29`). Gap moves by
  `memmove` in `setSelect`/`setCurPtr` (`teditor2.cpp:513-532`); text loads at the buffer **end**
  (gap at front), `gapLen = bufSize − length` (`teditor2.cpp:423-442`).
- **Line scan** — `lineStart`/`lineEnd` scan backward/forward for `\r`/`\n`, CRLF-aware
  (`edits.cpp:94-159`); `nextLine(P) = nextChar(lineEnd(P))`, `prevLine(P) = lineStart(prevChar(P))`
  (`teditor2.cpp:270-352`).
- **Char steps** — `nextChar`/`prevChar` are cluster-aware and treat `\r\n` as ONE unit
  (`edits.cpp:94-159`; TV's double-byte awareness generalizes to our clusters per AR-251).
- **Word hops** — char-class boundaries per `getCharType`/`isWordBoundary` (`teditor2.cpp:45-59`
  — PF-009; the function literally named `isWordChar` is `:61-64` and serves the *search*
  whole-words test, 03-03). This is a **distinct decode** from Input's `tinputli.cpp` hops — do
  not merge (PF-014).
- **Visual columns** — `charPos(P, target)`/`charPtr(P, col)` expand tabs `pos = (pos|7)+1`
  (8-col stops; the tab math lives in `nextCharAndPos`, `teditor1.cpp:255`) and count wide glyphs
  by their core width (`WIDTH_MODE='wcwidth'`); `lineMove` preserves the visual column across
  lines, clamping at a shorter line's EOL (`teditor2.cpp:270-352`).
- **EOL policy** — TV `loadFile` reads raw bytes verbatim; `insertBuffer` converts new edits
  (RD AR-252/PF-008).

## Implementation Details

### `segment.ts` — grapheme segmentation (PA-5)

```ts
/** Cluster-boundary primitives over Intl.Segmenter (granularity 'grapheme'); pure, ui-local. */
export function nextClusterEnd(text: string, i: number): number;   // end of the cluster starting/containing i
export function prevClusterStart(text: string, i: number): number; // start of the cluster before i
export function isClusterStart(text: string, i: number): boolean;
```

One module-level `Intl.Segmenter('und', { granularity: 'grapheme' })` reused across calls.
Malformed input (lone surrogates) must never throw — a lone surrogate is its own cluster (the
RD-13 HR-01 rule; `Intl.Segmenter` already behaves this way, asserted by ST-4).

### `gap.ts` — `GapBuffer`

```ts
export class GapBuffer {
  constructor(text?: string);
  readonly length: number;                 // logical code units
  charAt(p: number): string;               // '' out of range (bounds-checked, never throws)
  slice(from: number, to: number): string; // gap-aware two-half copy
  moveGap(p: number): void;                // memmove analogue (typed on a string-array store)
  insert(p: number, text: string): number; // returns inserted length
  remove(from: number, to: number): void;
  text(): string;                          // full content, gap-invisible
}
```

Store: a single JS string pair (`before`/`after` halves split at the gap) — the idiomatic JS gap
buffer; `bufPtr` becomes the half-selection rule and `moveGap` a substring shuffle. O(1) amortized
edits at the gap, O(n) gap moves — the TV cost model (AR-250). (A `Uint16Array` backing is the
DEF-3 future; not built now.)

### `navigate.ts` — pure navigation over `{ charAt, slice, length }`

```ts
export function lineStart(b: BufText, p: number): number;
export function lineEnd(b: BufText, p: number): number;
export function nextChar(b: BufText, p: number): number;   // cluster + CRLF atomic
export function prevChar(b: BufText, p: number): number;
export function nextLine(b: BufText, p: number): number;
export function prevLine(b: BufText, p: number): number;
export function nextWord(b: BufText, p: number): number;   // getCharType/isWordBoundary classes, teditor2.cpp:45-59 (PF-014/PF-009)
export function prevWord(b: BufText, p: number): number;
export function charPos(b: BufText, lineStart: number, target: number): number; // position → visual col
export function charPtr(b: BufText, lineStart: number, col: number): number;    // visual col → position
```

`BufText = { charAt, slice, length }` is the minimal read interface (`GapBuffer` satisfies it,
and plain strings have all three natively) so oracles can run on plain strings. `slice` is
required for cluster segmentation (PF-007): the cluster steps operate on the **line slice**
(`lineStart(p)…lineEnd(p)`), which also keeps `Intl.Segmenter` inputs line-bounded. All functions
clamp `p` into `[0, length]` (hostile callers never throw — see Error Handling).

### `eol.ts`

```ts
export type LineEnding = 'lf' | 'crlf' | 'cr';
export function detectEol(text: string): LineEnding;          // first break wins; none ⇒ 'lf' (AR-252)
export function eolOf(kind: LineEnding): string;
export function convertNewEdit(text: string, kind: LineEnding): string; // normalize any \r\n|\r|\n runs
```

Loaded/`setText` content is stored **verbatim** (mixed EOLs preserved, PF-008); only new edits
(typed/pasted/clipboard) pass through `convertNewEdit`.

## Integration Points

- 03-02 `Editor` owns one `GapBuffer` + a `LineEnding` and exposes reactive `length`/`modified`.
- Core width engine supplies glyph widths to `charPos`/`charPtr` (clusters are NOT core's job — PF-002).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Position out of `[0, length]` | Clamp, never throw (pure fns are hostile-input-safe) | RD §Security (HR-01), PA-8 batch |
| Lone surrogate / malformed cluster | Treated as a 1-unit cluster; navigation never lands inside a well-formed pair | AC-16, RD §Security |
| Empty buffer | All navigation returns 0; `lineStart(0)=lineEnd(0)=0` | AC-1 edge |
| Mixed EOLs in loaded text | Preserved verbatim; round-trip byte-identical | AC-15 / PF-008 |

## Testing Requirements

- Spec: ST-1…ST-5 (`buffer.spec`, `segment` cases folded in) — see [07](07-testing-strategy.md).
- Impl: gap-move stress, alternating-edit amortization, CR-only files, tab-at-boundary `charPtr`
  round-trips, RD-13-style hostile-UTF-8 sweeps.
