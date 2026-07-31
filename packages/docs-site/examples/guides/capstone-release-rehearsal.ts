/** Browser-safe release decision rehearsal laboratory. */
import { Button, Commands, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ReleaseRehearsalPanel } from '../../src/example-fixtures/complete-application/release-rehearsal.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const NEXT_SCENARIO = 'guide.capstone.release.next';
const VERIFY_RECOVERY = 'guide.capstone.release.verify';

export default defineExample({
  title: 'Release Rehearsal',
  blurb: 'Cycle ship/no-go scenarios and verify recovery while observing the browser evidence boundary.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+n': NEXT_SCENARIO, 'alt+v': VERIFY_RECOVERY, 'alt+z': Commands.zoom }),
    });
    const panel = new ReleaseRehearsalPanel();
    app.onCommand(NEXT_SCENARIO, () => panel.nextScenario());
    app.onCommand(VERIFY_RECOVERY, () => panel.verifyRecovery());
    const next = new Button('~N~ext scenario', { command: NEXT_SCENARIO, default: true });
    const verify = new Button('~V~erify recovery', { command: VERIFY_RECOVERY });
    const content = new Group();
    content.add(at(panel, 0, 0, 58, 7));
    content.add(at(next, 0, 7, 20, 2));
    content.add(at(verify, 22, 7, 22, 2));
    content.add(at(new Text('Alt+N next · Alt+V verify · Alt+Z maximize/restore'), 0, 10, 58, 1));
    content.add(at(new Text('Status stays bounded and payload-free in every scenario.'), 0, 11, 58, 1));

    const dialog = new Template1Dialog({
      title: ' Release Rehearsal ',
      width: 64,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 60, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(next);
    return app;
  },
});
