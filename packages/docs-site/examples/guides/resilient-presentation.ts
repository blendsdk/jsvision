/** Monochrome, ASCII-fallback, reduced-geometry, and browser-evidence accessibility laboratory. */
import { Button, Commands, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ResilientPresentationPanel } from '../../src/example-fixtures/accessibility/resilient-presentation-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_PROFILE = 'guide.accessibility.next-profile';

export default defineExample({
  title: 'Resilient Presentation Laboratory',
  blurb: 'Cycle NO_COLOR, monochrome, ASCII, and reduced geometry while semantic labels stay intact.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+p': CMD_PROFILE, 'alt+z': Commands.zoom }),
    });
    const panel = new ResilientPresentationPanel();
    app.onCommand(CMD_PROFILE, () => panel.nextProfile());
    const next = new Button('Next ~p~rofile', { command: CMD_PROFILE, default: true });
    const content = new Group();
    content.add(at(panel, 0, 0, 54, 6));
    content.add(at(next, 0, 6, 18, 2));
    content.add(at(new Text('Alt+P profiles | meaning survives without colour'), 0, 9, 54, 1));

    const dialog = new Template1Dialog({
      title: ' Resilient Presentation ',
      width: 58,
      height: 14,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 54, 10));
    app.desktop.addWindow(dialog);
    app.loop.focusView(next);
    return app;
  },
});
