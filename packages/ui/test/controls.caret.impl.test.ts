/**
 * Implementation tests — RD-07 logical caret internals + edges (P1.4) + the hardware-caret run()
 * wiring (P5.2). The ST-13 oracle pins the caret position + reversed style; these cover the caret at
 * the value end (space glyph), the caret-vs-`►` right-edge overlap (PF-008 — the caret preserves the
 * arrow glyph, reversing colours), `desiredCaret()` returning `null` off-screen / unfocused, and the
 * `run()` cursor-sequence output: the focused Input's absolute cell is written to the terminal after
 * each frame, re-applied on host resume, and OSC-52 clipboard sequences stream to the same output.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, cursor } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createApplication } from '../src/app/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { FakeRuntimeAdapter, CaptureStream, FakeInput } from './app-shell.fixtures.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', altScreen: true, osc: { clipboard52: true } },
}).profile;

/** The unambiguous caret write run() emits for the Input at absolute (6,3) → 1-based row 4, col 7. */
const CARET_AT_FIELD = cursor.show() + cursor.to(4, 7);

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}
/** A subclass exposing `desiredCaret()` (already public via View) + mounting helper. */
function mountInput(opts: ConstructorParameters<typeof Input>[0], w = 10) {
  const input = new Input(opts);
  const stub = new FocusStub();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  stub.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: w, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  return { loop, input, stub };
}

test('the caret at the value end paints a reversed space (no char beyond the end)', () => {
  const value = signal('ab');
  const { loop } = mountInput({ value }, 10);
  loop.dispatch(key('end')); // curPos 2 (== length) → caret col 3, no char there
  const buf = loop.renderRoot.buffer();
  expect(buf.get(3, 0)?.char).toBe(' ');
  expect(buf.get(3, 0)?.bg).toBe(defaultTheme.inputSelected.fg); // reversed → bg = field.fg
});

// PF-008 — caret coincides with the ► arrow column: the arrow glyph is preserved, colours reversed.
test('PF-008: the caret over the ► column preserves ► and reverses its colours', () => {
  const value = signal('123456789');
  const { loop } = mountInput({ value }, 6);
  for (let i = 0; i < 4; i++) loop.dispatch(key('right')); // curPos 4, firstPos 0 → caret col 5 (== w-1)
  const buf = loop.renderRoot.buffer();
  expect(buf.get(5, 0)?.char).toBe('►'); // arrow glyph kept (not erased by the caret)
  expect(buf.get(5, 0)?.bg).toBe(defaultTheme.inputSelected.fg); // reversed caret colours
});

test('desiredCaret() returns the view-local caret cell when focused, null when unfocused', () => {
  const value = signal('abcd');
  const { loop, input, stub } = mountInput({ value }, 10);
  loop.dispatch(key('right')); // curPos 1 → caret col 2
  expect(input.desiredCaret()).toEqual({ x: 2, y: 0 });
  loop.focusView(stub);
  expect(input.desiredCaret()).toBeNull();
});

test('desiredCaret() returns null when the caret scrolls out of the field width', () => {
  const value = signal('123456789');
  const { loop, input } = mountInput({ value }, 6);
  // Scroll right via ► clicks while the caret stays at 0 → caret col can leave [0, w). Simulate by
  // clicking the ► arrow twice (firstPos advances, curPos stays 0 → caret col 0-firstPos+1 goes < 0).
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 6, y: 1 }); // firstPos 1
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 6, y: 1 }); // firstPos 2 → caret col -1
  expect(input.desiredCaret()).toBeNull();
});

// --- run() hardware-caret wiring (P5.2) ------------------------------------------------------------
/** Compose an app with an absolutely-placed focusable Input, wired to fake OS doubles. */
function makeAppWithInput() {
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  const value = signal('');
  const field = new Input({ value });
  field.setLayout({ position: 'absolute', rect: { x: 5, y: 3, width: 10, height: 1 } });
  const app = createApplication({
    warnAmbiguousWidth: false,
    caps,
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    viewport: { width: 40, height: 12 },
  });
  app.desktop.add(field);
  return { app, runtime, output, field, value };
}

test('run() writes the focused Input absolute caret cell to the terminal (show + move)', async () => {
  const { app, output, field } = makeAppWithInput();
  const runP = app.run();
  app.loop.focusView(field); // curPos 0 → local {x:1,y:0}; origin (5,3) → absolute {x:6,y:3}
  // The combined show+move is unique to run()'s caret write (serialize never emits ?25h).
  expect(output.data).toContain(CARET_AT_FIELD);
  app.loop.emitCommand('quit');
  await runP;
});

test('run() re-applies the last caret sequence on host resume (SIGCONT)', async () => {
  const { app, runtime, output, field } = makeAppWithInput();
  const runP = app.run();
  app.loop.focusView(field);
  const before = output.countOf(CARET_AT_FIELD);
  runtime.emit('continue'); // host re-asserts modes + repaints, then onResume re-positions the cursor
  expect(output.countOf(CARET_AT_FIELD)).toBe(before + 1);
  app.loop.emitCommand('quit');
  await runP;
});

test('run() hides the cursor when no view requests a caret', async () => {
  const { app, output } = makeAppWithInput();
  const runP = app.run(); // nothing focused into the Input yet → the initial refreshCaret hides it
  expect(output.data).toContain(cursor.hide());
  app.loop.emitCommand('quit');
  await runP;
});

test('run() streams an OSC-52 clipboard sequence to the output on copy', async () => {
  const { app, output, field, value } = makeAppWithInput();
  const runP = app.run();
  value.set('hello'); // setValue() is protected — drive the field through its bound two-way signal instead
  app.loop.focusView(field);
  app.loop.dispatch({ type: 'key', key: 'a', ctrl: true, alt: false, shift: false }); // select-all
  const before = output.data.length;
  app.loop.dispatch({ type: 'key', key: 'insert', ctrl: true, alt: false, shift: false }); // copy (Ctrl+Ins, TV)
  // OSC-52 clipboard write starts with the "\x1b]52;" introducer.
  expect(output.data.slice(before)).toContain('\x1b]52;');
  app.loop.emitCommand('quit');
  await runP;
});
