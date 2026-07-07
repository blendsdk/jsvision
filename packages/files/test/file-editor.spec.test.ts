/**
 * Specification tests (immutable oracles) — RD-08 Phase-9 `FileEditor` (ST-30/ST-31).
 *
 * Source: RD-08 AC-13/AC-15 + AR-249/AR-258 + plan-preflight PF-001 → ST-30/ST-31
 * (codeops/features/jsvision-ui/plans/editor-family/07-testing-strategy.md; 03-06). TV decode
 * (`tfiledtr.cpp`, re-verified 2026-07-07 @ 57b6f56): `loadFile` — a missing file ⇒ EMPTY buffer,
 * still valid (`:107-111`); content verbatim. `saveFile` (`:180-219`) with `efBackupFiles`
 * (default ON, `editstat.cpp:24`): the backup name REPLACES the extension with `.bak`
 * (`fnsplit`/`fnmerge`, `:186-190`) — unlink the stale `.bak` (ignore-missing) → rename the
 * current file to it → write the buffer fresh. `save`/`saveAs` (`:147-167`): untitled routes
 * `edSaveAs` through the seam. `valid(close/quit)` (`:264-291`): modified ⇒ `edSaveModify`
 * (named) / `edSaveUntitled` — Yes → `save()`'s result, No → drop (modified=false, true),
 * Cancel → false. Everything runs on the in-memory fs (disk-free, AC-13).
 *
 * Trace: RD-08 03-06 · PA-6 / PA-17 / PF-001 · ST-30/ST-31.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import type { EditorDialogRequest, EditorDialogResult } from '@jsvision/ui';
import { FileEditor } from '../src/editor/file-editor.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

/** A scripted seam answering saveAs with a path and save prompts from a queue. */
function scriptedSeam(opts: { saveAsPath?: string | null; confirms?: ('yes' | 'no' | 'cancel')[] }) {
  const requests: EditorDialogRequest[] = [];
  const confirms = [...(opts.confirms ?? [])];
  const handler = (req: EditorDialogRequest): Promise<EditorDialogResult> => {
    requests.push(req);
    if (req.kind === 'saveAs') return Promise.resolve({ kind: 'path', path: opts.saveAsPath ?? null });
    if (req.kind === 'saveModify' || req.kind === 'saveUntitled') {
      return Promise.resolve({ kind: 'confirm', answer: confirms.shift() ?? 'cancel' });
    }
    return Promise.resolve({ kind: 'ok' });
  };
  return { handler, requests };
}

// ST-30 — load-missing ⇒ empty valid; save writes the exact buffer bytes; backup sequence.
test('ST-30: loading a missing path yields an empty, valid, unmodified buffer', () => {
  const fs = createMemoryFs(dir({}));
  const ed = new FileEditor({ fs, fileName: '/nope.txt' });
  ed.loadFile();
  expect(ed.getText()).toBe('');
  expect(ed.modified()).toBe(false);
});

test('ST-30: save writes EXACTLY the buffer content (CRLF preserved)', async () => {
  const fs = createMemoryFs(dir({}));
  const ed = new FileEditor({ fs, fileName: '/f.txt' });
  ed.setText('a\r\nb');
  expect(await ed.save()).toBe(true);
  expect(fs.readFile('/f.txt')).toBe('a\r\nb');
  expect(ed.modified()).toBe(false); // saveFile clears modified (decode :214)
});

test('ST-30: saving over an existing file with backups ON leaves the old content at .bak', async () => {
  const fs = createMemoryFs(dir({ src: dir({ 'old.cpp': file({ content: 'OLD' }) }) }));
  const ed = new FileEditor({ fs, fileName: '/src/old.cpp' });
  ed.loadFile();
  expect(ed.getText()).toBe('OLD');
  ed.setText('NEW');
  expect(await ed.save()).toBe(true);
  expect(fs.readFile('/src/old.bak')).toBe('OLD'); // extension REPLACED (fnmerge, :186-190)
  expect(fs.readFile('/src/old.cpp')).toBe('NEW');
});

