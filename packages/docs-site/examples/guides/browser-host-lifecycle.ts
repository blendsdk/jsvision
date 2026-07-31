/** Browser mount, input, resize, first-paint, and disposal laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { BrowserHostLifecyclePanel } from '../../src/example-fixtures/running-in-the-browser/browser-host-lifecycle-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const COMMANDS = {
  mount: 'guide.browser-host.mount',
  input: 'guide.browser-host.input',
  resize: 'guide.browser-host.resize',
} as const;

export default defineExample({
  title: 'Browser Host Lifecycle Laboratory',
  blurb: 'Mount an unchanged app, observe first paint and decoded input, resize it, then dispose every owner.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+m': COMMANDS.mount,
        'alt+i': COMMANDS.input,
        'alt+s': COMMANDS.resize,
      }),
    });
    const panel = new BrowserHostLifecyclePanel();
    app.onCommand(COMMANDS.mount, () => panel.mountHost('keyboard'));
    app.onCommand(COMMANDS.input, () => panel.sendInput('keyboard'));
    app.onCommand(COMMANDS.resize, () => panel.resizeHost('keyboard'));

    const mount = new Button('~M~ount host', { onClick: () => panel.mountHost('mouse') });
    const input = new Button('Send ~i~nput', { onClick: () => panel.sendInput('mouse') });
    const resize = new Button('Re~s~ize host', { onClick: () => panel.resizeHost('mouse') });
    const dispose = new Button('Dispose host', { onClick: () => panel.disposeHost('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 56, 5));
    content.add(at(mount, 0, 6, 14, 2));
    content.add(at(input, 14, 6, 14, 2));
    content.add(at(resize, 28, 6, 15, 2));
    content.add(at(dispose, 0, 8, 16, 2));
    content.add(at(new Text('Alt+M mount · Alt+I input · Alt+S resize · mouse disposes'), 0, 10, 56, 1));
    content.add(at(new Text('The nested terminal is in memory; no visitor resource is used.'), 0, 11, 56, 1));

    const dialog = new Template1Dialog({
      title: ' Browser Host Lifecycle ',
      width: 60,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 56, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(mount);
    return app;
  },
});
