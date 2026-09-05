/**
 * A GroupBox laboratory comparing caption alignment, nesting, reactive text, theme roles, shadow,
 * and ordinary descendant focus inside one passive workspace.
 */
import { Button, Group, GroupBox, Text, at, fixed, grow, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CONTENT_WIDTH = 64;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;

export default defineExample({
  title: 'GroupBox Lab',
  blurb: 'Compare passive framed groups, then update a reactive caption without moving focus to the frame.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const moduleCount = signal(2);
    const status = signal('2 modules · GroupBox stays out of the Tab order');
    const content = new Group();
    const workspace = new GroupBox({
      title: 'Grouping states',
      padding: { top: 1, right: 3, bottom: 2, left: 1 },
    });
    const application = new GroupBox({ title: 'Application', titleAlignment: 'start' });
    const modules = new GroupBox({ title: () => `Modules: ${moduleCount()}`, titleAlignment: 'center' });
    const deployment = new GroupBox({
      title: 'Deployment modules with a long caption',
      titleAlignment: 'end',
      role: 'labelSelected',
      shadow: true,
    });

    workspace.setLayout({ direction: 'row', gap: 2 });
    workspace.add(fixed(application, 14));
    workspace.add(fixed(modules, 16));
    workspace.add(grow(deployment));
    application.add(at(new Text('Start aligned\nOpaque fill'), 0, 0, 12, 2));
    modules.add(at(new Text('Nested content\nLive getter'), 0, 0, 14, 2));
    deployment.add(at(new Text('End-aligned clipping\nRole + standard shadow'), 0, 0, 24, 2));

    content.add(at(new Text('Start, center, and end captions share one passive workspace.'), 0, 0, CONTENT_WIDTH, 1));
    content.add(at(workspace, 0, 2, CONTENT_WIDTH, 7));
    content.add(
      at(
        new Button('~A~dd module', {
          onClick: () => {
            const next = moduleCount() + 1;
            moduleCount.set(next);
            status.set(`Added module ${next}`);
          },
        }),
        0,
        10,
        17,
        2,
      ),
    );
    content.add(at(new Text(() => `Status: ${status()}`), 0, 12, CONTENT_WIDTH, 1));
    content.add(
      at(new Text('Click Add module · Tab focuses it · Alt+A/Space updates caption'), 0, 13, CONTENT_WIDTH, 1),
    );

    const dialog = new Template1Dialog({
      title: ' GroupBox Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: (view) => view !== workspace,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
