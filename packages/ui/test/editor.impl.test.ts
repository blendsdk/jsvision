/**
 * Implementation tests — RD-08 Phase-4 `Editor` edge cases (after green).
 *
 * Multi-click window boundaries (injected clock), overwrite at EOL/wide glyphs, prefix/modifier
 * corners through the live loop, deletion actions, persistent select, mouse clamp, wheel, paste
 * conversion, and the desiredCaret off-view guard.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent, WheelEvent, PasteEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Editor } from '../src/editor/editor.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

function wheel(dir: WheelEvent['dir'], x: number, y: number): WheelEvent {
  return { type: 'wheel', dir, x: x + 1, y: y + 1, shift: false, alt: false, ctrl: false };
}

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

test('multi-click: a second down past the 500 ms window stays a single click', () => {
  let t = 0;
  const { loop, ed } = mountEditor({ now: () => t });
  ed.setText('foo bar');
  loop.dispatch(mouse('down', 4, 0));
  loop.dispatch(mouse('up', 4, 0));
  t += 501; // just past the window
  loop.dispatch(mouse('down', 4, 0));
  loop.dispatch(mouse('up', 4, 0));
  expect(ed.hasSelection()).toBe(false); // no word snap
});

test('multi-click: a fourth click cycles back to a plain click', () => {
  let t = 0;
  const { loop, ed } = mountEditor({ now: () => t });
  ed.setText('foo bar\nsecond');
  for (let i = 0; i < 3; i++) {
    loop.dispatch(mouse('down', 4, 0));
    loop.dispatch(mouse('up', 4, 0));
    t += 100;
  }
  expect(ed.selectionText()).toBe('foo bar\n'); // triple → line
  loop.dispatch(mouse('down', 4, 0)); // fourth
  loop.dispatch(mouse('up', 4, 0));
  expect(ed.hasSelection()).toBe(false); // cycled back to single
});

test('multi-click: a different cell resets the count', () => {
  let t = 0;
  const { loop, ed } = mountEditor({ now: () => t });
  ed.setText('foo bar');
  loop.dispatch(mouse('down', 1, 0));
  loop.dispatch(mouse('up', 1, 0));
  t += 100;
  loop.dispatch(mouse('down', 5, 0)); // other cell within the window
  loop.dispatch(mouse('up', 5, 0));
  expect(ed.hasSelection()).toBe(false);
});

test('overwrite replaces a WIDE cluster whole and never splits it', () => {
  const { loop, ed } = mountEditor();
  ed.setText('漢x');
  loop.dispatch(key('insert')); // → overwrite
  loop.dispatch(key('a'));
  expect(ed.getText()).toBe('ax'); // the whole 漢 replaced
});

test('a prefix survives only one follow-up; typing resumes cleanly after an unknown', () => {
  const { loop, ed } = mountEditor();
  ed.setText('');
  loop.dispatch(key('q', { ctrl: true }));
  loop.dispatch(key('z')); // unknown — clears, consumed, no insert
  expect(ed.getText()).toBe('');
  loop.dispatch(key('z')); // now plain typing
  expect(ed.getText()).toBe('z');
});

test('deletion actions: delWord, delWordLeft, delStart, delEnd, delLine', () => {
  const { ed } = mountEditor({}, 20, 4);
  ed.setText('foo bar\nsecond line');
  ed.execute('delWord'); // from 0: deletes the "foo" run
  expect(ed.getText()).toBe(' bar\nsecond line');
  ed.execute('delEnd'); // to EOL
  expect(ed.getText()).toBe('\nsecond line');
  ed.execute('delLine'); // whole line incl. break
  expect(ed.getText()).toBe('second line');
  ed.execute('textEnd');
  ed.execute('delWordLeft');
  expect(ed.getText()).toBe('second ');
  ed.execute('delStart');
  expect(ed.getText()).toBe('');
});

test('startSelect arms persistent select; hideSelect collapses it (Ctrl-K B / H)', () => {
  const { loop, ed } = mountEditor({}, 20, 3);
  ed.setText('abcdef');
  loop.dispatch(key('k', { ctrl: true }));
  loop.dispatch(key('b')); // startSelect
  loop.dispatch(key('right'));
  loop.dispatch(key('right'));
  expect(ed.selectionText()).toBe('ab'); // extends without shift while selecting
  loop.dispatch(key('k', { ctrl: true }));
  loop.dispatch(key('h')); // hideSelect
  expect(ed.hasSelection()).toBe(false);
});

test('a click beyond the last line/col clamps to the nearest valid position', () => {
  const { loop, ed } = mountEditor({}, 12, 3);
  ed.setText('ab');
  loop.dispatch(mouse('down', 10, 2)); // beyond text on an empty row
  loop.dispatch(mouse('up', 10, 2));
  expect(ed.curPos()).toEqual({ line: 1, col: 3 }); // clamped to EOL of the only line
});

test('wheel scrolls three lines, clamped at the extent', () => {
  const { loop, ed } = mountEditor({}, 12, 3);
  ed.setText('a\nb\nc\nd\ne\nf\ng\nh');
  loop.dispatch(wheel('down', 2, 1));
  expect(ed.delta.y()).toBe(3);
  loop.dispatch(wheel('down', 2, 1));
  expect(ed.delta.y()).toBe(5); // 8 lines − 3 rows
  loop.dispatch(wheel('up', 2, 1));
  expect(ed.delta.y()).toBe(2);
});

test('a paste event inserts once, converted to the buffer EOL kind', () => {
  const { loop, ed } = mountEditor({}, 20, 4);
  ed.setText('a\r\nb');
  ed.execute('textEnd');
  const paste: PasteEvent = { type: 'paste', text: 'x\ny', truncated: false };
  loop.dispatch(paste);
  expect(ed.getText()).toBe('a\r\nbx\r\ny'); // LF converted to the crlf buffer kind
});

test('desiredCaret is null once the caret scrolls out of view', () => {
  const { ed } = mountEditor({}, 12, 3);
  ed.setText('a\nb\nc\nd\ne\nf');
  ed.execute('textStart'); // caret at (0,0)
  ed.delta.y.set(2); // scroll the caret above the viewport
  expect(ed.desiredCaret()).toBeNull();
});

test('scrollTo clamps hostile arguments', () => {
  const { ed } = mountEditor({}, 12, 3);
  ed.setText('a\nb');
  ed.scrollTo(-5, 99);
  expect(ed.delta.x()).toBe(0);
  expect(ed.delta.y()).toBe(0); // 2 lines < 3 rows → no vertical scroll possible
});

// Regression (2026-07-07 bug report): the decoder names 0x20 'space' (core keys.ts) — the typing
// branch must map it back to ' ' (the RD-06 Input idiom), and admit astral-plane printables.
test('the space bar types a space (decoder key name "space")', () => {
  const { loop, ed } = mountEditor();
  ed.setText('ab');
  loop.dispatch(key('right'));
  loop.dispatch(key('space'));
  expect(ed.getText()).toBe('a b');
  loop.dispatch(key('space', { shift: true })); // Shift+space still types (selectMode is moot mid-type)
  expect(ed.getText()).toBe('a  b');
});

test('an astral-plane printable key types as one cluster', () => {
  const { loop, ed } = mountEditor();
  loop.dispatch(key('👍')); // one code point, .length 2
  expect(ed.getText()).toBe('👍');
});
