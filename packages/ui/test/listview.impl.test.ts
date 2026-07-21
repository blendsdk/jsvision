/**
 * Implementation tests — RD-11 `ListView`/`ListRows` internals & edges (03-04).
 *
 * Covers the empty `<empty>` render, type-ahead buffer reset on focus-move + Backspace shrink, sorted
 * not mutating the source signal (PF-003), the focused clamp on shrink, and the security surfaces
 * (out-of-range focused is bounds-safe; an escape-laden item string renders inert via `sanitize`).
 * Real `View`/`EventLoop`. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ListView } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}

function hosted<T>(list: ListView<T>, w: number, h: number) {
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  return loop;
}

// An empty list draws "<empty>" top-left (TV emptyText).
test('empty list renders <empty>', () => {
  const list = new ListView<string>({ items: signal<string[]>([]), getText: (s) => s });
  const rr = createRenderRoot({ width: 12, height: 4 }, { caps });
  rr.mount(list);
  // HR-51: TV draws emptyText at column 1 (the text inset), not column 0.
  expect(rr.buffer().get(0, 0)?.char).toBe(' ');
  const row = [1, 2, 3, 4, 5, 6, 7].map((x) => rr.buffer().get(x, 0)?.char).join('');
  expect(row).toBe('<empty>');
});

// Type-ahead accumulates a prefix, Backspace shrinks it, and a focus-move (arrow) resets it.
test('type-ahead accumulates, Backspace shrinks, and an arrow resets the buffer', () => {
  const items = signal(['apple', 'apricot', 'banana', 'cherry']);
  const focused = signal(0);
  const list = new ListView<string>({ items, getText: (s) => s, focused, typeAhead: true });
  const loop = hosted(list, 14, 6);

  loop.dispatch(key('b')); // 'b' ⇒ 'banana' (index 2)
  expect(focused()).toBe(2);
  loop.dispatch(key('down')); // focus-move resets the buffer + moves to 'cherry' (3)
  expect(focused()).toBe(3);
  loop.dispatch(key('a')); // fresh buffer 'a' ⇒ 'apple' (0), NOT 'ba…'
  expect(focused()).toBe(0);
  loop.dispatch(key('p')); // 'ap' ⇒ still 'apple' (0)
  loop.dispatch(key('r')); // 'apr' ⇒ 'apricot' (1)
  expect(focused()).toBe(1);
  loop.dispatch(key('backspace')); // 'ap' ⇒ back to 'apple' (0)
  expect(focused()).toBe(0);
});

// Sorted display does NOT mutate the source items signal (PF-003 foot-gun documented).
test('sorted leaves the source items signal in source order', () => {
  const items = signal(['Charlie', 'alpha', 'Bravo']);
  const list = new ListView<string>({ items, getText: (s) => s, sorted: true });
  const rr = createRenderRoot({ width: 14, height: 5 }, { caps });
  rr.mount(list);
  // Display is sorted (row 0 = 'alpha'), but the source signal is untouched.
  expect(rr.buffer().get(1, 0)?.char).toBe('a');
  expect(items()).toEqual(['Charlie', 'alpha', 'Bravo']);
});

// Focused clamps when the list shrinks below the focused index (TV newList).
test('focused clamps into range when the items shrink', () => {
  const items = signal(['a', 'b', 'c', 'd', 'e']);
  const focused = signal(4);
  const list = new ListView<string>({ items, getText: (s) => s, focused });
  const loop = hosted(list, 12, 6);
  expect(focused()).toBe(4);
  items.set(['a', 'b']);
  loop.renderRoot.flush();
  expect(focused()).toBe(1); // clamped to range-1
});

// Security: a forced out-of-range focused never indexes past the items (bounds-safe render).
test('security: an out-of-range focused signal is bounds-safe', () => {
  const items = signal(['a', 'b', 'c']);
  const focused = signal(99999);
  const list = new ListView<string>({ items, getText: (s) => s, focused });
  const rr = createRenderRoot({ width: 10, height: 4 }, { caps });
  expect(() => rr.mount(list)).not.toThrow();
  // Rows render normally (no crash, no undefined access): items a/b/c on rows 0..2.
  expect(rr.buffer().get(1, 0)?.char).toBe('a');
  expect(rr.buffer().get(1, 2)?.char).toBe('c');
});

// Security: an escape-laden item string renders inert (sanitized) — no raw ESC reaches the buffer.
test('security: an escape-laden item string renders inert', () => {
  const items = signal(['\x1b[31mX', 'ok']);
  const list = new ListView<string>({ items, getText: (s) => s });
  const rr = createRenderRoot({ width: 12, height: 4 }, { caps });
  rr.mount(list);
  for (let x = 0; x < 12; x += 1) {
    expect(rr.buffer().get(x, 0)?.char).not.toBe('\x1b');
  }
});
