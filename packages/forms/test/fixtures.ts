// Shared test fixtures for the @jsvision/forms store + validation specs.
// Not a test file (no *.spec/*.impl.test suffix), so vitest never runs it directly.
//
// The `.min(1, 'Min 1')` / 'Required' messages are custom author messages (not zod
// defaults) so the message-passthrough oracle tests real passthrough rather than
// "the engine did not mangle a zod default". `initial` carries the RAW editing types
// (port is a string edited into a `z.coerce.number()` field).
import { z } from 'zod';

/** The canonical multi-field fixture: string / coerced-number / boolean + a field-routed cross rule. */
export const Schema = z
  .object({
    name: z.string().min(1, 'Required'),
    port: z.coerce.number().int('Whole number').min(1, 'Min 1').max(65535),
    tls: z.boolean(),
  })
  .refine((v) => !(v.tls && v.port === 23), { message: 'TLS not on 23', path: ['port'] });

/** Fresh raw initial per call, so no test can leak mutations into another. */
export const makeInitial = () => ({ name: '', port: '8080', tls: true });

/** An array (check-group) field, to exercise element-wise dirty. */
export const ArraySchema = z.object({ flags: z.array(z.boolean()) });
export const makeArrayInitial = () => ({ flags: [true, false] });

/** A PATH-LESS refine (object-level) that routes to `form.errors()`, not any field. */
export const CrossSchema = z
  .object({ a: z.string().min(1), b: z.string().min(1) })
  .refine((v) => v.a === v.b, { message: 'a and b must match' });
export const makeCrossInitial = () => ({ a: '', b: '' });
