/** Typed raw values, coercion, touched state, submission, and reset laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { FormStateValidationPanel } from '../../src/example-fixtures/forms-guide/form-state-validation-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_SUBMIT = 'guide.form-state-validation.submit';
const CMD_FILL = 'guide.form-state-validation.fill';
const CMD_EDIT = 'guide.form-state-validation.edit';
const CMD_RESET = 'guide.form-state-validation.reset';

export default defineExample({
  title: 'Form State and Validation Laboratory',
  blurb: 'Compare raw and coerced values, expose touched and dirty state, then submit and reset a typed form.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+s': CMD_SUBMIT,
        'alt+f': CMD_FILL,
        'alt+e': CMD_EDIT,
        'alt+r': CMD_RESET,
      }),
    });
    const panel = new FormStateValidationPanel();
    app.onCommand(CMD_SUBMIT, () => {
      const rejectedBefore = panel.invalidSubmissions;
      panel.submit('keyboard');
      if (panel.invalidSubmissions > rejectedBefore) app.loop.focusView(panel.nameInput);
    });
    app.onCommand(CMD_FILL, () => panel.fillValid('keyboard'));
    app.onCommand(CMD_EDIT, () => panel.edit('keyboard'));
    app.onCommand(CMD_RESET, () => panel.reset('keyboard'));

    const submit = new Button('~S~ubmit', {
      onClick: () => {
        const rejectedBefore = panel.invalidSubmissions;
        panel.submit('mouse');
        if (panel.invalidSubmissions > rejectedBefore) app.loop.focusView(panel.nameInput);
      },
    });
    const fill = new Button('~F~ill valid', { onClick: () => panel.fillValid('mouse') });
    const edit = new Button('~E~dit', { onClick: () => panel.edit('mouse') });
    const reset = new Button('~R~eset', { onClick: () => panel.reset('mouse') });
    const content = new Group();
    content.add(at(new Text('Deterministic bounded in-memory fixture · no network.'), 0, 0, 62, 1));
    content.add(at(new Text('Text status is ASCII-safe and works in monochrome.'), 0, 1, 62, 1));
    content.add(at(panel, 0, 2, 62, 9));
    content.add(at(submit, 0, 11, 10, 2));
    content.add(at(fill, 11, 11, 13, 2));
    content.add(at(edit, 25, 11, 8, 2));
    content.add(at(reset, 34, 11, 9, 2));
    content.add(at(new Text('Alt+S submit · Alt+F fill · Alt+E edit'), 0, 14, 62, 1));
    content.add(at(new Text('Alt+R reset · Tab fields/buttons · mouse click'), 0, 15, 62, 1));

    const dialog = new Template1Dialog({
      title: ' Form State and Validation Laboratory ',
      width: 66,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 62, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(panel.nameInput);
    return app;
  },
});
