/** FileInput laboratory for file/directory mirroring and focused edit preservation. */
import { FileInput } from '@jsvision/files';
import type { DirEntry } from '@jsvision/files';
import { Button, Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_DIRECTORY = 'file-input-lab.directory';
const CMD_FILE = 'file-input-lab.file';
const CMD_FOCUS = 'file-input-lab.focus';
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 8;
const MTIME = new Date('2026-07-15T10:30:00.000Z');
const README: DirEntry = { name: 'README.md', kind: 'file', size: 18, mtime: MTIME, hidden: false };
const SOURCE: DirEntry = { name: 'src', kind: 'dir', size: 0, mtime: MTIME, hidden: false };

export default defineExample({
  title: 'File Input Lab',
  blurb: 'Mirror focused file and directory entries until the user focuses the field and begins editing.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+d': CMD_DIRECTORY, 'alt+f': CMD_FILE, 'alt+i': CMD_FOCUS }),
    });
    const value = signal('README.md');
    const focusedEntry = signal<DirEntry | undefined>(README);
    const input = new FileInput({ value, focusedEntry, wildcard: () => '*.ts', sep: '/' });
    const reset = new Button('~F~ile entry', { command: CMD_FILE });
    const dialog = new Template1Dialog({
      title: ' File Input Lab ',
      width: 60,
      height: 12,
      preserveChildHeights: true,
    });
    const content = new Group();
    content.add(at(new Text('Focused entries mirror until this field owns focus.'), 0, 0, 56, 1));
    content.add(at(input, 0, 2, 38, 1));
    content.add(at(reset, 40, 5, 14, 2));
    content.add(at(new Text(() => `Bound value:\n${value()}`), 40, 2, 16, 3));
    content.add(at(new Text('File → README.md · directory → src/*.ts'), 0, 5, 56, 1));
    content.add(at(new Text('Alt+D mirrors a directory · typing pauses mirroring'), 0, 7, 56, 1));
    app.onCommand(CMD_DIRECTORY, () => focusedEntry.set(SOURCE));
    app.onCommand(CMD_FILE, () => focusedEntry.set(README));
    app.onCommand(CMD_FOCUS, () => app.loop.focusView(input));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(reset);
    return app;
  },
});
