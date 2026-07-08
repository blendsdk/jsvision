# 03-01 — P6: constructor normalization + callback taxonomy

Implements FR-1…FR-5. Decisions: AR-1 (hard-replace), AR-2 (taxonomy), AR-4 (scope), AR-5 (spec call sites).

## A. Constructors → options objects

### `RadioGroup` (`packages/ui/src/controls/radio-group.ts`)

Add and export `RadioGroupOptions`, replace the positional constructor:

```ts
/** Options for a {@link RadioGroup}. */
export interface RadioGroupOptions {
  /** One label per option; each may mark its hotkey with `~X~`. */
  readonly labels: readonly string[];
  /** Two-way binding: the selected option index. */
  readonly value: Signal<number>;
}

export class RadioGroup extends Cluster {
  constructor(opts: RadioGroupOptions) {
    super(opts.labels, opts.value /* …existing wiring, unchanged… */);
  }
  // …rest unchanged…
}
```

The class JSDoc gains an `@example`:

```ts
/**
 * A single-choice group of radio buttons bound to a numeric index signal…
 * @example
 * const align = signal(0);
 * const radio = new RadioGroup({ labels: ['~L~eft', '~C~enter', '~R~ight'], value: align });
 * form.add(radio); // align() is 0/1/2 as the user moves the selection
 */
```

### `CheckGroup` (`packages/ui/src/controls/check-group.ts`)

Symmetric — `CheckGroupOptions { readonly labels; readonly value: Signal<boolean[]> }`, constructor
`(opts: CheckGroupOptions)`, class `@example` using `new CheckGroup({ labels, value })`.

### Barrel (`packages/ui/src/index.ts:91`)

```ts
export type { ButtonOptions, InputOptions, MultiCheckGroupOptions, Validator,
  RadioGroupOptions, CheckGroupOptions } from './controls/index.js';
```
(and re-export the two new types from `controls/index.js`).

### Call-site migration (all positional → options)

Source `editor/dialogs.ts:66,117`; examples `controls-demo`, `controls-live`, kitchen-sink
`checkgroup`/`radiogroup` stories; tests per [02-current-state.md](02-current-state.md). Spec-test
call sites update per **AR-5** — assertions untouched.

## B. Color callbacks → `onInput` (live) / `onChange` (commit)

### `ColorSwatch` (`packages/ui/src/color/color-swatch.ts`)

`ColorSwatchOptions`:
```ts
  /** Fired on every live value change (arrow / click / drag). */
  onInput?: (c: Color) => void;
  /** Fired on the discrete commit gesture — Enter, Space, or a mouse-up over a cell. */
  onChange?: (c: Color) => void;
```
Field renames + fire-site changes:
- protected fields `onInput`/`onChange` (was `onChange`/`onCommit`).
- `setLive(idx)` → `this.onInput?.(c)` (was `onChange`).
- `close()` → `this.onChange?.(this.value())` (was `onCommit`).
- `select(color)` → `this.onInput?.(color); this.onChange?.(color);` (was `onChange` + `onCommit`).
- Class `@example` shows the split.

### `ColorPicker` (`packages/ui/src/color/color-picker.ts`)

`ColorPicker` today forwards its (live) `onChange` to the swatch **and** closes the popup on the
swatch's commit — two distinct hooks (`onChange: this.onChange` at `:263`, `onCommit: () => commit()`
at `:264`). Under the new taxonomy the picker must expose the **same `onInput`/`onChange` split** as
the swatch, so it needs both a new `onInput?` option and a semantics change on its existing `onChange`.

- `ColorPickerOptions` gains `onInput?: (c: Color) => void` (live — fires on every arrow/click/drag)
  and **keeps** `onChange?: (c: Color) => void`, whose meaning changes from live to **commit**
  (Enter/Space/mouse-up). Update the `:169` JSDoc from "Fired when `value` changes" to "Fired on the
  discrete commit gesture (Enter/Space/mouse-up)"; add an `onInput` JSDoc "Fired on every live value
  change".
- Store both (`this.onInput = opts.onInput; this.onChange = opts.onChange`).
- The hosted swatch (`open()`, `:258-265`) is created with **both** forwards, replacing the old
  `onChange: this.onChange` + `onCommit: () => commit()` pair:
  ```ts
  onInput: this.onInput,                                  // live: forward the picker's onInput
  onChange: (c) => { this.onChange?.(c); commit(); },     // commit: fire the picker's onChange, then close
  ```
  This preserves popup-close on commit, keeps the picker's public `onChange` callback live (no dead
  option), and wires the live stream through `onInput`.
- The popup-close JSDoc at `:133`,`:239` updates to say "the swatch handles its own Enter via
  `onChange` (commit), which fires the picker's `onChange` and then closes".

### Invariant

No `onCommit` identifier remains in `packages/ui/src` or any example/test after this phase (verified
by a repo grep in ST-6).

## Junior-level notes to carry as code comments (why, not what)

- Why two callbacks: a color grid has a *continuous* selection (live preview as you arrow around) and
  a *discrete* accept (Enter / mouse-up). `onInput` is the preview stream; `onChange` is the accept —
  same split as a text `Input` (`onInput` while typing) vs. a committed value.
