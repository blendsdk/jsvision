import type { Signal } from '@jsvision/ui';
import type { z } from 'zod';
import type { ZodIssue } from 'zod';

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
  /** Whether the whole object currently satisfies the schema (live, independent of touched). */
  isValid(): boolean;
  /** Whether any field diverges from its baseline. */
  dirty(): boolean;
  /**
   * Mark every field touched, validate, and — when valid — await `onValid` with the
   * coerced values. Resolves `true` when valid (after `onValid` completes) and `false`
   * when invalid (without calling `onValid`).
   */
  submit(onValid: (values: z.output<S>) => void | Promise<void>): Promise<boolean>;
  /** Restore every field to its baseline value and clear dirty + touched, in one batch. */
  reset(): void;
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
}
