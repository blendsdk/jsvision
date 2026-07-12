/**
 * Specification tests (immutable oracles) — global clipboard, Editor side (ST-19, ST-21..ST-23).
 *
 * Source: global-clipboard 01/03-03 + 07. With the framework default keymap, a focused `Editor`
 * handles the globalized `Commands.selectAll` (Ctrl+A) so select-all does not regress once the raw
 * chord is swallowed. This file holds the Phase-1 select-all oracle (ST-21); the cross-widget and
 * modal-scope oracles (ST-22/ST-23/ST-19) land with Phase 3.
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

/** Mount a focused `Editor` in a loop that uses the framework default keymap (`'both'`). */
function mountEditor(opts: ConstructorParameters<typeof Editor>[0] = {}, w = 12, h = 3) {
  const ed = new Editor(opts);
  const root = new Group();
  root.layout = { direction: 'col' };
  ed.layout = { size: { kind: 'fr', weight: 1 } };
  root.add(ed);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);
  return { loop, ed };
}

// ST-21 — Ctrl+A (globalized to Commands.selectAll) selects the whole editor buffer, replacing any
// prior partial selection.
test('ST-21: Ctrl+A selects the whole editor buffer (a fresh select-all replaces a partial one)', () => {
  const { loop, ed } = mountEditor();
  ed.setText('hello world');
  loop.dispatch(key('right', { shift: true })); // a partial selection first
  expect(ed.hasSelection()).toBe(true);

  loop.dispatch(key('a', { ctrl: true })); // Ctrl+A → Commands.selectAll
  expect(ed.selectionText()).toBe('hello world'); // whole buffer selected (start 0 .. end length)
});
