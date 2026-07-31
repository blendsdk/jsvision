/**
 * A SplitView laboratory showing proportional panes, minimum constraints, focusable keyboard
 * resizing, commit callbacks, and a live grab-mark signal.
 */
import { Group, SplitView, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_GRAB = 'split-view-lab.grab';
const CONTENT_WIDTH = 52;
const CONTENT_HEIGHT = 11;

export default defineExample({
  title: 'Split View Lab',
  blurb: 'Resize constrained panes from the keyboard and toggle the live divider grab mark.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+g': CMD_GRAB }),
    });
    const sizes = signal([1, 2]);
    const commits = signal(0);
    const left = new Group();
    const right = new Group();
    left.background = 'dialog';
    right.background = 'dialog';
    left.add(at(new Text(() => `EXPLORER\n${left.bounds.width} cells`), 1, 1, 15, 2));
    right.add(at(new Text(() => `EDITOR\n${right.bounds.width} cells`), 1, 1, 18, 2));
    const split = new SplitView({
      direction: 'row',
      children: [left, right],
      sizes,
      minSize: [10, 14],
      onResizeEnd: () => commits.set(commits() + 1),
    });
    const dialog = new Template1Dialog({
      title: ' Split View Lab ',
      width: 56,
      height: 15,
      preserveChildHeights: (view) => view !== split,
    });
    const content = new Group();

    content.add(at(new Text('One divider trades cells between two panes.'), 0, 0, 52, 1));
    content.add(at(split, 0, 2, 40, 6));
    content.add(at(new Text(() => `Weights/cells:\n${sizes().join(' : ')}`), 42, 2, 10, 3));
    content.add(at(new Text(() => `Resize commits: ${commits()}`), 0, 8, 52, 1));
    content.add(at(new Text('←/→ resize · drag commits once on release'), 0, 9, 52, 1));
    content.add(at(new Text('Alt+G toggles the public grabMark signal'), 0, 10, 52, 1));

    app.onCommand(CMD_GRAB, () => split.grabMark.set(!split.grabMark()));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(split.splitters[0]);
    return app;
  },
});
