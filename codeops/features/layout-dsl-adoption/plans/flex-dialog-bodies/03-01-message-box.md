# 03-01 — Component: messageBox / confirm / inputBox

> **File**: `packages/ui/src/dialog/message-box.ts` · **Implements**: R-1, R-4 · **Oracle**: survives (AR-6)

## Goal

Compose each dialog body with `cover(col(...))` + a centered button `row`, deleting the local
`at` / `centerX` / `PAIR_WIDTH` helpers. The **dialog width/height formulas stay exactly as they are**
(message-box.impl asserts them); only child positions change.

## Target structure

Keep `new Dialog({ title, width, height, centered:true })` and `padding:0`; replace the flat absolute
children with a single covering column. Import `col`, `row`, `grow`, `fixed`, `cover` from the internal view barrel (`../view/index.js`), matching this file's existing relative imports.

```ts
// okCancel messageBox (height 9):
dlg.add(
  cover(
    col(
      { padding: 1 },
      grow(new Text(o.text)),
      fixed(row({ justify: 'center', gap: 2 }, okButton(), cancelButton()), BUTTON.height),
    ),
  ),
);
// OK-only messageBox (height 7): the row holds a single okButton().
// confirm: row(yesButton(), noButton()). inputBox: see below.
```

- **`cover(col(...))`** — the `col` has in-flow children (a growing text + a fixed button band), so it has
  intrinsic content and does **not** collapse; `cover()` gives it the whole dialog content box (AR-3).
- **`row({ justify:'center', gap:2 })`** — reproduces the old centered pair (`PAIR_WIDTH = 10+2+10`) with
  no `centerX` math. A single-button row is trivially centered.
- **`fixed(row, BUTTON.height)`** — pins the button band to 2 rows at the bottom of the column; `grow(text)`
  absorbs the rest. `padding:1` reproduces a one-cell inset inside the frame (the exact child rects may
  diverge from the old `x:3` — that is sanctioned divergence; no oracle asserts them).

### inputBox

Preserve the **[Input, OK, Cancel]** focusable order (Input added first today). The `Label` is
non-focusable and links to the input for its `~N~` hotkey:

```ts
const input = new Input({ value: o.value, validator: o.validator, placeholder: o.placeholder });
dlg.add(
  cover(
    col(
      { padding: 1 },
      new Label(o.label, input), // above the field; non-focusable, links to `input`
      fixed(input, 1),
      spacer(),                  // absorbs slack so the buttons pin to the bottom (spacer() is grow-weight-1)
      fixed(row({ justify: 'center', gap: 2 }, ok, cancel), BUTTON.height),
    ),
  ),
);
```

The `Label(o.label, input)` link is unchanged, so the hotkey still focuses the field. Building `input`
first and passing it to both `Label` and the `col` keeps the same object identity; tab order is
[Input, OK, Cancel] because Label is non-focusable (matches today). Use `spacer()` (exported from the
barrel; already `grow`-weight-1) for the slack — `Empty` is a private class in `dsl/flex.ts` and is not
importable.

## Invariants to preserve (FR-2)

- Width/height formulas (`message-box.ts:104-106`, `:133-134`, `:159-160`) — **unchanged**.
- Return values via `runDialog` — unchanged (`messageBox`→ok/cancel, `confirm`→bool, `inputBox`→value|null).
- `inputBox` validator veto + refocus (message-box.impl `:65`) — unchanged; the `Input` + dialog `valid()`
  sweep are untouched.
- Focusable order: `[OK]` / `[OK,Cancel]` / `[Yes,No]` / `[Input,OK,Cancel]` — proven by the new traversal spec (R-4).

## Verification

- `message-box.spec` (7) + `message-box.impl` (5) pass **unedited**.
- New `message-box.traversal.spec.test.ts` asserts the focusable order per variant, green-on-current-first, green after.
- New `message-box.render.impl.test.ts` (ST-K2, PF-002): each of messageBox/confirm/inputBox mounts headless, `flush()`es, a known body string paints, and every button solves to non-zero `bounds` — the `form-dialog.impl:104` collapse-guard pattern applied to this family (which has no child-rect oracle). Green-on-current-first, green after.
- `yarn workspace @jsvision/ui test` green; no local `at`/`centerX`/`PAIR_WIDTH` left (`grep`).
