/** Validation, command-result, and cancellation laboratory for the Dialogs & modality course. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import {
  DIALOG_RESULTS_TRY_OK_COMMAND,
  DialogResultsPanel,
} from '../../src/example-fixtures/dialogs-and-modality/dialog-results-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_RESET = 'guide.dialog-results.reset';

export default defineExample({
  title: 'Dialog Results Laboratory',
  blurb: 'Exercise validation veto, corrected command/value results, and a real Cancel bypass.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+o': DIALOG_RESULTS_TRY_OK_COMMAND,
        'alt+r': CMD_RESET,
      }),
    });
    const panel = new DialogResultsPanel(app);
    app.onCommand(DIALOG_RESULTS_TRY_OK_COMMAND, () => panel.tryOk('keyboard'));
    app.onCommand(CMD_RESET, () => panel.resetForCancel('keyboard'));

    const tryOk = new Button('Try ~O~K', { onClick: () => panel.tryOk('mouse') });
    const reset = new Button('~R~eset for Cancel', {
      onClick: () => panel.resetForCancel('mouse'),
    });
    const content = new Group();
    content.add(at(new Text('Interpret modal results; do not infer success from window removal.'), 0, 0, 62, 1));
    content.add(at(panel, 0, 2, 62, 6));
    content.add(at(tryOk, 0, 9, 16, 2));
    content.add(at(reset, 19, 9, 20, 2));
    content.add(at(new Text('Alt+O try OK · Alt+F fix · Alt+R reset · Alt+C cancel'), 0, 12, 62, 1));
    content.add(
      at(new Text('Mouse buttons mirror the keyboard routes; status text carries every outcome.'), 0, 13, 62, 1),
    );

    const dialog = new Template1Dialog({
      title: ' Dialog Results Laboratory ',
      width: 66,
      height: 18,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 14));
    app.desktop.addWindow(dialog);
    app.loop.focusView(tryOk);
    return app;
  },
});
