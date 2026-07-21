/**
 * Specification tests (immutable oracles) — the flexible status bar.
 *
 * The status line is a general child-view container: interactive command items, a flexible
 * `spacer()` for right-alignment, embedded passive widgets (a `ProgressBar`), and command-less
 * accessor-text labels — all laid out in one row. A real composed `createApplication` drives each
 * case (no mocks); a hidden post-process `CommandSpy` records emitted commands; pixel assertions
 * read `app.loop.renderRoot.buffer().get(x, y)`. Expectations derive from the requirements, never
 * the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { View } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { spacer } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { ProgressBar } from '../src/feedback/index.js';
import { createApplication } from '../src/app/index.js';
import { statusLine, statusItem, StatusLine, Commands } from '../src/status/index.js';
import type { StatusItem } from '../src/status/index.js';

// Truecolor + full Unicode: the palette hexes are emitted directly and a ProgressBar renders its
// block glyphs (not the ASCII fallback), so ST-03 can assert the `█` fill.
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } },
}).profile;
const STATUS_BG = '#aaaaaa'; // statusBar bg = lightGray

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

// ST-01 — a flexible spacer right-aligns the trailing items.
test('ST-01: spacer() pushes the following item flush to the right edge; the gap is status bg', () => {
  const status = statusLine([statusItem('~H~elp', 'help'), spacer(), statusItem('~Q~uit', 'quit')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;
  const buf = app.loop.renderRoot.buffer();

  // "Help" packs from the left: ` Help ` span at cols 0..5, text at cols 1..4.
  expect(buf.get(1, statusY)?.char).toBe('H');
  expect(buf.get(4, statusY)?.char).toBe('p');
  // "Quit" is flush right: ` Quit ` span ends at col 39, text "Quit" at cols 35..38.
  expect(buf.get(35, statusY)?.char).toBe('Q');
  expect(buf.get(38, statusY)?.char).toBe('t');
  // The gap between them is empty, painted in the status-bar background.
  expect(buf.get(20, statusY)?.char).toBe(' ');
  expect(buf.get(20, statusY)?.bg).toBe(STATUS_BG);
});

// ST-02 — a fixed-size spacer inserts an exact-width gap.
test('ST-02: spacer({fixed:3}) inserts exactly 3 empty cells between two items', () => {
  const status = statusLine([statusItem('A', 'a'), spacer({ fixed: 3 }), statusItem('B', 'b')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;
  const buf = app.loop.renderRoot.buffer();

  // "A" span [0,3): text 'A' at col 1. Gap [3,6). "B" span [6,9): text 'B' at col 7.
  expect(buf.get(1, statusY)?.char).toBe('A');
  expect(buf.get(7, statusY)?.char).toBe('B');
  for (const gx of [3, 4, 5]) {
    expect(buf.get(gx, statusY)?.char).toBe(' ');
    expect(buf.get(gx, statusY)?.bg).toBe(STATUS_BG);
  }
});

// ST-03 — an embedded ProgressBar paints and repaints reactively with no manual redraw.
test('ST-03: an embedded ProgressBar paints and self-repaints on a value change', () => {
  const value = signal(0.5);
  const bar = new ProgressBar({ value });
  bar.setLayout({ size: { kind: 'fixed', cells: 10 } });
  const status = statusLine([statusItem('~Q~uit', 'quit'), spacer(), bar]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;

  // The bar occupies cols 30..39. Half-full → the last cell is not a full block.
  expect(app.loop.renderRoot.buffer().get(39, statusY)?.char).not.toBe('█');

  value.set(1.0);
  app.loop.renderRoot.flush(); // one coalesced frame; no explicit invalidate on the bar
  expect(app.loop.renderRoot.buffer().get(39, statusY)?.char).toBe('█');
});

// ST-04 — accessor text repaints AND re-measures (a widened label shifts its own span).
test('ST-04: an accessor-text item re-measures and repaints when its signal changes', () => {
  const label = signal('AA');
  const status = statusLine([statusItem(() => label())]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;

  // ` AA ` span [0,4): text "AA" at cols 1..2.
  expect(app.loop.renderRoot.buffer().get(1, statusY)?.char).toBe('A');
  expect(app.loop.renderRoot.buffer().get(2, statusY)?.char).toBe('A');

  label.set('BBBB');
  app.loop.renderRoot.flush();
  // ` BBBB ` span widened to [0,6): text "BBBB" at cols 1..4 (col 4 only fills after a re-measure).
  expect(app.loop.renderRoot.buffer().get(1, statusY)?.char).toBe('B');
  expect(app.loop.renderRoot.buffer().get(4, statusY)?.char).toBe('B');
});

// ST-05 — a command-less item is passive: no emit on click, ignored by the accelerator sweep.
test('ST-05: a command-less item emits nothing on click and is skipped by accelerators', () => {
  const status = statusLine([statusItem('~X~ Info')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;

  app.loop.dispatch(mouse('down', 2, statusY));
  app.loop.dispatch(mouse('up', 2, statusY));
  expect(spy.commands).toEqual([]); // no command to emit

  app.loop.dispatch(key('x', { alt: true }));
  app.loop.dispatch(key('x'));
  expect(spy.commands).toEqual([]); // not an accelerator target

  // It still renders its label.
  expect(app.loop.renderRoot.buffer().get(1, statusY)?.char).toBe('X');
});

// ST-06 — packaging parity: the retained `StatusItem` type + `.command`, accessor text, empty line.
test('ST-06: StatusItem type parity — .command reads, accessor text compiles, empty line constructs', () => {
  const entry: StatusItem = statusItem('~Q~uit', Commands.quit);
  expect(entry.command).toBe('quit');

  const live: StatusItem = statusItem(() => 'x');
  expect(typeof live.text).toBe('function');

  expect(statusLine([]) instanceof StatusLine).toBe(true);
});

// ST-07 — a passive widget between two command items does not break drag-retarget.
test('ST-07: dragging across an embedded widget still emits the item under the release point', () => {
  const value = signal(0.5);
  const bar = new ProgressBar({ value });
  bar.setLayout({ size: { kind: 'fixed', cells: 10 } });
  const status = statusLine([statusItem('~F~ile', 'file'), bar, statusItem('~E~dit', 'edit')]);
  const app = createApplication({ caps, statusLine: status, viewport: { width: 40, height: 12 } });
  const spy = new CommandSpy();
  app.desktop.add(spy);
  app.loop.renderRoot.flush();
  const statusY = app.desktop.bounds.height + app.desktop.bounds.y;

  // "File" span [0,6), bar [6,16), "Edit" span [16,22) with text at cols 17..20.
  app.loop.dispatch(mouse('down', 2, statusY)); // press "File"
  app.loop.dispatch(mouse('drag', 10, statusY)); // drag across the bar (not a target)
  app.loop.dispatch(mouse('drag', 18, statusY)); // onto "Edit"
  app.loop.dispatch(mouse('up', 18, statusY)); // release over "Edit"
  expect(spy.commands).toEqual(['edit']);
});
