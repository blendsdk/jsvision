---
title: Button
description: Button — the JSVision command control. Click, Space, Alt-hotkey, or Enter (default) activates it, emitting a typed command and/or an onClick callback.
---

# Button

`Button` is a focusable command control with a raised, drop-shadowed face — the primary way a user
triggers an action. Activate it by click, by **Space** while focused, by its **Alt**+hotkey, or — for
a dialog's default button — by **Enter**. Activation emits a typed **command** (handled by an app,
menu, or status line) and/or runs an **`onClick`** callback. A **disabled** button is greyed out,
inert, and drops out of the Tab order; pass a getter for `disabled` to re-evaluate it reactively.

## Usage

The label may embed an `~x~` hotkey marker. Give a `Button` an `onClick` callback, a typed `command`,
or both:

```ts
import { Button } from '@jsvision/ui';

// The basics: a label (with an optional ~hotkey~) and a click handler.
const clickMe = new Button('~C~lick me', { onClick: () => save() });

// Emit a typed command instead — a menu, status line, or app handler catches it.
// `default: true` also fires it on Enter when the keystroke is otherwise unconsumed.
const ok = new Button('~O~K', { command: 'ok', default: true });

// Disabled — pass a getter so it re-evaluates reactively as your signals change.
const submit = new Button('Submit', { disabled: () => !formValid() });
```

## Live example

<PlayExample id="controls/button" title="Button" blurb="A push button bound to a click counter, with a live count echo." />

## Props

`new Button(text, options)` — the label is the first argument; everything in `options` is optional.

| Prop       | Type                         | Default | Description                                                                                   |
| ---------- | ---------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `text`     | `string`                     | —       | The button label. Wrap one letter in tildes (`~O~K`) to mark its **Alt**+hotkey.              |
| `command`  | `string`                     | —       | A typed command emitted on activation, caught by an app / menu / status-line handler.         |
| `onClick`  | `() => void`                 | —       | A callback run on activation — with, or instead of, `command`.                                |
| `default`  | `boolean`                    | `false` | Marks the dialog's default button: it also activates on **Enter** when the key is unconsumed. |
| `disabled` | `boolean \| (() => boolean)` | `false` | Greys the button out and makes it inert. Pass a **getter** to re-evaluate reactively.         |

`command` and `onClick` are independent — set either, both, or neither (a button with neither is a
valid, inert-looking no-op, handy while wiring up a form). When both are set, the command is emitted
**first**, then `onClick` runs.

### The `disabled` getter

A boolean `disabled` is fixed for the button's life. A **getter** (`disabled: () => !formValid()`) is
re-read whenever the signals it touches change, so the button greys, ungreys, and joins or leaves the
Tab order on its own — no manual toggling:

```ts
import { Button, signal } from '@jsvision/ui';

const name = signal('');
const save = new Button('~S~ave', {
  command: 'save',
  disabled: () => name().trim() === '', // enabled only once the field has content
});
```

## Keyboard & mouse

| Input                                           | Result                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Click** (press _and_ release inside the face) | Activates. Pressing then releasing **outside** the face cancels — nothing fires.                                      |
| **Space** (while focused)                       | Activates.                                                                                                            |
| **Alt**+hotkey                                  | Activates from anywhere in the dialog, even when another view has focus (the button watches after the focused chain). |
| **Enter**                                       | Activates **only** the `default` button, and only when nothing else consumed the key.                                 |
| **Tab** / **Shift+Tab**                         | Moves focus to / from the button. A disabled button is skipped.                                                       |

A disabled button ignores every one of these — it is fully inert and never takes focus.

## Sizing & layout

`Button.measure()` reports the natural translated caption width in terminal display cells, including
face padding and shadow but excluding the `~accelerator~` markup itself. That means wide glyphs and
combining characters are measured by what they occupy on screen, not by JavaScript string length.
An absolute rectangle is still a hard bound: if the terminal cannot provide the measured size, the
caption clips rather than escaping its parent.

For a single button, use its measured size or place it in a sizing layout parent. For an action set,
measure the complete set first. `measureButtonGroup()` makes every sibling as wide as the widest
button (subject to `minimumButtonWidth`), while `buttonGroup()` composes those same Buttons in
row-major order. `maxColumns` wraps equal-width buttons across multiple rows; `buttonColumn()` is
the vertical one-column shorthand.

