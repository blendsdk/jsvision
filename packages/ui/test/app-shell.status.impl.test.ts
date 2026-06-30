/**
 * Implementation tests — RD-05 StatusLine (Phase 5). Internals + edge cases not pinned by the spec
 * oracle: tilde-marked item layout, click hit-zones (incl. the inter-item gap), accelerator-chord
 * matching (Alt/Ctrl/Shift + plain function keys), greying (disabled → non-activatable via click and
 * accelerator), and the inert-until-attached contract.
 *
 * Trace: RD-05 03-05 · AR-72/AR-77 · PA-7.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createApplication } from '../src/app/index.js';
import { StatusLine, statusLine, statusItem } from '../src/status/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x: x + 1, y: y + 1 };
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

/** A composed app with the given status items + a command spy; returns the row's absolute y. */
function statusApp(items: ReturnType<typeof statusItem>[]) {
  const status = statusLine(items);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();
  const y = app.desktop.bounds.height + app.desktop.bounds.y;
  return { app, status, spy, y };
}

// --- Hit-zones (TV ` text ` spans that abut, pad cells included) ---------------------------------

test('each item hit-zone spans its pad cells; adjacent items abut; clicks past the last are no-ops', () => {
  // TV packs each item as a ` text ` span (`tstatusl.cpp` i += len+2): "File" span x=0..5 (lead 0,
  // text 1..4, trail 5), "Edit" span x=6..11 — they abut, with no dead gap, and the pad cells are
  // clickable parts of their item (`itemMouseIsIn` spans `[i, i+len+2)`).
  const { app, spy, y } = statusApp([statusItem('~F~ile', 'file'), statusItem('~E~dit', 'edit')]);

  app.loop.dispatch(mouseDown(2, y)); // inside "File" text
  expect(spy.commands).toEqual(['file']);

  app.loop.dispatch(mouseDown(8, y)); // inside "Edit" text
  expect(spy.commands).toEqual(['file', 'edit']);

  app.loop.dispatch(mouseDown(5, y)); // "File"'s trailing pad — still part of File's span (no gap)
  expect(spy.commands).toEqual(['file', 'edit', 'file']);

  app.loop.dispatch(mouseDown(30, y)); // far past the last item — no item there
  expect(spy.commands).toEqual(['file', 'edit', 'file']); // unchanged
});

// --- Accelerator-chord matching -----------------------------------------------------------------

test('accelerators match Alt/Ctrl + a letter and a bare function key', () => {
  const { app, spy } = statusApp([
    statusItem('~S~ave', 'save', 'Ctrl+S'),
    statusItem('~F~ind', 'find', 'Alt+F'),
    statusItem('~H~elp', 'help', 'F1'),
  ]);

  app.loop.dispatch(key('s', { ctrl: true }));
  app.loop.dispatch(key('f', { alt: true }));
  app.loop.dispatch(key('f1'));
  expect(spy.commands).toEqual(['save', 'find', 'help']);

  // A near-miss modifier set does not match (Alt+F ≠ a plain F).
  const before = spy.commands.length;
  app.loop.dispatch(key('f'));
  expect(spy.commands.length).toBe(before);
});

// --- Greying (disabled ⇒ non-activatable) -------------------------------------------------------

test('a disabled command is non-activatable via both click and accelerator', () => {
  const { app, spy, y } = statusApp([statusItem('~H~elp', 'help', 'Alt+H')]);
  app.loop.enableCommand('help', false);

  app.loop.dispatch(mouseDown(2, y)); // click the greyed item
  app.loop.dispatch(key('h', { alt: true })); // its accelerator
  expect(spy.commands).toEqual([]); // neither path activates

  app.loop.enableCommand('help', true); // re-enable restores activation
  app.loop.dispatch(key('h', { alt: true }));
  expect(spy.commands).toEqual(['help']);
});

// --- Inert until attached ------------------------------------------------------------------------

test('a StatusLine is inert until attached; createApplication attaches it', () => {
  const bare = statusLine([statusItem('~Q~uit', 'quit')]);
  expect(bare.seam).toBeNull(); // unattached
  // An unattached onEvent is a safe no-op (no seam ⇒ nothing emitted, no throw).
  expect(() => bare.onEvent({ event: mouseDown(2, 0), handled: false, local: { x: 2, y: 0 } })).not.toThrow();

  const { status } = statusApp([statusItem('~Q~uit', 'quit')]);
  expect(status).toBeInstanceOf(StatusLine);
  expect(status.seam).not.toBeNull(); // createApplication attached it
});
