/**
 * A ProgressBar laboratory showing reactive updates, labels, captions, positions, and clamping.
 */
import { Group, ProgressBar, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_NEXT = 'progress-lab.next';
const CMD_MAX = 'progress-lab.max';
const CMD_RESET = 'progress-lab.reset';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 12;

export default defineExample({
  title: 'Progress Bar Lab',
  blurb: 'Drive determinate bars through a shared signal and inspect captions, labels, layout, and safe clamping.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+n': CMD_NEXT, 'alt+m': CMD_MAX, 'alt+r': CMD_RESET }),
    });
    const value = signal(0.25);
    const note = signal('ready');
    const dialog = new Template1Dialog({ title: ' Progress Bar Lab ', width: 60, height: 16 });
    const content = new Group();

    content.add(at(new Text('One signal drives several determinate presentations.'), 0, 0, 56, 1));
    content.add(at(new ProgressBar({ value, caption: true, label: 'Copying', labelPosition: 'left' }), 0, 2, 42, 1));
    content.add(at(new ProgressBar({ value, label: 'Right label', labelPosition: 'right' }), 0, 4, 42, 1));
    content.add(
      at(new ProgressBar({ value, caption: true, label: 'Top-left label', labelPosition: 'top-left' }), 0, 6, 42, 2),
    );
    content.add(at(new Text(() => `Value: ${Math.round(value() * 100)}% · ${note()}`), 0, 9, 56, 1));
    content.add(at(new Text('Alt+N advances · Alt+M overshoots · Alt+R resets'), 0, 10, 56, 1));
    content.add(at(new Text('Signals repaint; values clamp safely to 0…100%.'), 0, 11, 56, 1));

    app.onCommand(CMD_NEXT, () => {
      value.set(Math.min(1, value() + 0.25));
      note.set('advanced');
    });
    app.onCommand(CMD_MAX, () => {
      value.set(1.4);
      note.set('clamped from 140%');
    });
    app.onCommand(CMD_RESET, () => {
      value.set(0.25);
      note.set('reset');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
