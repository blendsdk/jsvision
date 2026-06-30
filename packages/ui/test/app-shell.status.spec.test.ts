/**
 * Specification tests (immutable oracles) — RD-05 StatusLine + the one-frame oracle (Phase 5).
 *
 * Source: RD-05 AC-19, AC-20 → ST-19, ST-20 (codeops/features/jsvision-ui/plans/app-shell/
 * 03-05-statusline-commands-theme-seams.md + 07-testing-strategy.md). Real StatusLine on a composed
 * app (no mocks); clicks/keys drive the loop; a post-process spy records emitted commands. The status
 * row is left-packed from margin 1 with a 2-cell gap (the documented preset). Expectations derive
 * from the acceptance criteria, never the implementation.
 *
 * Trace: RD-05 03-05 · AR-72/AR-77 · PA-6 · ST-19, ST-20.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';
import { statusLine, statusItem, Commands } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 }; // pass 0-based; convert to 1-based
}

/** A post-process spy recording the command names routed to it. */
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

// ST-19 / AC-19 — the status line draws its item; a click in its range OR its accelerator emits the
// command; a disabled command greys + is non-activatable. (A custom 'help' command is used so the
// emission is observable at the post-process spy — the standard 'quit' is consumed by the hidden
// quit sink in pre-process before any post-process view sees it.)
test('ST-19: status item — click + accelerator emit the command; disabled is non-activatable', () => {
  const status = statusLine([statusItem('~H~elp', 'help', 'Alt+H')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();

  const statusY = app.desktop.bounds.height + app.desktop.bounds.y; // the row just below the desktop

  // A click inside the left-packed "Help" item (x≈2, within the margin-1 range) emits the command.
  app.loop.dispatch(mouse('down', 2, statusY));
  expect(spy.commands).toContain('help');

  // The accelerator (Alt+H) emits it too.
  const beforeAccel = spy.commands.length;
  app.loop.dispatch(key('h', { alt: true }));
  expect(spy.commands.length).toBe(beforeAccel + 1);

  // A disabled command is non-activatable: a click in its range emits nothing.
  app.loop.enableCommand('help', false);
  const before = spy.commands.length;
  app.loop.dispatch(mouse('down', 2, statusY));
  expect(spy.commands.length).toBe(before); // greyed ⇒ no emit
});

// ST-20 / AC-20 — each single interaction (a drag step, a menu nav key, a command-cascade key)
// produces exactly one coalesced frame (one onFrame per dispatch tick).
test('ST-20: each interaction produces exactly one frame (one onFrame per dispatch tick)', () => {
  const bar = menuBar([subMenu('~F~ile', [item('~O~k', 'ok')])]);
  const status = statusLine([statusItem('~Q~uit', Commands.quit)]);
  const app = createApplication({ caps, menuBar: bar, statusLine: status, viewport: { width: 40, height: 16 } });

  const w = new Window('W');
  w.layout.rect = { x: 2, y: 2, width: 16, height: 6 };
  app.desktop.addWindow(w);
  app.loop.renderRoot.flush();

  let frames = 0;
  app.loop.onFrame = (): void => {
    frames += 1;
  };

  // (a) A drag step: grab the title (begins capture), then one drag → exactly one frame.
  app.loop.dispatch(mouse('down', 8, 2)); // grab title row
  frames = 0;
  app.loop.dispatch(mouse('drag', 12, 5));
  expect(frames).toBe(1);

  // (b) A menu nav key: open the menu, then one ↓ → exactly one frame.
  app.loop.dispatch(key('f10'));
  frames = 0;
  app.loop.dispatch(key('down'));
  expect(frames).toBe(1);

  // (c) A command cascade: Enter activates the item (emits a command + closes) in ONE tick → one frame.
  frames = 0;
  app.loop.dispatch(key('enter'));
  expect(frames).toBe(1);
});
