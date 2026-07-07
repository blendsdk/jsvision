/**
 * Implementation tests — RD-08 Phase-6 search edges (after green).
 *
 * Empty needle (no seam round-trip), overlapping hits, seam rejection/throw paths, the TV
 * whole-words quirk (tabs/newlines COUNT as word chars in the search-side class), and the
 * replace-all no-match count.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Editor } from '../src/editor/editor.js';
import { GapBuffer } from '../src/editor/buffer/index.js';
import { scan, isWordChar } from '../src/editor/search.js';
import type { EditorDialogRequest, EditorDialogResult } from '../src/editor/editor-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mountEditor(opts: ConstructorParameters<typeof Editor>[0] = {}) {
  const ed = new Editor(opts);
  const root = new Group();
  root.layout = { direction: 'col' };
  ed.layout = { size: { kind: 'fr', weight: 1 } };
  root.add(ed);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);
  return { loop, ed };
}

test('scan: empty needle always misses; case modes behave; from clamps', () => {
  const b = new GapBuffer('aXbXc');
  expect(scan(b, 0, '', { caseSensitive: false, wholeWords: false })).toBe(-1);
  expect(scan(b, 0, 'x', { caseSensitive: true, wholeWords: false })).toBe(-1);
  expect(scan(b, 0, 'x', { caseSensitive: false, wholeWords: false })).toBe(1);
  expect(scan(b, 2, 'X', { caseSensitive: true, wholeWords: false })).toBe(3);
  expect(scan(b, -9, 'a', { caseSensitive: true, wholeWords: false })).toBe(0);
  expect(scan(b, 99, 'a', { caseSensitive: true, wholeWords: false })).toBe(-1);
});

test('isWordChar: the TV search class — tabs/newlines COUNT as word chars (the faithful quirk)', () => {
  expect(isWordChar('a')).toBe(true);
  expect(isWordChar('_')).toBe(true); // _ is not in the TV punctuation set
  expect(isWordChar(' ')).toBe(false);
  expect(isWordChar('(')).toBe(false);
  expect(isWordChar('')).toBe(false); // out-of-range = NUL
  expect(isWordChar('\t')).toBe(true); // NOT in the TV set — transcribed faithfully
  expect(isWordChar('\n')).toBe(true);
});

test('an empty needle never makes a seam round-trip (03-03 error table)', async () => {
  const requests: EditorDialogRequest[] = [];
  const handler = (req: EditorDialogRequest): Promise<EditorDialogResult> => {
    requests.push(req);
    return Promise.resolve({ kind: 'ok' });
  };
  const { ed } = mountEditor({ editorDialog: handler });
  ed.setText('abc');
  expect(await ed.doSearchReplace()).toBe(0); // findStr is ''
  expect(requests).toHaveLength(0); // no searchFailed round-trip
});

test('overlapping hits advance past each match (never re-match in place)', async () => {
  const { ed } = mountEditor();
  ed.setText('aaaa');
  ed.findStr = 'aa';
  ed.searchOpts = { caseSensitive: true, wholeWords: false };
  expect(ed.searchOnce()).toBe(true);
  expect(ed.curPos().col).toBe(3); // matched [0,2)
  expect(ed.searchOnce()).toBe(true);
  expect(ed.curPos().col).toBe(5); // next from the caret: [2,4) — no overlap loop
  expect(ed.searchOnce()).toBe(false);
});

test('a rejecting seam handler leaves the buffer untouched (treated as cancel)', async () => {
  const handler = (): Promise<EditorDialogResult> => Promise.reject(new Error('boom'));
  const { ed } = mountEditor({ editorDialog: handler });
  ed.setText('x x');
  ed.findStr = 'x';
  ed.replaceStr = 'Y';
  ed.searchOpts = { caseSensitive: true, wholeWords: false };
  ed.doReplace = true;
  ed.promptOnReplace = true;
  ed.replaceAllFlag = true;
  await expect(ed.doSearchReplace()).rejects.toThrow('boom'); // the loop's error isolation catches it
  expect(ed.getText()).toBe('x x'); // nothing replaced before the rejection
});

test('replace-all over zero hits returns 0 without raising searchFailed', async () => {
  const requests: EditorDialogRequest[] = [];
  const handler = (req: EditorDialogRequest): Promise<EditorDialogResult> => {
    requests.push(req);
    return Promise.resolve({ kind: 'ok' });
  };
  const { ed } = mountEditor({ editorDialog: handler });
  ed.setText('abc');
  ed.findStr = 'zzz';
  ed.searchOpts = { caseSensitive: true, wholeWords: false };
  ed.doReplace = true;
  ed.replaceAllFlag = true;
  ed.promptOnReplace = false;
  expect(await ed.doSearchReplace()).toBe(0);
  expect(requests.filter((r) => r.kind === 'searchFailed')).toHaveLength(0); // suppressed (decode)
});
