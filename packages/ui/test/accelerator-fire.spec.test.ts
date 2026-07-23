/**
 * Specification tests (immutable oracles) — accelerator-overlay armed mode + synth-alt fire.
 *
 * Source: accelerator-overlay/07-testing-strategy.md — ST-2 (arm → a plain letter fires like Alt),
 * ST-3 (F12 toggles), ST-4 (fire is modal-scoped), ST-5 (dismiss: Esc/other-key/click leave no
 * residual), ST-7 (an open menu owns plain letters), ST-8 (`revealKey` null/override), ST-9
 * (collision resolves in Alt dispatch order), ST-10 (a StatusLine Alt-item fires, a Ctrl-chord does
 * not). Realizes FR-2…FR-5, FR-7, FR-8 (AR-1/3/4/5/7/10).
 *
 * NOT TV-derived. Real `EventLoop`/`RenderRoot`; synthetic key/mouse events drive dispatch; command
 * effects are recorded by a post-process spy and reveal is read off the composed buffer's underline
 * bit. Expectations derive from the FRs/ARs, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, Attr } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent, Cell, ScreenBuffer } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createApplication } from '../src/app/index.js';
import { Button } from '../src/controls/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';
import { statusLine, statusItem } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
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

/** A post-process spy that records the command names routed to it. */
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

/** A post-process spy that records the raw key names routed to it (proves consume-vs-passthrough). */
class KeySpy extends View {
  readonly keys: string[] = [];
  constructor() {
    super();
    this.postProcess = true;
    this.state.visible = false;
  }
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key') this.keys.push(ev.event.key);
  }
}

/** A `~O~pen` Button (postProcess) + command/key spies in a plain loop; `revealKey` optional. */
function fireApp(revealKey?: string | null): {
  loop: ReturnType<typeof createEventLoop>;
  spy: CommandSpy;
  keySpy: KeySpy;
} {
  const btn = new Button('~O~pen', { command: 'open' });
  const spy = new CommandSpy();
  const keySpy = new KeySpy();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  btn.setLayout({ size: { kind: 'fixed', cells: 2 } }); // give the button drawable rows (for the reveal check)
  root.add(btn);
  root.add(spy);
  root.add(keySpy);
  const loop = createEventLoop({ width: 12, height: 4 }, revealKey === undefined ? { caps } : { caps, revealKey });
  loop.mount(root);
  return { loop, spy, keySpy };
}

// ST-2 / FR-2 / AR-4 — arm, then a plain letter fires the matching accelerator like Alt+letter, and
// the mode dismisses (no residual underline).
test('ST-2: armed, a plain letter fires the accelerator and dismisses the mode', () => {
  const { loop, spy } = fireApp();
  loop.dispatch(key('f12')); // arm
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(true); // overlay revealed

  loop.dispatch(key('o')); // plain letter → synth-alt fire
  expect(spy.commands).toEqual(['open']); // fired exactly as Alt+O would
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(false); // dismissed, no residual
});

// ST-3 / FR-3 / AR-1/AR-10 — F12 toggles the overlay on, a second F12 toggles it off.
test('ST-3: F12 toggles accelerator mode on then off', () => {
  const { loop } = fireApp();
  loop.dispatch(key('f12'));
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(true);
  loop.dispatch(key('f12'));
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(false); // no residual underline
});

// ST-4 / FR-4 / AR-5 — while a modal is open, an armed plain letter fires ONLY the modal's
// accelerator; a background accelerator (outside the dispatch scope) never fires.
test('ST-4: armed fire is clamped to the modal dispatch scope', () => {
  const bg = new Button('~O~pen', { command: 'open-bg' }); // background (out of scope)
  const modalBtn = new Button('~O~pen', { command: 'open-modal' });
  const modalSpy = new CommandSpy();
  const modal = new Group();
  modal.add(modalBtn);
  modal.add(modalSpy);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.add(bg);
  root.add(modal);
  const loop = createEventLoop({ width: 12, height: 6 }, { caps });
  loop.mount(root);
  void loop.execView(modal); // open the modal → dispatch scope = modal subtree

  loop.dispatch(key('f12')); // arm (scope = modal)
  loop.dispatch(key('o')); // plain letter fire
  expect(modalSpy.commands).toEqual(['open-modal']); // only the modal's Open fired; bg never did
});

// ST-5 / FR-5 / AR-3 — each of Esc / a non-accelerator letter / a click dismisses the mode with no
// residual underline. Esc is consumed; the other-key and the click dispatch normally.
test('ST-5a: Esc dismisses and is consumed (never reaches a view)', () => {
  const { loop, keySpy } = fireApp();
  loop.dispatch(key('f12'));
  loop.dispatch(key('escape'));
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(false); // dismissed, no residual
  expect(keySpy.keys).not.toContain('escape'); // consumed by the intercept
});

