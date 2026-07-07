# Terminal: the code-unit ring + `Terminal` view + `terminalWriter`

> **Document**: 03-05-terminal.md
> **Parent**: [Index](00-index.md)
> **Files**: `packages/ui/src/terminal/{ring.ts,terminal.ts,index.ts}`

## Overview

The streaming log sink (AR-257): a capacity-capped circular queue measured in **UTF-16 code units**
(PF-007) with TV's whole-line eviction, an auto-scrolling `View`, and the Should-Have
`terminalWriter` sink adapter (PA-4).

## TV decode (GATE 1)

`TTerminal : TTextDevice : TScroller` (`textview.h:37-95`, `textview.cpp:35-250`,
`ttprvlns.cpp:18-47`):

- **Ring** (`textview.cpp:66,79-100` — `bufDec`/`bufInc`/`canInsert`): `bufSize = min(32000, n)`;
  `queFront`/`queBack`; an oversized write keeps only the last `bufSize−1` units (the tail-trim
  lives in `do_sputn`, `textview.cpp:202-206` — PF-009); whole oldest **lines** are evicted until
  a write fits (never a partial line at the head); `\n` grows `limit.y`.
- **Draw** (`textview.cpp:117-240`): walks line boundaries **backwards** from `queFront`
  (`prevLines`, `ttprvlns.cpp:18-47`); auto-scrolls so the last line is visible; the cursor parks
  on the last line (`setCursor` inside draw, `textview.cpp:127,182`).
- **Colour**: `mapColor(1)` (`textview.cpp:125`) through `cpScroller "\x06\x07"`
  (`tscrolle.cpp:35`) → blue window → `cpAppColor[13]` = **`0x1E`** — role `terminalNormal` (PA-8).
- The C++ `streambuf`/`otstream` surface is replaced by `write()`/`writeLine()` (AR-257/AR-263).

## Implementation Details

### `ring.ts` (pure)

```ts
export class LineRing {
  constructor(capacity?: number);            // default 32000 code units (AR-257)
  write(text: string): void;                 // append; evict whole oldest lines to fit; tail-truncate oversized
  writeLine(text: string): void;             // write(text + '\n')
  lineCount(): number;
  line(i: number): string;                   // 0-based, ''-safe out of range
  clear(): void;
}
```

Store: an array of line strings + a running code-unit total (the ring semantics without byte
arithmetic — the observable TV behavior, unit = UTF-16 code units per PF-007). Eviction: while
`total + incoming > capacity`, drop line 0 whole; a single write longer than `capacity` keeps only
its last `capacity − 1` units (decode).

### `terminal.ts` — `class Terminal extends View`

```ts
export interface TerminalOptions { capacity?: number }
export class Terminal extends View {
  focusable = false;
  write(text: string): void; writeLine(text: string): void; clear(): void;
}
export function terminalWriter(term: Terminal): (s: string) => void; // Should-Have (PA-4) logger sink
```

Reactive: a version signal bumps per write → one coalesced repaint; draw renders the last
`size.y` lines bottom-anchored (auto-scroll, AC-14) in `terminalNormal`, every cell through
`DrawContext` (sanitize — content is hostile, AC-17); **wheel-only** scroll-back within the ring
(PF-006 — key events reach only the focused chain, `dispatch.ts:13`, and `Terminal` is
non-focusable; TV's keyboard scrolling came from attached scrollbars our Terminal doesn't have),
snapping back to bottom on the next write.

## Integration Points

Standalone (`src/terminal/`, own barrel); the kitchen-sink `editor/terminal` story writes to it on
a timer/button (03-07).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Empty ring | Draws an empty view, no crash | AC-14 |
| Write > capacity | Tail-kept per decode | AC-14 |
| capacity ≤ 0 | Clamped to 1 (degenerate but defined) | PA-8 batch edge |
| Control bytes/escapes in writes | Inert cells via sanitize | AC-17 |

## Testing Requirements

- Spec: ST-28…ST-29 (`ring.spec`, `terminal.spec`).
- Impl: eviction across multi-line writes, scroll-back + snap, `writeLine('')`, CRLF in writes.
