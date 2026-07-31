/** Responsive custom-widget composition, clipping, fallback, headless, and cleanup laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { WidgetCompositionPanel } from '../../src/example-fixtures/writing-your-own-widget/widget-composition-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_REPAINT = 'guide.widget-composition.repaint';
const CMD_REFLOW = 'guide.widget-composition.reflow';
const CMD_CLIP = 'guide.widget-composition.clip';
const CMD_ASCII = 'guide.widget-composition.ascii';
const CMD_HEADLESS = 'guide.widget-composition.headless';

export default defineExample({
  title: 'Widget Composition Laboratory',
  blurb: 'Compare repaint and reflow, prove clipping and capability fallback, then verify cleanup headlessly.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+p': CMD_REPAINT,
        'alt+r': CMD_REFLOW,
        'alt+c': CMD_CLIP,
        'alt+a': CMD_ASCII,
        'alt+h': CMD_HEADLESS,
      }),
    });
    const panel = new WidgetCompositionPanel();
    app.onCommand(CMD_REPAINT, () => panel.checkRepaint('keyboard'));
    app.onCommand(CMD_REFLOW, () => panel.checkReflow('keyboard'));
    app.onCommand(CMD_CLIP, () => panel.checkClipping('keyboard'));
    app.onCommand(CMD_ASCII, () => panel.checkCapabilities('keyboard'));
    app.onCommand(CMD_HEADLESS, () => panel.checkHeadless('keyboard'));

    const repaint = new Button('Local repaint', { onClick: () => panel.checkRepaint('mouse') });
    const reflow = new Button('Full reflow', { onClick: () => panel.checkReflow('mouse') });
    const clip = new Button('Clip probe', { onClick: () => panel.checkClipping('mouse') });
    const ascii = new Button('ASCII proof', { onClick: () => panel.checkCapabilities('mouse') });
    const headless = new Button('Headless check', { onClick: () => panel.checkHeadless('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 56, 6));
    content.add(at(repaint, 0, 6, 17, 2));
    content.add(at(reflow, 18, 6, 15, 2));
    content.add(at(clip, 34, 6, 14, 2));
    content.add(at(ascii, 0, 8, 15, 2));
    content.add(at(headless, 16, 8, 18, 2));
    content.add(at(new Text('Alt+P repaint · Alt+R reflow · Alt+C clip · Alt+A ASCII'), 0, 10, 56, 1));
    content.add(at(new Text('Alt+H headless · Tab/mouse actions · non-colour text status'), 0, 11, 56, 1));

    const dialog = new Template1Dialog({
      title: ' Widget Composition & Evidence ',
      width: 60,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 56, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(repaint);
    return app;
  },
});
