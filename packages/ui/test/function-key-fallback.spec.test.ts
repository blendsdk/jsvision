/**
 * Specification tests for the application-level Alt number-row function-key fallback.
 */
import { Attr, resolveCapabilities } from '@jsvision/core';
import type { Cell, KeyEvent, ScreenBuffer } from '@jsvision/core';
import { expect, test } from 'vitest';

import { createApplication } from '../src/app/index.js';
import { Button } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import type { FunctionKeyFallback } from '../src/event/index.js';
import { item, menuBar, subMenu } from '../src/menu/index.js';
import { Group, View } from '../src/view/index.js';
import type { DispatchEvent, DrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

function key(name: string, modifiers: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...modifiers };
}

/** Capture key events after global routing. */
class KeySpy extends View {
  readonly keys: KeyEvent[] = [];

  constructor() {
    super();
    this.postProcess = true;
    this.state.visible = false;
  }

  draw(_ctx: DrawContext): void {}

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key') {
      this.keys.push(event.event);
    }
  }
}

function loopWithSpy(functionKeyFallback?: FunctionKeyFallback): {
  readonly loop: ReturnType<typeof createEventLoop>;
  readonly spy: KeySpy;
} {
  const spy = new KeySpy();
  const root = new Group();
  root.add(spy);
  const loop = createEventLoop(
    { width: 20, height: 5 },
    functionKeyFallback === undefined ? { caps, revealKey: null } : { caps, revealKey: null, functionKeyFallback },
  );
  loop.mount(root);
  return { loop, spy };
}

function findChar(buffer: ScreenBuffer, char: string): Cell | undefined {
  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      const cell = buffer.get(x, y);
      if (cell?.char === char) return cell;
    }
  }
  return undefined;
}

test('should map Alt+1 through Alt+= to unmodified F1 through F12 when enabled', () => {
  const { loop, spy } = loopWithSpy('number-row');
  const aliases = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  for (const alias of aliases) {
    loop.dispatch(key(alias, { alt: true }));
  }

  expect(spy.keys).toStrictEqual(
    aliases.map((_, index) => ({
      type: 'key',
      key: `f${index + 1}`,
      ctrl: false,
      alt: false,
      shift: false,
    })),
  );
});

test('should preserve aliases in a bare loop by default and under the explicit opt-out', () => {
  for (const policy of [undefined, 'none'] as const) {
    const { loop, spy } = loopWithSpy(policy);
    loop.dispatch(key('1', { alt: true }));
    expect(spy.keys).toStrictEqual([key('1', { alt: true })]);
  }
});

test('should preserve unrelated and additionally modified input', () => {
  const { loop, spy } = loopWithSpy('number-row');
  const events = [
    key('1'),
    key('1', { alt: true, ctrl: true }),
    key('1', { alt: true, shift: true }),
    key('x', { alt: true }),
  ];
  for (const event of events) loop.dispatch(event);
  expect(spy.keys).toStrictEqual(events);
});

test('should apply application fallback before keymap routing', () => {
  let calls = 0;
  const app = createApplication({
    caps,
    viewport: { width: 20, height: 5 },
    keymap: {
      lookup(event) {
        return event.key === 'f1' ? 'mapped-f1' : undefined;
      },
    },
  });
  app.onCommand('mapped-f1', () => {
    calls += 1;
  });
  app.loop.dispatch(key('1', { alt: true }));
  expect(calls).toBe(1);
});

test('should open the first application menu with Alt+0 exactly like F10', () => {
  function run(openKey: KeyEvent): number {
    let calls = 0;
    const app = createApplication({
      caps,
      viewport: { width: 30, height: 8 },
      menuBar: menuBar([subMenu('~F~ile', [item('~O~pen', 'open')])]),
    });
    app.onCommand('open', () => {
      calls += 1;
    });
    app.loop.dispatch(openKey);
    app.loop.dispatch(key('enter'));
    return calls;
  }

  expect(run(key('0', { alt: true }))).toBe(1);
  expect(run(key('f10'))).toBe(1);
});

test('should toggle accelerator reveal with Alt+= exactly like F12', () => {
  const button = new Button('~O~pen', { command: 'open' });
  const app = createApplication({
    caps,
    content: button,
    viewport: { width: 20, height: 5 },
  });
  app.loop.dispatch(key('=', { alt: true }));
  const cell = findChar(app.loop.renderRoot.buffer(), 'O');
  expect(cell !== undefined && (cell.attrs & Attr.underline) !== 0).toBe(true);
});
