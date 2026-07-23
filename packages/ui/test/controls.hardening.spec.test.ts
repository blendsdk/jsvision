/**
 * Specification tests (immutable oracles) — controls & input-editor hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-43…HR-60, plan docs 03-08-controls-input.md + 07-testing-strategy.md
 * (ST-8.a–m). TV-derived oracles additionally defer to the GATE-1 decode of the cited `.cpp`. Driven
 * through the real loop / render root; expectations derive from the RD/AC + the C++, never the impl.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent, PasteEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, Button, CheckGroup, MultiCheckGroup, Text } from '../src/controls/index.js';
import { picture } from '../src/controls/validators/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}
function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false }; // this fixture never exercises the size-cap path
}

/** A focusable no-draw stub — the "other dialog control" for dialog-wide-hotkey / drag-guard cases. */
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

/** Mount `view` above a focus stub in a fixed-row column; focus the view unless `focusStub`. */
function mount(view: View, w: number, h: number, focusStub = false): ReturnType<typeof createEventLoop> {
  const stub = new FocusStub();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  view.setLayout({ size: { kind: 'fixed', cells: h } });
  stub.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(view);
  root.add(stub);
  const loop = createEventLoop({ width: w, height: h + 1 }, { caps });
  loop.mount(root);
  loop.focusView(focusStub ? stub : view);
  return loop;
}

// ST-8.a — bracketed paste of two-line text with a tab: no control chars reach the bound signal.
test('ST-8.a: paste maps \\t\\r\\n to spaces (no control chars in the value) — HR-43', () => {
  const value = signal('');
  const input = new Input({ value });
  const loop = mount(input, 20, 1);
  loop.dispatch(paste('a\tb\r\nc'));
  expect(value()).toBe('a b  c'); // \t→space, \r→space, \n→space
  expect(/[\t\r\n]/.test(value())).toBe(false);
});

// ST-8.b — Alt+hotkey while another control is focused: the cluster selects+presses and takes focus.
test('ST-8.b: Alt+hotkey toggles a non-focused CheckGroup and gives it focus — HR-44', () => {
  const flags = signal([false, false]);
  const group = new CheckGroup({ labels: ['~A~pple', '~B~anana'], value: flags });
  const loop = mount(group, 20, 2, true); // focus the stub, NOT the group
  loop.dispatch(key('b', { alt: true })); // dialog-wide Alt+B
  expect(flags()[1]).toBe(true); // Banana toggled on
  expect(loop.getFocused()).toBe(group); // the cluster took focus
});

// ST-8.c — picture autoFill appends trailing literals but the caret only advances past the typed char.
test('ST-8.c: caret advances past the typed char, not the trailing autoFill — HR-45', () => {
  const value = signal('a');
  const input = new Input({ value, validator: picture('@@--') });
  const loop = mount(input, 20, 1);
  loop.dispatch(key('b')); // caret 0, type b → "ba" → autoFill "ba--"
  expect(input.caretPos).toBe(1); // just past the typed 'b', NOT at the trailing '--'
});

// ST-8.d — a drag this Input never initiated does not mutate its selection/caret.
test('ST-8.d: a foreign drag leaves the Input selection/caret unchanged — HR-46', () => {
  const value = signal('hello world');
  const input = new Input({ value });
  const loop = mount(input, 20, 1);
  loop.dispatch(key('end')); // caret at 11
  const before = { caret: input.caretPos, sel: input.selection };
  loop.dispatch(mouse('drag', 3, 1)); // a drag with no preceding down on this Input
  expect(input.caretPos).toBe(before.caret);
  expect(input.selection).toEqual(before.sel);
});

// ST-8.e — a delete that would break a picture mask is reverted (validator consulted on deletions).
test('ST-8.e: a mask-breaking Backspace is reverted — HR-47', () => {
  const value = signal('(12');
  const input = new Input({ value, validator: picture('(###)###-####') });
  const loop = mount(input, 20, 1);
  loop.dispatch(key('right')); // caret → 1 (just past the '(')
  loop.dispatch(key('backspace')); // would delete '(' → "12", which breaks the mask
  expect(value()).toBe('(12'); // reverted — the delete was rejected
});

// ST-8.f — Ctrl+Backspace deletes to the previous word boundary.
test('ST-8.f: Ctrl+Backspace deletes the previous word — HR-48', () => {
  const value = signal('foo bar');
  const input = new Input({ value });
  const loop = mount(input, 20, 1);
  loop.dispatch(key('end')); // caret at 7
  loop.dispatch(key('backspace', { ctrl: true })); // delete back to the word boundary
  expect(value()).toBe('foo ');
});

