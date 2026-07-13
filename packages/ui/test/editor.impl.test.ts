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
import type { ClipboardKeys } from '../src/event/index.js';
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

// The multi-click clock now lives on the loop (the framework's single source of truth); the harness
// accepts `now` and injects it into `createEventLoop` so the same-cell double-click window stays
// deterministic (AR-14 — only the injection point moves; assertions are unchanged).
function mountEditor(
  opts: ConstructorParameters<typeof Editor>[0] & { now?: () => number; clipboardKeys?: ClipboardKeys } = {},
  w = 12,
  h = 3,
) {
  const { now, clipboardKeys, ...editorOpts } = opts;
  const ed = new Editor(editorOpts);
  const root = new Group();
  root.layout = { direction: 'col' };
  ed.layout = { size: { kind: 'fr', weight: 1 } };
  root.add(ed);
  // clipboardKeys defaults to undefined → the loop's 'both'; a WordStar-mode test passes 'none' so the
  // global keymap does not shadow the WordStar Ctrl+C/X/V navigation chords.
  const loop = createEventLoop({ width: w, height: h }, { caps, now, clipboardKeys });
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

test('multi-click: a fifth consecutive same-cell click wraps to word again (((cc-1)%3)+1)', () => {
  let t = 0;
  const { loop, ed } = mountEditor({ now: () => t });
  ed.setText('foo bar\nsecond');
  // Five same-cell downs each within the window → loop clickCount 1..5; the editor's wrap maps
  // cc=5 → ((5-1)%3)+1 = 2 → word snap, proving the cyclic re-wrap (D2), not a raw pass-through.
  for (let i = 0; i < 5; i++) {
    loop.dispatch(mouse('down', 4, 0));
    loop.dispatch(mouse('up', 4, 0));
    t += 100;
  }
  expect(ed.selectionText()).toBe('bar'); // 5th → word again
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

// --- Modern Ctrl+X/C/V/A overlay (default binding set) ------------------------------------------
test('modern default: Ctrl+A selects all, Ctrl+C copies to the clipboard editor', () => {
  const clipboard = new Editor();
  const { loop, ed } = mountEditor({ clipboard });
  ed.setText('hello');
  loop.dispatch(key('a', { ctrl: true }));
  expect(ed.selectionText()).toBe('hello');
  loop.dispatch(key('c', { ctrl: true }));
  expect(clipboard.getText()).toBe('hello');
});

test('modern default: Ctrl+X cuts the selection out of the editor', () => {
  const clipboard = new Editor();
  const { loop, ed } = mountEditor({ clipboard });
  ed.setText('hello');
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('x', { ctrl: true }));
  expect(ed.getText()).toBe('');
  expect(clipboard.getText()).toBe('hello');
});

test('modern default: Ctrl+V pastes the clipboard selection at the caret', () => {
  const clipboard = new Editor();
  clipboard.setText('world');
  clipboard.setSelect(0, 5, false); // the clipboard holds 'world' selected (the copy invariant)
  const { loop, ed } = mountEditor({ clipboard });
  ed.setText('');
  loop.dispatch(key('v', { ctrl: true }));
  expect(ed.getText()).toBe('world');
});

test('modern default: Ctrl+Shift+C also copies (kitty-protocol alias)', () => {
  const clipboard = new Editor();
  const { loop, ed } = mountEditor({ clipboard });
  ed.setText('hey');
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true, shift: true }));
  expect(clipboard.getText()).toBe('hey');
});

test('modern default: Ctrl+Z undoes and Ctrl+Y redoes an edit', () => {
  const { loop, ed } = mountEditor();
  ed.setText('');
  loop.dispatch(key('h')); // type one char = one undo step
  expect(ed.getText()).toBe('h');
  loop.dispatch(key('z', { ctrl: true })); // undo
  expect(ed.getText()).toBe('');
  loop.dispatch(key('y', { ctrl: true })); // redo
  expect(ed.getText()).toBe('h');
});

test("keyBindings:'wordstar': Ctrl+Y deletes the line (not redo), Ctrl+U undoes", () => {
  const { loop, ed } = mountEditor({ keyBindings: 'wordstar' });
  ed.setText('one\ntwo');
  loop.dispatch(key('y', { ctrl: true })); // WordStar cmDelLine
  expect(ed.getText()).toBe('two');
  loop.dispatch(key('u', { ctrl: true })); // WordStar cmUndo restores the line
  expect(ed.getText()).toBe('one\ntwo');
});

test("keyBindings:'wordstar' keeps the faithful decode (Ctrl+C = pageDown, not copy)", () => {
  const clipboard = new Editor();
  // A WordStar app opts out of the global clipboard keymap ('none'), so Ctrl+C/X/V reach the editor as
  // the raw WordStar navigation chords instead of being globalized to copy/cut/paste commands.
  const { loop, ed } = mountEditor({ clipboard, keyBindings: 'wordstar', clipboardKeys: 'none' }, 12, 3);
  ed.setText('a\nb\nc\nd\ne');
  loop.dispatch(key('a', { ctrl: true })); // WordStar: selectAll (same in both sets)
  loop.dispatch(key('c', { ctrl: true })); // WordStar: cmPageDown — must NOT copy
  expect(clipboard.getText()).toBe('');
});

test("keyBindings:'wordstar' Ctrl+K K still copies (the block prefix is never overlaid)", () => {
  const clipboard = new Editor();
  const { loop, ed } = mountEditor({ clipboard, keyBindings: 'wordstar' });
  ed.setText('block');
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('k', { ctrl: true })); // arm Ctrl-K
  loop.dispatch(key('k')); // block copy
  expect(clipboard.getText()).toBe('block');
});

test('modern default: Ctrl-K prefix survives (overlay is idle-only)', () => {
  const clipboard = new Editor();
  const { loop, ed } = mountEditor({ clipboard });
  ed.setText('kept');
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('k', { ctrl: true })); // arm Ctrl-K even in modern mode
  loop.dispatch(key('c')); // Ctrl-K then 'c' = block paste (prefix not overlaid) — no crash, prefix cleared
  expect(ed.keyState).toBe(0);
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
