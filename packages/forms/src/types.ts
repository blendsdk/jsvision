import type { Signal } from '@jsvision/ui';
import type { z } from 'zod';
import type { ZodIssue } from 'zod';

/**
 * An opt-in asynchronous validator for a single field — the "is this username / email already
 * taken?" round-trip class of check that a synchronous Zod schema cannot express.
 *
 * It receives the field's **raw** editing value (coerce inside if you need a typed value) and an
 * `AbortSignal` that is aborted when a newer change supersedes this run or the form is disposed —
 * thread it into `fetch` so a stale request is cancelled. It resolves the error message to surface,
 * or `null` for "no async error". A **rejected** promise is treated as "no async error"; if your
 * validator can fail (e.g. the network is down), `catch` inside and return a message such as
 * `'Could not verify'` to surface that as an error.
 *
 * @typeParam T - the field's raw editing value type.
 */
export type AsyncValidator<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<string | null>;

/**
 * A single field's handle: its live, store-owned raw value signal plus the derived
 * error / touched / dirty accessors. Handles are stable — `form.field(name)` returns
 * the same instance every call — so a UI can bind to one shared signal.
 */
export interface Field<T> {
  /** The field name (a schema key). */
  readonly name: string;
  /** The store-owned raw editing signal; bind a widget straight to it (writes are two-way). */
  readonly value: Signal<T>;
  /** The first validation issue for this field, or `null` when the field has none. */
  error(): ZodIssue | null;
  /** Whether the field has been interacted with (blur) or a submit was attempted. */
  touched(): boolean;
  /** Whether the raw value differs from its baseline. */
  dirty(): boolean;
  /**
   * Whether an async validation for this field is currently in flight. Always `false` for a field
   * with no `asyncValidators` entry. Stays `false` during the debounce window — it flips `true` only
   * once the validator is actually running.
   */
  validating(): boolean;
  /**
   * The latest non-superseded async validation message, or `null`. This is a **distinct** surface
   * from `error()` (which stays the synchronous `ZodIssue`): an async message is never fabricated
   * into a `ZodIssue`. Cleared to `null` the moment the value changes (a verdict describes one
   * specific value). Compose the two surfaces yourself in the UI.
   */
  asyncError(): string | null;
}

/**
 * The headless form store returned by {@link createForm}. It owns the raw editing
 * values, validates the whole object through the schema, and exposes per-field and
 * form-level accessors plus `submit` / `reset`. It draws nothing.
 *
 * @typeParam S - the Zod object schema type.
 * @typeParam I - the raw initial value shape (keys constrained to the schema).
 */
export interface Form<S extends z.ZodObject<z.ZodRawShape>, I> {
  /** Get the stable handle for a field. Throws `FormFieldError` for an unknown key. */
  field<K extends keyof I>(name: K): Field<I[K]>;
  /** The coerced, schema-typed values when the form is valid, else `null`. Never throws. */
  values(): z.output<S> | null;
  /** The live raw editing snapshot — always available, independent of validity. */
  rawValues(): I;
  /** Form-level (path-less) validation issues, e.g. from an object-level `refine`. */
  errors(): ZodIssue[];
  /**
   * Whether the whole object currently satisfies the schema **and** has no async error (live,
   * independent of touched). Optimistic about pending async work: a field whose async validator has
   * not yet run (or is still in flight) does not hold this `false` — only a resolved async error
   * does. Adds no extra `safeParse` call.
   */
  isValid(): boolean;
  /** Whether any field diverges from its baseline. */
  dirty(): boolean;
  /** Whether any field is currently running an async validation. */
  validating(): boolean;
  /**
   * Whether a {@link Form.submit} is currently in flight — `true` synchronously from the moment
   * `submit()` is called until it settles (its validators **and** the `onValid` callback), `false` on
   * every return path, including a `onValid` that throws. Form-level; it completes the
   * `loading()` / `validating()` / `submitting()` in-flight trio. Bind a busy indicator or a
   * `disabled` getter to it (e.g. `disabled: () => form.submitting()`).
   */
  submitting(): boolean;
  /**
   * Whether an async record load started by {@link Form.load} is currently in flight. Form-level and
   * atomic (a whole record loads at once — there is no per-field loading). It does NOT gate
   * `isValid()` / `submit()`; compose the busy state yourself (e.g. `disabled: () => form.loading()`).
   */
  loading(): boolean;
  /**
   * Load an existing record into the form: runs `loader` (given a fresh `AbortSignal`) and, on
   * success, replaces every field's value and rebases the whole baseline to the loaded record in one
   * batch, leaving the form pristine — `touched` / submit-attempted cleared and `dirty()` false, so
   * `reset()` now returns to the LOADED record. Resolves `true` on success, `false` if the loader
   * rejects (state untouched) — it never rejects. Re-invokable (a Reload button). A newer `load()`
   * supersedes an older in-flight one; `dispose()` aborts an in-flight load. Do NOT call while a
   * `submit()` is in flight (the two are independent; gate them in the app).
   *
   * The loader must resolve the full RAW editing record (`Promise<I>`, the same shape as `initial`) —
   * map your server/domain record to raw editing values inside it (there is no inverse of
   * `z.coerce`). A key missing from the resolved record sets that field (and its baseline) to
   * `undefined`.
   */
  load(loader: (ctx: { signal: AbortSignal }) => Promise<I>): Promise<boolean>;
  /**
   * Mark every field touched, validate, and — when valid — await `onValid` with the
   * coerced values. Resolves `true` when valid (after `onValid` completes) and `false`
   * when invalid (without calling `onValid`).
   *
   * The async-aware gate: it short-circuits `false` on a synchronously-invalid object (no async
   * validator is invoked), otherwise it cancels pending debounces, force-runs and awaits every async
   * validator, and gates on the combined result — so a value an async rule rejects never passes.
   */
  submit(onValid: (values: z.output<S>) => void | Promise<void>): Promise<boolean>;
  /** Restore every field to its baseline value and clear dirty + touched, in one batch. */
  reset(): void;
  /**
   * Tear down the form's whole reactive scope — the standing async-validation effects and every
   * owned computed. Idempotent and safe to call more than once. A long-lived form need not call
   * this, but a per-dialog form that mounts async validators should dispose it when the dialog
   * closes so no debounce fires after teardown.
   */
  dispose(): void;
}

/**
 * Options for {@link createForm}.
 *
 * @typeParam S - the Zod object schema type.
 * @typeParam I - the raw initial values; keys constrained to the schema, value types
 *                are the raw editing types the caller supplies.
 */
export interface CreateFormOptions<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>> {
  /**
   * A Zod object schema. A non-string field that is edited as text must use `z.coerce.*`
   * (or a transform) so the raw string is coerced by the schema.
   */
  schema: S;
  /**
   * The raw initial editing values. Keys are constrained to the schema's keys; the value
   * types are whatever the caller edits (e.g. a coerced-number field is initialised as a
   * string).
   */
  initial: I;
  /**
   * Opt-in per-field async validators, keyed by field name. A field with an entry runs its validator
   * debounced on change (only while the field is synchronously clean) and on submit; the field's
   * `validating()` / `asyncError()` reflect the result. Fields with no entry are unaffected.
   */
  asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };
  /**
   * Debounce, in milliseconds, before an async validator runs after a change. Defaults to `300`.
   * Applies to every async field.
   */
  asyncDebounceMs?: number;
}
