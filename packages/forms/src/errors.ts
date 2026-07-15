/**
 * Thrown when a form field cannot be resolved. Two cases raise it:
 *
 * 1. A form's `field(name)` accessor is called with a name that is not one of the schema's fields.
 *    The typed API constrains `field` to the schema keys, so this only fires when a name is reached
 *    dynamically — through a cast or a runtime-computed string.
 * 2. `bindField(field, view)` is given a field handle that was **not** produced by this form's
 *    `createForm` (a foreign or hand-built object). Such a handle has no registered touched seam, so
 *    binding it would silently do nothing; failing fast surfaces the mistake instead. `error.field`
 *    carries the handle's `name`.
 *
 * @example
 * ```ts
 * import { createForm, FormFieldError } from '@jsvision/forms';
 * import { z } from 'zod';
 *
 * const form = createForm({ schema: z.object({ name: z.string() }), initial: { name: '' } });
 * try {
 *   form.field('nope' as never);
 * } catch (err) {
 *   if (err instanceof FormFieldError) console.error(err.field); // 'nope'
 * }
 * ```
 */
export class FormFieldError extends Error {
  /** The field name that was requested but does not exist on the form. */
  readonly field: string;

  constructor(field: string) {
    super(`Unknown form field "${field}"`);
    this.name = 'FormFieldError';
    this.field = field;
  }
}
