/** FileDialog laboratory for virtual browsing, filtering, modal launch, and denied reads. */
import { FileDialog, FileInfoPane, FileInput, FileList } from '@jsvision/files';
import { Button, Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { createDemoFileSystem, FILE_LAB_HOME } from '../../src/fixtures/file-lab.js';

const CMD_FILTER = 'file-dialog-lab.filter';
const CMD_ERROR = 'file-dialog-lab.error';
const CMD_OPEN = 'file-dialog-lab.open';
const CONTENT_WIDTH = 64;
const CONTENT_HEIGHT = 14;

/** Compatibility exports retained for the security and legacy virtual-tree specifications. */
export const HOME = FILE_LAB_HOME;
/** Create a fresh virtual filesystem for tests and consumers of the historical example fixture. */
export const seedFs = (): ReturnType<typeof createDemoFileSystem>['fs'] => createDemoFileSystem().fs;

export default defineExample({
  title: 'File Dialog Lab',
  blurb: 'Inspect the composed picker, navigate a virtual project, and launch the real modal FileDialog.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+f': CMD_FILTER, 'alt+e': CMD_ERROR, 'alt+o': CMD_OPEN }),
    });
    const fixture = createDemoFileSystem();
    const directory = signal(FILE_LAB_HOME);
    const wildcard = signal('*');
    const filename = signal('');
    const status = signal('ready · virtual filesystem only');
    const list = new FileList({ fs: fixture.fs, directory, wildcard });
    const input = new FileInput({
      value: filename,
      focusedEntry: list.focusedEntry,
      wildcard,
      sep: fixture.fs.sep,
    });
    const info = new FileInfoPane({ fs: fixture.fs, directory, wildcard, focusedEntry: list.focusedEntry });
    const dialog = new Template1Dialog({ title: ' File Dialog Lab ', width: 68, height: 18 });
    const content = new Group();
    content.add(at(new Text('FileDialog composes these same public picker widgets.'), 0, 0, 64, 1));
    content.add(at(input, 0, 2, 42, 1));
    content.add(at(new Button('~O~pen dialog', { command: CMD_OPEN }), 46, 2, 16, 2));
    content.add(at(list, 0, 4, 42, 6));
    content.add(at(new Text(() => `Directory:\n${directory()}\nFilter: ${wildcard()}`), 45, 5, 19, 4));
    content.add(at(info, 0, 10, 64, 2));
    content.add(at(new Text(() => `Status: ${status()}`), 0, 12, 64, 1));
    content.add(at(new Text('Alt+F enters src · Alt+E shows a denied read'), 0, 13, 64, 1));
    app.onCommand(CMD_FILTER, () => {
      fixture.reset();
      wildcard.set('*.ts');
      directory.set(`${FILE_LAB_HOME}/src`);
      status.set('src · TypeScript filter');
    });
    app.onCommand(CMD_ERROR, () => {
      fixture.setFault('denied');
      try {
        fixture.fs.readDir(directory());
      } catch (error) {
        status.set(error instanceof Error ? `access denied · ${error.message}` : 'access denied');
      }
    });
    app.onCommand(CMD_OPEN, () => {
      const modal = new FileDialog({
        fs: createDemoFileSystem().fs,
        directory: signal(FILE_LAB_HOME),
        showError: (message) => status.set(message),
      });
      app.desktop.addWindow(modal);
      void app.loop.execView(modal).finally(() => app.desktop.removeWindow(modal));
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(list.rows);
    return app;
  },
});
