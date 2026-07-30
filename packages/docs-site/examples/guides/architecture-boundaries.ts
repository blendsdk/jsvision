/** Dependency and command-flow comparison laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ArchitectureBoundariesPanel } from '../../src/example-fixtures/application-architecture/architecture-boundaries-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_COUPLED = 'guide.architecture.coupled';
const CMD_LAYERED = 'guide.architecture.layered';

export default defineExample({
  title: 'Architecture Boundaries Laboratory',
  blurb:
    'Compare a coupled view mutation with the recommended layered command, injected service, reactive state, and view flow.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+c': CMD_COUPLED,
        'alt+l': CMD_LAYERED,
      }),
    });
    const panel = new ArchitectureBoundariesPanel({
      increment: (current) => current + 1,
    });
    app.onCommand(CMD_COUPLED, () => panel.runCoupled('keyboard'));
    app.onCommand(CMD_LAYERED, () => panel.runLayered('keyboard'));

    const coupled = new Button('Coupled path', {
      command: CMD_COUPLED,
      onClick: () => panel.markNextActionSource('mouse'),
    });
    const layered = new Button('Layered flow', {
      command: CMD_LAYERED,
      onClick: () => panel.markNextActionSource('mouse'),
    });
    const content = new Group();
    content.add(at(panel, 0, 0, 60, 9));
    content.add(at(coupled, 0, 10, 16, 2));
    content.add(at(layered, 18, 10, 16, 2));
    content.add(at(new Text('Alt+C coupled diagnosis · Alt+L layered flow · click parity'), 0, 13, 60, 1));
    content.add(at(new Text('Resize/maximize/restore: compare counters and text evidence.'), 0, 15, 60, 1));

    const dialog = new Template1Dialog({
      title: ' Architecture Boundaries ',
      width: 66,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(layered);
    return app;
  },
});
