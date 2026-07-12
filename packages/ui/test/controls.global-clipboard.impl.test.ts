/**
 * Implementation tests — global clipboard, Input internals & edges: wide-glyph selection copy, caret
 * placement after a cut, and the dual-sink independence boundary (the app-local buffer fills even when
 * the OS-clipboard write is a headless/incapable no-op). Complements the ST oracles in the spec file.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, CapabilityProfile } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal, effect, createRoot } from '../src/reactive/index.js';
import { Input, picture, range } from '../src/controls/index.js';
import { Commands } from '../src/status/index.js';

const base = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const capsClip: CapabilityProfile = { ...base, osc: { ...base.osc, clipboard52: true } };
const capsNoClip: CapabilityProfile = { ...base, osc: { ...base.osc, clipboard52: false } };

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

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

function mountInput(opts: ConstructorParameters<typeof Input>[0], caps = capsClip, w = 15) {
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
    { caps, commands: [...Object.values(Commands), '__read__', '__seed__'] },
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

test('copy carries a wide-glyph selection intact into the buffer', () => {
  const value = signal('漢字');
  const { loop, readClip } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true })); // select all
  loop.dispatch(key('c', { ctrl: true })); // copy
  expect(readClip()).toBe('漢字');
});

test('after a cut the caret sits at the start of the removed selection', () => {
  const value = signal('hello');
  const { loop, input } = mountInput({ value });
  loop.dispatch(key('a', { ctrl: true })); // select all
  loop.dispatch(key('x', { ctrl: true })); // cut
  expect(value()).toBe('');
  expect(input.caretPos).toBe(0);
});

test('the app-local buffer fills even when the OS clipboard write is an incapable no-op', () => {
  const value = signal('hi');
  const { loop, clip, readClip } = mountInput({ value }, capsNoClip); // terminal without OSC-52 clipboard
  loop.dispatch(key('a', { ctrl: true }));
  loop.dispatch(key('c', { ctrl: true }));
  expect(clip.length).toBe(0); // no OS write sequence emitted (capability-gated off)
  expect(readClip()).toBe('hi'); // but in-app paste still works — the buffer was filled unconditionally
});

test('paste through a picture mask drops the code points that do not fit', () => {
  const value = signal('');
  const { loop, seedClip } = mountInput({ value, validator: picture('###') });
  seedClip('1a2b3'); // only the digits fit the three-# mask
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('123');
});

test('paste through a range validator keeps only the valid digit run', () => {
  const value = signal('');
  const { loop, seedClip } = mountInput({ value, validator: range(0, 999) });
  seedClip('1x2y3');
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('123');
});

test('paste into the middle of a field leaves the caret after the inserted text', () => {
  const value = signal('ab');
  const { loop, input, seedClip } = mountInput({ value });
  seedClip('CD');
  loop.dispatch(key('right')); // caret between 'a' and 'b'
  loop.dispatch(key('v', { ctrl: true }));
  expect(value()).toBe('aCDb');
  expect(input.caretPos).toBe(3); // just past the inserted "CD"
});

test('a paste command on an event with no readClipboard seam is a harmless no-op', () => {
  const value = signal('keep');
  const input = new Input({ value }); // never mounted in a loop → no enriched seams
  input.onEvent({ event: { type: 'command', command: Commands.paste }, handled: false });
  expect(value()).toBe('keep'); // the `?.() ?? ''` guard yields an empty paste → nothing inserted
});

test('the reactive hasSelection signal fires on selection-only changes (no value edit)', () => {
  const value = signal('hello');
  const { loop, input } = mountInput({ value });
  const seen: boolean[] = [];
  let dispose = (): void => {};
  createRoot((d) => {
    dispose = d;
    // Track the reactive signal — an app binds this to grey Cut/Copy. It must react to selection
    // changes that never touch the bound value.
    effect(() => {
      seen.push(input.hasSelection());
    });
  });
  expect(seen).toEqual([false]); // initial run: fresh field, no selection

  loop.dispatch(key('a', { ctrl: true })); // select all — a selection appears, the value is untouched
  expect(value()).toBe('hello');
  expect(seen).toEqual([false, true]);

  loop.dispatch(key('right')); // a plain motion collapses the selection — value still untouched
  expect(value()).toBe('hello');
  expect(seen).toEqual([false, true, false]);
  dispose();
});
