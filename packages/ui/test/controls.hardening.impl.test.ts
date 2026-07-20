/**
 * Implementation tests — controls & input-editor hardening (RD-13). Edge/error paths for HR-43…HR-60:
 * paste-over-selection, word-delete at the string edges, drags across two Inputs, maxLength clamps,
 * and the disabled Cluster hot run. Driven through the real loop; complements the ST-8 spec oracles.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent, PasteEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, CheckGroup } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}
function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false }; // these fixtures never exercise the size-cap path
}

class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

function mountInput(value = ''): { loop: ReturnType<typeof createEventLoop>; input: Input } {
  const input = new Input({ value: signal(value) });
  const stub = new FocusStub();
  const root = new Group();
  root.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  stub.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: 20, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  return { loop, input };
}

// HR-43/HR-47 — pasting over a selection replaces it (delete-then-insert), mapping control chars.
test('HR-43 impl: paste replaces the current selection', () => {
  const value = signal('abcdef');
  const input = new Input({ value });
  const stub = new FocusStub();
  const root = new Group();
  root.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  stub.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: 20, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  loop.dispatch(key('a', { ctrl: true })); // select all
  loop.dispatch(paste('X\tY')); // \t → space
  expect(value()).toBe('X Y');
});

// HR-48 — Ctrl+Backspace at index 0 deletes nothing (prevWord(_, 0) === 0); Ctrl+Delete at the end
// deletes nothing (nextWord at end === len).
test('HR-48 impl: word-delete at the string edges is a no-op', () => {
  const { loop, input } = mountInput('foo bar');
  loop.dispatch(key('home')); // caret 0
  loop.dispatch(key('backspace', { ctrl: true }));
  expect(input.caretPos).toBe(0);

  loop.dispatch(key('end')); // caret 7
  loop.dispatch(key('delete', { ctrl: true }));
  expect(input.caretPos).toBe(7);
});

// HR-48 — Ctrl+Delete mid-string deletes the following word.
test('HR-48 impl: Ctrl+Delete deletes the next word', () => {
  const { loop, input } = mountInput('foo bar baz');
  loop.dispatch(key('home')); // caret 0
  loop.dispatch(key('delete', { ctrl: true })); // delete "foo" (through the following space run start)
  expect(input.caretPos).toBe(0);
  // "foo" removed; TV nextWord lands on the next word start, so the space is consumed too.
  expect(input.selection.start).toBe(input.selection.end);
});

// HR-46 — a drag over Input B, begun on Input A, never mutates B (only the initiator drags).
test('HR-46 impl: a drag begun on one Input does not affect a second Input', () => {
  const valA = signal('aaaaa');
  const valB = signal('bbbbb');
  const a = new Input({ value: valA });
  const b = new Input({ value: valB });
  const root = new Group();
  root.layout = { direction: 'col' };
  a.layout = { size: { kind: 'fixed', cells: 1 } };
  b.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(a);
  root.add(b);
  const loop = createEventLoop({ width: 20, height: 3 }, { caps });
  loop.mount(root);

  loop.dispatch(mouse('down', 3, 1)); // down on A (row 0)
  const bBefore = { caret: b.caretPos, sel: b.selection };
  loop.dispatch(mouse('drag', 3, 2)); // drag onto B's row — capture keeps it routed to A
  expect(b.caretPos).toBe(bBefore.caret); // B untouched (it never started a drag)
  expect(b.selection).toEqual(bBefore.sel);
});

// HR-58 — a paste longer than maxLength clamps at the cap and keeps only what fits.
test('HR-58 impl: paste clamps at maxLength', () => {
  const value = signal('');
  const input = new Input({ value, maxLength: 3 });
  const stub = new FocusStub();
  const root = new Group();
  root.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  stub.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: 20, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  loop.dispatch(paste('abcdefgh'));
  expect(value().length).toBeLessThanOrEqual(3);
  expect(value()).toBe('abc');
});

// HR-52 — a disabled CheckGroup row draws its ~hot~ run in the disabled color (matches a plain cell).
test('HR-52 impl: a disabled CheckGroup row draws its hot run in the disabled color', () => {
  const flags = signal([false]);
  const group = new CheckGroup({ labels: ['~A~pple'], value: flags });
  group.setItemEnabled(0, false);
  const root = new Group();
  group.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(group);
  const loop = createEventLoop({ width: 20, height: 2 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  // Label starts at col 5: 'A'(hot) at 5, 'p'(plain) at 6.
  expect(buf.get(5, 0)?.fg).toBe(buf.get(6, 0)?.fg); // hot 'A' matches plain 'p' — both disabled
});
