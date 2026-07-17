/**
 * Story: `@jsvision/forms` async loading — the "open this form to edit an existing record" case. A
 * `Load record` button runs a **simulated** fetch (no network, works on any TTY): while it is in
 * flight `loading()` drives a `Loading…` swap, and on success every field value AND the whole baseline
 * rebase to the loaded record, leaving the form pristine. From there it demonstrates the payoff —
 * editing the bound `Input` flips `dirty()` true, and `Reset` returns to the LOADED record, not the
 * blank initial.
 *
 * It shows how `createForm`'s `load(loader)` / `loading()` turn a blank form into an edit form: the
 * baseline moves to the fetched record, so `dirty()` means "changed since it was loaded" and `reset()`
 * targets the loaded values.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Input, Button, Label, Text, signal } from '@jsvision/ui';
import { createForm, bindField } from '@jsvision/forms';
import { z } from 'zod';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Resolve after `ms`, or reject early when `signal` aborts (a superseded/disposed load is torn down). */
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
 * The showcase's async-loading story: a simulated record fetch bound to a live `Input`, with a
 * `Loading…` swap, a `dirty` rebase-state echo, and a `Reset`-to-loaded affordance.
 *
 * @example
 * import { STORIES } from './stories/index.js';
 * const story = STORIES.find((s) => s.id === 'forms/load');
 * const group = story!.build({ caps, width: 72, height: 16 }); // a Group ready for the shell to place
 */
export const formsLoadStory: Story = {
  id: 'forms/load',
  category: 'Forms',
  title: 'Async loading + baseline rebase',
  rd: 'RD-07',
  blurb: 'form.load(loader): a simulated fetch, the Loading… swap, then load → edit → dirty → reset-to-loaded.',
  build(ctx: StoryContext) {
    const schema = z.object({ name: z.string().min(1, 'Required') });
    const form = createForm({ schema, initial: { name: '' } });

    // The simulated fetch: resolve the RAW editing record after a short, abortable delay. No network —
    // dispose() (or a newer load) aborts the sleep, whose promise rejects, so that load resolves false.
    const loadRecord = async ({ signal }: { signal: AbortSignal }): Promise<{ name: string }> => {
      await sleep(500, signal);
      return { name: 'Ada Lovelace' };
    };

    const field = form.field('name');
    const nameInput = new Input({ value: field.value, placeholder: '— empty until loaded —' });
    bindField(field, nameInput); // touched-on-first-blur for the sync error

    // The loading()/loaded swap: Loading… while a fetch is in flight, then a settled confirmation.
    const status = signal('not loaded');
    const statusText = new Text(() => (form.loading() ? 'Loading…' : status()));

    // The rebase-state echo — the whole point: after a load dirty() is false; editing flips it true;
    // Reset returns to the LOADED record, not the blank initial.
    const dirtyEcho = new Text(() => `dirty: ${form.dirty()}   (edit the field, then Reset)`);

    const loadBtn = new Button('~L~oad record', {
      default: true,
      disabled: () => form.loading(), // no double-trigger while a fetch is in flight
      onClick: () => {
        void form.load(loadRecord).then((ok) => status.set(ok ? '✓ loaded — baseline rebased' : '✗ load failed'));
      },
    });
    const resetBtn = new Button('~R~eset', {
      onClick: () => form.reset(), // returns to the loaded record (or the blank initial before any load)
    });

    const w = Math.max(58, ctx.width - 2);
    const g = new Group();

    // Label · bound input · the Loading… / loaded status.
    g.add(at(new Label('~N~ame', nameInput), 1, 0, 8, 1));
    g.add(at(nameInput, 9, 0, 24, 1));
    g.add(at(statusText, 35, 0, w - 35, 1));

    // The live rebase-state echo, then the load + reset actions.
    g.add(at(dirtyEcho, 1, 2, w, 1));
    g.add(at(loadBtn, 1, 4, 17, 2));
    g.add(at(resetBtn, 19, 4, 11, 2));

    // The always-painted interaction hint. It also names how to fire Reset: it is a click / Space /
    // Alt+R action, NOT Enter — Enter always triggers the dialog default (the Load button), so a
    // keyboard user who tabs to Reset and presses Enter re-loads instead of resetting.
    g.add(at(new Text('Reset: click or Alt+R (Enter runs Load) → returns to the loaded record.'), 1, 7, w, 1));

    return g;
  },
};
