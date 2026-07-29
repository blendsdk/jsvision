---
title: Input
description: Input — a reactive single-line JSVision text editor with selection, clipboard editing, placeholders, horizontal scrolling, length limits, and live or completion validation.
---

# Input

`Input` is a focusable, single-line text editor backed by a `Signal<string>`. The signal is the
source of truth: typing writes to it, while an application update immediately repaints the field.
Use an Input for short values such as names, numbers, search terms, phone numbers, and identifiers;
use [`Editor`](/components/editor/editor) or [`Memo`](/components/editor/memo) when text must wrap or
span multiple lines.

The control provides caret movement, keyboard and mouse selection, clipboard editing, placeholder
text, a stored-length cap for user edits, and horizontal scrolling for values wider than the field.
An optional `Validator` separates **live acceptance** from **completed-value validation**, so a
partial value can remain editable without being accepted as final.

## Usage

Create the value signal first, pass it to the Input, and give the field an explicit one-row layout:

```ts
import { Input, at, filter, signal } from '@jsvision/ui';

const name = signal('');
const nameInput = new Input({
  value: name,
  placeholder: 'Full name',
  maxLength: 40,
  validator: filter('A-Za-z '),
});

form.add(at(nameInput, 12, 2, 28, 1));
```

Read `name()` wherever the application needs the current value, and call `name.set(...)` to replace
it from application code.

## Live example

<PlayExample id="controls/input"
  title="Input Lab"
  blurb="Compare filtering, range validation, an auto-filling phone mask, placeholders, live signal updates, selection, clipboard editing, and horizontal overflow in a centered Classic-theme dialog."
/>

Try typing a digit in **Name**, entering `151` in **Age** and pressing **Tab**, or typing ten digits
in **Phone**. In **Long value**, use **Shift**+arrows or a mouse drag to select text and watch the
selection readout. **Load sample**, **Check fields**, and **Clear** demonstrate external signal
updates and explicit validation; the **View** menu lets you compare the same states across themes.

## Props and public state

`new Input(options)` requires a value signal. Every other option is optional.

| Option        | Type                       | Default    | Purpose                                                                          |
| ------------- | -------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `value`       | `Signal<string>`           | —          | Required two-way binding and source of truth for the text.                       |
| `maxLength`   | `number`                   | `Infinity` | Caps text inserted by typing or paste.                                           |
| `validator`   | `Validator`                | —          | Filters edits live and checks the completed value on focus-leave or `valid()`.   |
| `placeholder` | `string \| Signal<string>` | —          | Muted hint shown only while `value()` is empty; it is never stored in the value. |

The Input also exposes a small observation and control surface:

| Member              | Type / return                    | Use                                                                                      |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `invalid`           | `boolean`                        | Last completed-validation result: `true` after `valid()` or focus-leave fails.           |
| `hasSelection`      | `Signal<boolean>`                | Reactive selection-presence state, useful for enabling Cut or Copy actions.              |
| `selection`         | `{ start: number; end: number }` | Current half-open selection range in JavaScript string indices.                          |
| `caretPos`          | `number`                         | Current caret position in JavaScript string indices.                                     |
| `valid()`           | `boolean`                        | Runs completed-value validation, updates `invalid`, and returns the result.              |
| `selectAll(enable)` | `void`                           | Selects all text; pass `false` to clear the selection and return the caret to the start. |
| `getValueSignal()`  | `Signal<string>`                 | Returns the bound signal for a companion control such as `History`.                      |
| `getMaxLength()`    | `number`                         | Returns the configured cap, including `Infinity` when no cap was supplied.               |

`maxLength` constrains the Input's own typing and paste paths. A direct `value.set(...)` remains an
application-level update and is not truncated, so clamp untrusted or oversized external values
before assigning them.

## Sizing & layout

Input has no natural `measure()` result. Give it an explicit rectangle or put it in a layout that
assigns a concrete size; an auto-sized flow cannot infer how wide a text field should be.

The normal height is **one terminal row**. Text begins one cell inside the field because the first
and last columns can display `◄` and `►` overflow arrows. Choose a width for the expected value plus
that display budget, but do not rely on width to enforce data length—use `maxLength` for that.
Placeholder text and long values clip to the assigned width rather than wrapping.

