/** Nested stack, focus restoration, confinement, and teardown laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ModalWorkflowsPanel } from '../../src/example-fixtures/dialogs-and-modality/modal-workflows-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_NESTED = 'guide.modal-workflows.nested';
const CMD_TEARDOWN = 'guide.modal-workflows.teardown';

export default defineExample({
  title: 'Modal Workflows Laboratory',
  blurb: 'Run nested LIFO confirmation, exact focus restoration, cancellation, and cleanup.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_NESTED,
        'alt+d': CMD_TEARDOWN,
      }),
    });
    const panel = new ModalWorkflowsPanel(app, ctx.caps);
    const nested = new Button('Run ~n~ested workflow', {
      onClick: () => panel.runNested('mouse', nested),
    });
    const teardown = new Button('Run ~d~isposal probe', {
      onClick: () => panel.runTeardown('mouse'),
    });
    app.onCommand(CMD_NESTED, () => panel.runNested('keyboard', nested));
    app.onCommand(CMD_TEARDOWN, () => panel.runTeardown('keyboard'));

    const content = new Group();
    content.add(at(new Text('The top modal owns input; each result restores one saved focus frame.'), 0, 0, 62, 1));
    content.add(at(panel, 0, 2, 62, 7));
    content.add(at(nested, 0, 10, 22, 2));
    content.add(at(teardown, 25, 10, 21, 2));
    content.add(at(new Text('Alt+N open · X confinement · Alt+Y inner · Alt+C outer'), 0, 13, 62, 1));
    content.add(at(new Text('Alt+D teardown · mouse buttons mirror both workflows'), 0, 14, 62, 1));

    const dialog = new Template1Dialog({
      title: ' Modal Workflows Laboratory ',
      width: 66,
      height: 19,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 15));
    app.desktop.addWindow(dialog);
    app.loop.focusView(nested);
    return app;
  },
});
