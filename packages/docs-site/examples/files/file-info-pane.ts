/** FileInfoPane laboratory for reactive paths, metadata, and broken-link presentation. */
import { FileInfoPane } from '@jsvision/files';
import type { DirEntry } from '@jsvision/files';
import { Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { createDemoFileSystem, FILE_LAB_HOME } from '../../src/fixtures/file-lab.js';

const CMD_NEXT = 'file-info-lab.next';
const CMD_BROKEN = 'file-info-lab.broken';
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 8;
const MTIME = new Date('2026-07-15T10:30:00.000Z');
const README: DirEntry = { name: 'README.md', kind: 'file', size: 18, mtime: MTIME, hidden: false };
const MAIN: DirEntry = { name: 'main.ts', kind: 'file', size: 26, mtime: MTIME, hidden: false };
const BROKEN: DirEntry = {
  name: 'missing-link',
  kind: 'symlink',
  size: 0,
  mtime: MTIME,
  hidden: false,
  broken: true,
};

export default defineExample({
  title: 'File Info Pane Lab',
  blurb: 'Project the current search path plus deterministic entry metadata, including a broken symlink.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+n': CMD_NEXT, 'alt+b': CMD_BROKEN }),
    });
    const fixture = createDemoFileSystem();
    const entry = signal<DirEntry | undefined>(README);
    const pane = new FileInfoPane({
      fs: fixture.fs,
      directory: () => FILE_LAB_HOME,
      wildcard: () => '*.ts',
      focusedEntry: entry,
    });
    const dialog = new Template1Dialog({
      title: ' File Info Pane Lab ',
      width: 64,
      height: 12,
      preserveChildHeights: true,
    });
    const content = new Group();
    content.add(at(new Text('Two passive rows: expanded path, then focused metadata.'), 0, 0, 60, 1));
    content.add(at(pane, 0, 3, 60, 2));
    content.add(at(new Text('Broken links intentionally show their name without metadata.'), 0, 6, 60, 1));
    content.add(at(new Text('Alt+N changes entry · Alt+B shows a broken link'), 0, 7, 60, 1));
    app.onCommand(CMD_NEXT, () => entry.set(MAIN));
    app.onCommand(CMD_BROKEN, () => entry.set(BROKEN));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
