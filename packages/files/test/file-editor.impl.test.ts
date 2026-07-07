/**
 * Implementation tests — RD-08 Phase-9 `FileEditor` edges (after green).
 *
 * Backup-of-backup cycles, saveAs-to-existing-path, write failure mid-sequence, EOL round-trip
 * through a real save, extension-less backup names, and the openFileInEditor title bind.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';
import type { EditorDialogRequest, EditorDialogResult } from '@jsvision/ui';
import { FileEditor } from '../src/editor/file-editor.js';
import { openFileInEditor } from '../src/editor/open-file.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

test('backup-of-backup: two saves leave the previous version at .bak each time', async () => {
  const fs = createMemoryFs(dir({ 'n.txt': file({ content: 'v1' }) }));
  const ed = new FileEditor({ fs, fileName: '/n.txt' });
  ed.loadFile();
  ed.setText('v2');
  await ed.save();
  expect(fs.readFile('/n.bak')).toBe('v1');
  ed.setText('v3');
  await ed.save();
  expect(fs.readFile('/n.bak')).toBe('v2'); // the stale .bak was unlinked then replaced
  expect(fs.readFile('/n.txt')).toBe('v3');
});

test('an extension-less file backs up as name.bak', async () => {
  const fs = createMemoryFs(dir({ Makefile: file({ content: 'all:' }) }));
  const ed = new FileEditor({ fs, fileName: '/Makefile' });
  ed.loadFile();
  ed.setText('all: build');
  await ed.save();
  expect(fs.readFile('/Makefile.bak')).toBe('all:');
});

test('saveAs onto an existing path replaces it and rebinds fileName', async () => {
  const fs = createMemoryFs(dir({ 'a.txt': file({ content: 'A' }), 'b.txt': file({ content: 'B' }) }));
  const seam = (req: EditorDialogRequest): Promise<EditorDialogResult> =>
    Promise.resolve(req.kind === 'saveAs' ? { kind: 'path', path: '/b.txt' } : { kind: 'ok' });
  const ed = new FileEditor({ fs, fileName: '/a.txt', editorDialog: seam });
  ed.loadFile();
  expect(await ed.saveAs()).toBe(true);
  expect(ed.fileName()).toBe('/b.txt');
  expect(fs.readFile('/b.txt')).toBe('A');
});

test('a write failure routes edWriteError through the seam and reports false', async () => {
  const requests: EditorDialogRequest[] = [];
  const seam = (req: EditorDialogRequest): Promise<EditorDialogResult> => {
    requests.push(req);
    return Promise.resolve({ kind: 'ok' });
  };
  const fs = createMemoryFs(dir({}));
  const broken = {
    ...fs,
    writeFile: () => {
      throw new Error('EACCES');
    },
  };
  const ed = new FileEditor({ fs: broken, fileName: '/x.txt', backupFiles: false, editorDialog: seam });
  ed.setText('data');
  expect(await ed.save()).toBe(false);
  expect(requests.map((r) => r.kind)).toContain('writeError');
});

test('EOL round-trip through a real save: CRLF typed edits survive to disk', async () => {
  const fs = createMemoryFs(dir({ 'c.txt': file({ content: 'a\r\nb' }) }));
  const ed = new FileEditor({ fs, fileName: '/c.txt' });
  ed.loadFile();
  ed.execute('textEnd');
  ed.insertText('\nc'); // converted to the detected crlf kind
  await ed.save();
  expect(fs.readFile('/c.txt')).toBe('a\r\nb\r\nc');
});

test('openFileInEditor mounts the window, loads the file, and binds fileName → title', async () => {
  const fs = createMemoryFs(dir({ 'doc.md': file({ content: '# hi' }) }));
  const app = createApplication({ caps, viewport: { width: 60, height: 20 } });
  const { window, editor } = openFileInEditor(app, { fs, fileName: '/doc.md' });
  app.loop.renderRoot.flush();
  expect(editor.getText()).toBe('# hi');
  expect(window.title()).toBe('/doc.md'); // the reactive bind (PF-013)
  editor.fileName.set('/renamed.md'); // a saveAs-style rebind retitles
  expect(window.title()).toBe('/renamed.md');
});
