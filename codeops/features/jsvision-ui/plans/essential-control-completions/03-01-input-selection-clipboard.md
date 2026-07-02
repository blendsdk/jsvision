# 03-01 — Input: selection · clipboard · logical caret

> Edits `packages/ui/src/controls/input.ts`. TV source: `TInputLine` (`tinputli.cpp`).
> Unit: **code point** (PA-1) — `curPos`/`firstPos`/`selStart`/`selEnd` are JS string indices.

## TV decode (GATE-1)

> Decoded 2026-07-01 from `/home/gevik/workdir/github/tvision/source/tvision/tinputli.cpp` (+ `dialogs.h`).
> Re-open and re-verify at implementation time (BEFORE-decode task); diff rendered output after (GATE-2).

### Selection model
- Fields `selStart`/`selEnd`/`anchor`/`curPos`/`firstPos` (`dialogs.h:187-190,216`). `anchor` is the fixed
  end during extension; `selStart ≤ selEnd` always.
- `adjustSelectBlock()` (`tinputli.cpp:225-237`): `if (curPos < anchor) {selStart=curPos; selEnd=anchor}
  else {selStart=anchor; selEnd=curPos}`.
- `deleteSelect()` (`:203-212`): guarded by `selStart < selEnd`; removes `[selStart,selEnd)`, sets
  `curPos=selStart`. Does **not** clear the selection.
- Shift-extension (`:341-359`): on a `padKeys` motion (Home/Left/Right/End/Ctrl+Left/Ctrl+Right) **with
  kbShift**, set `anchor` = `(curPos==selEnd ? selStart : selStart==selEnd ? curPos : selEnd)`, then
  `extendBlock=True`. After the motion moves `curPos`, `adjustSelectBlock()` derives the range (`:456-457`).
  A motion **without** shift → `extendBlock=False` → `selStart=selEnd=0` collapse (`:459`).
- Word nav (`:64-82`, PA-12): `prevWord`/`nextWord` = **space-delimited** (first non-space after a space).
  Ctrl+Left/Right call them (`:368-372`).
- Home/End (`:374-379`): `curPos=0` / `curPos=strlen`. `selectAll(enable)` (`:496-508`): `selStart=0`,
  `curPos=selEnd=strlen` (enable) or all-0 (disable), then scroll to show `curPos`.
- Mouse (`:312-338`): mouseDown sets `anchor=mousePos` (:325); the drag loop sets `curPos=mousePos` +
  `adjustSelectBlock()` per move (:333-334); `meDoubleClick → selectAll(True)` (:322). `mousePos` =
  `max(0, mouse.x + firstPos - 1)` mapped to an offset (:188-196).
- Edit-over-selection: printable (`:418-446`) → `deleteSelect()` **first** (:424), then insert with
  validate; Backspace (`:380-388`) → if empty selection make a 1-char one to the left then `deleteSelect`;
  Delete (`:399-405`) → `deleteSelect` if selection else delete char under cursor.

### Draw + color
- `draw()` (`:134-161`): fill with `getColor(sfFocused?2:1)`; text at **column 1** scrolled by `firstPos`;
  `◄`/`►` at cols 0 / `size.x-1` in `getColor(4)`; selection band = fill cols `[l+1, r+1)` in
  **`getColor(3)`** where `l=max(0,displayedPos(selStart)-firstPos)`, `r=min(size.x-2,displayedPos(selEnd)-
  firstPos)`, only if `l<r` (`:152-157`).
