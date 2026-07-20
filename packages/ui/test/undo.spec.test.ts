/**
 * Specification tests (immutable oracles) — RD-08 Phase-5 undo/redo (ST-15/ST-16).
 *
 * Source: RD-08 AC-6 / AR-253 / PA-1 → ST-15/ST-16 (codeops/features/jsvision-ui/plans/
 * editor-family/07-testing-strategy.md; 03-03 §undo.ts). The bounded multi-level stack is the
 * documented BEHAVIOR EXTENSION superseding TV's single-level `delCount`/`insCount` counters
 * (`teditor2.cpp:169-237,593-604` — kept only as the coalescing semantic reference): consecutive
 * single-cluster typing at the caret coalesces into ONE step; a cursor move seals the open step;
 * a fresh edit clears the redo branch; the stack evicts OLDEST WHOLE steps past `undoDepth`
 * (default 1000, PA-1); redo is command-only (no keymap chord). Expectations derive from RD-08 +
 * the register, never the implementation.
 *
 * Trace: RD-08 03-03 · AR-253 / PA-1 · ST-15/ST-16.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Editor } from '../src/editor/editor.js';

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

// ST-15 / AC-6 — coalescing + seal-on-move; two undos empty; two redos restore everything.
test('ST-15: typing coalesces, a cursor move seals; undo ×2 empties, redo ×2 restores "abcd"', () => {
  const { loop, ed } = mountEditor();
  loop.dispatch(key('a'));
  loop.dispatch(key('b'));
  loop.dispatch(key('c')); // one coalesced step "abc"
  loop.dispatch(key('left')); // the move seals it
  loop.dispatch(key('right'));
  loop.dispatch(key('d')); // a second step "d"
  expect(ed.getText()).toBe('abcd');

  ed.execute('undo');
  expect(ed.getText()).toBe('abc'); // step 2 undone
  ed.execute('undo');
  expect(ed.getText()).toBe(''); // step 1 (the whole coalesced run) undone
  expect(ed.canUndo()).toBe(false);

  ed.execute('redo');
  expect(ed.getText()).toBe('abc');
  ed.execute('redo');
  expect(ed.getText()).toBe('abcd');
  expect(ed.canRedo()).toBe(false);
});

// ST-16 / AC-6 / PA-1 — a fresh edit clears redo; eviction drops OLDEST WHOLE steps; the signals flip.
test('ST-16: a fresh edit after undo clears the redo branch', () => {
  const { loop, ed } = mountEditor();
  loop.dispatch(key('a'));
  loop.dispatch(key('left'));
  loop.dispatch(key('right'));
  loop.dispatch(key('b')); // two steps
  ed.execute('undo');
  expect(ed.canRedo()).toBe(true);
  loop.dispatch(key('z')); // a fresh edit
  expect(ed.canRedo()).toBe(false); // redo branch cleared
  expect(ed.getText()).toBe('az');
});

test('ST-16: past undoDepth the OLDEST WHOLE steps evict; canUndo/canRedo signals flip', () => {
  const { loop, ed } = mountEditor({ undoDepth: 2 });
  expect(ed.canUndo()).toBe(false);
  // Three sealed steps: 'a' | 'b' | 'c' (moves seal between them).
  for (const ch of ['a', 'b', 'c']) {
    loop.dispatch(key(ch));
    loop.dispatch(key('left'));
    loop.dispatch(key('end')); // reseal + return to the end
  }
  expect(ed.getText()).toBe('abc');
  expect(ed.canUndo()).toBe(true);

  ed.execute('undo');
  ed.execute('undo');
  expect(ed.getText()).toBe('a'); // the oldest step ('a') was evicted — only 2 undos available
  expect(ed.canUndo()).toBe(false);
  expect(ed.canRedo()).toBe(true);
});
