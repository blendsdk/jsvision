/** Colour-depth encoder, monochrome-attribute, and ASCII-fallback laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ColourDepthPanel } from '../../src/example-fixtures/theming-and-colour-depth/colour-depth-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_DEPTH = 'guide.color-depth-fallbacks.depth';
const CMD_ASCII = 'guide.color-depth-fallbacks.ascii';

export default defineExample({
  title: 'Colour Depth Fallbacks Laboratory',
  blurb: 'Trace one accent through truecolor, 256, 16, mono, and ASCII-safe non-colour evidence.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+d': CMD_DEPTH,
        'alt+a': CMD_ASCII,
      }),
    });
    const panel = new ColourDepthPanel();
    app.onCommand(CMD_DEPTH, () => panel.nextDepth('keyboard'));
    app.onCommand(CMD_ASCII, () => panel.checkAscii('keyboard'));

    const nextDepth = new Button('Next ~d~epth', { onClick: () => panel.nextDepth('mouse') });
    const ascii = new Button('Check ~A~SCII', { onClick: () => panel.checkAscii('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 56, 8));
    content.add(at(nextDepth, 0, 8, 14, 2));
    content.add(at(ascii, 16, 8, 15, 2));
    content.add(at(new Text('Alt+D advances depth · Alt+A checks ASCII fallbacks'), 0, 10, 56, 1));
    content.add(at(new Text('The host is unchanged; labelled evidence uses explicit caps.'), 0, 11, 56, 1));

    const dialog = new Template1Dialog({
      title: ' Colour Depth & Resilience ',
      width: 60,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 56, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(nextDepth);
    return app;
  },
});
