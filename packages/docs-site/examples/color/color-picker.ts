/**
 * A ColorPicker laboratory showing popup palette selection, custom hex, preview, and commit.
 */
import { ColorPicker, Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import type { Color } from '@jsvision/core';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_HEX = 'color-picker-lab.hex';
const COLORS: readonly Color[] = ['red', 'green', 'blue', 'cyan'];
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 9;

export default defineExample({
  title: 'Color Picker Lab',
  blurb: 'Open a palette, preview live movement, commit deliberately, and load a custom truecolor value.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+h': CMD_HEX }),
    });
    const value = signal<Color>('red');
    const inputCount = signal(0);
    const commitCount = signal(0);
    const picker = new ColorPicker({
      value,
      colors: COLORS,
      columns: 4,
      allowCustom: true,
      nameFor: (color) => `selected ${color}`,
      onInput: () => inputCount.set(inputCount() + 1),
      onChange: () => commitCount.set(commitCount() + 1),
    });
    const dialog = new Template1Dialog({ title: ' Color Picker Lab ', width: 60, height: 13 });
    const content = new Group();

    content.add(at(new Text('Popup palette plus a validated custom-color field.'), 0, 0, 56, 1));
    content.add(at(picker, 0, 2, 28, 1));
    content.add(
      at(new Text(() => `Color: ${value()}\nInput: ${inputCount()}\nCommits: ${commitCount()}`), 32, 2, 24, 3),
    );
    content.add(at(new Text('Alt+Down opens swatch + #rrggbb custom field.'), 0, 6, 56, 1));
    content.add(at(new Text('Arrows preview · Enter commits · Alt+H loads hex'), 0, 8, 56, 1));

    app.onCommand(CMD_HEX, () => value.set('#663399'));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(picker);
    return app;
  },
});
