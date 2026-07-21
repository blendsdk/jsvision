/**
 * Story: `@jsvision/forms` async validation — a live "username availability" form that exercises the
 * whole async surface with a **simulated** in-memory directory check (no network, works on any TTY).
 * Type a name: after a short debounce it shows `checking…`, then either an `Already in use` error (for
 * `admin` / `root` / `guest`) or `✓ available`. A `valid · validating` echo mirrors the form state, and
 * a submit button is disabled while invalid or mid-check and force-runs the async gate on click.
 *
 * It shows how `createForm`'s `asyncValidators` drive `field.validating()` / `field.asyncError()` as a
 * surface **distinct** from the synchronous `error()` — the app composes the two, painting a muted
 * `checking…`, a danger-styled async error, and a touched-gated sync error independently.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Input, Button, Label, Text, signal } from '@jsvision/ui';
import { createForm, bindField } from '@jsvision/forms';
import { z } from 'zod';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Resolve after `ms`, or reject early when `signal` aborts (the superseded/disposed run is torn down). */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new Error('aborted'));
    });
  });
}

/**
 * The showcase's async-validation story: a simulated username-availability check bound to a live
 * `Input`, with a `checking…` / async-error / `✓ available` state echo and a submit-gated button.
 *
 * @example
 * import { STORIES } from './stories/index.js';
 * const story = STORIES.find((s) => s.id === 'forms/async');
 * const group = story!.build({ caps, width: 72, height: 16 }); // a Group ready for the shell to place
 */
export const formsAsyncStory: Story = {
  id: 'forms/async',
  category: 'Forms',
  title: 'Async validation',
  rd: 'RD-06',
  blurb:
    'createForm asyncValidators: debounced availability check, checking… / async-error / ✓ available, a submit-gated async gate.',
  build(ctx: StoryContext) {
    const TAKEN = new Set(['admin', 'root', 'guest']); // the simulated directory
    const schema = z.object({ username: z.string().min(3, 'Min 3 chars') });
    const form = createForm({
      schema,
      initial: { username: '' },
      asyncValidators: {
        username: async (value, { signal }) => {
          await sleep(500, signal); // simulated round-trip (abortable)
          return TAKEN.has(value.toLowerCase()) ? 'Already in use' : null;
        },
      },
      asyncDebounceMs: 300,
    });

    const field = form.field('username');
    const usernameInput = new Input({ value: field.value, placeholder: 'try "admin"' });
    bindField(field, usernameInput); // touched-on-first-blur for the sync error

    // The live async state echo. `checking…` while in flight; an empty string once a verdict or a
    // sync issue takes over (each has its own Text below) — at most one of these three paints.
    const statusText = new Text(() => {
      if (field.validating()) return 'checking…';
      if (field.asyncError() !== null) return ''; // the danger-styled asyncErrText paints it instead
      return field.value().length >= 3 ? '✓ available' : '';
    });
    // The async error, danger-styled. Coerce at the boundary (the getter is typed `() => string`) and
    // let it stay empty when there is no async error so it never paints an empty danger-red cell.
    const asyncErrText = new Text(() => field.asyncError() ?? '', { severity: 'error' });

    // The synchronous min(3) issue, revealed only once the field is touched (app-composed gating).
    const syncErrText = new Text(() => {
      const issue = field.error();
      return field.touched() && issue ? issue.message : '';
    });

    const echo = new Text(() => `valid: ${form.isValid()}   validating: ${form.validating()}`);

    const outcome = signal('');
    const submitBtn = new Button('~S~ubmit', {
      default: true,
      // Disabled while the object is invalid or a check is mid-flight; the click force-runs the async
      // gate and echoes the coerced values on success. `void` discards the Promise.
      disabled: () => !form.isValid() || form.validating(),
      onClick: () => {
        void form.submit((v) => outcome.set(`✓ Submitted: ${JSON.stringify(v)}`));
      },
    });
    const outcomeText = new Text(() => outcome());

    const w = Math.max(58, ctx.width - 2);
    const g = new Group();

    // Label · input · live async status (checking… / async error / ✓ available share this row).
    g.add(at(new Label('~U~sername', usernameInput), 1, 0, 10, 1));
    g.add(at(usernameInput, 11, 0, 22, 1));
    g.add(at(statusText, 34, 0, w - 34, 1));
    g.add(at(asyncErrText, 34, 0, w - 34, 1));

    // The touched-gated sync error on its own row.
    g.add(at(syncErrText, 11, 1, w - 11, 1));

    // Live bound-state echo, the submit gate, and the post-submit result.
    g.add(at(echo, 1, 3, w, 1));
    g.add(at(submitBtn, 1, 5, 12, 2));
    g.add(at(outcomeText, 15, 5, w - 15, 1));

    // The always-painted interaction hint — it also guarantees the literal `checking…` demonstration
    // string paints even in a headless mount (the smoke oracle reads it).
    g.add(at(new Text('Type a name → "checking…" then availability. Taken: admin, root, guest.'), 1, 8, w, 1));

    return g;
  },
};
