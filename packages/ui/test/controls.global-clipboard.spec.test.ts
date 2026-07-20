/**
 * Specification tests (immutable oracles) — global clipboard, Input side (ST-8..ST-18, ST-20, ST-24).
 *
 * Source: global-clipboard 01/03-02/03-03 + 07. With the framework default keymap (`clipboardKeys`
 * defaults to `'both'`), a focused `Input` performs copy/cut/select-all on the modern chords and the
 * classic aliases; copy/cut mirror to the OS clipboard (OSC-52) AND fill the loop's app-local buffer
 * (the dual sink); an empty selection is a no-op; bracketed paste still inserts. This file holds the
 * Phase-1 oracles (copy/cut/select-all); the paste and gating oracles land with their phases.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, PasteEvent, CapabilityProfile } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { ClipboardKeys } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, Button, filter } from '../src/controls/index.js';
import { ComboBox } from '../src/dropdown/index.js';
import { Commands } from '../src/status/index.js';

const base = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const capsClip: CapabilityProfile = { ...base, osc: { ...base.osc, clipboard52: true } };

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function paste(text: string): PasteEvent {
  return { type: 'paste', text, truncated: false };
}

/** OSC-52 of `text` (base64), as core `setClipboard` builds it. */
function osc52(text: string): string {
  return `\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`;
}

/**
 * A focusable probe that reads or seeds the loop's app-local clipboard buffer via the per-event
 * seams: `__read__` captures `ev.readClipboard()`, `__seed__` writes `ev.setClipboard(arg)` (to stage
 * buffer content a test then pastes, without needing a second unconstrained field).
 */
class ClipProbe extends View {
  override focusable = true;
  lastRead = '';
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type !== 'command') return;
    if (ev.event.command === '__read__') this.lastRead = ev.readClipboard?.() ?? '';
    else if (ev.event.command === '__seed__') ev.setClipboard?.(String(ev.event.arg ?? ''));
  }
}

/**
 * Mount a focused `Input` plus a `ClipProbe`, capturing every OS-clipboard sequence the loop emits.
 * `clipboardKeys` defaults to undefined → the loop's `'both'`; pass `'none'` to disable the global
 * keymap. `readClip()` reads the app-local buffer and `seedClip(text)` fills it (both by routing a
 * harmless command to the probe and restoring focus afterward).
 */
function mountInput(
  opts: ConstructorParameters<typeof Input>[0],
  caps = capsClip,
  w = 15,
  clipboardKeys?: ClipboardKeys,
) {
  const input = new Input(opts);
  const probe = new ClipProbe();
  const root = new Group();
  root.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  probe.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(input);
  root.add(probe);
  const loop = createEventLoop(
    { width: w, height: 3 },
    { caps, clipboardKeys, commands: [...Object.values(Commands), '__read__', '__seed__'] },
  );
  const clip: string[] = [];
  loop.writeClipboard = (seq) => clip.push(seq);
  loop.mount(root);
  loop.focusView(input);
  const viaProbe = (command: string, arg?: unknown): void => {
    const prev = loop.getFocused();
    loop.focusView(probe);
    loop.emitCommand(command, arg);
    if (prev !== null) loop.focusView(prev);
  };
  const readClip = (): string => {
    viaProbe('__read__');
    return probe.lastRead;
  };
  const seedClip = (text: string): void => viaProbe('__seed__', text);
  return { loop, input, clip, readClip, seedClip };
}

// ST-8 — copy fires the dual sink: OS write AND the app-local buffer; the value is unchanged.
test('ST-8: Ctrl+C copies the selection to both the OS clipboard and the app-local buffer', () => {
  const value = signal('hello');
  const { loop, clip, readClip } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true })); // select all → [0,5]
  loop.dispatch(key('c', { ctrl: true })); // copy
  expect(clip.at(-1)).toBe(osc52('hello')); // OS clipboard write fired
  expect(readClip()).toBe('hello'); // app-local buffer filled
  expect(value()).toBe('hello'); // copy does not mutate
});

// ST-9 — cut fills the buffer and deletes the selection.
test('ST-9: Ctrl+X cuts — buffer holds the text, the field becomes empty', () => {
  const value = signal('hello');
  const { loop, readClip } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('x', { ctrl: true }));
  expect(readClip()).toBe('hello');
  expect(value()).toBe('');
});

// ST-10 — copy with an empty selection writes nothing to either sink.
test('ST-10: copy with an empty selection is a no-op (no OS write, buffer unchanged)', () => {
  const value = signal('hello');
  const { loop, clip, readClip } = mountInput({ value }); // no selection
  loop.dispatch(key('c', { ctrl: true }));
  expect(clip.length).toBe(0); // OS sink never called
  expect(readClip()).toBe(''); // buffer unchanged
  expect(value()).toBe('hello');
});

// ST-13 — a bracketed paste event still inserts (external-paste regression guard).
test('ST-13: a bracketed PasteEvent still inserts into the Input', () => {
  const value = signal('');
  const { loop } = mountInput({ value });
  loop.dispatch(paste('xyz'));
  expect(value()).toBe('xyz');
});

