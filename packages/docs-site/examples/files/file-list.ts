/** FileList laboratory for reactive scans, wildcard filters, hidden files, and read errors. */
import { FileList } from '@jsvision/files';
import { Dialog, Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { createDemoFileSystem, FILE_LAB_HOME } from '../../src/fixtures/file-lab.js';

const CMD_HIDDEN = 'file-list-lab.hidden';
const CMD_TYPESCRIPT = 'file-list-lab.typescript';
const CMD_ERROR = 'file-list-lab.error';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 10;

export default defineExample({
  title: 'File List Lab',
  blurb: 'Rescan a two-column virtual directory as hidden-file, wildcard, and failure inputs change.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+h': CMD_HIDDEN, 'alt+t': CMD_TYPESCRIPT, 'alt+e': CMD_ERROR }),
    });
    const fixture = createDemoFileSystem();
    const directory = signal(FILE_LAB_HOME);
    const wildcard = signal('*');
    const showHidden = signal(false);
    const status = signal('ready · hidden files omitted');
    const list = new FileList({ fs: fixture.fs, directory, wildcard, showHidden });
    const dialog = new Dialog({ title: ' File List Lab ', width: 60, height: 14 });
    dialog.closable = false;
    const content = new Group();
    content.add(at(new Text('Files first, directories after them, parent entry last.'), 0, 0, 56, 1));
    content.add(at(list, 0, 2, 38, 6));
    content.add(
      at(new Text(() => `Path: ${directory()}\nFilter: ${wildcard()}\nHidden: ${showHidden()}`), 40, 2, 16, 4),
    );
    content.add(at(new Text(() => `Status: ${status()}`), 0, 8, 56, 1));
    content.add(at(new Text('Alt+H hidden · Alt+T TypeScript · Alt+E error'), 0, 9, 56, 1));
    app.onCommand(CMD_HIDDEN, () => {
      fixture.reset();
      showHidden.set(!showHidden());
      status.set(showHidden() ? 'hidden files included' : 'hidden files omitted');
    });
    app.onCommand(CMD_TYPESCRIPT, () => {
      fixture.reset();
      directory.set(`${FILE_LAB_HOME}/src`);
      wildcard.set('*.ts');
      status.set('reactive TypeScript scan');
    });
    app.onCommand(CMD_ERROR, () => {
      fixture.setFault('io-error');
      directory.set(`${FILE_LAB_HOME}/missing`);
      status.set('I/O error · empty list');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(list.rows);
    return app;
  },
});
