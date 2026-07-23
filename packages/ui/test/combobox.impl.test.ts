/**
 * Implementation tests (edge cases / internals) — RD-14 `ComboBox<T>`.
 *
 * Companion to `combobox.spec.test.ts`: case-insensitive default filter, a custom filter predicate,
 * empty-text ⇒ all candidates, the `onSelect` callback, reactive `items` re-render while a select-only
 * popup is open, an injected `text` signal, and no-overlay-host / non-trigger no-ops.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { ComboBox } from '../src/dropdown/index.js';
import type { ComboBoxOptions } from '../src/dropdown/index.js';
import { ListView } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function type(loop: ReturnType<typeof createEventLoop>, s: string): void {
  for (const ch of s) loop.dispatch(key(ch));
}

interface Harness<T> {
  loop: ReturnType<typeof createEventLoop>;
  combo: ComboBox<T>;
  overlay: Group;
}

/** Build a mounted ComboBox app with the overlay + popup host wired. */
function makeCombo<T>(opts: Omit<ComboBoxOptions<T>, 'value'> & { value?: Signal<T | null> }): Harness<T> {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const combo = new ComboBox<T>({ ...opts, value: opts.value ?? signal<T | null>(null) });
  combo.setLayout({ position: 'absolute', rect: { x: 5, y: 3, width: 14, height: 1 } });
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(combo);
  root.add(overlay);
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  return { loop, combo, overlay };
}

function hostedList<T>(overlay: Group): ListView<T> | undefined {
  const frame = overlay.children.find((c): c is Group => c instanceof Group);
  return frame?.children.find((c): c is ListView<T> => c instanceof ListView);
}
function popupOpen(overlay: Group): boolean {
  return overlay.state.visible && overlay.children.some((c) => c instanceof Group);
}
const idn = (s: string): string => s;

test('the default filter is case-insensitive ("GR" matches "Green")', () => {
  const h = makeCombo({ items: signal(['Red', 'Green', 'Blue']), getText: idn, editable: true });
  h.loop.focusView(h.combo.input);
  type(h.loop, 'GR');
  expect(h.combo.filtered()).toStrictEqual(['Green']);
});

test('a custom filter predicate is honored (exact prefix, case-sensitive)', () => {
  const h = makeCombo({
    items: signal(['apple', 'Apricot', 'banana']),
    getText: idn,
    editable: true,
    filter: (item, text) => item.startsWith(text),
  });
  h.loop.focusView(h.combo.input);
  type(h.loop, 'ap');
  expect(h.combo.filtered()).toStrictEqual(['apple']); // 'Apricot' excluded (capital A)
});

test('empty editable text yields all items as candidates', () => {
  const h = makeCombo({ items: signal(['Red', 'Green', 'Blue']), getText: idn, editable: true });
  expect(h.combo.text()).toBe('');
  expect(h.combo.filtered()).toStrictEqual(['Red', 'Green', 'Blue']);
});

test('onSelect fires with the display index + item on pick', () => {
  const picks: Array<[number, string]> = [];
  const h = makeCombo({
    items: signal(['Apple', 'Banana', 'Cherry']),
    getText: idn,
    editable: false,
    onSelect: (index, item) => picks.push([index, item]),
  });
  h.loop.focusView(h.combo.input);
  h.loop.dispatch(key('down', { alt: true })); // open, focus index 0
  h.loop.dispatch(key('down')); // focus Banana (1)
  h.loop.dispatch(key('enter')); // pick
  expect(picks).toStrictEqual([[1, 'Banana']]);
});

test('select-only: mutating items re-renders the open popup (reactive list source)', () => {
  const items = signal(['Apple', 'Banana']);
  const h = makeCombo({ items, getText: idn, editable: false });
  h.loop.focusView(h.combo.input);
  h.loop.dispatch(key('down', { alt: true })); // open
  const list = hostedList<string>(h.overlay);
  expect(list).toBeDefined();

  items.set(['Apple', 'Banana', 'Cherry']); // add while open
  h.loop.renderRoot.flush();
  const buf = h.loop.renderRoot.buffer();
  expect(buf.get(6, 5)?.char).toBe('C'); // the new 'Cherry' row painted at interior row 3 (y=5)
});

test('an injected text signal is the one edited (shared two-way binding)', () => {
  const text = signal('seed');
  const h = makeCombo({ items: signal(['seedling']), getText: idn, editable: true, text });
  h.loop.focusView(h.combo.input);
  type(h.loop, 'x'); // caret starts at column 0 on a pre-seeded field → inserts at the front
  expect(text()).toBe('xseed'); // the injected signal received the edit (shared two-way)
});

test('opening with no overlay host is a safe no-op', () => {
  const h = makeCombo({ items: signal(['Red']), getText: idn, editable: true });
  h.loop.popupHost = undefined;
  h.loop.focusView(h.combo.input);
  expect(() => h.loop.dispatch(key('down', { alt: true }))).not.toThrow();
  expect(popupOpen(h.overlay)).toBe(false);
});