```ts
import { Button, Dialog, at, buttonGroup, measureButtonGroup } from '@jsvision/ui';

const actions = [
  new Button('~S~peichern', { command: 'save', default: true }),
  new Button('~A~bbrechen', { command: 'cancel' }),
  new Button('Als ~E~ntwurf speichern', { command: 'save-draft' }),
];
const options = { minimumButtonWidth: 10, gap: 2, maxColumns: 2 } as const;
const metrics = measureButtonGroup(actions, options);
const actionGroup = buttonGroup(actions, options);
const dialog = new Dialog({
  title: 'Aktionen',
  // Dialog padding consumes one cell on every edge, outside the content-area metrics.
  width: metrics.width + 2,
  height: metrics.height + 2,
});
dialog.add(at(actionGroup, 0, 0, metrics.width, metrics.height));
```

The Buttons passed to a composer must be unattached: one live `Button` can have only a single parent.
Create a fresh action set when rebuilding a dialog instead of reusing already-mounted controls.
Treat `metrics.width` and `metrics.height` as preferred **content-area** minima: add the parent
Dialog's border/padding when negotiating its outer dimensions, expand the container when possible,
wrap with `maxColumns` when width is constrained, and accept clipping only at the terminal's
absolute hard bound.

You can also give a button space directly:

- an **absolute rect** (the usual choice inside a dialog):
  `button.setLayout({ position: 'absolute', rect: { x, y, width, height } })`;
- or a **sizing layout parent** (a row or column) that measures and positions it.

Two hard limits to budget for:

- The face needs at least **2×2 cells** — below that, `draw()` bails and nothing shows.
- The **drop shadow** occupies the rightmost column and the bottom row, so a one-line button is
  **2 rows** tall (one content row plus one shadow row).

## Best practices

- **Prefer `command` when the action is reachable elsewhere.** If a menu item or a status-line key
  triggers the same thing, emit a shared command and handle it once — don't duplicate the logic in an
  `onClick`. Reserve `onClick` for a genuinely local, one-off action.
- **Exactly one `default: true` per dialog.** The default button owns **Enter**; two of them race for
  the same key.
- **Use a `disabled` getter for anything conditional.** A static boolean can't track form state; a
  getter keeps greying, focusability, and the Tab order correct with zero manual updates.
- **Always mark a hotkey.** `~S~ave` costs nothing and makes the button reachable without the mouse
  or a Tab hunt.
- **Don't look for `[ ]` brackets.** This face has none — state is carried entirely by colour and the
  drop shadow, so a custom theme must keep enough contrast between the normal, focused, default, and
  disabled faces.

For the four standard dialog buttons, skip the manual wiring and use the helpers — `okButton()`,
`cancelButton()`, `yesButton()`, `noButton()`, or the `okCancelButtons()` / `yesNoButtons()` pairs —
which emit the matching `ok` / `cancel` / `yes` / `no` command and pre-set `default` where appropriate.

## Theming

The button paints through six theme roles. Override them on a custom theme to restyle every button at
once.

::: details Button theme roles

| Role             | Applies to                            | Turbo Vision default    |
| ---------------- | ------------------------------------- | ----------------------- |
| `button`         | The normal (unfocused) face           | black on green          |
| `buttonFocused`  | The focused face                      | white on green          |
| `buttonDefault`  | The `default` button's unfocused face | bright cyan on green    |
| `buttonDisabled` | A disabled face                       | dark gray on light gray |
| `buttonShortcut` | The `~hotkey~` accent glyph           | yellow on green         |
| `buttonShadow`   | The `▄` `█` `▀` drop-shadow blocks    | black on light gray     |

:::

## Related

- [Form dialog](/components/controls/form-dialog) — buttons in their natural home, with the
  `okButton()` / `cancelButton()` helpers.
- [Input](/components/controls/input) — the text field a Save/OK button usually commits.
- `CheckGroup` and `RadioGroup` — sibling controls that share the button's hotkey and focus model.
- [API reference](/api/ui/classes/Button) — the full generated `Button` and `ButtonOptions` signatures.
