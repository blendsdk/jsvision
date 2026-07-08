/**
 * Specification tests (immutable oracles) — `EventLoop.onCommand`, the first-class command handler.
 *
 * A handler registered for a named command runs when that command is emitted; many handlers may
 * register for one command and all fire; a fired command is consumed (`ev.handled`), so a matching
 * view downstream does not also receive it; and the returned unsubscribe function stops the handler.
 *
 * Expectations derive from the requirements, never the implementation.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A focusable leaf that records the last command it received via its own `onEvent`. */
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

/** Build a mounted loop over a single focusable leaf. */
function mountLoop(): { loop: ReturnType<typeof createEventLoop>; leaf: CommandLeaf } {
  const leaf = new CommandLeaf();
  const root = new Group();
  root.add(leaf);
  const loop = createEventLoop({ width: 10, height: 4 }, { caps });
  loop.mount(root);
  loop.focusView(leaf);
  return { loop, leaf };
}

// ST-6 — a registered handler runs exactly once when its command is emitted.
test('should call a registered onCommand handler exactly once when the command is emitted', () => {
  const { loop } = mountLoop();
  let calls = 0;
  loop.onCommand('greet', () => {
    calls += 1;
  });
  loop.emitCommand('greet');
  expect(calls).toBe(1);
});

// ST-7 — every handler registered for a command fires.
test('should fire every handler registered for the same command', () => {
  const { loop } = mountLoop();
  const fired: string[] = [];
  loop.onCommand('greet', () => fired.push('a'));
  loop.onCommand('greet', () => fired.push('b'));
  loop.emitCommand('greet');
  expect(fired.sort()).toEqual(['a', 'b']);
});

// ST-8 — the unsubscribe function stops the handler.
test('should not call a handler after its unsubscribe function runs', () => {
  const { loop } = mountLoop();
  let calls = 0;
  const off = loop.onCommand('greet', () => {
    calls += 1;
  });
  off();
  loop.emitCommand('greet');
  expect(calls).toBe(0);
});

// ST-10 — a fired command is consumed, so a matching focused view does not also receive it.
test('should consume a handled command so a matching view does not receive it', () => {
  const { loop, leaf } = mountLoop();
  loop.onCommand('greet', () => {
    /* handled by the sink */
  });
  loop.emitCommand('greet');
  expect(leaf.received).toBeNull(); // the sink consumed it before the focused leaf

  // A command with no handler still routes to the focused view as before.
  loop.emitCommand('other');
  expect(leaf.received).toBe('other');
});
