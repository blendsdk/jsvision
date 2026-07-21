import { computed } from '@jsvision/ui';
import type { z } from 'zod';
import type { ZodIssue } from 'zod';

/** The validation accessors derived from a single whole-object parse. */
export interface Validation<S extends z.ZodObject<z.ZodRawShape>> {
  isValid(): boolean;
  values(): z.output<S> | null;
  errors(): ZodIssue[];
  fieldError(name: string): ZodIssue | null;
}

/**
 * Build the validation layer over a schema and a live raw-values accessor.
 *
 * A single memoized computed runs `schema.safeParse` on the whole object; every accessor
 * reads that one result, so the parse runs at most once per raw change no matter how many
 * readers subscribe. The parse is synchronous: a schema that contains an async refinement makes
 * `safeParse` throw, which this layer catches and rethrows as a named developer error pointing at
 * the `asyncValidators` option — the supported way to do per-field async checks.
 */
export function createValidation<S extends z.ZodObject<z.ZodRawShape>, I>(
  schema: S,
  rawValues: () => I,
): Validation<S> {
  const result = computed(() => {
    try {
      return schema.safeParse(rawValues());
    } catch (cause) {
      // A synchronous `safeParse` returns `{ success: false }` for ordinary validation failures, so a
      // *throw* here unambiguously means the schema holds an async refinement (Zod's $ZodAsyncError) —
      // which the synchronous validator cannot run. Rethrow a named error; `cause` keeps the original.
      throw new Error(
        'jsvision-forms: the schema contains an async refinement, which the synchronous validator ' +
          'cannot run. Use the `asyncValidators` option for per-field async checks instead.',
        { cause },
      );
    }
  });

  return {
    isValid: () => result().success,
    values: () => {
      const r = result();
      return r.success ? r.data : null;
    },
    // Path-less issues are the form-level ones (an object-level refine); a field-routed
    // issue carries the field name as its first path segment.
    errors: () => {
      const r = result();
      return r.success ? [] : r.error.issues.filter((issue) => issue.path.length === 0);
    },
    fieldError: (name) => {
      const r = result();
      if (r.success) return null;
      return r.error.issues.find((issue) => issue.path[0] === name) ?? null;
    },
  };
}
