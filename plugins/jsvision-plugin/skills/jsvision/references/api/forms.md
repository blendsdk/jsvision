<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/forms — form state & validation

Typed form state, field bindings, validation, and form dialogs.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## AsyncValidator

An opt-in asynchronous validator for a single field — the "is this username / email already taken?" round-trip class of check that a synchronous Zod schema cannot express.

```ts
type AsyncValidator<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<string | null>
```

## bindCheck

Adapt a multi-choice field to a `CheckGroup`'s `Signal<boolean[]>` (one flag per option), keeping the field's value as the list of **selected values** so validation runs on the domain array.

```ts
bindCheck<T>(field: Field<T[]>, options: readonly T[]): Signal<boolean[]>
```

## bindField

Wire a field's **touched** flag to a widget's focus: the field becomes touched the first time focus *leaves* the widget (a blur), never merely by mounting it or focusing into it.

```ts
bindField<T>(field: Field<T>, view: View): void
```

## bindRadio

Adapt a single-choice field to a `RadioGroup`'s `Signal<number>` (the selected index), keeping the field's value in domain terms so validation runs on the real value, never an index.

```ts
bindRadio<T>(field: Field<T>, options: readonly T[]): Signal<number>
```

## createForm

Create a headless, reactive form store over a Zod object schema.

```ts
createForm<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(options: CreateFormOptions<S, I>): Form<S, I>
```

## CreateFormOptions

Options for createForm .

```ts
interface CreateFormOptions<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>> {
  schema: S;   // A Zod object schema. A non-string field that is edited as text must use `z.coerce.*` (or a transform) so the raw string is coerced by the schema.
  initial: I;   // The raw initial editing values. Keys are constrained to the schema's keys; the value types are whatever the caller edits (e.g. a coerced-number field is initialised as a string).
  asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };   // Opt-in per-field async validators, keyed by field name. A field with an entry runs its validator debounced on change (only while the field is synchronously clean) and on submit; the field's `validating()` / `asyncError()` reflect the result. Fields with no entry are unaffected.
  asyncDebounceMs?: number;   // Debounce, in milliseconds, before an async validator runs after a change. Defaults to `300`. Applies to every async field.
}
```

## Field

A single field's handle: its live, store-owned raw value signal plus the derived error / touched / dirty accessors.

```ts
interface Field<T> {
  name: string;   // The field name (a schema key).
  value: Signal<T>;   // The store-owned raw editing signal; bind a widget straight to it (writes are two-way).
  error(): ZodIssue | null;   // The first validation issue for this field, or `null` when the field has none.
  touched(): boolean;   // Whether the field has been interacted with (blur) or a submit was attempted.
  dirty(): boolean;   // Whether the raw value differs from its baseline.
  validating(): boolean;   // Whether an async validation for this field is currently in flight. Always `false` for a field with no `asyncValidators` entry. Stays `false` during the debounce window — it flips `true` only once the validator is actually running.
  asyncError(): string | null;   // The latest non-superseded async validation message, or `null`. This is a **distinct** surface from `error()` (which stays the synchronous `ZodIssue`): an async message is never fabricated into a `ZodIssue`. Cleared to `null` the moment the value changes (a verdict describes one specific value). Compose the two surfaces yourself in the UI.
}
```

## Form

The headless form store returned by createForm .

