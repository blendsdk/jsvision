/**
 * Implementation tests (edges) — accelerator-overlay armed mode + synth-alt fire.
 *
 * Source: accelerator-overlay/07-testing-strategy.md — IT-1 (re-entrancy: the synthesized `alt:true`
 * event cannot re-enter the armed branch, so a plain letter fires exactly once and the tick
 * terminates), IT-5 (an armed plain `f` opens the `~F~ile` top menu via synth-alt → MenuBar
 * preProcess and dismisses accelerator mode in the same tick), IT-6 (an armed no-match letter
 * dismisses and changes nothing). Real `EventLoop`/`Application`; synthetic events drive dispatch.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, Attr } from '@jsvision/core';
import type { KeyEvent, Cell, ScreenBuffer } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createApplication } from '../src/app/index.js';
import { Button } from '../src/controls/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function findChar(buf: ScreenBuffer, ch: string): Cell | undefined {
  for (let y = 0; y < buf.height; y += 1) {
    for (let x = 0; x < buf.width; x += 1) {
      const cell = buf.get(x, y);
      if (cell?.char === ch) return cell;
    }
  }
  return undefined;
}
function underlined(cell: Cell | undefined): boolean {
  return cell !== undefined && (cell.attrs & Attr.underline) !== 0;
}

// IT-1 — the synthesized `alt:true` event cannot re-trigger the armed branch: an armed plain letter
// fires the accelerator exactly ONCE (no infinite re-arm loop) and the dispatch tick terminates.
test('IT-1: re-entrancy — an armed plain letter fires exactly once', () => {
  let activations = 0;
  const btn = new Button('~O~pen', { onClick: () => (activations += 1) });
  const root = new Group();
  root.layout = { direction: 'col' };
  btn.layout = { size: { kind: 'fixed', cells: 2 } };
  root.add(btn);
  const loop = createEventLoop({ width: 12, height: 3 }, { caps });
  loop.mount(root);

  loop.dispatch(key('f12')); // arm
  loop.dispatch(key('o')); // synth-alt fire — must not re-enter the armed branch
  expect(activations).toBe(1); // fired exactly once, tick terminated
});

// IT-5 — an armed plain `f` opens the `~F~ile` top menu (synth-alt → MenuBar preProcess) and
// dismisses accelerator mode within the same tick (no residual underline).
test('IT-5: armed `f` opens the File menu and dismisses accelerator mode', () => {
  const bar = menuBar([subMenu('~F~ile', [item('~N~ew', 'new')])]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width: 30, height: 10 } });
  app.loop.renderRoot.flush();

  app.loop.dispatch(key('f12')); // arm
  expect(bar.controller?.isOpen()).not.toBe(true); // menu still closed
  expect(underlined(findChar(app.loop.renderRoot.buffer(), 'F'))).toBe(true); // revealed

  app.loop.dispatch(key('f')); // armed plain 'f' → synth-alt opens File + dismisses
  expect(bar.controller?.isOpen()).toBe(true); // File menu opened
  expect(underlined(findChar(app.loop.renderRoot.buffer(), 'F'))).toBe(false); // mode dismissed
});

// IT-6 — an armed letter with no matching accelerator dismisses and changes nothing on screen (the
// composed frame returns to its pre-arm resting state; no command fires).
test('IT-6: an armed no-match letter dismisses and changes nothing', () => {
  const commands: string[] = [];
  class CommandSpy extends View {
    constructor() {
      super();
      this.postProcess = true;
      this.state.visible = false;
    }
    draw(_ctx: DrawContext): void {}
    override onEvent(ev: DispatchEvent): void {
      if (ev.event.type === 'command') commands.push(ev.event.command);
    }
  }
  const btn = new Button('~O~pen', { command: 'open' });
  const root = new Group();
  root.layout = { direction: 'col' };
  btn.layout = { size: { kind: 'fixed', cells: 2 } };
  root.add(btn);
  root.add(new CommandSpy());
  const loop = createEventLoop({ width: 12, height: 3 }, { caps });
  loop.mount(root);

  loop.dispatch(key('f12')); // arm (reveal on)
  loop.dispatch(key('z')); // no accelerator matches 'z' → dismiss, nothing fires

  expect(commands).toEqual([]); // nothing fired
  const oCell = findChar(loop.renderRoot.buffer(), 'O');
  expect(oCell).toBeDefined(); // the button is still drawn normally
  expect(underlined(oCell)).toBe(false); // no residual underline — back to the resting look
});
