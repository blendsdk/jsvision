/** FileEditor laboratory for loading, exact saves, backups, write failures, and modified state. */
import { FileEditor } from '@jsvision/files';
import { Group, Text, at, createKeymap, signal } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { createDemoFileSystem, FILE_LAB_HOME } from '../../src/fixtures/file-lab.js';

const CMD_SAVE = 'file-editor-lab.save';
const CMD_ERROR = 'file-editor-lab.error';
const CMD_RESET = 'file-editor-lab.reset';
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 12;
const FILE_NAME = `${FILE_LAB_HOME}/notes.txt`;

export default defineExample({
  title: 'File Editor Lab',
  blurb: 'Load and edit a virtual file, save it with a backup, and inspect a deterministic write failure.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+s': CMD_SAVE, 'alt+e': CMD_ERROR, 'alt+r': CMD_RESET }),
    });
    const fixture = createDemoFileSystem();
    const status = signal('ready · loaded notes.txt');
    const editor = new FileEditor({
      fs: fixture.fs,
      fileName: FILE_NAME,
      editorDialog: async () => ({ kind: 'ok' }),
    });
    editor.loadFile();
    const dialog = new Template1Dialog({
      title: ' File Editor Lab ',
      width: 64,
      height: 16,
      preserveChildHeights: (view) => view !== editor,
    });
    const content = new Group();
    content.add(at(new Text('FileEditor adds load/save/backup policy to Editor.'), 0, 0, 60, 1));
    content.add(at(editor, 0, 2, 44, 7));
    content.add(at(new Text(() => `File:\n${editor.fileName()}\n\nModified:\n${editor.modified()}`), 46, 2, 14, 6));
    content.add(at(new Text(() => `Status: ${status()}`), 0, 10, 60, 1));
    content.add(at(new Text('Edit normally · Alt+S saves · Alt+E fails safely'), 0, 11, 60, 1));
    app.onCommand(CMD_SAVE, () => {
      fixture.reset();
      const saved = editor.saveFile();
      const persisted = saved ? fixture.fs.readFile(FILE_NAME) : '';
      status.set(saved ? `saved · ${persisted.length} chars · backup ready` : 'save failed');
    });
    app.onCommand(CMD_ERROR, () => {
      fixture.setFault('io-error');
      status.set(editor.saveFile() ? 'unexpected save' : 'write failed · buffer remains');
    });
    app.onCommand(CMD_RESET, () => {
      fixture.reset();
      editor.loadFile();
      status.set('ready · fixture reset');
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(editor);
    return app;
  },
});