test('ST-5b: a non-accelerator letter dismisses and dispatches normally (nothing fires)', () => {
  const { loop, spy, keySpy } = fireApp();
  loop.dispatch(key('f12'));
  loop.dispatch(key('z')); // no accelerator matches 'z'
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(false); // dismissed
  expect(keySpy.keys).toContain('z'); // still dispatched to views
  expect(spy.commands).toEqual([]); // nothing fired
});

test('ST-5c: a mouse click dismisses the mode', () => {
  const { loop } = fireApp();
  loop.dispatch(key('f12'));
  loop.dispatch(mouse('down', 1, 1)); // a click
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(false); // dismissed
});

// ST-7 / FR-7 / AR-7 — opening a menu dismisses accelerator mode; while the menu is open a plain
// letter routes to the menu item (controller.itemHotkey), not a synth-alt accelerator fire.
test('ST-7: an open menu owns plain letters (accelerator mode dismissed)', () => {
  const bar = menuBar([subMenu('~F~ile', [item('~N~ew', 'new')])]);
  const app = createApplication({ caps, menuBar: bar, viewport: { width: 30, height: 10 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();

  app.loop.dispatch(key('f12')); // arm
  expect(underlined(findChar(app.loop.renderRoot.buffer(), 'F'))).toBe(true); // ~F~ile revealed

  app.loop.dispatch(key('f')); // armed plain 'f' → synth-alt opens File + dismisses
  expect(underlined(findChar(app.loop.renderRoot.buffer(), 'F'))).toBe(false); // mode dismissed

  app.loop.dispatch(key('n')); // routes to the open menu's ~N~ew item, not a synth-alt fire
  expect(spy.commands).toContain('new');
});

// ST-8 / FR-8 / AR-10 — `revealKey: null` disables the feature entirely; `revealKey: 'f9'` moves the
// trigger to F9 (and F12 is then just a normal key).
test('ST-8a: revealKey null disables the mode — F12 does nothing and dispatches normally', () => {
  const { loop, keySpy } = fireApp(null);
  loop.dispatch(key('f12'));
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(false); // no mode
  expect(keySpy.keys).toContain('f12'); // dispatched normally (no intercept)
});

test('ST-8b: revealKey f9 moves the trigger — F9 toggles, F12 does not', () => {
  const { loop, keySpy } = fireApp('f9');
  loop.dispatch(key('f12')); // not the trigger → no mode, dispatched normally
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(false);
  expect(keySpy.keys).toContain('f12');

  loop.dispatch(key('f9')); // the configured trigger → arm
  expect(underlined(findChar(loop.renderRoot.buffer(), 'O'))).toBe(true);
});

// ST-9 / AR-4 (collision) — two `~O~pen` accelerators in one scope: an armed plain letter fires the
// first in dispatch order, identical to dispatching Alt+O in the same tree.
test('ST-9: a collision resolves in Alt dispatch order (first wins)', () => {
  function twoButtons(): { loop: ReturnType<typeof createEventLoop>; spy: CommandSpy } {
    const b1 = new Button('~O~pen', { command: 'open1' });
    const b2 = new Button('~O~pen', { command: 'open2' });
    const spy = new CommandSpy();
    const root = new Group();
    root.setLayout({ direction: 'col' });
    root.add(b1);
    root.add(b2);
    root.add(spy);
    const loop = createEventLoop({ width: 12, height: 6 }, { caps });
    loop.mount(root);
    return { loop, spy };
  }
  // Reference: a real Alt+O in the same tree.
  const ref = twoButtons();
  ref.loop.dispatch(key('o', { alt: true }));
  expect(ref.spy.commands.length).toBe(1);

  // Armed plain 'o' reproduces the exact same single fire.
  const armed = twoButtons();
  armed.loop.dispatch(key('f12'));
  armed.loop.dispatch(key('o'));
  expect(armed.spy.commands).toEqual(ref.spy.commands);
});

// ST-10 / FR-2 / AR-9 — a StatusLine reveals both `~X~` accents; an armed plain letter fires an
// Alt-letter item (Alt+S), but NOT a Ctrl-chord item (Ctrl+Q) — the documented limitation.
test('ST-10: an armed letter fires a StatusLine Alt-item, not a Ctrl-chord item', () => {
  const status = statusLine([statusItem('~S~ave', 'save', 'Alt+S'), statusItem('~Q~uit', 'quitcmd', 'Ctrl+Q')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 30, height: 10 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();

  app.loop.dispatch(key('f12')); // arm → both accents revealed
  expect(underlined(findChar(app.loop.renderRoot.buffer(), 'S'))).toBe(true);
  expect(underlined(findChar(app.loop.renderRoot.buffer(), 'Q'))).toBe(true);

  app.loop.dispatch(key('s')); // Alt+S matches → Save fires
  expect(spy.commands).toContain('save');

  app.loop.dispatch(key('f12')); // re-arm
  app.loop.dispatch(key('q')); // Ctrl+Q cannot be matched by a synth-alt letter → no fire
  expect(spy.commands).not.toContain('quitcmd');
});
