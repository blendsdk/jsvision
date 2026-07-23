/**
 * Implementation tests — global clipboard, Editor internals & edges: the paste-source precedence (an
 * injected clipboard editor wins over the app-local buffer when both hold text) and paste recorded as
 * a single undo step. Complements the ST-19/22/23 oracles in the spec file.
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
const capsClip: CapabilityProfile = { ...base, osc: { ...base.osc, clipboard52: true } };

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** Mount an `Editor` (optional injected clipboard editor) and an `Input` sharing one loop's buffer. */
function mount(edText: string, inputText: string, clipboard?: Editor) {
  const ed = new Editor(clipboard === undefined ? {} : { clipboard });
  const inputValue = signal(inputText);
  const input = new Input({ value: inputValue });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(ed);
  root.add(input);
  const loop = createEventLoop({ width: 24, height: 5 }, { caps: capsClip, commands: Object.values(Commands) });
  loop.mount(root);
  loop.renderRoot.flush();
  ed.setText(edText);
  return { loop, ed, input };
}

test('an injected clipboard editor with text wins over the app-local buffer', () => {
  const clip = new Editor();
  clip.setText('FROM_CLIP');
  clip.setSelect(0, 'FROM_CLIP'.length, false); // the clipboard editor holds its text selected
  const { loop, ed, input } = mount('', 'FROM_BUFFER', clip);

  // Fill the loop's app-local buffer with different text via the Input's copy.
  loop.focusView(input);
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true })); // buffer := "FROM_BUFFER"

  loop.focusView(ed);
  loop.dispatch(key('v', { ctrl: true })); // paste — the injected clipboard editor takes precedence
  expect(ed.getText()).toBe('FROM_CLIP');
});

test('a cross-widget paste into the Editor is a single undo step', () => {
  const { loop, ed, input } = mount('', 'abc');
  loop.focusView(input);
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true })); // buffer := "abc"

  loop.focusView(ed);
  loop.dispatch(key('v', { ctrl: true })); // paste via the shared-buffer fallback
  expect(ed.getText()).toBe('abc');

  loop.dispatch(key('z', { ctrl: true })); // modern undo (Ctrl+Z is not globalized) removes it in one step
  expect(ed.getText()).toBe('');
});
