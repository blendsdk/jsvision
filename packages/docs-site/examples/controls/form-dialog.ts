/** FormDialog laboratory with a schema preview and the real modal submission lifecycle. */
import { formDialog } from '@jsvision/forms';
import { Button, Dialog, Group, Input, Label, Text, at, createKeymap, signal } from '@jsvision/ui';
import { z } from 'zod';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_OPEN = 'form-dialog-lab.open';
const CMD_SUBMIT = 'form-dialog-lab.submit';
const CMD_CANCEL = 'form-dialog-lab.cancel';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 10;
const profileSchema = z.object({ name: z.string().min(1), age: z.coerce.number().int().min(0).max(120) });

export default defineExample({
  title: 'Form Dialog Lab',
  blurb: 'Validate and coerce a profile, then launch the same fields through the real modal formDialog helper.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+o': CMD_OPEN, 'alt+s': CMD_SUBMIT, 'alt+c': CMD_CANCEL }),
    });
    const name = signal('');
    const age = signal('');
    const status = signal('ready · enter a name and age');
    const nameInput = new Input({ value: name });
    const ageInput = new Input({ value: age });
    const dialog = new Dialog({ title: ' Form Dialog Lab ', width: 60, height: 14 });
    dialog.closable = false;
    const content = new Group();
    content.add(at(new Text('Schema fields, coercion, errors, and modal lifecycle.'), 0, 0, 56, 1));
    content.add(at(new Label('~N~ame', nameInput), 0, 2, 10, 1));
    content.add(at(nameInput, 11, 2, 22, 1));
    content.add(at(new Label('~A~ge', ageInput), 0, 4, 10, 1));
    content.add(at(ageInput, 11, 4, 22, 1));
    content.add(at(new Button('~S~ubmit', { command: CMD_SUBMIT, default: true }), 36, 2, 14, 2));
    content.add(at(new Button('~O~pen modal', { command: CMD_OPEN }), 36, 5, 16, 2));
    content.add(at(new Text(() => `Result: ${status()}`), 0, 7, 56, 1));
    content.add(at(new Text('Alt+O opens · complete fields · Esc cancels'), 0, 9, 56, 1));

    app.onCommand(CMD_SUBMIT, () => {
      const result = profileSchema.safeParse({ name: name(), age: age() });
      status.set(result.success ? `${result.data.name} · ${result.data.age}` : 'invalid · both fields stay editable');
    });
    app.onCommand(CMD_CANCEL, () => status.set('cancelled · no values committed'));
    app.onCommand(CMD_OPEN, () => {
      const pending = formDialog(app, {
        schema: profileSchema,
        initial: { name: '', age: '' },
        title: ' Profile form ',
        width: 46,
        height: 10,
        body: (form) => {
          const body = new Group();
          const modalName = new Input({ value: form.field('name').value });
          const modalAge = new Input({ value: form.field('age').value });
          body.add(at(new Label('~N~ame', modalName), 2, 1, 10, 1));
          body.add(at(modalName, 13, 1, 24, 1));
          body.add(at(new Label('~A~ge', modalAge), 2, 3, 10, 1));
          body.add(at(modalAge, 13, 3, 24, 1));
          return body;
        },
      });
      void pending.then((result) =>
        status.set(
          result === null ? 'cancelled · modal returned null' : `modal result · ${result.name} · ${result.age}`,
        ),
      );
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(nameInput);
    return app;
  },
});
