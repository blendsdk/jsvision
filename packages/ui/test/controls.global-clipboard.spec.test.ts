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
import { signal } from '../src/reactive/index.js';
import { Input, Button } from '../src/controls/index.js';
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

/** A focusable probe that captures the loop's `readClipboard` seam from any command it receives. */
class ClipProbe extends View {
  override focusable = true;
  lastRead = '';
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.lastRead = ev.readClipboard?.() ?? '';
  }
}

/**
 * Mount a focused `Input` plus a `ClipProbe`, capturing every OS-clipboard sequence the loop emits.
 * The loop uses the default keymap (no `clipboardKeys` → `'both'`). `readClip()` reads the loop's
 * app-local buffer by routing a harmless command to the probe and restoring focus afterward.
 */
function mountInput(opts: ConstructorParameters<typeof Input>[0], caps = capsClip, w = 15) {
  const input = new Input(opts);
  const probe = new ClipProbe();
  const root = new Group();
  root.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  probe.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(input);
  root.add(probe);
  const loop = createEventLoop({ width: w, height: 3 }, { caps, commands: [...Object.values(Commands), '__read__'] });
  const clip: string[] = [];
  loop.writeClipboard = (seq) => clip.push(seq);
  loop.mount(root);
  loop.focusView(input);
  const readClip = (): string => {
    const prev = loop.getFocused();
    loop.focusView(probe);
    loop.emitCommand('__read__');
    if (prev !== null) loop.focusView(prev);
    return probe.lastRead;
  };
  return { loop, input, clip, readClip };
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
