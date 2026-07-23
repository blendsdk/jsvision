/**
 * Implementation-edge tests for function-key fallback normalization and dispatch order.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { InputEvent, KeyEvent } from '@jsvision/core';
import { expect, test } from 'vitest';

import { createEventLoop } from '../src/event/index.js';
import { normalizeFunctionKey } from '../src/event/function-key-fallback.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

function key(name: string, modifiers: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...modifiers };
}

test('should remove printable metadata from a normalized alias', () => {
  const event = key('1', { alt: true, codepoint: 49 });
  expect(normalizeFunctionKey(event, 'number-row')).toStrictEqual({
    type: 'key',
    key: 'f1',
    ctrl: false,
    alt: false,
    shift: false,
  });
});

test('should preserve object identity outside the exact alias allowlist', () => {
  const inputs: readonly InputEvent[] = [
    key('1'),
    key('1', { alt: true, ctrl: true }),
    key('1', { alt: true, shift: true }),
    key('x', { alt: true }),
    { type: 'mouse', kind: 'down', button: 0, x: 1, y: 1 },
    { type: 'wheel', dir: 'down', x: 1, y: 1, ctrl: false, alt: false, shift: false },
    { type: 'paste', text: '1', truncated: false },
    { type: 'focus', focused: true },
  ];

  for (const input of inputs) {
    expect(normalizeFunctionKey(input, 'number-row')).toBe(input);
    expect(normalizeFunctionKey(input, 'none')).toBe(input);
  }
});

test('should leave command dispatch unchanged at the public event boundary', () => {
  class CommandSpy extends View {
    readonly commands: string[] = [];

    constructor() {
      super();
      this.postProcess = true;
      this.state.visible = false;
    }

    draw(_ctx: DrawContext): void {}

    override onEvent(event: DispatchEvent): void {
      if (event.event.type === 'command') this.commands.push(event.event.command);
    }
  }

  const spy = new CommandSpy();
  const root = new Group();
  root.add(spy);
  const loop = createEventLoop({ width: 10, height: 3 }, { caps, functionKeyFallback: 'number-row' });
  loop.mount(root);
  loop.dispatch({ type: 'command', command: '1' });
  expect(spy.commands).toStrictEqual(['1']);
});

test('should normalize before a keymap consumes the key', () => {
  let commands = 0;
  const loop = createEventLoop(
    { width: 10, height: 3 },
    {
      caps,
      functionKeyFallback: 'number-row',
      keymap: {
        lookup(event) {
          return event.key === 'f11' ? 'mapped' : undefined;
        },
      },
    },
  );
  loop.onCommand('mapped', () => {
    commands += 1;
  });
  loop.mount(new Group());
  loop.dispatch(key('-', { alt: true }));
  expect(commands).toBe(1);
});
