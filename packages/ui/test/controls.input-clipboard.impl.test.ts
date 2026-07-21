/**
 * Implementation tests — RD-07 `Input` clipboard internals + edges (P2.4). Covers the pure helpers
 * (input-clipboard.ts), copy of an empty selection, paste maxLength boundary, and paste-over-selection.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, PasteEvent, CapabilityProfile } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, filter } from '../src/controls/index.js';
import { clipboardCommand, applyPaste } from '../src/controls/input-clipboard.js';

const b = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const capsClip: CapabilityProfile = { ...b, osc: { ...b.osc, clipboard52: true } };

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
function mountInput(opts: ConstructorParameters<typeof Input>[0]) {
  const input = new Input(opts);
  const stub = new FocusStub();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  stub.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: 15, height: 3 }, { caps: capsClip });
  const clip: string[] = [];
  loop.writeClipboard = (seq) => clip.push(seq);
  loop.mount(root);
  loop.focusView(input);
  return { loop, input, clip };
}

// --- Pure helpers ----------------------------------------------------------------------------------
test('clipboardCommand maps Commands.copy/cut/paste, null otherwise', () => {
  expect(clipboardCommand('copy')).toBe('copy');
  expect(clipboardCommand('cut')).toBe('cut');
  expect(clipboardCommand('paste')).toBe('paste');
  expect(clipboardCommand('quit')).toBeNull();
});

test('applyPaste inserts code point by code point, dropping invalid + honouring maxLength', () => {
  expect(applyPaste('12ab34', '', 0, Infinity, filter('0-9'))).toEqual({ value: '1234', curPos: 4 });
  expect(applyPaste('abcdef', '', 0, 3)).toEqual({ value: 'abc', curPos: 3 }); // maxLength cap
  expect(applyPaste('XY', 'aZb', 1, Infinity)).toEqual({ value: 'aXYZb', curPos: 3 }); // insert at curPos
});

// --- Edges -----------------------------------------------------------------------------------------
test('copy with an empty selection writes nothing (effective no-op, PA-9)', () => {
  const value = signal('hello');
  const { loop, clip } = mountInput({ value });
  loop.dispatch(key('insert', { ctrl: true })); // no selection
  expect(clip.length).toBe(0);
});

test('paste respects maxLength measured across the inserted run', () => {
  const value = signal('ab');
  const { loop } = mountInput({ value, maxLength: 4 });
  loop.dispatch(key('end')); // caret at 2
  loop.dispatch(paste('XYZW')); // only 2 more fit (→ "abXY")
  expect(value()).toBe('abXY');
});

test('paste over a selection replaces it, then applies the filter to the pasted run', () => {
  const value = signal('12345');
  const { loop } = mountInput({ value, validator: filter('0-9') });
  loop.dispatch(key('a', { ctrl: true })); // select all
  loop.dispatch(paste('9x8')); // deleteSelect → "" then insert "98" (x dropped)
  expect(value()).toBe('98');
});

test('cut then copy: the clipboard reflects the most recent selection', () => {
  const value = signal('hello');
  const { loop, clip } = mountInput({ value });
  loop.dispatch(key('right', { shift: true }));
  loop.dispatch(key('right', { shift: true })); // "he"
  loop.dispatch(key('delete', { shift: true })); // cut "he" → value "llo"
  loop.dispatch(key('end', { shift: true })); // select "llo"
  loop.dispatch(key('insert', { ctrl: true })); // copy "llo"
  expect(clip.length).toBe(2);
  expect(clip[1]).toContain(Buffer.from('llo').toString('base64'));
});
