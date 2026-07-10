/**
 * A modal file-open dialog browsing an in-memory virtual file tree — no backend,
 * no real disk. It seeds a small project tree (with a subdirectory) into
 * @jsvision/web's pure browser file system, then opens a FileDialog over it in the
 * full demo shell. Move with the arrows, Enter a directory to descend, pick a file
 * or Cancel. Because a bare-placed dialog would not be modal, the example returns a
 * whole application and opens the dialog on start.
 */
import { openFile } from '@jsvision/files';
import { createBrowserFileSystem, type FileTree } from '@jsvision/web';
import { Button, Text, Window, View } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
// #region example

/** Absolutely place a view within its parent's interior. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };
  return view;
}

/** The home directory the dialog opens at. */
export const HOME = '/home/demo';

/**
 * The seeded project tree. `notes.txt` deliberately carries a raw `ESC` escape in
 * its content: the docs-site paint path strips it (sanitize is the injection
 * boundary), so no control byte ever reaches the terminal.
 */
export const FILE_TREE: FileTree = {
  [HOME]: {
    'README.md': '# Demo project\n\nA sample tree for the file-dialog example.\n',
    'notes.txt': 'Session log: connected\x1b[2J then reset — control bytes are stripped when drawn.\n',
    src: {
      'index.ts': 'export const hello = (): string => "hi";\n',
      'util.ts': 'export const add = (a: number, b: number): number => a + b;\n',
    },
  },
};

/** A fresh in-memory browser file system seeded with {@link FILE_TREE}, opening at {@link HOME}. */
export function seedFs(): ReturnType<typeof createBrowserFileSystem> {
  return createBrowserFileSystem({ tree: FILE_TREE, home: HOME });
}

export default defineExample({
  title: 'File dialog',
  blurb: 'Browse a virtual file tree in a modal dialog — no backend, entirely in-memory.',
  build: (ctx) => {
    const app = demoApp(ctx);

    // `openFile` handles the full modal lifecycle (add → execView → remove-on-close); a fresh
    // `seedFs()` each time keeps the tree pristine. So reopening is just calling it again.
    const openTheDialog = (): void => {
      void openFile(app, { fs: seedFs(), directory: HOME, title: 'Open a file' });
    };
    app.onCommand('demo.openDialog', () => openTheDialog());

    // A non-closable stage window with the reopen affordance, centered on the desktop.
    const stage = new Window('File dialog');
    stage.closable = false;
    const sw = 46;
    const sh = 7;
    const { width: dw, height: dh } = app.desktop.bounds;
    stage.layout.rect = {
      x: Math.max(0, Math.floor((dw - sw) / 2)),
      y: Math.max(0, Math.floor((dh - sh) / 2)),
      width: sw,
      height: sh,
    };
    stage.add(at(new Button('~O~pen the dialog', { command: 'demo.openDialog', default: true }), 12, 0, 20, 2));
    stage.add(at(new Text('Pick a file or Cancel, then reopen the dialog here.'), 0, 3, sw - 2, 2));
    app.desktop.addWindow(stage);

    openTheDialog(); // start with it open once
    return app;
  },
});
// #endregion example
