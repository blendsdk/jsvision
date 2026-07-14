/**
 * Thrown by a form's `field(name)` accessor when the requested name is not one of the
 * schema's fields. The typed API constrains `field` to the schema keys, so this only
 * fires when a name is reached dynamically — through a cast or a runtime-computed string.
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
