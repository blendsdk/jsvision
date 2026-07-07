/**
 * Specification tests (immutable oracles) — RD-08 Phase-6 literal search/replace (ST-19/ST-20).
 *
 * Source: RD-08 AC-8 + PA-17 + PF-009 → ST-19/ST-20 (codeops/features/jsvision-ui/plans/
 * editor-family/07-testing-strategy.md; 03-03 §search). TV decode: `doSearchReplace` =
 * `teditor1.cpp:400-429`; `search()` = `teditor2.cpp:389-421` (scan from the caret, whole-words
 * via the search-side `isWordChar` `:61-64`, select the match); the seam requests flow through
 * the async PA-17 handler (default answers cancel — every action is a safe no-op unwired);
 * replace-all RETURNS ITS COUNT (the PF-009 documented extension). Expectations derive from
 * RD-08 + the decodes, never the implementation.
 *
 * Trace: RD-08 03-03 · PA-17 / PF-009 · ST-19/ST-20.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Editor } from '../src/editor/editor.js';
import type { EditorDialogRequest, EditorDialogResult, FindRec, ReplaceRec } from '../src/editor/editor-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A scripted seam: answers find/replace with the given recs, prompts from a queue; records all. */
function scriptedSeam(opts: {
  find?: FindRec | null;
  replace?: ReplaceRec | null;
  prompts?: ('yes' | 'no' | 'cancel')[];
}) {
  const requests: EditorDialogRequest[] = [];
  const prompts = [...(opts.prompts ?? [])];
  const handler = (req: EditorDialogRequest): Promise<EditorDialogResult> => {
    requests.push(req);
    switch (req.kind) {
      case 'find':
        return Promise.resolve({ kind: 'find', rec: opts.find ?? null });
      case 'replace':
        return Promise.resolve({ kind: 'replace', rec: opts.replace ?? null });
      case 'replacePrompt':
        return Promise.resolve({ kind: 'confirm', answer: prompts.shift() ?? 'cancel' });
      default:
        return Promise.resolve({ kind: 'ok' });
    }
  };
  return { handler, requests };
}

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

const opts = (caseSensitive = false, wholeWords = false) => ({ caseSensitive, wholeWords });

// ST-19 / AC-8 — case-insensitive match selects; whole-words rejects; searchAgain advances; a miss
// raises edSearchFailed; an unwired seam is a safe no-op.
test('ST-19: a case-insensitive find selects the actual match text', async () => {
  const seam = scriptedSeam({ find: { find: 'abc', options: opts(false) } });
  const { ed } = mountEditor({ editorDialog: seam.handler });
  ed.setText('xABCx');
  await ed.find();
  expect(ed.selectionText()).toBe('ABC'); // the selection lands ON the match
});

test('ST-19: whole-words rejects an embedded match and raises edSearchFailed', async () => {
  const seam = scriptedSeam({ find: { find: 'abc', options: opts(false, true) } });
  const { ed } = mountEditor({ editorDialog: seam.handler });
  ed.setText('abcd');
  await ed.find();
  expect(ed.hasSelection()).toBe(false);
  expect(seam.requests.map((r) => r.kind)).toContain('searchFailed');
});

test('ST-19: searchAgain finds the next hit after the current one', async () => {
  const seam = scriptedSeam({ find: { find: 'abc', options: opts() } });
  const { ed } = mountEditor({ editorDialog: seam.handler });
  ed.setText('abc abc');
  await ed.find();
  expect(ed.selectionText()).toBe('abc');
  expect(ed.curPos().col).toBe(4); // caret after the first match
  await ed.searchAgain();
  expect(ed.selectionText()).toBe('abc');
  expect(ed.curPos().col).toBe(8); // after the second
});

test('ST-19: a miss raises edSearchFailed; case-sensitive rejects a case mismatch', async () => {
  const seam = scriptedSeam({ find: { find: 'zzz', options: opts() } });
  const { ed } = mountEditor({ editorDialog: seam.handler });
  ed.setText('hello');
  await ed.find();
  expect(seam.requests.map((r) => r.kind)).toContain('searchFailed');

  const seam2 = scriptedSeam({ find: { find: 'abc', options: opts(true) } });
  const { ed: ed2 } = mountEditor({ editorDialog: seam2.handler });
  ed2.setText('xABCx');
  await ed2.find();
  expect(ed2.hasSelection()).toBe(false);
});

test('ST-19: with no seam wired, find is a safe no-op (the default answers cancel)', async () => {
  const { ed } = mountEditor(); // defaultEditorDialog
  ed.setText('abc');
  await expect(ed.find()).resolves.toBeUndefined();
  expect(ed.hasSelection()).toBe(false);
});

// ST-20 / AC-8 / PF-009 — per-hit prompts honored; replace-all counts.
test('ST-20: promptOnReplace prompts per hit — yes, no, yes replaces two of three', async () => {
  const seam = scriptedSeam({
    replace: { find: 'x', replace: 'Y', options: opts(), promptOnReplace: true, replaceAll: true },
    prompts: ['yes', 'no', 'yes'],
  });
  const { ed } = mountEditor({ editorDialog: seam.handler });
  ed.setText('x x x');
  const count = await ed.replace();
  expect(ed.getText()).toBe('Y x Y'); // accept, skip, accept
  expect(count).toBe(2);
  expect(seam.requests.filter((r) => r.kind === 'replacePrompt')).toHaveLength(3);
});

test('ST-20: replaceAll without prompting does all four in one pass and RETURNS 4', async () => {
  const seam = scriptedSeam({
    replace: { find: 'a', replace: 'B', options: opts(), promptOnReplace: false, replaceAll: true },
  });
  const { ed } = mountEditor({ editorDialog: seam.handler });
  ed.setText('a a a a');
  const count = await ed.replace();
  expect(ed.getText()).toBe('B B B B');
  expect(count).toBe(4); // the PF-009 documented extension
  expect(seam.requests.filter((r) => r.kind === 'replacePrompt')).toHaveLength(0);
});
