/**
 * A ScrollBar laboratory comparing two orientations over one bound signal and showing live range
 * collapse into the disabled track state.
 */
import { Dialog, Group, ScrollBar, Text, at, createKeymap, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_NEXT = 'scroll-bar-lab.next';
const CMD_DISABLE = 'scroll-bar-lab.disable';
const CONTENT_WIDTH = 44;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'Scroll Bar Lab',
  blurb: 'Compare vertical and horizontal bars sharing one signal, then collapse their range.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_NEXT,
        'alt+d': CMD_DISABLE,
      }),
    });
    const value = signal(0);
    const disabled = signal(false);
    const vertical = new ScrollBar({ value, min: 0, max: 100, pageStep: 20, orientation: 'vertical' });
    const horizontal = new ScrollBar({ value, min: 0, max: 100, pageStep: 20, orientation: 'horizontal' });
    const dialog = new Dialog({ title: ' Scroll Bar Lab ', width: 48, height: 14 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Two bar orientations share one value signal.'), 0, 0, 44, 1));
    content.add(at(vertical, 2, 2, 1, 6));
    content.add(at(horizontal, 7, 4, 28, 1));
    content.add(at(new Text(() => `Bound value: ${value()}`), 7, 2, 25, 1));
    content.add(at(new Text(() => `Disabled track: ${disabled() ? 'yes' : 'no'}`), 7, 6, 28, 1));
    content.add(at(new Text('Click arrows/page/thumb · Alt+N sets 40'), 0, 8, 44, 1));
    content.add(at(new Text('Alt+D collapses both ranges in place'), 0, 9, 44, 1));

    app.onCommand(CMD_NEXT, () => value.set(40));
    app.onCommand(CMD_DISABLE, () => {
      vertical.setRange(0, 0);
      horizontal.setRange(0, 0);
      disabled.set(true);
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
