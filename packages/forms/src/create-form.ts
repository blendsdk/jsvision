import { batch, createRoot, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { z } from 'zod';
import type { CreateFormOptions, Field, Form } from './types.js';
import { FormFieldError } from './errors.js';
import { touchedSinks } from './internal.js';
import { createValidation } from './validation.js';

/** Copy an array value (so the store never shares a reference with the caller); pass scalars through. */
function clone(value: unknown): unknown {
  return Array.isArray(value) ? [...value] : value;
}

/** Baseline equality: identity for scalars, element-wise for arrays (e.g. check-group values). */
function eq(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  }
  return Object.is(a, b);
}

/**
 * Create a headless, reactive form store over a Zod object schema.
 *
 * The store owns one raw editing signal per field (bind widgets straight to
 * `field(name).value`), validates the whole object through `schema.safeParse` in one
 * memoized computed, and exposes per-field and form-level accessors plus `submit` /
 * `reset`. It draws nothing and needs no disposal.
 *
 * Gotchas: `initial` holds the **raw** editing values, so a `z.coerce.number()` field is
 * initialised as a string (e.g. `port: '8080'`); `values()` returns the coerced object
 * only when the form is valid, otherwise `null`.
 *
 * @param options - the schema and the raw initial values.
 * @returns a {@link Form} store.
 *
 * @example
 * ```ts
 * import { createForm } from '@jsvision/forms';
 * import { z } from 'zod';
 *
 * const schema = z.object({
 *   name: z.string().min(1, 'Required'),
 *   port: z.coerce.number().int().min(1).max(65535),
 * });
 * // `initial` holds the RAW editing values (port edited as a string):
 * const form = createForm({ schema, initial: { name: '', port: '8080' } });
 *
 * form.field('name').value.set('db');
 * form.isValid();  // true
 * form.values();   // { name: 'db', port: 8080 } — port coerced to a number
 *
 * await form.submit((values) => {
 *   console.log(values.port); // 8080 (typed as a number)
 * });
 * ```
 */
export function createForm<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(
  options: CreateFormOptions<S, I>,
): Form<S, I> {
  // Own the reactive graph in a root scope so its computeds are owned (avoiding the
  // reactive core's owner-less dev-warning) and released with the ambient scope. No
  // public dispose is exposed — there is nothing for a caller to tear down.
  return createRoot(() => buildForm(options));
}

function buildForm<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(
  options: CreateFormOptions<S, I>,
): Form<S, I> {
  const { schema, initial } = options;
  const raw = initial as Record<string, unknown>;
  const names = Object.keys(raw);

  // Defensive baseline snapshot (arrays copied) so reset()/dirty() always compare to the
  // original values even if the caller mutates `initial` after the form is created.
  const baseline: Record<string, unknown> = {};
  const valueSignals = new Map<string, Signal<unknown>>();
  const touchedSignals = new Map<string, Signal<boolean>>();
  for (const name of names) {
    baseline[name] = clone(raw[name]);
    valueSignals.set(name, signal(clone(raw[name])));
    touchedSignals.set(name, signal(false));
  }

  // Mandated reset target. Intentionally write-only for now: submit() sets it, reset()
  // clears it, and nothing reads it yet — a later reveal-after-submit feature consumes it.
  const submitAttempted = signal(false);

  const valueSignal = (name: string): Signal<unknown> => {
    const s = valueSignals.get(name);
    if (!s) throw new FormFieldError(name);
    return s;
  };

  const touchedSignal = (name: string): Signal<boolean> => {
    const t = touchedSignals.get(name);
    if (!t) throw new FormFieldError(name);
    return t;
  };

  const rawValues = (): I => {
    const out: Record<string, unknown> = {};
    for (const name of names) out[name] = valueSignal(name)();
    return out as I;
  };

  const validation = createValidation(schema, rawValues);

  const fieldDirty = (name: string): boolean => !eq(valueSignal(name)(), baseline[name]);

  // Memoize one handle per name so callers observe a single shared touched/value signal.
  const handles = new Map<string, Field<unknown>>();
  const field = <K extends keyof I>(name: K): Field<I[K]> => {
    const key = name as string;
    const value = valueSignals.get(key);
    if (!value) throw new FormFieldError(key);
    const cached = handles.get(key);
    if (cached) return cached as Field<I[K]>;
    const handle: Field<unknown> = {
      name: key,
      value,
      error: () => validation.fieldError(key),
      touched: () => touchedSignal(key)(),
      dirty: () => fieldDirty(key),
    };
    handles.set(key, handle);
    // Register the touched write seam for this handle, so `bindField` can flip touched without a
    // public setter on the handle. It writes the same signal `field.touched()` reads.
    touchedSinks.set(handle, () => touchedSignal(key).set(true));
    return handle as Field<I[K]>;
  };

  const dirty = (): boolean => names.some((name) => fieldDirty(name));

  const reset = (): void => {
    batch(() => {
      for (const name of names) {
        valueSignal(name).set(clone(baseline[name]));
        touchedSignal(name).set(false);
      }
      submitAttempted.set(false);
    });
  };

  const submit = async (onValid: (values: z.output<S>) => void | Promise<void>): Promise<boolean> => {
    batch(() => {
      for (const name of names) touchedSignal(name).set(true);
      submitAttempted.set(true);
    });
    if (!validation.isValid()) return false;
    const coerced = validation.values();
    if (coerced === null) return false; // isValid() true implies non-null; guard for safety
    await onValid(coerced);
    return true;
  };

  return {
    field,
    values: validation.values,
    rawValues,
    errors: validation.errors,
    isValid: validation.isValid,
    dirty,
    submit,
    reset,
  };
}
