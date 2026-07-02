/**
 * Specification tests (immutable oracles) — RD-07 `Input` clipboard (ST-05…ST-06).
 *
 * Source: jsvision-ui RD-07 AC-4/AC-5 → ST-05/ST-06 (essential-control-completions/07). TV source:
 * `TInputLine::handleEvent` cmCut/cmCopy/cmPaste (`tinputli.cpp:469-489`) + paste char-by-char
 * validate (`:418-446`). Chords Ctrl+Insert (copy) / Shift+Insert (paste) / Shift+Delete (cut) are
 * the SIGINT-safe DOS chords (PA-7/AR-117). Copy/cut ride `ev.setClipboard` → the loop's
 * `writeClipboard` sink (core `setClipboard`, OSC-52 base64 + sanitize, caps-gated). Expectations
 * derive from TV + core `osc.ts`, never from the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, PasteEvent, CapabilityProfile } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, filter } from '../src/controls/index.js';

const base = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const capsClip: CapabilityProfile = { ...base, osc: { ...base.osc, clipboard52: true } };
const capsNoClip: CapabilityProfile = { ...base, osc: { ...base.osc, clipboard52: false } };

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false };
}
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}
/** Mount a focused Input, capturing every clipboard-write sequence the loop emits. */
function mountInput(opts: ConstructorParameters<typeof Input>[0], caps = capsClip, w = 15) {
  const input = new Input(opts);
  const stub = new FocusStub();
  const root = new Group();
  root.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  stub.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: w, height: 3 }, { caps, commands: ['copy', 'cut', 'paste'] });
  const clip: string[] = [];
  loop.writeClipboard = (seq) => clip.push(seq);
  loop.mount(root);
  loop.focusView(input);
  return { loop, input, clip };
}

/** OSC-52 of `text` (base64), as core `setClipboard` builds it. */
function osc52(text: string): string {
  return `\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`;
}

// ST-05 / AC-4 — copy/cut via the OSC-52 sink; caps-gated no-op; empty-selection cut is a no-op.
test('ST-05: Ctrl+Insert copies the selection as OSC-52 base64', () => {
  const value = signal('hello');
  const { loop, clip } = mountInput({ value });
  loop.dispatch(key('right', { shift: true })); // select "h"..
  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('right', { shift: true })); // selection "hel"
  loop.dispatch(key('insert', { ctrl: true })); // copy
  expect(clip.at(-1)).toBe(osc52('hel'));
  expect(value()).toBe('hello'); // copy does not mutate
});

test('ST-05: Shift+Delete cuts — writes OSC-52 AND deletes the selection (collapsed)', () => {
  const value = signal('hello');
  const { loop, input, clip } = mountInput({ value });
  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('right', { shift: true })); // select "he"
  loop.dispatch(key('delete', { shift: true })); // cut
  expect(clip.at(-1)).toBe(osc52('he'));
  expect(value()).toBe('llo');
  expect(input.selection.start).toBe(input.selection.end); // collapsed
});

test('ST-05: with clipboard52 off, copy/cut are safe no-ops (no sequence written)', () => {
  const value = signal('hello');
  const { loop, clip } = mountInput({ value }, capsNoClip);
  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('insert', { ctrl: true })); // copy — gated off
  loop.dispatch(key('delete', { shift: true })); // cut — gated off (but still deletes locally)
  expect(clip.length).toBe(0);
});

test('ST-05: cut with an empty selection is a no-op (no write, value unchanged)', () => {
  const value = signal('hello');
  const { loop, clip } = mountInput({ value });
  loop.dispatch(key('delete', { shift: true })); // no selection → no-op
  expect(clip.length).toBe(0);
  expect(value()).toBe('hello');
});

// ST-06 / AC-5 — paste replaces the selection then inserts char-by-char, validator-filtered.
test('ST-06: paste replaces the selection and inserts only validator-accepted code points', () => {
  const value = signal('');
  const { loop } = mountInput({ value, validator: filter('0-9') });
  loop.dispatch(paste('12ab34')); // letters dropped char-by-char
  expect(value()).toBe('1234');
});

test('ST-06: a paste over a selection replaces it (the bracketed-paste path, PA-16)', () => {
  const value = signal('X');
  const { loop } = mountInput({ value });
  // The real paste content arrives as a bracketed PasteEvent (system read is deferred, PA-16/DEF-25).
  // Select all then paste "YZ" → deleteSelect first, then insert → replaces "X".
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(paste('YZ'));
  expect(value()).toBe('YZ');
});

test('ST-06: Shift+Insert / Commands.paste are consumed no-ops without clipboard read (PA-16)', () => {
  const value = signal('ab');
  const { loop } = mountInput({ value });
  loop.dispatch(key('insert', { shift: true })); // no system read → does not mutate the value
  loop.dispatch({ type: 'command', command: 'paste' });
  expect(value()).toBe('ab'); // unchanged; real paste flows via PasteEvent
});
