/**
 * Beginner laboratory that traces one rendered result across application, host, and frame layers.
 *
 * The module is a real template1 application. Its teaching panels expose the conceptual boundary
 * without replacing the actual app shell, event loop, rendering, or keyboard dispatch with a mock.
 */
import { Button, Group, Text, at, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { RuntimeStagePanel } from '../../src/example-fixtures/introduction/runtime-stage-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;

/** Ordered teaching stages and the bounded explanation shown when each one is current. */
const STAGES = [
  {
    name: 'Application',
    detail: 'views + commands',
    explanation: 'Your code owns the view tree, state, focus, and the quit decision.',
  },
  {
    name: 'Host runtime',
    detail: 'input + resize',
    explanation: 'The host forwards input and resize events, then delivers rendered frames.',
  },
  {
    name: 'Terminal frame',
    detail: 'visible cells',
    explanation: 'The frame is visible output; application state remains the source of truth.',
  },
] as const;

export default defineExample({
  title: 'Introduction Runtime Lab',
  blurb: 'Advance through application, host runtime, and terminal-frame stages to see what each layer owns.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const currentStage = signal(0);
    const panels = STAGES.map(
      (stage, index) => new RuntimeStagePanel(stage.name, stage.detail, () => currentStage() === index),
    );

    const next = new Button('~N~ext stage', {
      onClick: () => currentStage.update((index) => (index + 1) % STAGES.length),
    });
    const reset = new Button('~R~eset', {
      onClick: () => currentStage.set(0),
    });

    const content = new Group();
    content.add(
      at(new Text('Trace one result: application decisions become host-delivered terminal cells.'), 0, 0, 66, 1),
    );
    content.add(at(panels[0], 0, 2, 20, 4));
    content.add(at(new Text('-->'), 20, 3, 3, 1));
    content.add(at(panels[1], 23, 2, 20, 4));
    content.add(at(new Text('-->'), 43, 3, 3, 1));
    content.add(at(panels[2], 46, 2, 20, 4));
    content.add(at(new Text(() => `Stage ${currentStage() + 1} of 3`), 0, 7, 66, 1));
    content.add(at(new Text(() => STAGES[currentStage()]?.explanation ?? STAGES[0].explanation), 0, 8, 66, 1));
    content.add(at(next, 0, 10, 16, 2));
    content.add(at(reset, 18, 10, 12, 2));
    content.add(at(new Text('Alt+N next · Alt+R reset · F2 maximize/restore'), 0, 13, 66, 1));

    const dialog = new Template1Dialog({
      title: ' Introduction Runtime Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: true,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
