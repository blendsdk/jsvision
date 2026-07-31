/** Browser key, clipboard authorization, and virtual-file boundary laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { BrowserCapabilityPanel } from '../../src/example-fixtures/running-in-the-browser/browser-capability-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const COMMANDS = {
  key: 'guide.browser-boundaries.key',
  copy: 'guide.browser-boundaries.copy',
  deny: 'guide.browser-boundaries.deny',
  file: 'guide.browser-boundaries.file',
} as const;

export default defineExample({
  title: 'Browser Capability Boundaries Laboratory',
  blurb: 'Reclaim a focused key, exercise clipboard writes and virtual files, then compare authorization denial.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+k': COMMANDS.key,
        'alt+c': COMMANDS.copy,
        'alt+d': COMMANDS.deny,
        'alt+f': COMMANDS.file,
      }),
    });
    const panel = new BrowserCapabilityPanel();
    app.onCommand(COMMANDS.key, () => panel.checkReclaim('keyboard'));
    app.onCommand(COMMANDS.copy, () => void panel.copyAuthorized('keyboard'));
    app.onCommand(COMMANDS.deny, () => void panel.copyDenied('keyboard'));
    app.onCommand(COMMANDS.file, () => panel.useVirtualFile('keyboard'));

    const reclaim = new Button('Check ~k~ey', { onClick: () => panel.checkReclaim('mouse') });
    const copy = new Button('Allow ~c~opy', { onClick: () => void panel.copyAuthorized('mouse') });
    const deny = new Button('~D~eny copy', { onClick: () => void panel.copyDenied('mouse') });
    const file = new Button('Virtual ~f~ile', { onClick: () => panel.useVirtualFile('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 56, 5));
    content.add(at(reclaim, 0, 6, 14, 2));
    content.add(at(copy, 14, 6, 14, 2));
    content.add(at(deny, 28, 6, 13, 2));
    content.add(at(file, 0, 8, 16, 2));
    content.add(at(new Text('Alt+K reclaim · Alt+C allow · Alt+D deny · Alt+F file'), 0, 10, 56, 1));
    content.add(at(new Text('Keyboard and mouse use the same bounded, non-colour evidence.'), 0, 11, 56, 1));

    const dialog = new Template1Dialog({
      title: ' Browser Capability Boundaries ',
      width: 60,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 56, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(reclaim);
    return app;
  },
});
