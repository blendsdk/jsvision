/**
 * Implementation tests — StatusItemView + StatusLine internals not pinned by the spec oracles:
 * natural-size measurement (static + accessor), the pressed/enabled draw-style matrix, and that
 * command-less items are skipped by both hit-testing and the accelerator sweep.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { statusLine, statusItem, StatusItemView } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}
class CommandSpy extends View {
  readonly commands: string[] = [];
  constructor() {
    super();
    this.postProcess = true;
    this.state.visible = false;
  }
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

test('measure(): natural width = display text length + 2 pad columns, one row (static + accessor)', () => {
  expect(statusItem('~Q~uit', 'quit').measure()).toEqual({ width: 6, height: 1 }); // "Quit" (4) + 2
  expect(statusItem(() => 'ABCDE').measure()).toEqual({ width: 7, height: 1 }); // accessor value (5) + 2
  expect(statusItem('').measure()).toEqual({ width: 2, height: 1 }); // empty label → the two pads
});

test('the pressed/enabled draw matrix picks the right span colours', () => {
  const item = statusItem('Ok', 'ok'); // no tilde → the whole span draws in the base/selected style
  const app = createApplication({ caps, statusLine: statusLine([item]), viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();
  const y = app.desktop.bounds.height + app.desktop.bounds.y;
  const cell = (): { fg?: string; bg?: string } => ({
    fg: app.loop.renderRoot.buffer().get(1, y)?.fg,
    bg: app.loop.renderRoot.buffer().get(1, y)?.bg,
  });

  // enabled, not pressed → statusBar (black on lightGray)
  expect(cell()).toEqual({ fg: '#000000', bg: '#aaaaaa' });

  // pressed, enabled → statusSelected (black on green)
  item.pressed = true;
  item.invalidate();
  app.loop.renderRoot.flush();
  expect(cell()).toEqual({ fg: '#000000', bg: '#00aa00' });

  // pressed, disabled → greyed fg on the selected (green) bg
  item.isEnabled = (): boolean => false;
  item.invalidate();
  app.loop.renderRoot.flush();
  expect(cell()).toEqual({ fg: '#555555', bg: '#00aa00' });

  // not pressed, disabled → greyed fg on the statusBar bg
  item.pressed = false;
  item.invalidate();
  app.loop.renderRoot.flush();
  expect(cell()).toEqual({ fg: '#555555', bg: '#aaaaaa' });
});

test('a command-less item is not a click target — the click falls through, no emit', () => {
  const passive = statusItem('Note'); // command-less; span [0,6)
  const active = statusItem('~E~dit', 'edit'); // span [6,12)
  const app = createApplication({
    caps,
    statusLine: statusLine([passive, active]),
    viewport: { width: 40, height: 12 },
  });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();
  const y = app.desktop.bounds.height + app.desktop.bounds.y;

  // press + release over the passive item → nothing emitted
  app.loop.dispatch(mouse('down', 2, y));
  app.loop.dispatch(mouse('up', 2, y));
  expect(spy.commands).toEqual([]);

  // press + release over the command item → its command emits (proves the bar still works)
  app.loop.dispatch(mouse('down', 8, y));
  app.loop.dispatch(mouse('up', 8, y));
  expect(spy.commands).toEqual(['edit']);
});

test('the accelerator sweep skips a command-less item even when it carries a key', () => {
  const passive = statusItem('Hint', undefined, 'Alt+H'); // command-less but keyed
  const app = createApplication({ caps, statusLine: statusLine([passive]), viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();

  app.loop.dispatch(key('h', { alt: true }));
  expect(spy.commands).toEqual([]); // no command → never emitted

  // Sanity: the same view is not classified as a StatusItemView command item.
  expect(passive instanceof StatusItemView).toBe(true);
  expect(passive.command).toBeUndefined();
});