test('ST-30: backups OFF writes in place with no .bak', async () => {
  const fs = createMemoryFs(dir({ 'a.txt': file({ content: 'one' }) }));
  const ed = new FileEditor({ fs, fileName: '/a.txt', backupFiles: false });
  ed.loadFile();
  ed.setText('two');
  await ed.save();
  expect(fs.readFile('/a.txt')).toBe('two');
  expect(() => fs.readFile('/a.bak')).toThrow();
});

// ST-31 — the untitled saveAs seam round-trip + the valid() prompt state machine.
test('ST-31: an untitled save routes edSaveAs through the seam; a path answer saves + retitles', async () => {
  const fs = createMemoryFs(dir({}));
  const seam = scriptedSeam({ saveAsPath: '/named.txt' });
  const ed = new FileEditor({ fs, editorDialog: seam.handler });
  ed.setText('body');
  expect(await ed.save()).toBe(true);
  expect(seam.requests.map((r) => r.kind)).toContain('saveAs');
  expect(ed.fileName()).toBe('/named.txt');
  expect(fs.readFile('/named.txt')).toBe('body');

  const cancelSeam = scriptedSeam({ saveAsPath: null });
  const ed2 = new FileEditor({ fs, editorDialog: cancelSeam.handler });
  ed2.setText('x');
  expect(await ed2.save()).toBe(false); // cancel ⇒ save reports false
});

test('ST-31: valid(close) — Yes saves then closes, No drops, Cancel keeps the window', async () => {
  const fs = createMemoryFs(dir({ 'f.txt': file({ content: 'v1' }) }));

  const yes = scriptedSeam({ confirms: ['yes'] });
  const edYes = new FileEditor({ fs, fileName: '/f.txt', editorDialog: yes.handler });
  edYes.loadFile();
  edYes.execute('selectAll');
  edYes.insertText('v2');
  expect(await edYes.valid('close')).toBe(true);
  expect(fs.readFile('/f.txt')).toBe('v2'); // Yes → saved
  expect(yes.requests.map((r) => r.kind)).toContain('saveModify'); // named file → edSaveModify

  const no = scriptedSeam({ confirms: ['no'] });
  const edNo = new FileEditor({ fs, fileName: '/f.txt', editorDialog: no.handler });
  edNo.loadFile();
  edNo.execute('selectAll');
  edNo.insertText('v3');
  expect(await edNo.valid('close')).toBe(true); // No → drop the changes, close
  expect(fs.readFile('/f.txt')).toBe('v2'); // nothing written
  expect(edNo.modified()).toBe(false); // decode :283 clears modified

  const cancel = scriptedSeam({ confirms: ['cancel'] });
  const edCancel = new FileEditor({ fs, fileName: '/f.txt', editorDialog: cancel.handler });
  edCancel.loadFile();
  edCancel.execute('selectAll');
  edCancel.insertText('v4');
  expect(await edCancel.valid('close')).toBe(false); // Cancel → abort the close

  const untitled = scriptedSeam({ confirms: ['cancel'] });
  const edUntitled = new FileEditor({ fs, editorDialog: untitled.handler });
  edUntitled.insertText('u');
  await edUntitled.valid('quit');
  expect(untitled.requests.map((r) => r.kind)).toContain('saveUntitled'); // untitled → edSaveUntitled
});

test('ST-31: an unmodified editor closes without any prompt', async () => {
  const fs = createMemoryFs(dir({ 'f.txt': file({ content: 'v1' }) }));
  const seam = scriptedSeam({});
  const ed = new FileEditor({ fs, fileName: '/f.txt', editorDialog: seam.handler });
  ed.loadFile();
  expect(await ed.valid('close')).toBe(true);
  expect(seam.requests).toHaveLength(0);
});
