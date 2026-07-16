import type { View } from '@jsvision/ui';
import type { Field } from './types.js';
import { touchedSinks } from './internal.js';
import { FormFieldError } from './errors.js';

/**
 * Per-view record of which fields are already wired, so a repeated `bindField(field, view)` is a
 * no-op. Keyed by the view and by the field handle object (identity), avoiding `Signal` invariance.
 * A view's `onCleanup` clears its entry at unmount, so a later re-`bindField` on a remounted view can
 * wire again — remounting does not itself restore the binding.
 */
const bound = new WeakMap<View, Set<object>>();

/**
 * Wire a field's **touched** flag to a widget's focus: the field becomes touched the first time focus
 * *leaves* the widget (a blur), never merely by mounting it or focusing into it. This is how a form
 * shows a validation error only after the user has visited and left a field, matching `submit()`
 * (which marks every field touched at once).
 *
 * Behavior and constraints:
 * - **First-leave only.** Touched flips on the `focused: true → false` transition. It never fires on
 *   mount or on focus-in, and re-focusing then leaving again is harmless (touched stays `true`).
 * - **View-scoped lifetime.** The focus effect is owned by the view and torn down when the view
 *   unmounts — no manual cleanup, no store-level subscription. Call it any time (before or after the
 *   view is mounted); the wiring is deferred to the view's mount.
 * - **Idempotent per (field, view).** Calling it twice for the same pair wires the effect once.
 * - **Foreign handles throw.** `field` must be a handle from this form's `createForm`; any other
 *   object throws {@link FormFieldError} (there is no touched seam registered for it).
 *
 * Use it alongside a direct value binding (`new Input({ value: field.value })`) or a choice adapter
 * (`bindRadio`/`bindCheck`) — those carry the value two-way; `bindField` adds only the touched signal.
 *
 * @param field The field handle whose touched flag to drive.
 * @param view  The focusable widget bound to that field.
 * @throws {FormFieldError} If `field` was not produced by this form's `createForm`.
 *
 * @example
 * import { Group, Input, createEventLoop } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 * import { createForm, bindField } from '@jsvision/forms';
 * import { z } from 'zod';
 *
 * const form = createForm({ schema: z.object({ email: z.string().email() }), initial: { email: '' } });
 * const field = form.field('email');
 * const input = new Input({ value: field.value }); // two-way value binding
 * bindField(field, input);                          // touched once focus leaves the field
 *
 * const root = new Group();
 * root.add(input);
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const loop = createEventLoop({ width: 30, height: 3 }, { caps });
 * loop.mount(root);
 * loop.focusView(input);
 * // field.touched() stays false while focused; it becomes true the first time focus moves away.
 */
export function bindField<T>(field: Field<T>, view: View): void {
  const mark = touchedSinks.get(field);
  if (!mark) throw new FormFieldError(field.name); // not a handle from this form's createForm

  let set = bound.get(view);
  if (set?.has(field)) return; // already wired for this pair
  if (!set) {
    set = new Set<object>();
    bound.set(view, set);
  }
  set.add(field);

  // Wire on mount, when the view's reactive scope exists. Capturing `was` before the first effect run
  // means mounting never counts as a leave; the focus manager settles `state.focused` before it pokes
  // the focus signal, so each re-run reads the fresh flag.
  view.onMount(() => {
    let was = view.state.focused;
    view.bind(() => {
      view.focusSignal()(); // subscribe: re-run on every focus flip (enter and leave)
      const now = view.state.focused;
      if (was && !now) mark(); // a blur — mark touched (writing an already-true signal is a no-op)
      was = now;
    });
    view.onCleanup(() => bound.get(view)?.delete(field));
  });
}
