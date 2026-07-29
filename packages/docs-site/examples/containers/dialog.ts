/**
 * A Dialog laboratory showing automatic centering, built-in padding, validation gating, and the
 * guaranteed cancel escape path.
 */
import { Commands, Dialog, Group, Input, Label, Text, at, createKeymap, range, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_VALIDATE = 'dialog-lab.validate';
const CMD_CANCEL = 'dialog-lab.cancel';
const CONTENT_WIDTH = 44;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'Dialog Lab',
  blurb: 'Inspect centered geometry and compare an invalid OK gate with cancellation’s guaranteed escape path.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+v': CMD_VALIDATE,
        'alt+c': CMD_CANCEL,
      }),
    });
    const ageValue = signal('17');
    const validation = signal('waiting');
    const cancel = signal('not checked');
    const age = new Input({ value: ageValue, validator: range(18, 120) });
    const dialog = new Dialog({ title: ' Dialog Lab ', width: 48, height: 14 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Dialog aggregates child validity before a modal command resolves.'), 0, 0, 44, 2));
    content.add(at(new Label('~A~ge (18–120)', age), 0, 3, 16, 1));
    content.add(at(age, 18, 3, 10, 1));
    content.add(at(new Text(() => `Input value: ${ageValue()}`), 30, 3, 14, 1));
    content.add(at(new Text(() => `Validation: ${validation()}`), 0, 5, 44, 1));
    content.add(at(new Text(() => `Cancel bypass: ${cancel()}`), 0, 6, 44, 1));
    content.add(at(new Text('Alt+V OK gate · Alt+C Cancel · Alt+A age'), 0, 8, 44, 1));
    content.add(at(new Text('Edit 17 to 18, then test validation again.'), 0, 9, 44, 1));

    app.onCommand(CMD_VALIDATE, () => {
      validation.set(dialog.valid(Commands.ok) ? 'allowed valid value' : 'blocked invalid value');
    });
    app.onCommand(CMD_CANCEL, () => {
      cancel.set(dialog.valid(Commands.cancel) ? 'allowed' : 'blocked');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
