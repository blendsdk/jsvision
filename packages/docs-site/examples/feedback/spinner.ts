/**
 * A Spinner laboratory showing all presets under a deterministic caller-owned frame signal.
 */
import { Group, Spinner, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_NEXT = 'spinner-lab.next';
const CMD_RESET = 'spinner-lab.reset';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'Spinner Lab',
  blurb: 'Compare rotating and ping-pong presets while retaining explicit ownership of animation time.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+n': CMD_NEXT, 'alt+r': CMD_RESET }),
    });
    const frame = signal(0);
    const dialog = new Template1Dialog({ title: ' Spinner Lab ', width: 60, height: 14 });
    const content = new Group();

    content.add(at(new Text('One frame signal drives dots, line, and blocks.'), 0, 0, 56, 1));
    content.add(at(new Spinner({ frame, preset: 'dots', label: 'dots — Unicode rotation' }), 0, 2, 35, 1));
    content.add(at(new Spinner({ frame, preset: 'line', label: 'line — universal ASCII' }), 0, 4, 35, 1));
    content.add(at(new Spinner({ frame, preset: 'blocks', label: 'blocks — grows then shrinks' }), 0, 6, 35, 1));
    content.add(at(new Text(() => `Frame: ${frame()}`), 40, 3, 16, 2));
    content.add(at(new Text('Alt+N steps · Alt+R resets · timers stay app-owned'), 0, 8, 56, 1));
    content.add(at(new Text('Manual steps keep this example deterministic.'), 0, 9, 56, 1));

    app.onCommand(CMD_NEXT, () => frame.set(frame() + 1));
    app.onCommand(CMD_RESET, () => frame.set(0));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