// ST-14 — Ctrl+A selects the whole value via the globalized select-all command.
test('ST-14: Ctrl+A selects the whole value', () => {
  const value = signal('hi');
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true }));
  expect(input.selection).toEqual({ start: 0, end: 2 });
});

// ST-16 — under the default 'both', the classic Ctrl+Insert alias still copies.
test('ST-16: the classic Ctrl+Insert alias still copies under the default', () => {
  const value = signal('hello');
  const { loop, clip, readClip } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true })); // select all
  loop.dispatch(key('insert', { ctrl: true })); // classic copy alias
  expect(clip.at(-1)).toBe(osc52('hello'));
  expect(readClip()).toBe('hello');
});

// ST-18 — clipboard commands to a focused non-editable widget are harmless no-ops.
test('ST-18: clipboard commands on a focused Button are harmless no-ops (no throw, no write)', () => {
  const button = new Button('OK', { command: 'ok' });
  const root = new Group();
  root.add(button);
  const loop = createEventLoop({ width: 12, height: 3 }, { caps: capsClip, commands: Object.values(Commands) });
  const clip: string[] = [];
  loop.writeClipboard = (seq) => clip.push(seq);
  loop.mount(root);
  loop.focusView(button);
  expect(() => {
    loop.emitCommand(Commands.copy);
    loop.emitCommand(Commands.cut);
    loop.emitCommand(Commands.paste);
    loop.emitCommand(Commands.selectAll);
  }).not.toThrow();
  expect(clip.length).toBe(0); // no editable widget consumed them → nothing written
});

// ST-11 — paste inserts the app-local buffer at the caret (here the buffer is filled by a prior cut).
test('ST-11: Ctrl+V pastes the app-local buffer, caret after the inserted text', () => {
  const value = signal('abc');
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true })); // select all
  loop.dispatch(key('x', { ctrl: true })); // cut → buffer "abc", field ""
  expect(value()).toBe('');
  loop.dispatch(key('v', { ctrl: true })); // paste
  expect(value()).toBe('abc');
  expect(input.caretPos).toBe(3);
});

// ST-12 — paste with an empty buffer is a no-op.
test('ST-12: Ctrl+V with an empty buffer leaves the value unchanged', () => {
  const value = signal('hi');
  const { loop } = mountInput({ value });
  loop.dispatch(key('v', { ctrl: true })); // nothing copied yet
  expect(value()).toBe('hi');
});

// ST-15 — paste inserts only the valid, in-cap code points (the existing applyPaste drop rule).
test('ST-15: paste drops invalid + over-cap code points through the validator and maxLength', () => {
  const value = signal('');
  const { loop, seedClip } = mountInput({ value, validator: filter('0-9'), maxLength: 3 });
  seedClip('1a2b3c'); // stage mixed content directly in the buffer
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('123'); // 'a'/'b'/'c' dropped by the filter; capped at 3
});

// ST-17 — a ComboBox (its field is an Input) inherits copy + paste with no widget-specific code.
test('ST-17: a ComboBox inherits copy then paste on its field', () => {
  const text = signal('Red');
  const combo = new ComboBox<string>({
    items: signal(['Red', 'Green']),
    getText: (s) => s,
    value: signal<string | null>(null), // no initial selection; this test only exercises the text field
    text,
  });
  combo.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 1 } };
  const root = new Group();
  root.add(combo);
  const loop = createEventLoop({ width: 20, height: 4 }, { caps: capsClip, commands: Object.values(Commands) });
  loop.mount(root);
  loop.focusView(combo.input);
  loop.dispatch(key('a', { ctrl: true })); // select-all the field
  loop.dispatch(key('c', { ctrl: true })); // copy "Red" → buffer
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('backspace')); // clear the field
  expect(text()).toBe('');
  loop.dispatch(key('v', { ctrl: true })); // paste
  expect(text()).toBe('Red');
});

// ST-20 — with the global keymap disabled ('none'), the widget's raw Ctrl+A still selects all.
test("ST-20: under clipboardKeys 'none', raw Ctrl+A still selects all via the widget fallback", () => {
  const value = signal('hello');
  const { loop, input } = mountInput({ value }, capsClip, 15, 'none');
  loop.dispatch(key('a', { ctrl: true })); // no global keymap → raw key → Input.handleKey selectAll
  expect(input.selection).toEqual({ start: 0, end: 5 });
});

// ST-24 — hasSelection() reports the queryable selection state the app uses to grey copy/cut.
test('ST-24: hasSelection() is false with no selection and true with one', () => {
  const value = signal('hello');
  const { loop, input } = mountInput({ value });
  expect(input.hasSelection()).toBe(false); // fresh field: selStart === selEnd
  loop.dispatch(key('a', { ctrl: true })); // select all
  expect(input.hasSelection()).toBe(true); // selStart < selEnd
  loop.dispatch(key('right')); // a plain motion collapses the selection
  expect(input.hasSelection()).toBe(false);
});
