/**
 * A Group laboratory demonstrating retained child order, background fill, and dynamic ownership.
 */
import { Group, Show, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 58;
const CONTENT_HEIGHT = 12;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;
const CMD_OVERLAY = 'group-lab.overlay';

export default defineExample({
  title: 'Group Lab',
  blurb: 'Inspect retained child order, background clearing, and a dynamically owned front layer.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+a': CMD_OVERLAY }),
    });
    const overlayVisible = signal(false);
    const dialog = new Template1Dialog({ title: ' Group Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    const content = new Group();
    const stage = new Group();
    stage.background = 'dialog';

    stage.add(at(new Text('┌──────────────────────────────────────────┐'), 0, 0, 44, 1));
    stage.add(at(new Text('│ Base layer                                │'), 0, 1, 44, 1));
    stage.add(at(new Text('│       Detail paints after Base            │'), 0, 2, 44, 1));
    stage.add(at(new Text('│                                            │'), 0, 3, 44, 1));
    stage.add(at(new Text('└──────────────────────────────────────────┘'), 0, 4, 44, 1));
    stage.addDynamic(() =>
      Show(
        () => overlayVisible(),
        () => at(new Text('OVERLAY — last child paints in front', { severity: 'warning' }), 6, 2, 36, 1),
      ),
    );

    content.add(at(new Text('Group retains children and composes them back-to-front.'), 0, 0, CONTENT_WIDTH, 1));
    content.add(at(stage, 7, 2, 44, 5));
    content.add(
      at(new Text(() => `Children: Base, Detail${overlayVisible() ? ', Overlay' : ''}`), 0, 8, CONTENT_WIDTH, 1),
    );
    content.add(
      at(
        new Text(() => `Dynamic child: ${overlayVisible() ? 'mounted and front-most' : 'unmounted'}`),
        0,
        9,
        CONTENT_WIDTH,
        1,
      ),
    );
    content.add(at(new Text('Alt+A adds/removes Overlay · later children paint in front'), 0, 11, CONTENT_WIDTH, 1));

    app.onCommand(CMD_OVERLAY, () => overlayVisible.update((visible) => !visible));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
