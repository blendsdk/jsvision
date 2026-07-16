# UI: `Text.severity` & `Input.placeholder`

> **Document**: 03-02-ui-text-input.md
> **Parent**: [Index](00-index.md)
> **Owns**: the `@jsvision/ui` control changes and placeholder propagation.
> **Depends on**: 03-01 (the roles must exist before `ctx.color('dangerText')` typechecks).

## Overview

Two additive, backward-compatible control options: `Text` gains `severity?: 'error' | 'warning'`
(painted via the 03-01 roles), and `Input` gains `placeholder?: string | Signal<string>` (muted, over
an empty value), forwarded to `DatePicker`/`ComboBox`/`inputBox()`. No behaviour changes for existing
call sites (AR-26/27/28/29/30).

## Architecture

See 02 §"What exists — UI controls" for the current shapes. Both changes are new optional fields;
`draw()`/`paintInput` gain one branch each.

## Implementation Details

### `Text.severity` (`controls/text.ts`)

New option type + optional ctor arg (public value stays semantic, decoupled from role names — AR-27):
```ts
export type TextSeverity = 'error' | 'warning';
export interface TextOptions {
  /** Paint the text in a semantic severity colour instead of the default static-text role. */
  readonly severity?: TextSeverity;
}
// new Text(content)                              — unchanged (staticText)
// new Text(content, { severity: 'error' })       — danger-red (dangerText role)
constructor(content: string | (() => string), opts?: TextOptions)
```

