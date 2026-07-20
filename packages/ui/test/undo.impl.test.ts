/**
 * Implementation tests — RD-08 Phase-5 `UndoStack` internals + editor wiring edges (after green).
 *
 * Coalescing boundaries (inserts vs deletes never merge; non-contiguous edits split), eviction
 * order, redo-clear on both record paths, seal semantics, forward-delete runs, and the
 * setText document-swap reset.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Editor } from '../src/editor/editor.js';
import { UndoStack } from '../src/editor/undo.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

function mountEditor(opts: ConstructorParameters<typeof Editor>[0] = {}) {
  const ed = new Editor(opts);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(ed);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);
  return { loop, ed };
}

// --- Pure stack -------------------------------------------------------------------------------

test('inserts and deletes never merge into one step', () => {
  const s = new UndoStack(10);
  s.coalesce({ at: 0, removed: '', inserted: 'a' });
  s.coalesce({ at: 1, removed: '', inserted: 'b' }); // merges: "ab"
  s.coalesce({ at: 1, removed: 'b', inserted: '' }); // a delete — records fresh
  expect(s.undo()).toEqual({ at: 1, removed: 'b', inserted: '' });
  expect(s.undo()).toEqual({ at: 0, removed: '', inserted: 'ab' });
});

test('non-contiguous typing records a fresh step', () => {
  const s = new UndoStack(10);
  s.coalesce({ at: 0, removed: '', inserted: 'a' });
  s.coalesce({ at: 5, removed: '', inserted: 'b' }); // gap → fresh
  expect(s.undo()).toEqual({ at: 5, removed: '', inserted: 'b' });
  expect(s.canUndo).toBe(true);
});

test('backspace runs grow leftward; forward-delete runs grow rightward', () => {
  const back = new UndoStack(10);
  back.coalesce({ at: 2, removed: 'c', inserted: '' });
  back.coalesce({ at: 1, removed: 'b', inserted: '' });
  back.coalesce({ at: 0, removed: 'a', inserted: '' });
  expect(back.undo()).toEqual({ at: 0, removed: 'abc', inserted: '' });

  const fwd = new UndoStack(10);
  fwd.coalesce({ at: 3, removed: 'x', inserted: '' });
  fwd.coalesce({ at: 3, removed: 'y', inserted: '' });
  expect(fwd.undo()).toEqual({ at: 3, removed: 'xy', inserted: '' });
});

test('seal stops merging but keeps the history; eviction drops the oldest first', () => {
  const s = new UndoStack(2);
  s.coalesce({ at: 0, removed: '', inserted: 'a' });
  s.seal();
  s.coalesce({ at: 1, removed: '', inserted: 'b' }); // fresh after seal
  s.coalesce({ at: 2, removed: '', inserted: 'c' }); // merges into 'bc'
  s.seal();
  s.record({ at: 3, removed: '', inserted: 'd' }); // evicts the 'a' step (depth 2)
  expect(s.undo()?.inserted).toBe('d');
  expect(s.undo()?.inserted).toBe('bc');
  expect(s.canUndo).toBe(false); // 'a' evicted
});

test('coalesce clears the redo branch like record does', () => {
  const s = new UndoStack(10);
  s.record({ at: 0, removed: '', inserted: 'a' });
  s.undo();
  expect(s.canRedo).toBe(true);
  s.coalesce({ at: 0, removed: '', inserted: 'z' });
  expect(s.canRedo).toBe(false);
});

// --- Editor wiring ----------------------------------------------------------------------------

test('type → backspace → type makes three distinct steps; full round-trip restores each state', () => {
  const { loop, ed } = mountEditor();
  loop.dispatch(key('a'));
  loop.dispatch(key('b')); // step 1: "ab"
  loop.dispatch(key('backspace')); // step 2: delete "b"
  loop.dispatch(key('z')); // step 3: "z"
  expect(ed.getText()).toBe('az');
  ed.execute('undo');
  expect(ed.getText()).toBe('a');
  ed.execute('undo');
  expect(ed.getText()).toBe('ab');
  ed.execute('undo');
  expect(ed.getText()).toBe('');
  ed.execute('redo');
  ed.execute('redo');
  ed.execute('redo');
  expect(ed.getText()).toBe('az');
});

test('delWord is one whole step (never coalesced with typing)', () => {
  const { loop, ed } = mountEditor();
  ed.setText('foo bar');
  loop.dispatch(key('x')); // step: insert x at 0
  ed.execute('delWord'); // step: delete "foo" — wait, deletes from after x
  const after = ed.getText();
  ed.execute('undo');
  expect(ed.getText()).toBe('xfoo bar'); // only the word delete undone
  ed.execute('redo');
  expect(ed.getText()).toBe(after);
});

test('setText clears the history — undo cannot cross a document swap', () => {
  const { loop, ed } = mountEditor();
  loop.dispatch(key('a'));
  expect(ed.canUndo()).toBe(true);
  ed.setText('fresh');
  expect(ed.canUndo()).toBe(false);
  ed.execute('undo'); // no-op
  expect(ed.getText()).toBe('fresh');
});

test('undo of an overwrite restores the replaced cluster', () => {
  const { loop, ed } = mountEditor();
  ed.setText('漢x');
  loop.dispatch(key('insert')); // overwrite
  loop.dispatch(key('a'));
  expect(ed.getText()).toBe('ax');
  ed.execute('undo');
  expect(ed.getText()).toBe('漢x');
});
