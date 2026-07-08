/**
 * Implementation tests (edges/internals) — jsvision-ui RD-21 `ColorPicker` (written AFTER impl).
 *
 * Covers the no-host guard, drag-preview-not-close vs commit-on-release, a hex reject (filter) + a hex
 * commit (parse), `allowCustom:false`, and the chip caption via `nameFor`. The `.js` extension in import
 * specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { Color, KeyEvent, MouseEvent } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { absoluteRect } from '../src/dropdown/index.js';
import { ColorPicker } from '../src/color/color-picker.js';
import { ColorSwatch } from '../src/color/color-swatch.js';
import { Input } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const key = (k: string, m: Partial<KeyEvent> = {}): KeyEvent => ({
  type: 'key',
  key: k,
  ctrl: false,
  alt: false,
  shift: false,
  ...m,
});
const mouse = (kind: MouseEvent['kind'], x: number, y: number): MouseEvent => ({
  type: 'mouse',
  kind,
  button: 0,
  x,
  y,
});

function find<T extends View>(root: View, pred: (v: View) => v is T): T | undefined {
  if (pred(root)) return root;
  if (root instanceof Group)
    for (const c of root.children) {
      const h = find(c, pred);
      if (h) return h;
    }
  return undefined;
}
const findSwatch = (o: View) => find(o, (v): v is ColorSwatch => v instanceof ColorSwatch);
const findHex = (o: View) => find(o, (v): v is Input => v instanceof Input);
const popupOpen = (o: Group) => o.state.visible && o.children.some((c) => c instanceof Group);

function make(opts: { value?: Color; allowCustom?: boolean; nameFor?: (c: Color) => string; withHost?: boolean } = {}) {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const value = signal<Color>(opts.value ?? 'red');
  const picker = new ColorPicker({ value, allowCustom: opts.allowCustom, nameFor: opts.nameFor });
  picker.layout = { position: 'absolute', rect: { x: 5, y: 3, width: 16, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(picker);
  root.add(overlay);
  loop.mount(root);
  if (opts.withHost !== false)
    loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() } as PopupHost;
  loop.renderRoot.flush();
  return { loop, picker, overlay, value };
}
function open(h: ReturnType<typeof make>): ColorSwatch {
  h.loop.focusView(h.picker);
  h.loop.dispatch(key('down'));
  h.loop.renderRoot.flush();
  return findSwatch(h.overlay)!;
}
const swatchCell = (sw: ColorSwatch, i: number, cols = 4) => {
  const r = absoluteRect(sw);
  return { x: r.x + (i % cols) * 3 + 1, y: r.y + Math.floor(i / cols) + 1 };
};

test('the no-host open is a silent no-op (does not throw, no popup)', () => {
  const h = make({ withHost: false });
  h.loop.focusView(h.picker);
  expect(() => h.loop.dispatch(key('down'))).not.toThrow();
  expect(popupOpen(h.overlay)).toBe(false);
});

test('a drag ending OUTSIDE the grid does not commit and keeps the popup open', () => {
  const h = make({ value: 'black' });
  const sw = open(h);
  const a = swatchCell(sw, 2);
  h.loop.dispatch(mouse('down', a.x, a.y)); // preview cell 2
  h.loop.dispatch(mouse('move', 39, 19)); // drag far outside
  h.loop.dispatch(mouse('up', 39, 19)); // release outside → no commit
  expect(h.value(), 'no commit on release outside a cell').toBe('black');
  expect(popupOpen(h.overlay), 'popup stays open after a null release').toBe(true);
});

test('the hex filter rejects non-hex characters (invalid never enters the field)', () => {
  const h = make({ value: 'red' });
  open(h);
  const hex = findHex(h.overlay)!;
  h.loop.dispatch(key('tab'));
  h.loop.renderRoot.flush();
  const before = hex.getValueSignal()();
  // A typed non-hex char is rejected by the filter validator (isValidInput('g') === false).
  h.loop.dispatch(key('g'));
  expect(hex.getValueSignal()(), 'the "g" was filtered out').toBe(before);
  expect(h.value(), 'value unchanged by the rejected keystroke').toBe('red');
});

test('a complete valid hex commits to value; a short #rgb also parses', () => {
  const h = make({ value: 'red' });
  open(h);
  const hex = findHex(h.overlay)!;
  h.loop.dispatch(key('tab'));
  h.loop.renderRoot.flush();
  hex.getValueSignal().set('#0af'); // short form, valid
  h.loop.renderRoot.flush();
  expect(h.value(), 'a #rgb sets value').toBe('#0af');
});

test('allowCustom:false hosts no hex Input', () => {
  const h = make({ value: 'red', allowCustom: false });
  open(h);
  expect(findHex(h.overlay)).toBeUndefined();
  expect(findSwatch(h.overlay)).toBeInstanceOf(ColorSwatch);
});

test('the chip caption uses nameFor(value)', () => {
  const h = make({ value: 'red', nameFor: (c) => `N-${c}` });
  const buffer = h.loop.renderRoot.buffer();
  // caption starts at chip-local col 3 → abs col 8, row 3.
  let caption = '';
  for (let x = 8; x < 8 + 5; x += 1) caption += buffer.get(x, 3)?.char ?? '';
  expect(caption, 'chip caption via nameFor').toBe('N-red');
});

// ── IT-1: the picker forwards its own onInput (live) / onChange (commit) through the hosted swatch ──

test('IT-1: live nav forwards the picker onInput; a commit forwards onChange exactly once + closes', () => {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const value = signal<Color>('black'); // swatch cursor inits to cell 0
  const inputs: Color[] = [];
  const commits: Color[] = [];
  const picker = new ColorPicker({ value, onInput: (c) => inputs.push(c), onChange: (c) => commits.push(c) });
  picker.layout = { position: 'absolute', rect: { x: 5, y: 3, width: 16, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(picker);
  root.add(overlay);
  loop.mount(root);
  loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() } as PopupHost;
  loop.renderRoot.flush();

  loop.focusView(picker);
  loop.dispatch(key('down')); // open the popup
  loop.renderRoot.flush();
  loop.dispatch(key('right')); // live nav → cell 1 (red)
  expect(inputs.at(-1), 'live nav forwarded the picker onInput').toBe('red');
  expect(commits, 'no onChange fires during live nav').toEqual([]);
  loop.dispatch(key('enter')); // commit at the cursor
  expect(commits, 'the commit forwarded the picker onChange exactly once').toEqual(['red']);
  expect(popupOpen(overlay), 'the popup closed on commit').toBe(false);
});
