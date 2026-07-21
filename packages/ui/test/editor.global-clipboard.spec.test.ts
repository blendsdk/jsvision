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
import type { KeyEvent, CapabilityProfile } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { Commands } from '../src/status/index.js';
import { Editor } from '../src/editor/editor.js';

const base = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const caps = base;
const capsClip: CapabilityProfile = { ...base, osc: { ...base.osc, clipboard52: true } };

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** Mount a focused `Editor` in a loop that uses the framework default keymap (`'both'`). */
function mountEditor(opts: ConstructorParameters<typeof Editor>[0] = {}, w = 12, h = 3) {
  const ed = new Editor(opts);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(ed);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);
  return { loop, ed };
}

/** Mount an `Editor` and an `Input` in one loop, so they share the loop's app-local clipboard buffer. */
function mountEditorAndInput(edText: string, inputText: string, clipboard?: Editor) {
  const ed = new Editor(clipboard === undefined ? {} : { clipboard });
  const inputValue = signal(inputText);
  const input = new Input({ value: inputValue });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(ed);
  root.add(input);
  const loop = createEventLoop({ width: 20, height: 4 }, { caps: capsClip, commands: Object.values(Commands) });
  loop.mount(root);
  loop.renderRoot.flush();
  ed.setText(edText);
  return { loop, ed, input, inputValue };
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

// ST-22 — Editor copy fills the shared buffer (via its OS-mirror sink); an Input then pastes it.
test('ST-22: copy in an Editor then paste into an Input (Editor→Input)', () => {
  const { loop, ed, input, inputValue } = mountEditorAndInput('hello', '');
  loop.focusView(ed);
  loop.dispatch(key('a', { ctrl: true })); // select all in the editor
  loop.dispatch(key('c', { ctrl: true })); // copy → loop buffer
  loop.focusView(input);
  loop.dispatch(key('v', { ctrl: true })); // paste into the input
  expect(inputValue()).toBe('hello');
});

// ST-23 — Input copy fills the shared buffer; an Editor (empty clipboard editor) pastes it via the
// shared-buffer fallback.
test('ST-23: copy in an Input then paste into an Editor (Input→Editor via the shared-buffer fallback)', () => {
  const { loop, ed, input } = mountEditorAndInput('', 'world');
  loop.focusView(input);
  loop.dispatch(key('a', { ctrl: true })); // select all in the input
  loop.dispatch(key('c', { ctrl: true })); // copy → loop buffer
  loop.focusView(ed);
  loop.dispatch(key('v', { ctrl: true })); // paste into the editor (its clipboard editor is empty)
  expect(ed.getText()).toBe('world');
});

// ST-19 — the loop-owned buffer survives a modal boundary: copy inside a modal, paste after it closes.
test('ST-19: a copy inside a modal and a paste after it closes share the loop buffer', () => {
  const deskVal = signal('');
  const dlgVal = signal('secret');
  const deskInput = new Input({ value: deskVal });
  const dlgInput = new Input({ value: dlgVal });
  const dialog = new Group();
  dialog.add(dlgInput);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  deskInput.setLayout({ size: { kind: 'fixed', cells: 1 } });
  dialog.setLayout({ size: { kind: 'fr', weight: 1 } });
  dlgInput.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(deskInput);
  root.add(dialog);
  const loop = createEventLoop({ width: 20, height: 4 }, { caps: capsClip, commands: Object.values(Commands) });
  loop.mount(root);
  void loop.execView(dialog); // open the modal; focus moves into the dialog subtree
  loop.focusView(dlgInput);
  loop.dispatch(key('a', { ctrl: true })); // select all in the dialog field
  loop.dispatch(key('c', { ctrl: true })); // copy inside the modal → loop buffer
  loop.endModal('ok'); // close the modal
  loop.focusView(deskInput);
  loop.dispatch(key('v', { ctrl: true })); // paste on the desktop
  expect(deskVal()).toBe('secret');
});
