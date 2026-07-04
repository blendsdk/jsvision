# 03-02: `ColorPicker` + hex field (the swatch dropdown)

> **Document**: 03-02-color-picker.md
> **Parent**: [Index](00-index.md)
> **Component**: `packages/ui/src/color/color-picker.ts` (`ColorPicker extends Group`)

`ColorPicker` has **no Turbo Vision counterpart** — it is a documented **extension** that compresses
the heavy `TColorDialog` (a 61×18 full-screen palette editor, `colorsel.cpp:694-749`) into a compact
form-field dropdown. It composes shipped pieces + the generalized `openAnchoredPopup` and mirrors
`DatePicker` (`date-picker.ts`) one-for-one.

---

## Composition

```
[ chip / hex field (fr) | ▐↓▌ button (3) ]
```

- **Trigger chip** — a small `View` (`ColorChip`) showing the current `value` as a `█`-block cell (in
  `value`'s color, near-black uses the `colorMarker` contrast for visibility) + an optional caption
  (`label`, or `nameFor(value)`, or the raw color string) in `staticText`/`label`. TV's `TColorDisplay`
  idea (`colorsel.cpp:345-355`).
- **`ColorButton`** — the trailing 3-cell `▐↓▌` button drawn via the **shared** `drawDropdownIcon(ctx,
  0)` (`dropdown/popup.ts:41`) so it is byte-identical to ComboBox/DatePicker. Not focusable;
  click-only (mouse-down → `open`).
- When `allowCustom` is on the field portion is the **chip + a hex `Input` row** (the hex field lives
  inside the popup below the grid, per AC-8 — see below); the chip itself stays a display-only block +
  caption.

## Options + public API

```ts
export interface ColorPickerOptions {
  value: Signal<Color>;                 // two-way selected color (shared with the hosted swatch)
  colors?: readonly Color[];            // forwarded to the ColorSwatch (default ANSI16_ORDER)
  columns?: number;                     // forwarded (default 4)
  allowCustom?: boolean;                // default true → the popup includes a hex Input
  label?: string;                       // optional chip caption prefix
  nameFor?: (c: Color) => string;       // optional name accessor for the caption (PA-13)
  onChange?: (c: Color) => void;
}

export class ColorPicker extends Group {
  readonly value: Signal<Color>;
}
```

## Open / commit / cancel (AC-7, mirrors `DatePicker`)

`open(ev)` (verbatim the `date-picker.ts:167-190` shape):

1. `const host = ev.popupHost; if (host === undefined) return;` — **headless no-op** (AC-7).
2. `ev.focusView?.(this)` — focus the picker first.
3. `openAnchoredPopup({ host, anchor: absoluteRect(this), buildContent, contentSize, focusTarget })`.

`buildContent(commit)` builds the popup body inside the popup's reactive owner:

- A `Group` (column) of `[ ColorSwatch (fr) | hex Input (1, if allowCustom) ]`.
- The `ColorSwatch` shares **the same `value` signal**; its `onCommit` is wired to `commit()` so a
  **mouse-up over a cell** (PA-11: drag previews via cursor tracking, down alone does not close) or
  **Enter** on the cursor sets `value` then closes.
- The hex `Input` (if `allowCustom`) binds a `text: Signal<string>` gated by `filter('#0-9a-fA-F')`;
  on a complete valid entry (`toRgb(text())` succeeds — caught `InvalidColorError` ⇒ ignore) **and**
  Enter, set `value` to `text()` (a truecolor) then `commit()`. Incomplete/invalid leaves `value`
  unchanged (AC-8). The value⟷text two-way bind reads only the opposite signal (the ComboBox idiom,
  `date-picker.ts:131-144`).

`contentSize` = the grid's `{ width: max(columns*3, HEX_MIN), height: rows (+1 if the hex row) }` + the
placement `+1` compensation (per `openAnchoredPopup`'s `contentSize.height` contract, `popup.ts:77-83`).
The width is **floored to `HEX_MIN` (≈ 9 columns, room for `#rrggbb` + padding) only when `allowCustom`
is on**, so a small `columns` (e.g. `2` → width `6`) can't clip the hex `Input`; without the hex row the
width stays `columns*3` (PF-006).
`focusTarget` = the `ColorSwatch` (grid-first: the grid receives focus on open, matching the
`pick-a-swatch` common path).

**Focus path to the hex field (AC-8):** the popup body is a focus group `[ ColorSwatch | hex Input ]`;
the swatch is focused first (above), and **Tab** (RD-04 focus traversal within the popup group) moves
focus swatch→hex `Input` so the user can type a `#rrggbb` (Shift-Tab returns to the grid). ST-9
dispatches a Tab before typing the hex. Arrow keys stay owned by whichever of the two holds focus.

**Cancel:** Esc / outside mouse-down dismiss the popup via `openAnchoredPopup`'s built-in
catcher/Esc/focus-loss handling, **without** changing `value` (AC-7).

### `onEvent(ev)` — open triggers (AC-7)

- `key === 'down' && (this.focused || ev.event.alt)` → `open(ev)` (Down / Alt+Down).
- The `ColorButton`'s mouse-down → `open(ev)`.

## Two directions of value⟷text (hex), no feedback loop

Exactly the `DatePicker` idiom: `value → text` serializes `value` to a `#rrggbb` string (reading only
`value`); `text → value` parses via `toRgb()` and sets `value` only on a complete valid parse, reading
the current value via `untrack` for the equality guard (reading only `text`). Neither direction
subscribes to the signal it writes.

## Popup generalization consumed (AC-9)

`ColorPicker` is the **fourth** client of `openAnchoredPopup` and the **second non-list** client
(after `DatePicker`). It uses the API RD-20 landed unchanged — **RD-21 does not edit `dropdown/`**. The
plan's Phase-5 verification re-runs the `history.*` / `combo-box.*` / `date-picker.*` suites to prove
they stay green.

## Security (AC-8/AC-13)

The hex field is **`filter`-gated** (allowlist `#` + hex digits — no arbitrary text) and the final
parse goes through **`toRgb()`** (the single validation boundary; a malformed string throws
`InvalidColorError`, caught → `value` unchanged). An invalid color is never committed. Chip caption /
block / button glyphs all route through `sanitize`.

**Line budget:** `color-picker.ts` ~230 lines (incl. `ColorChip` + `ColorButton`) ≤ 500 (PA-4).
