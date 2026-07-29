/** ChDirDialog laboratory for tree navigation, revert, modal launch, and denied paths. */
import { ChDirDialog, DirList } from '@jsvision/files';
import { Button, Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { createDemoFileSystem, FILE_LAB_HOME } from '../../src/fixtures/file-lab.js';

const CMD_NEXT = 'chdir-dialog-lab.next';
const CMD_REVERT = 'chdir-dialog-lab.revert';
const CMD_ERROR = 'chdir-dialog-lab.error';
const CMD_OPEN = 'chdir-dialog-lab.open';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 12;

export default defineExample({
  title: 'Change Directory Dialog Lab',
  blurb: 'Reroot a virtual directory tree, revert it, inspect denied-path feedback, and open the real dialog.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_NEXT,
        'alt+r': CMD_REVERT,
        'alt+e': CMD_ERROR,
        'alt+o': CMD_OPEN,
      }),
    });
    const fixture = createDemoFileSystem();
    const directory = signal(FILE_LAB_HOME);
    const status = signal('ready · current directory is valid');
    const tree = new DirList({ fs: fixture.fs, directory, onChangeDir: (path) => directory.set(path) });
    const dialog = new Template1Dialog({ title: ' Change Directory Lab ', width: 60, height: 16 });
    const content = new Group();
    content.add(at(new Text('ChDirDialog binds a path field to this reactive tree.'), 0, 0, 56, 1));
    content.add(at(tree, 0, 2, 34, 7));
    content.add(at(new Text(() => `Current:\n${directory()}\n\n${status()}`), 36, 2, 20, 6));
    content.add(at(new Button('~O~pen dialog', { command: CMD_OPEN }), 36, 8, 18, 2));
    content.add(at(new Text('Alt+N enters src · Alt+R reverts · Alt+E denies'), 0, 11, 56, 1));
    app.onCommand(CMD_NEXT, () => {
      fixture.reset();
      directory.set(`${FILE_LAB_HOME}/src`);
      status.set('navigated · path mirrors tree');
    });
    app.onCommand(CMD_REVERT, () => {
      fixture.reset();
      directory.set(FILE_LAB_HOME);
      status.set('reverted · original directory');
    });
    app.onCommand(CMD_ERROR, () => {
      fixture.setFault('denied');
      try {
        fixture.fs.stat(directory());
      } catch (error) {
        status.set(error instanceof Error ? `access denied · ${error.message}` : 'access denied');
      }
    });
    app.onCommand(CMD_OPEN, () => {
      const modal = new ChDirDialog({ fs: createDemoFileSystem().fs, directory: signal(FILE_LAB_HOME) });
      app.desktop.addWindow(modal);
      void app.loop.execView(modal).finally(() => app.desktop.removeWindow(modal));
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(tree.rows);
    return app;
  },
});
