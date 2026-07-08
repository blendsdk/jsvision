/**
 * Implementation tests — the command sink's handler isolation, unsubscribe, and ordering internals.
 *
 * Covers behaviors the spec oracles imply but do not exhaustively pin: one throwing handler neither
 * skips its siblings nor un-consumes the command; unsubscribe is idempotent; a handler may unsubscribe
 * itself mid-fire; and all handlers fire in registration order.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A focusable leaf that records the last command it received. */
class CommandLeaf extends View {
  received: string | null = null;
  constructor() {
    super();
    this.focusable = true;
  }
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.received = ev.event.command;
  }
}

function mountLoop(): { loop: ReturnType<typeof createEventLoop>; leaf: CommandLeaf } {
  const leaf = new CommandLeaf();
  const root = new Group();
  root.add(leaf);
  const loop = createEventLoop({ width: 10, height: 4 }, { caps });
  loop.mount(root);
  loop.focusView(leaf);
  return { loop, leaf };
}

test('should keep firing siblings and consume the command when one handler throws', () => {
  const { loop, leaf } = mountLoop();
  const fired: string[] = [];
  loop.onCommand('x', () => {
    fired.push('a');
    throw new Error('boom'); // isolated: must not skip b or leave the command unconsumed
  });
  loop.onCommand('x', () => fired.push('b'));

  loop.emitCommand('x');

  expect(fired).toEqual(['a', 'b']); // the sibling still ran despite the throw
  expect(leaf.received).toBeNull(); // the command was consumed, not left to fall through
});

test('should be a safe no-op when unsubscribe is called more than once', () => {
  const { loop } = mountLoop();
  let calls = 0;
  const off = loop.onCommand('x', () => {
    calls += 1;
  });
  off();
  expect(() => off()).not.toThrow(); // double-unsubscribe is idempotent
  loop.emitCommand('x');
  expect(calls).toBe(0);
});

test('should let a handler unsubscribe itself during its own fire', () => {
  const { loop } = mountLoop();
  const fired: string[] = [];
  const off = loop.onCommand('x', () => {
    fired.push('self');
    off(); // remove self mid-fire — the snapshot keeps this pass intact
  });
  loop.onCommand('x', () => fired.push('sibling'));

  loop.emitCommand('x');
  expect(fired).toEqual(['self', 'sibling']); // both fired on the first pass

  loop.emitCommand('x');
  expect(fired).toEqual(['self', 'sibling', 'sibling']); // self no longer fires; sibling still does
});

test('should fire all handlers for a command in registration order', () => {
  const { loop } = mountLoop();
  const order: string[] = [];
  loop.onCommand('x', () => order.push('first'));
  loop.onCommand('x', () => order.push('second'));
  loop.onCommand('x', () => order.push('third'));
  loop.emitCommand('x');
  expect(order).toEqual(['first', 'second', 'third']);
});