```ts
interface Form<S extends z.ZodObject<z.ZodRawShape>, I> {
  field(name: K): Field<I[K]>;   // Get the stable handle for a field. Throws `FormFieldError` for an unknown key.
  values(): z.output<S> | null;   // The coerced, schema-typed values when the form is valid, else `null`. Never throws.
  rawValues(): I;   // The live raw editing snapshot — always available, independent of validity.
  errors(): ZodIssue[];   // Form-level (path-less) validation issues, e.g. from an object-level `refine`.
  isValid(): boolean;   // Whether the whole object currently satisfies the schema **and** has no async error (live, independent of touched). Optimistic about pending async work: a field whose async validator has not yet run (or is still in flight) does not hold this `false` — only a resolved async error does. Adds no extra `safeParse` call.
  dirty(): boolean;   // Whether any field diverges from its baseline.
  validating(): boolean;   // Whether any field is currently running an async validation.
  submitting(): boolean;   // Whether a Form.submit is currently in flight — `true` synchronously from the moment `submit()` is called until it settles (its validators **and** the `onValid` callback), `false` on every return path, including a `onValid` that throws. Form-level; it completes the `loading()` / `validating()` / `submitting()` in-flight trio. Bind a busy indicator or a `disabled` getter to it (e.g. `disabled: () => form.submitting()`).
  loading(): boolean;   // Whether an async record load started by Form.load is currently in flight. Form-level and atomic (a whole record loads at once — there is no per-field loading). It does NOT gate `isValid()` / `submit()`; compose the busy state yourself (e.g. `disabled: () => form.loading()`).
  load(loader: (ctx: { signal: AbortSignal }) => Promise<I>): Promise<boolean>;   // Load an existing record into the form: runs `loader` (given a fresh `AbortSignal`) and, on success, replaces every field's value and rebases the whole baseline to the loaded record in one batch, leaving the form pristine — `touched` / submit-attempted cleared and `dirty()` false, so `reset()` now returns to the LOADED record. Resolves `true` on success, `false` if the loader rejects (state untouched) — it never rejects. Re-invokable (a Reload button). A newer `load()` supersedes an older in-flight one; `dispose()` aborts an in-flight load. Do NOT call while a `submit()` is in flight (the two are independent; gate them in the app). The loader must resolve the full RAW editing record (`Promise<I>`, the same shape as `initial`) — map your server/domain record to raw editing values inside it (there is no inverse of `z.coerce`). A key missing from the resolved record sets that field (and its baseline) to `undefined`.
  submit(onValid: (values: z.output<S>) => void | Promise<void>): Promise<boolean>;   // Mark every field touched, validate, and — when valid — await `onValid` with the coerced values. Resolves `true` when valid (after `onValid` completes) and `false` when invalid (without calling `onValid`). The async-aware gate: it short-circuits `false` on a synchronously-invalid object (no async validator is invoked), otherwise it cancels pending debounces, force-runs and awaits every async validator, and gates on the combined result — so a value an async rule rejects never passes.
  reset(): void;   // Restore every field to its baseline value and clear dirty + touched, in one batch.
  dispose(): void;   // Tear down the form's whole reactive scope — the standing async-validation effects and every owned computed. Idempotent and safe to call more than once. A long-lived form need not call this, but a per-dialog form that mounts async validators should dispose it when the dialog closes so no debounce fires after teardown.
}
```

## formDialog

Run a form in a modal dialog and resolve to the coerced values on OK, or `null` on Cancel / Esc / close-box / a quit-close.

```ts
formDialog<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(host: ModalDialogHost, options: FormDialogOptions<S, I>): Promise<z.output<S> | null>
```

## FormDialogOptions

Options for formDialog.

```ts
interface FormDialogOptions<S extends z.ZodObject<z.ZodRawShape>, I> {
  schema: S;   // A Zod object schema (a non-string field edited as text must use `z.coerce.*`).
  initial: I;   // The raw initial editing values (e.g. a coerced-number field is initialised as a string).
  asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };   // Opt-in per-field async validators; each force-runs as part of the OK submit gate.
  asyncDebounceMs?: number;   // Debounce, in milliseconds, before an async validator runs after a change. Defaults to `300`.
  title?: string;   // Title centered in the dialog's top border.
  body: (form: Form<S, I>) => View;   // Build the dialog body — bind widgets to `form.field(name).value`. Runs once, when the dialog opens.
  onSubmit?: (values: z.output<S>) => void | Promise<void>;   // Optional save callback run **inside** the submit gate with the coerced values. If it rejects, the dialog stays open and OK re-enables; surface the failure through your own body UI (none is minted).
  okText?: string;   // OK button label (tilde-marked hotkey, e.g. `'~S~ave'`). Defaults to `'~O~K'`.
  width: number;   // Dialog width in cells. Required — the body is opaque, so the dialog cannot size itself.
  height: number;   // Dialog height in cells. Required (a placement rect is applied only when both width and height are given).
}
```

## FormFieldError

Thrown when a form field cannot be resolved.

```ts
new FormFieldError(field: string)   // extends Error
// methods & signals:
field: string
```
