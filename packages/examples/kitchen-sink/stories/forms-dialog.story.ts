/**
 * Story: `@jsvision/forms` modal form dialog — the submit-gate flow. A launch button opens
 * `formDialog`, which runs a headless `createForm` store inside a modal `Dialog`: OK gates on the
 * async `form.submit()` (an invalid OK stays open with the error revealed; a valid OK closes and
 * echoes the coerced values), and Cancel / Esc resolve to `null`. A live echo shows the outcome.
 *
 * It shows how `formDialog` turns a schema + a `body(form)` builder into a self-contained edit dialog
 * that owns and disposes its form — no hand-wiring of the Dialog, the buttons, or the sync/async gate.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Button, Text, Input, Label, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { formDialog, bindField } from '@jsvision/forms';
import { z } from 'zod';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const formsDialogStory: Story = {
  id: 'forms/dialog',
  category: 'Forms',
  title: 'Modal form dialog + submit-gate',
  rd: 'RD-08',
  blurb:
    'formDialog(host, { schema, body }): a modal edit dialog that owns its form — OK gates on the async submit (invalid stays open, valid echoes the coerced values), Cancel/Esc → null.',
  build(ctx: StoryContext) {
    const result = signal('(not opened yet)');
    const g = new Group();

    const openDialog = (): void => {
      if (ctx.execView === undefined) {
        result.set('(headless — run demo:kitchen for the modal)');
        return;
      }
      // The shell's execModal (ctx.execView) already adds the modal to the desktop, runs it, and
      // removes it — so formDialog's desktop must be a NO-OP shim, or the dialog would be mounted
      // twice. `bounds` is only present to satisfy the host type; formDialog never reads it. And
      // ctx.execView is non-generic, so re-expose it as the generic method formDialog calls.
      const exec = ctx.execView;
      const host = {
        loop: { execView: <R>(view: View): Promise<R> => (exec as (m: View) => Promise<R>)(view) },
        desktop: {
          addWindow: (): void => {},
          removeWindow: (): void => {},
          bounds: { x: 0, y: 0, width: ctx.width, height: ctx.height },
        },
      };
      const schema = z.object({
        name: z.string().min(1, 'Required'),
        port: z.coerce.number().int().min(1).max(65535),
      });
      void formDialog(host, {
        schema,
        initial: { name: '', port: '8080' }, // RAW editing values (port edited as a string)
        title: ' Edit server ',
        width: 44,
        height: 9,
        body: (form) => {
          const body = new Group();
          const nameField = form.field('name');
          const portField = form.field('port');
          const nameInput = new Input({ value: nameField.value, placeholder: 'db-primary' });
          const portInput = new Input({ value: portField.value });
          bindField(nameField, nameInput); // touched-on-first-blur → the error reveals as you leave the field

          body.add(at(new Label('~N~ame', nameInput), 2, 1, 7, 1));
          body.add(at(nameInput, 10, 1, 30, 1));
          body.add(at(new Label('~P~ort', portInput), 2, 3, 7, 1));
          body.add(at(portInput, 10, 3, 30, 1));
          // A touched-gated error line for name, via RD-09's Text `severity` (soft integration).
          const nameErr = new Text(
            () => {
              const issue = nameField.touched() ? nameField.error() : null;
              return issue ? issue.message : '';
            },
            { severity: 'error' },
          );
          body.add(at(nameErr, 2, 5, 38, 1));
          return body;
        },
      }).then((values) => result.set(values ? `saved: ${values.name}:${values.port}` : 'cancelled'));
    };

    g.add(at(new Button('~O~pen form dialog…', { command: 'forms.dialog.open', onClick: openDialog }), 1, 1, 24, 2));
    g.add(at(new Text(() => result()), 1, 4, ctx.width - 2, 1));
    // The always-painted hint — it also guarantees the demonstration literals paint in a headless
    // mount (the smoke oracle reads rendered text; the 44×9 modal exceeds the 72×16 smoke canvas).
    g.add(
      at(
        new Text(
          'Open → edit Name → an invalid OK stays open (error shows) → a valid OK echoes the coerced values · Cancel/Esc → cancelled.',
        ),
        1,
        6,
        ctx.width - 2,
        2,
      ),
    );
    return g;
  },
};
