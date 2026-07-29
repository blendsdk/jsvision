/** Terminal laboratory for safe streaming, bounded history, wheel scrollback, and clearing. */
import { Group, Terminal, Text, at, createKeymap, signal, terminalWriter } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_WRITE = 'terminal-lab.write';
const CMD_CLEAR = 'terminal-lab.clear';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 12;

export default defineExample({
  title: 'Terminal Lab',
  blurb: 'Stream safe text through terminalWriter, retain bounded history, wheel backward, and snap to newest output.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+w': CMD_WRITE, 'alt+c': CMD_CLEAR }),
    });
    const terminal = new Terminal({ capacity: 300 });
    const write = terminalWriter(terminal);
    const lines = signal(8);
    for (let index = 1; index <= 7; index += 1) terminal.writeLine(`history line ${index}`);
    terminal.writeLine('newest output');
    const status = signal('pinned to newest');
    const dialog = new Template1Dialog({ title: ' Terminal Lab ', width: 60, height: 16 });
    const content = new Group();
    content.add(at(new Text('Passive, bounded output — never a command shell.'), 0, 0, 56, 1));
    content.add(at(terminal, 0, 2, 42, 7));
    content.add(at(new Text(() => `Lines: ${lines()} · ${status()}`), 0, 9, 56, 1));
    content.add(at(new Text('Wheel scrolls history · Alt+W writes · Alt+C clears'), 0, 10, 56, 1));
    content.add(at(new Text('New writes snap to bottom; control bytes draw safely.'), 0, 11, 56, 1));
    app.onCommand(CMD_WRITE, () => {
      write('\u001b[31m job complete\n');
      lines.set(lines() + 1);
      status.set('job complete · safe');
    });
    app.onCommand(CMD_CLEAR, () => {
      terminal.clear();
      lines.set(0);
      status.set('Terminal cleared');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
