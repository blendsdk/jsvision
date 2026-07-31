/** Complete record workflow capstone laboratory. */
import { Button, Commands, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import {
  CapstoneWorkflowPanel,
  createAuthorizedMemoryStore,
} from '../../src/example-fixtures/complete-application/workflow-model.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const COMMANDS = {
  open: 'guide.capstone.open',
  save: 'guide.capstone.save',
  refresh: 'guide.capstone.refresh',
  cancel: 'guide.capstone.cancel',
  fail: 'guide.capstone.fail',
  retry: 'guide.capstone.retry',
  back: 'guide.capstone.back',
} as const;

export default defineExample({
  title: 'Complete Application Workflow',
  blurb: 'Navigate, save through an authorized seam, cancel refresh work, and recover while observing one workflow.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+o': COMMANDS.open,
        'alt+s': COMMANDS.save,
        'alt+r': COMMANDS.refresh,
        'alt+c': COMMANDS.cancel,
        'alt+f': COMMANDS.fail,
        'alt+y': COMMANDS.retry,
        'alt+b': COMMANDS.back,
        'alt+z': Commands.zoom,
      }),
    });
    const panel = new CapstoneWorkflowPanel(createAuthorizedMemoryStore());
    const buttons = [
      new Button('~O~pen editor', { command: COMMANDS.open, default: true }),
      new Button('~B~ack', { command: COMMANDS.back }),
      new Button('~S~ave record', { command: COMMANDS.save }),
      new Button('Start ~r~efresh', { command: COMMANDS.refresh }),
      new Button('~C~ancel work', { command: COMMANDS.cancel }),
      new Button('Simulate ~f~ailure', { command: COMMANDS.fail }),
      new Button('Retr~y~', { command: COMMANDS.retry }),
    ];
    app.onCommand(COMMANDS.open, () => {
      panel.openEditor();
      app.loop.focusView(panel.nameInput);
    });
    app.onCommand(COMMANDS.back, () => {
      panel.backToRecords();
      app.loop.focusView(panel.recordButton);
    });
    app.onCommand(COMMANDS.save, () => {
      void panel.saveRecord();
      if (panel.phase === 'error') app.loop.focusView(panel.nameInput);
    });
    app.onCommand(COMMANDS.refresh, () => panel.startRefresh());
    app.onCommand(COMMANDS.cancel, () => panel.cancelWork());
    app.onCommand(COMMANDS.fail, () => panel.simulateFailure());
    app.onCommand(COMMANDS.retry, () => panel.retry());
    const content = new Group();
    content.add(at(panel, 0, 0, 58, 7));
    buttons.slice(0, 4).forEach((button, index) => content.add(at(button, index * 15, 7, 14, 2)));
    buttons.slice(4).forEach((button, index) => content.add(at(button, index * 19, 9, 18, 2)));
    content.add(at(new Text('Alt+O/B/S/R/C/F/Y · Alt+Z maximize/restore · Tab/Enter/click'), 0, 11, 58, 1));

    const dialog = new Template1Dialog({
      title: ' Complete Workflow ',
      width: 64,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 60, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(buttons[0]);
    return app;
  },
});