When the caret moves beyond the visible region, the Input scrolls horizontally and exposes the
arrows. Clicking an arrow scrolls by one position. The current display math uses JavaScript string
indices as terminal columns, so do not assume grapheme- or wide-glyph-aware cursor geometry for
arbitrary Unicode text.

Pair a field with [`Label`](/components/controls/label) so its purpose and Alt-hotkey remain visible:

```ts
import { Input, Label, at, signal } from '@jsvision/ui';

const queryInput = new Input({ value: signal('') });

dialog.add(at(new Label('~Q~uery', queryInput), 2, 2, 9, 1));
dialog.add(at(queryInput, 12, 2, 30, 1));
```

## Validation

A `Validator` has two deliberately different gates:

- `isValidInput(value)` runs during typing, deletion, and paste. Returning `false` rejects that edit,
  so it must allow legitimate partial states.
- `isValid(value)` checks a completed value when focus leaves the field or when the application
  calls `input.valid()`. Failure sets `input.invalid`, but never traps focus.
- Optional `fill(value)` may add formatting or transform a candidate before the live gate checks it.
- Optional `error` provides a message the application can show.

JSVision exports four validator factories:

| Factory                    | Live editing behavior                                  | Completed-value rule                                    |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `filter('A-Za-z ')`        | Rejects characters outside the expanded character set. | Every character must be in that set; empty is valid.    |
| `range(0, 150)`            | Accepts digits and a sign allowed by the lower bound.  | Requires a complete integer inside the inclusive range. |
| `lookup(['red', 'green'])` | Allows any intermediate text.                          | Requires an exact list member.                          |
| `picture('###-##-####')`   | Enforces the mask and auto-fills fixed punctuation.    | Requires a complete mask match.                         |

For a form action, validate every field and publish useful feedback yourself. `invalid` records
state; Input does not add an error message or a separate invalid theme role.

```ts
import { Input, range, signal } from '@jsvision/ui';

const age = signal('');
const ageRule = range(0, 150);
const ageInput = new Input({ value: age, maxLength: 3, validator: ageRule });
const ageError = signal('');

function validateAge(): boolean {
  const ok = ageInput.valid();
  ageError.set(ok ? '' : (ageRule.error ?? 'Enter a valid age.'));
  return ok;
}
```

For a custom validator, accept every partial and deletion state the user must pass through. For
example, a signed-number rule usually needs to accept `''` and `'-'` in `isValidInput`, then reject
them in `isValid`. If the live gate rejects an intermediate state, the corresponding keystroke,
paste character, or deletion is refused.

### Picture masks

`picture()` supports digit (`#`), letter (`?`), uppercase letter (`&`), uppercase-any (`!`), and
any-character (`@`) positions. It also supports required `{...}` and optional `[...]` groups,
alternatives separated by `,`, repetitions with `*N` or `*`, and `;` to escape the next mask
character.

Keep masks short and user-recognizable. Fixed literals are auto-filled as the value reaches them:

```ts
import { Input, picture, signal } from '@jsvision/ui';

const phone = signal('');
const phoneInput = new Input({
  value: phone,
  maxLength: 12,
  validator: picture('###-###-####'),
});
// Typing 5551234567 produces 555-123-4567.
```

## Reactive values and selection

Because `value` is a signal, the field automatically follows application updates. If an external
update shortens the value, Input clamps its caret and selection back into range. A signal
placeholder is reactive too, but remains display-only.

Use `hasSelection()` for reactive command availability; use `selection` only when the exact bounds
matter:

```ts
import { Button } from '@jsvision/ui';

const copyButton = new Button('~C~opy', {
  command: 'copy',
  disabled: () => !nameInput.hasSelection(),
});

const { start, end } = nameInput.selection;
const selectedText = name().slice(start, end);
```

The selection and caret offsets are JavaScript string indices. Treat them as positions within the
bound string, not measured terminal-cell coordinates.

## Keyboard, mouse, and clipboard

