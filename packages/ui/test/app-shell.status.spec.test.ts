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

// ST-19 / AC-19 (updated for RD-10 AR-88) — the status line draws its item; a click (press + release
// over the item) OR its accelerator emits the command; a disabled command greys + is non-activatable.
// TV emits on RELEASE, not press (tstatusl.cpp handleEvent), so a "click" is mouse-down then -up. (A
// custom 'help' command is used so the emission is observable at the post-process spy — 'quit' is
// consumed by the hidden quit sink in pre-process before any post-process view sees it.)
test('ST-19: status item — click (press+release) + accelerator emit; disabled is non-activatable', () => {
  const status = statusLine([statusItem('~H~elp', 'help', 'Alt+H')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();

  const statusY = app.desktop.bounds.height + app.desktop.bounds.y; // the row just below the desktop

  // A press inside "Help" (x≈2) does NOT emit yet — TV emits on release (AR-88).
  app.loop.dispatch(mouse('down', 2, statusY));
  expect(spy.commands).not.toContain('help');
  // Releasing over the item emits the command.
  app.loop.dispatch(mouse('up', 2, statusY));
  expect(spy.commands).toContain('help');

  // The accelerator (Alt+H) emits it too.
  const beforeAccel = spy.commands.length;
  app.loop.dispatch(key('h', { alt: true }));
  expect(spy.commands.length).toBe(beforeAccel + 1);

  // A disabled command is non-activatable: a full click (down+up) in its range emits nothing.
  app.loop.enableCommand('help', false);
  const before = spy.commands.length;
  app.loop.dispatch(mouse('down', 2, statusY));
  app.loop.dispatch(mouse('up', 2, statusY));
  expect(spy.commands.length).toBe(before); // greyed ⇒ no emit
});

// RD-10 ST-01 (AR-88) — a press highlights the held item in `statusSelected` (black on green) and does
// not emit; the hotkey run within it stays red. Source: tstatusl.cpp drawSelect (cSelect 0x20/0x24).
test('RD-10 ST-01: a press highlights the held status item green (no emit on press)', () => {
  const status = statusLine([statusItem('~H~elp', 'help', 'Alt+H')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;

  app.loop.dispatch(mouse('down', 2, statusY)); // press "Help" ('e' at col 2)
  const buf = app.loop.renderRoot.buffer();
  expect(buf.get(2, statusY)?.bg).toBe('#00aa00'); // green (statusSelected.bg)
  expect(buf.get(2, statusY)?.fg).toBe('#000000'); // black on green
  expect(spy.commands).not.toContain('help'); // no emit on press
});

// RD-10 ST-02/03 (AR-88, PA-10) — the highlight follows the cursor while held; on release the command
// of the item UNDER THE RELEASE POINT emits (not the press item); releasing off all items emits nothing.
test('RD-10 ST-02/03: drag re-targets the highlight; release emits the item under the cursor', () => {
  // "File" span x0..5 (text 1..4), "Edit" span x6..11 (text 7..10).
  const status = statusLine([statusItem('~F~ile', 'file'), statusItem('~E~dit', 'edit')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;

  app.loop.dispatch(mouse('down', 2, statusY)); // press "File"
  app.loop.dispatch(mouse('drag', 8, statusY)); // drag onto "Edit"
  const buf = app.loop.renderRoot.buffer();
  expect(buf.get(8, statusY)?.bg).toBe('#00aa00'); // "Edit" now highlighted
  expect(buf.get(2, statusY)?.bg).not.toBe('#00aa00'); // "File" no longer highlighted
  expect(spy.commands).toEqual([]); // nothing emitted yet (still held)

  app.loop.dispatch(mouse('up', 8, statusY)); // release over "Edit"
  expect(spy.commands).toEqual(['edit']); // the item under the release point (PA-10), not 'file'

  // A press then release off all items emits nothing.
  app.loop.dispatch(mouse('down', 2, statusY));
  app.loop.dispatch(mouse('up', 38, statusY)); // far past the last item
  expect(spy.commands).toEqual(['edit']); // unchanged
});

// ST-20 / AC-20 — each single interaction (a drag step, a menu nav key, a command-cascade key)
// produces exactly one coalesced frame (one onFrame per dispatch tick).
test('ST-20: each interaction produces exactly one frame (one onFrame per dispatch tick)', () => {
  const bar = menuBar([subMenu('~F~ile', [item('~O~k', 'ok')])]);
  const status = statusLine([statusItem('~Q~uit', Commands.quit)]);
  const app = createApplication({ caps, menuBar: bar, statusLine: status, viewport: { width: 40, height: 16 } });

  const w = new Window('W');
  w.setLayout({ rect: { x: 2, y: 2, width: 16, height: 6 } });
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