// ST-8.g — a disabled Button draws its ~hot~ run in the disabled role (not the bright accent).
test('ST-8.g: a disabled Button draws its hot run in the disabled color — HR-52', () => {
  const enabled = new Button('~O~K', { disabled: false });
  const disabled = new Button('~O~K', { disabled: true });
  const le = mount(enabled, 12, 2);
  const ld = mount(disabled, 12, 2);
  le.renderRoot.flush();
  ld.renderRoot.flush();
  const hotCell = (loop: ReturnType<typeof createEventLoop>): { x: number; fg: unknown } => {
    const buf = loop.renderRoot.buffer();
    for (let x = 0; x < 12; x += 1) {
      const c = buf.get(x, 0);
      if (c?.char === 'O') return { x, fg: c.fg };
    }
    throw new Error('O not found');
  };
  const plainCell = (loop: ReturnType<typeof createEventLoop>, ox: number): unknown =>
    loop.renderRoot.buffer().get(ox + 1, 0)?.fg; // the 'K' just right of 'O'
  const e = hotCell(le);
  const d = hotCell(ld);
  expect(e.fg).not.toBe(plainCell(le, e.x)); // enabled: hot 'O' differs from plain 'K' (bright accent)
  expect(d.fg).toBe(plainCell(ld, d.x)); // disabled: hot 'O' matches plain 'K' (both disabled color)
});

// ST-8.h — an edit between two clicks on the same cell disarms the double-click select-all.
test('ST-8.h: an edit resets the double-click window (no select-all on re-click) — HR-54', () => {
  const value = signal('abcdefgh');
  const input = new Input({ value });
  const loop = mount(input, 20, 1);
  loop.dispatch(mouse('down', 6, 1)); // click cell (local.x 5)
  loop.dispatch(mouse('up', 6, 1));
  loop.dispatch(key('X')); // an edit — disarms the double-click substitute
  loop.dispatch(mouse('down', 6, 1)); // click the same cell again
  expect(input.selection.start).toBe(input.selection.end); // NO select-all (empty selection)
});

// ST-8.i — a Button click at column 0 is inert; column 1 activates (clickRect.a.x++).
test('ST-8.i: Button column 0 is inert, column 1 activates — HR-56', () => {
  let clicks = 0;
  const button = new Button('~O~K', { onClick: () => (clicks += 1) });
  const loop = mount(button, 12, 2);
  loop.dispatch(mouse('down', 1, 1)); // local.x 0 — the inert shadow edge
  loop.dispatch(mouse('up', 1, 1));
  expect(clicks).toBe(0);
  loop.dispatch(mouse('down', 2, 1)); // local.x 1 — inside the face
  loop.dispatch(mouse('up', 2, 1));
  expect(clicks).toBe(1);
});

// ST-8.j — Text preserves internal whitespace + leading indentation verbatim.
test('ST-8.j: Text renders internal whitespace + indentation verbatim — HR-57', () => {
  const t = new Text('a  b');
  const loop = mount(t, 20, 2);
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  const row = [0, 1, 2, 3].map((x) => buf.get(x, 0)?.char);
  expect(row).toEqual(['a', ' ', ' ', 'b']); // the double space is kept

  const indented = new Text('  x');
  const loop2 = mount(indented, 20, 2);
  loop2.renderRoot.flush();
  const buf2 = loop2.renderRoot.buffer();
  expect([0, 1, 2].map((x) => buf2.get(x, 0)?.char)).toEqual([' ', ' ', 'x']); // indent kept
});

// ST-8.k — an insert whose autoFill would exceed maxLength clamps and accepts the typed char.
test('ST-8.k: an over-maxLength insert clamps and accepts what fits — HR-58', () => {
  const value = signal('');
  const input = new Input({ value, maxLength: 1, validator: picture('#-') });
  const loop = mount(input, 20, 1);
  loop.dispatch(key('5')); // "5" → autoFill "5-" (len 2 > maxLength 1) → clamp to "5", accept
  expect(value()).toBe('5'); // the typed digit is accepted (not rejected wholesale)
});

// ST-8.l — a shorter external value clamps the ENTIRE selection tuple, not just the caret.
test('ST-8.l: a shorter external value clamps the whole selection — HR-59', () => {
  const value = signal('abcdef');
  const input = new Input({ value });
  const loop = mount(input, 20, 1);
  loop.dispatch(key('a', { ctrl: true })); // select all → selEnd = 6
  value.set('ab'); // shorter external write
  loop.renderRoot.flush();
  expect(input.selection.end).toBeLessThanOrEqual(2);
  expect(input.selection.start).toBeLessThanOrEqual(2);
  expect(input.caretPos).toBeLessThanOrEqual(2);
});

// ST-8.m — MultiCheckGroup.press normalizes a negative externally-bound state into range.
test('ST-8.m: press normalizes a negative bound state via floored modulo — HR-60', () => {
  const states = signal([-3]);
  const group = new MultiCheckGroup({ items: ['~A~'], states: ' xX', value: states });
  const loop = mount(group, 12, 1);
  loop.dispatch(key('space')); // press(0): (((-3+1)%3)+3)%3 = 1
  expect(states()[0]).toBeGreaterThanOrEqual(0);
  expect(states()[0]).toBeLessThan(3);
});