- **Selection color (PA-6):** `cpInputLine = "\x13\x13\x14\x15"` (`:84`) → color-1=`0x13`, color-2=`0x13`,
  **color-3=`0x14`** (selection), color-4=`0x15`. `getColor(3)`→slot `0x14`→resolve through `cpGrayDialog`→
  `cpAppColor` to the exact attribute byte **at implementation GATE-1**. ⚠ The decode read color-1==color-2
  (both `0x13`) — i.e. TV draws a focused (`getColor(2)`) and unfocused (`getColor(1)`) input **identically**,
  which does **not** match the shipped RD-06 `inputNormal`(19)/`inputSelected`(20) split (the RD-06 focused
  green looks like a mis-decode against the blue-window palette rather than the gray-dialog owner). **PF-004:**
  GATE-1 (P0.1) must resolve `getColor(1/2/3)` for a gray-dialog-hosted input and, if focused==unfocused is
  confirmed, **surface a scoped `inputSelected` fidelity decision** (may ripple into RD-06 goldens — raise it,
  don't silently change shipped color) — in addition to fixing the new `inputSelection` (color-3) value; the
  AFTER-diff must confirm the rendered highlight byte against the source.
- Logical caret (`:160`): `setCursor(displayedPos(curPos)-firstPos+1, 0)`; `sfCursorVis` set in ctor (:100).
  `displayedPos(pos)=strwidth(data[0..pos))` (:198-201).

### Clipboard (`:469-489`)
- cmCopy: `TClipboard::setText(data[selStart..selEnd))` (:475-478). Empty selection → empty string.
- cmCut: same, then `saveState(); deleteSelect(); checkValid(True); selStart=selEnd=0` (:479-485). Empty
  selection → `deleteSelect` no-ops.
- cmPaste: `TClipboard::requestText()` async → pasted text arrives as key-like events, each inserted
  char-by-char through the same validate path (replaces the selection first) (PA-8).

## Spec (this implementation)

### State
Add `selStart`/`selEnd`/`anchor` (JS string indices, default 0) to `Input`. Selection is **empty** when
`selStart===selEnd`.

### Keyboard (extends `handleKey`)
| Chord | Effect |
|-------|--------|
| Shift+Left/Right | extend by one code point (set anchor per the TV rule, move `curPos`, `adjustSelectBlock`) |
| Ctrl+Shift+Left/Right | extend by word (`prevWord`/`nextWord`, space-delimited) |
| Shift+Home / Shift+End | extend to 0 / `value.length` |
| Ctrl+A | `selectAll(true)` |
| plain Left/Right/Home/End/Ctrl+arrow | move `curPos`; **collapse** (`selStart=selEnd=0`) |
| printable over non-empty selection | `deleteSelect()` then `insertPrintable` (existing validate + maxLength) |
| Backspace | if empty selection, delete code point left; else `deleteSelect()` |
| Delete | if empty selection, delete code point under cursor; else `deleteSelect()` |

### Mouse (extends `onEvent` mouse branch)
Press → `anchor = curPos = posFromMouse(x)`, collapse; drag (captured via the existing `setCapture` seam,
PA-5-adjacent) → `curPos = posFromMouse(x)` + `adjustSelectBlock` each move; double-click → `selectAll`.

### Clipboard
- **Copy** (`Commands.copy` / Ctrl+Insert) — handled in `Input.onEvent`: build the selected substring and
  request the write via the additive `ev.setClipboard?(text)` dispatch-envelope seam. The control has no output
  stream of its own, so the seam is wired in `event-loop.ts` `routeContext` → `setClipboard(text, caps)` → the
  loop's co-owned output stream (03-04 — clipboard rides the same output path as the frame/caret). Caps-gated
  no-op when `!caps.osc.clipboard52`. (Full seam contract in the boxed decision below.)
- Cut = copy + `deleteSelect` + re-validate + collapse.
- Paste: handle `type==='paste'` in `onEvent` — replace selection, then insert `ev.text` **code point by
  code point**, each through `validator.isValidInput` + `maxLength` (drop invalid); bounded by the core
  1 MiB `PasteEvent` cap. Shift+Insert maps to the same path (synthesize/route a paste, or emit
  `Commands.paste`). Ctrl+Insert = copy, Shift+Delete = cut.

> **Clipboard-write seam decision (records PA-7 detail):** add `setClipboard?: (text: string) => void` to
> the `DispatchEvent` envelope (`view/types.ts`), sourced in `event-loop.ts` `routeContext` from a loop
> option `writeClipboard?(seq)` that `run()` wires to the host output stream (same co-owned stream as the
> caret, PA-5). Additive; caps-gated no-op when `!caps.osc.clipboard52`. This keeps the control pure (no
> direct I/O) and mirrors the `emit`/`setCapture` envelope seams.

### Logical caret
`draw()` marks the caret cell at `displayedPos(curPos)-firstPos+1` (col, 0-based row 0) by repainting **that
one cell** in a concrete **reversed `Style`** — the field role's fg/bg swapped: `{ fg: base.bg, bg: base.fg }`
(where `base = ctx.color(sfFocused ? 'inputSelected' : 'inputNormal')`). This must differ from the plain field
style so the caret is visible even without the hardware cursor; it is drawn **last** (after the value text +
selection band). It also reports the cell via `desiredCaret()` (03-04) for the hardware cursor when focused.
**Edge (PF-008):** when `curPos` is at the far right during right-scroll, the caret column can coincide with
the `►` arrow column (`w-1`); the caret is drawn last, so it takes that cell and the arrow is hidden for it —
asserted by an impl-test edge (caret-vs-arrow overlap).

### Files & size
All edits in `input.ts`; if it approaches 500 lines, extract `input-selection.ts` (pure selection math:
`adjustSelectBlock`/`deleteSelect`/`prevWord`/`nextWord`/`posFromMouse`) imported by `Input`. Keep the
control class < 500 lines (AC-13).

## Security
Paste is untrusted: bounded by the core `PASTE_CAP_BYTES`, filtered per code point through
`validator.isValidInput` + `maxLength`, drawn only via `DrawContext`→`ScreenBuffer`+`sanitize` (no raw
escapes reach the terminal). `setClipboard` base64-encodes + `sanitize`s and is caps-gated (AC-15).
