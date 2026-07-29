/**
 * Interactive flow-layout workshop for the Layout guide.
 *
 * The visible application frame is authored with the shared template shell; the teaching stage
 * itself uses real nested rows and columns so every action and window resize exercises the public
 * layout engine.
 */
import { Button, Group, Text, at, col, fixed, grow, row, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { LayoutLessonPanel } from '../../src/example-fixtures/layout/lesson-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;

export default defineExample({
  title: 'Layout Flow Workshop',
  blurb: 'Change fixed cells, flex weights, and padding while a nested row-and-column workspace reflows.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const balanced = signal(false);
    const wideSidebar = signal(false);
    const padding = signal(1);

    const header = new LayoutLessonPanel('Header', 'fixed: 1 row', 'menuBar');
    const navigation = new LayoutLessonPanel('Navigation', 'fixed: 12 columns', 'desktop');
    const workspace = new LayoutLessonPanel('Workspace', 'grow: 2', 'window');
    const inspector = new LayoutLessonPanel('Inspector', 'grow: 1', 'dialog');
    const footer = new LayoutLessonPanel('Status', 'fixed: 1 row', 'statusBar');

    const body = row({ gap: 1 }, fixed(navigation, 12), grow(workspace, 2), grow(inspector, 1));
    const stage = col({ gap: 1, padding: 1, background: 'dialog' }, fixed(header, 1), grow(body), fixed(footer, 1));

    const statusText = (): string => {
      const weights = balanced() ? '1:1' : '2:1';
      const sidebar = wideSidebar() ? 18 : 12;
      return `Weights: ${weights} · Sidebar: ${sidebar} cells · Padding: ${padding()}`;
    };

    const balance = new Button('~B~alance', {
      onClick: () => {
        balanced.update((value) => !value);
        grow(workspace, balanced() ? 1 : 2);
        grow(inspector, 1);
      },
    });
    const sidebar = new Button('Widen ~s~idebar', {
      onClick: () => {
        wideSidebar.update((value) => !value);
        fixed(navigation, wideSidebar() ? 18 : 12);
      },
    });
    const cyclePadding = new Button('Cycle ~p~adding', {
      onClick: () => {
        padding.update((value) => (value + 1) % 3);
        stage.setLayout({ padding: padding() });
      },
    });

    const content = new Group();
    content.add(at(new Text('Nested flow: fixed header/status · fixed sidebar · weighted work areas'), 0, 0, 66, 1));
    content.add(at(stage, 0, 2, 66, 8));
    content.add(at(balance, 0, 10, 14, 2));
    content.add(at(sidebar, 16, 10, 20, 2));
    content.add(at(cyclePadding, 38, 10, 20, 2));
    content.add(at(new Text(statusText), 0, 12, 66, 1));
    content.add(at(new Text('Alt+B/S/P changes layout · maximize or resize to watch every pane reflow'), 0, 13, 66, 1));

    const dialog = new Template1Dialog({
      title: ' Layout Flow Workshop ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
