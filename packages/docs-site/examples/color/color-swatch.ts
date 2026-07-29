/**
 * A ColorSwatch laboratory showing live input, discrete commit, wrap navigation, and mouse gestures.
 */
import { ColorSwatch, Dialog, Group, Text, at, signal } from '@jsvision/ui';
import type { Color } from '@jsvision/core';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const COLORS: readonly Color[] = ['red', 'green', 'blue', 'yellow'];
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 9;

export default defineExample({
  title: 'Color Swatch Lab',
  blurb: 'Compare live palette movement with an explicit committed color using keyboard and mouse.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const value = signal<Color>('red');
    const inputCount = signal(0);
    const commitCount = signal(0);
    const swatch = new ColorSwatch({
      value,
      colors: COLORS,
      columns: 4,
      onInput: () => inputCount.set(inputCount() + 1),
      onChange: () => commitCount.set(commitCount() + 1),
    });
    const dialog = new Dialog({ title: ' Color Swatch Lab ', width: 60, height: 13 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Four-cell palette with separate preview and commit.'), 0, 0, 56, 1));
    content.add(at(swatch, 0, 2, 12, 1));
    content.add(
      at(new Text(() => `Color: ${value()}\nInput: ${inputCount()}\nCommits: ${commitCount()}`), 17, 2, 25, 3),
    );
    content.add(at(new Text('Arrows preview live · Enter commits · movement wraps'), 0, 6, 56, 1));
    content.add(at(new Text('Mouse drag previews; release over a cell commits.'), 0, 8, 56, 1));

    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(swatch);
    return app;
  },
});