| Input                                 | Result                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Left / Right**                      | Moves the caret by one string position.                                                   |
| **Ctrl+Left / Ctrl+Right**            | Moves to the previous or next space-delimited word boundary.                              |
| **Home / End**                        | Moves to the beginning or end.                                                            |
| **Shift** plus a movement key         | Extends the selection from its fixed anchor.                                              |
| **Backspace / Delete**                | Deletes one position, or replaces/deletes the active selection.                           |
| **Ctrl/Alt+Backspace / Ctrl+Delete**  | Deletes to the previous or next word boundary.                                            |
| **Ctrl+A / Ctrl+C / Ctrl+X / Ctrl+V** | Selects all, copies, cuts, or pastes through the application's clipboard commands.        |
| **Click / drag**                      | Positions the caret or selects text; dragging continues beyond the field through capture. |
| **Second click on the same cell**     | Selects the entire value.                                                                 |
| **Click `◄` / `►`**                   | Scrolls an overflowing value one position.                                                |
| **Tab / Enter**                       | Passes through for focus traversal or a dialog's default button.                          |

Typing or pasting over a selection replaces it. Paste is processed one code point at a time:
tabs and line breaks become spaces, other control characters are dropped, invalid characters are
skipped, and `maxLength` is respected. That makes the single-line invariant reliable, but it is
still presentation-layer validation—validate data again at the server or other trust boundary.

Clipboard commands use JSVision's application-local clipboard and synchronize with the host when
the host adapter permits it. See [Keyboard & clipboard](/guide/keyboard-and-clipboard) for browser,
terminal, and native clipboard integration.

## Best practices

- **Keep the signal as the application model.** Read and write the signal instead of reaching into
  editing internals; companion controls can use `getValueSignal()` when they need the same binding.
- **Use a Label for every field.** The visible caption explains the value and gives keyboard users
  an Alt-hotkey that transfers focus to the Input.
- **Separate live acceptance from completion.** A strict `isValidInput` can make valid values
  impossible to type; reserve final rules such as range membership for `isValid`.
- **Show validation feedback explicitly.** `invalid` is state, not a complete error UI. Pair it with
  concise nearby text or a form-level summary, and revalidate after edits when stale errors would
  mislead the user.
- **Set both width and `maxLength` intentionally.** Width controls what is visible; `maxLength`
  controls what user edits can store. Neither substitutes for the other.
- **Use Input only for one line.** Newlines pasted into it become spaces. Choose Editor or Memo when
  line structure is meaningful.
- **Revalidate beyond the UI.** Client-side filtering improves editing but is never an authorization
  or security boundary.

## Theming

Input paints through five roles. The `invalid` flag has no dedicated role, so an application should
render its own error text or indicator with an appropriate semantic role.

::: details Input theme roles

| Role               | Applies to                                                  | Classic default      |
| ------------------ | ----------------------------------------------------------- | -------------------- |
| `inputNormal`      | Unfocused field text and background                         | white on blue        |
| `inputSelected`    | Focused field text and background                           | white on blue        |
| `inputSelection`   | Selected text while the field is focused                    | white on green       |
| `inputArrows`      | `◄` and `►` horizontal-overflow indicators                  | bright green on blue |
| `inputPlaceholder` | Muted placeholder foreground on the active field background | cyan on blue         |

:::

In Classic, focus is carried by the visible caret rather than a color change because
`inputNormal` and `inputSelected` intentionally match. Custom themes may distinguish them, but must
preserve contrast for ordinary text, the caret reversal, selection, muted placeholder text, and
overflow arrows.

## Related

- [Label](/components/controls/label) — captions an Input and transfers an Alt-hotkey to it.
- [Form dialog](/components/controls/form-dialog) — composes fields, validation, and actions.
- [History](/components/dropdown/history) — recalls previous values into a linked Input.
- [ComboBox](/components/dropdown/combo-box) — combines editable input with a dropdown list.
- [DatePicker](/components/date/date-picker) — specializes masked date input with a calendar popup.
- [Keyboard & clipboard](/guide/keyboard-and-clipboard) — host integration and portable shortcuts.
- [API reference](/api/ui/classes/Input) — complete `Input` and `InputOptions` signatures.
