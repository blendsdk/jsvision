/** DirList laboratory for derived trees, reactive rerooting, activation, and empty error state. */
import { DirList } from '@jsvision/files';
import { Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { createDemoFileSystem, FILE_LAB_HOME } from '../../src/fixtures/file-lab.js';

const CMD_NEXT = 'dir-list-lab.next';
const CMD_RESET = 'dir-list-lab.reset';
const CMD_ERROR = 'dir-list-lab.error';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'Directory List Lab',
  blurb: 'Derive an ancestor-and-children tree, reroot it reactively, and inspect unreadable state.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+n': CMD_NEXT, 'alt+r': CMD_RESET, 'alt+e': CMD_ERROR }),
    });
    const fixture = createDemoFileSystem();
    const directory = signal(FILE_LAB_HOME);
    const status = signal('ready · activate any tree node');
    const tree = new DirList({ fs: fixture.fs, directory, onChangeDir: (path) => directory.set(path) });
    const dialog = new Template1Dialog({
      title: ' Directory List Lab ',
      width: 60,
      height: 14,
      preserveChildHeights: (view) => view !== tree,
    });
    const content = new Group();
    content.add(at(new Text('Ancestor chain plus immediate child directories.'), 0, 0, 56, 1));
    content.add(at(tree, 0, 2, 34, 6));
    content.add(at(new Text(() => `Root:\n${directory()}\n\n${status()}`), 36, 2, 20, 5));
    content.add(at(new Text('Alt+N reroots to src · Alt+R resets · Alt+E error'), 0, 9, 56, 1));
    app.onCommand(CMD_NEXT, () => {
      fixture.reset();
      directory.set(`${FILE_LAB_HOME}/src`);
      status.set('tree rerooted');
    });
    app.onCommand(CMD_RESET, () => {
      fixture.reset();
      directory.set(FILE_LAB_HOME);
      status.set('fixture reset');
    });
    app.onCommand(CMD_ERROR, () => {
      fixture.setFault('io-error');
      directory.set(`${FILE_LAB_HOME}/missing`);
      status.set('I/O error · empty tree');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(tree.rows);
    return app;
  },
});
