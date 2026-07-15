<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Controls

Leaf input widgets and the `Input` validators.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## Button

A focusable command button.

```ts
new Button(text: string, opts: ButtonOptions = {})   // extends View
```

## ButtonOptions

Options for Button.

```ts
interface ButtonOptions {
  command?: string;   // A command name emitted when the button is activated. Handle it from a menu/status/app handler.
  onClick?: () => void;   // A callback fired when the button is activated, in addition to (or instead of) command.
  default?: boolean;   // Marks this as the dialog's default button: it also activates on `Enter` when the key is unconsumed.
  disabled?: boolean | (() => boolean);   // Greyed out and inert. Pass a getter to re-evaluate reactively when the signals it reads change.
}
```

## CheckGroup

A checkbox group bound to a `boolean[]` signal.

```ts
new CheckGroup(opts: CheckGroupOptions)   // extends Cluster
```

## CheckGroupOptions

Options for a CheckGroup.

```ts
interface CheckGroupOptions {
  labels: readonly string[];   // One label per checkbox; each may mark its hotkey letter with `~X~` (e.g. `'~B~old'`).
  value: Signal<boolean[]>;   // Two-way binding: one boolean flag per item, in label order.
}
```

## filter

Build a filter validator over an allowed-character set.

```ts
filter(chars: string): Validator
```

## Input

A focusable single-line text editor.

```ts
new Input(opts: InputOptions)   // extends View
// methods & signals:
invalid
hasSelection: Signal<boolean>
selection: { start: number; end: number }
caretPos: number
getValueSignal(): Signal<string>
getMaxLength(): number
valid(): boolean
selectAll(enable = true): void
```

## InputOptions

Options for Input.

```ts
interface InputOptions {
  value: Signal<string>;   // The two-way bound text. Reading it renders the field; editing writes back. Required.
  maxLength?: number;   // Maximum stored length. Default: unbounded.
  validator?: Validator;   // A rule that filters keystrokes live and validates the completed value on focus-leave.
}
```

## Label

A caption linked to a control.

```ts
new Label(text: string, link: View)   // extends View
```

## lookup

Build an exact-membership validator over a fixed list of strings.

```ts
lookup(list: readonly string[]): Validator
```

## MultiCheckGroup

A multi-state checkbox group bound to a `number[]` signal (one state index per item).

```ts
new MultiCheckGroup(opts: MultiCheckGroupOptions)   // extends Cluster
```

## MultiCheckGroupOptions

Options for MultiCheckGroup.

```ts
interface MultiCheckGroupOptions {
  items: readonly string[];   // One label per item; each may mark its hotkey with `~X~`.
  states: string;   // The ordered marker glyphs, one per state (e.g. `' xX'`). The number of states is this string's length.
  value: Signal<number[]>;   // Two-way binding: one state index (`0`..states-1) per item, in item order.
}
```

## picture

Create a formatted-mask validator.

```ts
picture(mask: string, autoFill = true): Validator
```

## RadioGroup

A radio-button group bound to a `number` signal (the selected index).

```ts
new RadioGroup(opts: RadioGroupOptions)   // extends Cluster
```

## RadioGroupOptions

Options for a RadioGroup.

```ts
interface RadioGroupOptions {
  labels: readonly string[];   // One label per option; each may mark its hotkey letter with `~X~` (e.g. `'~L~eft'`).
  value: Signal<number>;   // Two-way binding to the selected option index.
}
```

## range

Build an integer-range validator.

```ts
range(min: number, max: number): Validator
```

## Slider

A focusable value slider bound two-way to a numeric `Signal` (see the module docs for glyphs and interaction).

```ts
new Slider(opts: SliderOptions)   // extends View
// methods & signals:
select(value: number): void
```

## SliderOptions

Construction options for a Slider.

```ts
interface SliderOptions {
  value: Signal<number>;   // Two-way numeric value: reading renders the thumb, an external write repaints and is clamped on read.
  min?: number;   // Range minimum (default 0).
  max?: number;   // Range maximum (default 100).
  step?: number;   // Arrow/wheel step (default 1).
  pageStep?: number;   // Page step for PgUp/PgDn (default `max(1, round((max - min) / 10))`).
  orientation?: 'horizontal' | 'vertical';   // Long axis (default `'horizontal'`).
  onInput?: (v: number) => void;   // Fired on every live change (drag move, arrow/page key, wheel).
  onChange?: (v: number) => void;   // Fired on each commit — a discrete key/wheel step, or the pointer-up ending a drag.
}
```

## Switch

A focusable on/off toggle bound two-way to a `Signal<boolean>` (see the module docs for glyphs, colours, and interaction).

```ts
new Switch(opts: SwitchOptions)   // extends View
// methods & signals:
select(on: boolean): void
```

## SwitchOptions

Construction options for a Switch.

```ts
interface SwitchOptions {
  value: Signal<boolean>;   // Two-way bound on/off state: reading renders the knob; an external write repaints.
  label?: string;   // Optional caption drawn left of the track; `~X~` marks an `Alt`+hotkey.
  onLabel?: string;   // Text shown right of the track when on (default `'On'`); `''` hides it.
  offLabel?: string;   // Text shown right of the track when off (default `'Off'`); `''` hides it.
  disabled?: boolean;   // Non-interactive and dim when true (also not focusable).
}
```

## Text

A static, non-focusable text view.

```ts
new Text(content: string | (() => string))   // extends View
```

## Validator

A rule that constrains what an Input accepts.

```ts
interface Validator {
  isValidInput(s: string): boolean;   // Live per-keystroke gate: may this string exist mid-edit? Must accept partial input.
  isValid(s: string): boolean;   // Blocking gate run on completion / focus-leave: is the finished value acceptable?
  fill(s: string): string;   // Optional post-keystroke rewrite. After accepting a keystroke, `Input` calls this and stores the returned string, letting a validator auto-insert formatting (e.g. `123` → `123-` for a `###-##` mask) or apply case transforms (`abc` → `ABC`). Return `s` unchanged when nothing applies. Only picture implements it; the other validators omit it. Never throws.
  error?: string;   // Optional message describing the invalid state, for you to surface to the user.
}
```
