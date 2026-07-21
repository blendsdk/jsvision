/**
 * Specification tests (immutable oracles) — Navigation router · Phase 0 ChromeHost (ST-3, ST-4).
 *
 * Source: 07-testing-strategy.md ST-3/ST-4 (R-3 / AR-21). `createApplication` implements a minimal
 * ChromeHost over the real StatusLine/MenuBar and hands it to a `ChromeHostAware` content. Swapping
 * status items or menu items takes effect live (menu rebuilds its controller); `null` restores the
 * app base. Expectations derive from the spec, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { statusLine, statusItem } from '../src/status/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';
import type { ChromeHost, ChromeHostAware } from '../src/router/types.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** A hidden post-process view that records the command names routed to it. */
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

/** A minimal ChromeHost-aware body that captures the host so a test can drive chrome swaps. */
class RouterStub extends Group implements ChromeHostAware {
  chrome: ChromeHost | null = null;
  attachChromeHost(host: ChromeHost): void {
    this.chrome = host;
  }
}

// ST-3 — a status swap replaces the bar's items live and activates them; null restores the base.
test('ST-3: ChromeHost.setStatus swaps status items live; null restores the base', () => {
  const base = statusLine([statusItem('~H~ Help', 'help', 'Alt+H')]);
  const body = new RouterStub();
  const spy = new CommandSpy();
  body.add(spy);
  const app = createApplication({ caps, content: body, statusLine: base, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  const host = body.chrome;
  expect(host).not.toBeNull();

  const alpha = statusItem('~A~ Alpha', 'alpha', 'Alt+A');
  const beta = statusItem('~B~ Beta', 'beta', 'Alt+B');
  host!.setStatus([alpha, beta]);
  app.loop.renderRoot.flush();

  // The status line now holds exactly the swapped-in items…
  expect(base.children).toEqual([alpha, beta]);
  // …and they are wired: their accelerator emits.
  app.loop.dispatch(key('a', { alt: true }));
  expect(spy.commands).toContain('alpha');
  expect(spy.commands).not.toContain('help');

  // Restoring the base brings the original item back, activatable again.
  host!.setStatus(null);
  app.loop.renderRoot.flush();
  expect(base.children).not.toContain(alpha);
  app.loop.dispatch(key('h', { alt: true }));
  expect(spy.commands).toContain('help');
});

// ST-4 — a menu swap rebuilds the controller so navigation/activation uses the NEW items; null restores base.
test('ST-4: ChromeHost.setMenu rebuilds the controller live; null restores the base', () => {
  const base = menuBar([subMenu('~F~ile', [item('~O~ Open', 'file.open')])]);
  const body = new RouterStub();
  const spy = new CommandSpy();
  body.add(spy);
  const app = createApplication({ caps, content: body, menuBar: base, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();

  const host = body.chrome;
  expect(host).not.toBeNull();

  host!.setMenu([subMenu('~E~dit', [item('~C~ Copy', 'edit.copy')])]);
  app.loop.renderRoot.flush();

  // Open the NEW Edit menu (Alt+E), activate its first item → the new command emits.
  app.loop.dispatch(key('e', { alt: true }));
  app.loop.dispatch(key('enter'));
  expect(spy.commands).toContain('edit.copy');
  expect(spy.commands).not.toContain('file.open');

  // Restore the base menu; the original File ▸ Open activates again.
  host!.setMenu(null);
  app.loop.renderRoot.flush();
  app.loop.dispatch(key('f', { alt: true }));
  app.loop.dispatch(key('enter'));
  expect(spy.commands).toContain('file.open');
});
