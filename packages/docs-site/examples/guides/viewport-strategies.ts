/**
 * Comparative viewport laboratory for the Scrolling, lists & large content course.
 */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ViewportStrategyPanel } from '../../src/example-fixtures/scrolling-lists-and-large-content/viewport-strategy-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_PAN = 'scrolling.viewport.pan-surface';
const CMD_RESET = 'scrolling.viewport.reset-surface';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;

export default defineExample({
  title: 'Viewport Strategies Laboratory',
  blurb: 'Compare Scroller ownership with passive SurfaceView offsets, clamping, and external controls.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+p': CMD_PAN,
        'alt+r': CMD_RESET,
      }),
    });
    const panel = new ViewportStrategyPanel();
    app.onCommand(CMD_PAN, () => panel.panSurface('keyboard'));
    app.onCommand(CMD_RESET, () => panel.resetSurface('keyboard'));

    const pan = new Button('Pan surface', {
      onClick: () => panel.panSurface('mouse'),
    });
    const reset = new Button('Reset surface', {
      onClick: () => panel.resetSurface('mouse'),
    });
    const content = new Group();
    content.add(at(new Text('Same visible-window problem; different offset and focus owners.'), 0, 0, 66, 1));
    content.add(at(panel, 0, 2, 66, 8));
    content.add(at(pan, 0, 10, 18, 2));
    content.add(at(reset, 20, 10, 20, 2));
    content.add(at(new Text('Focus Scroller: arrows/Page/Home/End · Alt+P pan · Alt+R reset'), 0, 13, 66, 1));

    const dialog = new Template1Dialog({
      title: ' Viewport Strategies Laboratory ',
      width: CONTENT_WIDTH + 4,
      height: CONTENT_HEIGHT + 4,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(panel.scroller);
    return app;
  },
});
