import { batch, createRoot, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { z } from 'zod';
import type { AsyncValidator, CreateFormOptions, Field, Form } from './types.js';
import { FormFieldError } from './errors.js';
import { touchedSinks } from './internal.js';
import { createValidation } from './validation.js';
import { createAsyncValidation } from './async.js';

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
 * `reset`. Opt into per-field async checks with `asyncValidators`. It draws nothing.
 *
 * Gotchas: `initial` holds the **raw** editing values, so a `z.coerce.number()` field is
 * initialised as a string (e.g. `port: '8080'`); `values()` returns the coerced object
 * only when the form is valid, otherwise `null`. A form that mounts `asyncValidators` should be
 * `dispose()`d when it is no longer needed (e.g. a per-dialog form) so no debounce fires after
 * teardown; a long-lived app-level form can leave it.
 *
 * @param options - the schema, the raw initial values, and optional `asyncValidators` / `asyncDebounceMs`.
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
 * const form = createForm({
 *   schema,
 *   initial: { name: '', port: '8080' },
 *   asyncValidators: {
 *     // Runs debounced, only while the field is sync-clean. Catch your own I/O errors —
 *     // an uncaught rejection is treated as "no async error".
 *     name: async (value, { signal }) => {
 *       try {
 *         const res = await fetch(`/api/available?u=${encodeURIComponent(value)}`, { signal });
 *         return (await res.json()).taken ? 'Already in use' : null;
 *       } catch {
 *         return 'Could not verify';
 *       }
 *     },
 *   },
 *   asyncDebounceMs: 300,
 * });
 *
 * form.field('name').value.set('db');
 * form.field('name').validating(); // true while the check is in flight
 * form.field('name').asyncError();  // 'Already in use' | null (distinct from error())
 * form.values();   // { name: 'db', port: 8080 } — port coerced to a number
 *
 * await form.submit((values) => {
 *   console.log(values.port); // 8080 (typed as a number)
 * });
 *
 * form.dispose(); // tear down the async effects (per-dialog forms must call this)
 * ```
 */
export function createForm<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(
  options: CreateFormOptions<S, I>,
): Form<S, I> {
  // Own the reactive graph in a root scope so its computeds + async effects are owned (avoiding the
  // reactive core's owner-less dev-warning) and released together. The root hands back an idempotent
  // disposer; we expose it as `form.dispose()` so a caller can tear the whole scope down.
  return createRoot((disposeScope) => buildForm(options, disposeScope));
}

function buildForm<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(
  options: CreateFormOptions<S, I>,
  disposeScope: () => void,
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

  // The opt-in per-field async layer sits beside the sync parse. `fieldSyncClean` is the gate the
  // trigger reads untracked (so an unrelated field's parse never re-subscribes it).
  const asyncLayer = createAsyncValidation({
    names,
    asyncValidators: (options.asyncValidators ?? {}) as Partial<Record<string, AsyncValidator<unknown>>>,
    debounceMs: options.asyncDebounceMs ?? 300,
    valueSignal,
    fieldSyncClean: (name) => validation.fieldError(name) === null,
  });

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
      validating: () => asyncLayer.fieldValidating(key),
      asyncError: () => asyncLayer.fieldAsyncError(key),
    };
    handles.set(key, handle);
    // Register the touched write seam for this handle, so `bindField` can flip touched without a
    // public setter on the handle. It writes the same signal `field.touched()` reads.
    touchedSinks.set(handle, () => touchedSignal(key).set(true));
    return handle as Field<I[K]>;
  };

  const dirty = (): boolean => names.some((name) => fieldDirty(name));

  // Form-level validity: sync-valid AND no async error. Optimistic about pending async work (a
  // not-yet-run or in-flight validator does not hold it false). ANDs signal reads — no extra parse.
  const isValidForm = (): boolean => validation.isValid() && asyncLayer.allAsyncClean();

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
    // Short-circuit on a sync-invalid object: no async validator is invoked (no pointless round-trip
    // on a doomed submit, and no malformed value is handed to a validator). Every field is sync-clean
    // past this point, so the async gate is the only thing left to satisfy.
    if (!validation.isValid()) return false;
    // No queued debounce may supersede the force-run; then force-run + await every async validator.
    asyncLayer.cancelPendingDebounces();
    await asyncLayer.runAllForced();
    if (!isValidForm()) return false; // now also reflects any async error
    const coerced = validation.values();
    if (coerced === null) return false; // isValidForm() true implies non-null; guard for safety
    await onValid(coerced);
    return true;
  };

  return {
    field,
    values: validation.values,
    rawValues,
    errors: validation.errors,
    isValid: isValidForm,
    dirty,
    validating: () => asyncLayer.anyValidating(),
    submit,
    reset,
    dispose: disposeScope,
  };
}