Store `this.severity = opts?.severity`. In `draw()`, replace the hard-coded role (`text.ts:114`):
```ts
const role = this.severity === 'error' ? 'dangerText' : this.severity === 'warning' ? 'warningText' : 'staticText';
const style = ctx.color(role);
```
Everything else (`wrapText`, `fillRect`, reactive `() => string` content) is unchanged. `severity` is
**static** (no reactive getter) — content is already reactive, which covers the touched-gated reveal
`new Text(() => touched ? error : '', { severity: 'error' })` (AR-27, RD Won't-Have).

**Docs & barrel:** update the `Text` class `@example` (`text.ts:73-88`) to add a `severity: 'error'`
line so `check:docs` sees the option demonstrated on the class (RD PF-004/AC #9). **Re-export
`TextOptions`/`TextSeverity` from `controls/index.ts` + the `export type` block in `ui/src/index.ts`**
— the sibling convention: every control's Options type is barrel-exported (`ButtonOptions`,
`InputOptions`, `SliderOptions`, …), but today the barrel exports `Text` with no `Text*Options`, so a
consumer cannot `import type { TextSeverity }`. `check:docs` does **not** require a per-interface
`@example`: `check-jsdoc.mjs` Check B enforces `@example` only on re-exported **classes/functions** and
exempts all interfaces/types (so `TextOptions` needs none whether or not it is barrel-exported;
`controls/index.ts:16` is `InputOptions`).

### `Input.placeholder` (`controls/input.ts` + `controls/input-render.ts`)

Extend `InputOptions` (`input.ts:33-40`):
```ts
/** Muted hint shown while the bound value is empty; never part of the value. */
placeholder?: string | Signal<string>;
```
Store `this.placeholder = opts.placeholder`. Reactivity (AR-P5): if `placeholder` is a signal,
subscribe on mount alongside the existing value binding (`input.ts:132-147`) so a changing
placeholder repaints an empty field; a plain string needs no subscription.

Resolve to a string and pass it to `paintInput` in `draw()` (`input.ts:181-188`):
```ts
paintInput(ctx, {
  value: this.value(), focused: this.state.focused,
  selStart: this.selStart, selEnd: this.selEnd, curPos: this.curPos, firstPos: this.firstPos,
  placeholder: this.placeholderText(), // '' | resolved string
});
```

Extend `InputPaintState` (`input-render.ts:14-27`) with `readonly placeholder?: string;` and, in
`paintInput` (`input-render.ts:78-105`), paint it **only when the value is empty**, after the field
fill and before the caret:
```ts
// Placeholder: shown only over an empty value, in a muted style; display-only (no edit/scroll math).
if (v === '' && s.placeholder) {
  const muted: Style = { fg: ctx.color('staticText').fg, bg: style.bg }; // staticText fg over the field bg
  if (w > 1) ctx.text(1, 0, s.placeholder.slice(0, w - 1), muted); // clipped to width, starts at col 1
}
```
Invariants (AR-28/29, RD Must-Have):
- Hidden the instant the value is non-empty (the `v === ''` guard) — the placeholder is **never**
  the bound value; reading/submitting an untouched field yields `''`.
- The caret still draws last (focused, `curPos = 0`) reversing col 1 over the placeholder's first
  glyph — the placeholder takes part in **no** selection/scroll/caret math.
- Muted style = `staticText` fg over the field bg (`inputNormal.bg` unfocused / `inputSelected.bg`
  focused — both blue in `defaultTheme`); no new `inputPlaceholder` role (AR-29).
- Empty placeholder ⇒ nothing painted; over-width placeholder ⇒ clipped, no wrap/overflow (AC #4).

### Placeholder propagation (AR-30/PF-001)

Add `placeholder?: string | Signal<string>` to each wrapper's options and forward it into the Input
it constructs:

| Wrapper | Options interface | Forward at | Into |
| ------- | ----------------- | ---------- | ---- |
| `DatePicker` | `DatePickerOptions` (`date-picker.ts:55-74`) | `date-picker.ts:133` | `new Input({ value: this.text, validator: picture(…), maxLength: …, placeholder: opts.placeholder })` |
| `ComboBox` | `ComboBoxOptions<T>` (`combo-box.ts:35-54`) | `combo-box.ts:148` | editable branch `{ value: this.text, placeholder: opts.placeholder }` (select-only branch optional — a rejected-input field rarely needs a hint) |
| `inputBox()` | `InputBoxOptions` (`message-box.ts:40-49`) | `message-box.ts:161` | inner `new Input({ value: o.value, validator: o.validator, placeholder: o.placeholder })` (the first arg to `at(…)`, not the rect) |

**Excluded (AR-30/PF-001):** `History` (owns no Input) and `ColorPicker` (transient, `allowCustom`-
gated hex editor). No change to either.

> **DatePicker UX note (RD §150):** the field's `picture(mask)` validator may already render a mask
> skeleton, so a placeholder is partly redundant there — still supported, per the uniform option.

## Integration Points
- Both new strings reach the buffer only through `ctx.text()` → `sanitize()` → `ScreenBuffer.set()`
  — the same sanitising path RD-04 pinned; no bypass. Asserted in 07 (ST-U9).
- `ctx.color('dangerText'|'warningText')` typechecks because 03-01 added the roles to `Theme`
  (`ThemeRoleName = keyof Theme`).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Placeholder text with control bytes | Rendered through the sanitising path — no raw C0/DEL/C1 cell | AR-22 |
| Placeholder mistaken for the value | Impossible — it is display-only, gated on `v === ''`, never written to the signal | AR-28 |
| `severity` value outside `'error'|'warning'` | Prevented by the `TextSeverity` union at the type layer | AR-27 |
| Placeholder wider than the field | Clipped to `w - 1` in `paintInput` | AR-28 |

> **Traceability:** references `00-ambiguity-register.md` AR-26/27/28/29/30/32, AR-P5, and RD-09
> §"`Text` severity" / §"`Input` placeholder".

## Testing Requirements
- `Text.severity` paints the mapped role's fg; unset paints `staticText`; existing ctor calls
  compile/render unchanged — 07 ST-U1…U3.
- `Input.placeholder` shown muted when empty, gone on first char, never in the value; empty/over-width
  boundaries — 07 ST-U4…U8.
- Forwarding on `DatePicker`/`ComboBox`/`inputBox` — 07 ST-U10…U12.
- Render-path sanitisation of both strings — 07 ST-U9.
