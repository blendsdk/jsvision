/**
 * Implementation tests — RD-06 `Button` edge cases (03-03).
 *
 * Release-outside cancels (the down/up press model), command + onClick both fire, a non-default
 * button ignores Enter, and a reactive `disabled` getter re-greys/-enables. Press-model edges are
 * driven at the `onEvent` level with crafted envelopes (a real loop won't deliver an outside `up`
 * to the button without pointer capture, which v1 omits — 03-03); behavior paths use the real loop.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Button } from '../src/controls/index.js';
import type { ButtonOptions } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** A bare envelope carrying an `emit` spy + view-local coords (as the loop would source them). */
function envelope(
  event: CoreMouseEvent | KeyEvent,
  emitted: string[],
  local?: { x: number; y: number },
): DispatchEvent {
  return { event, handled: false, local, emit: (c) => emitted.push(c) };
}

/** Give a button real bounds so `inFace` has a face to test against. */
function sizedButton(opts: ButtonOptions = {}): Button {
  const btn = new Button('~O~K', { command: 'ok', ...opts });
  btn.bounds = { x: 0, y: 0, width: 8, height: 2 };
  return btn;
}

class CommandSpy extends View {
  override postProcess = true;
  readonly commands: string[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

test('release-outside cancels: a down inside then up outside does not activate', () => {
  const emitted: string[] = [];
  let clicks = 0;
  const btn = sizedButton({ onClick: () => (clicks += 1) });
  btn.onEvent(envelope(mouse('down', 0, 0), emitted, { x: 1, y: 0 })); // press inside the face
  btn.onEvent(envelope(mouse('up', 0, 0), emitted, { x: 7, y: 1 })); // release on the shadow (outside)
  expect(emitted).toEqual([]);
  expect(clicks).toBe(0);
});

test('release-inside activates after a press (down then up inside)', () => {
  const emitted: string[] = [];
  let clicks = 0;
  const btn = sizedButton({ onClick: () => (clicks += 1) });
  btn.onEvent(envelope(mouse('down', 0, 0), emitted, { x: 1, y: 0 }));
  btn.onEvent(envelope(mouse('up', 0, 0), emitted, { x: 3, y: 0 })); // release inside the face
  expect(emitted).toEqual(['ok']);
  expect(clicks).toBe(1);
});

test('both command and onClick fire on a single activation', () => {
  const emitted: string[] = [];
  let clicks = 0;
  const btn = sizedButton({ onClick: () => (clicks += 1) });
  btn.state.focused = true;
  btn.onEvent(envelope(key('space'), emitted));
  expect(emitted).toEqual(['ok']);
  expect(clicks).toBe(1);
});

test('a non-default button ignores Enter', () => {
  const btn = new Button('~O~K', { command: 'ok' }); // default: false
  const spy = new CommandSpy();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  btn.setLayout({ size: { kind: 'fixed', cells: 2 } });
  spy.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(btn);
  root.add(spy);
  const loop = createEventLoop({ width: 8, height: 3 }, { caps });
  loop.mount(root);

  loop.focusView(btn);
  loop.dispatch(key('enter'));
  expect(spy.commands).toEqual([]); // Enter only activates a default button
});

test('a reactive disabled getter re-greys and re-enables the button', () => {
  const off = signal(false);
  const btn = new Button('~O~K', { command: 'ok', disabled: () => off() });
  const spy = new CommandSpy();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  btn.setLayout({ size: { kind: 'fixed', cells: 2 } });
  spy.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(btn);
  root.add(spy);
  const loop = createEventLoop({ width: 8, height: 3 }, { caps });
  loop.mount(root);

  // Initially enabled → Space (focused) activates.
  loop.focusView(btn);
  loop.dispatch(key('space'));
  expect(spy.commands).toEqual(['ok']);
  expect(btn.state.disabled).toBe(false);

  // Disable reactively → state.disabled flips and activation is inert.
  off.set(true);
  expect(btn.state.disabled).toBe(true);
  loop.dispatch(key('space'));
  expect(spy.commands).toEqual(['ok']); // unchanged — no new activation
});
