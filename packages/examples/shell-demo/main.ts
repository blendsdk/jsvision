/**
 * App-shell walkthrough (RD-05) — a narrated, headless console demo of `@jsvision/ui`'s
 * `createApplication`: a desktop window manager with a menu bar + status line, driven entirely by a
 * synthetic `dispatch()` sequence (no TTY needed), printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:shell
 *
 * It composes an `Application` (menu bar · desktop · status line · overlay), opens three windows,
 * then: raises a background window by clicking it, drags one by its title bar, zooms one to fill the
 * desktop, tiles them with Turbo Vision's no-remainder split (n=3 ⇒ a stacked column, favorY), opens
 * the Window menu with F10 and activates "Cascade" (TV's corner-pinned +1/+1 stair-step), and emits a
 * status-line command — composing a fresh frame after each interaction.
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly
 * as a consumer would.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import {
  View,
  createApplication,
  Window,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  Commands,
  type DrawContext,
} from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** A synthetic 1-based SGR mouse event at 0-based (x, y). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/** A static themed content line painted inside a window's frame. */
class Content extends View {
  constructor(private readonly text: string) {
    super();
  }
  draw(ctx: DrawContext): void {
    ctx.text(0, 0, this.text, ctx.color('window'));
  }
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) {
    console.log(`|${row.map((cell) => cell.char).join('')}|`);
  }
  console.log(`+${'-'.repeat(width)}+`);
}

function main(): void {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

  const bar = menuBar([
    subMenu('~W~indow', [
      item('~T~ile', Commands.tile),
      item('~C~ascade', Commands.cascade),
      item('~Z~oom', Commands.zoom),
      separator(),
      item('E~x~it', Commands.quit),
    ]),
  ]);
  const status = statusLine([
    statusItem('~T~ile', Commands.tile, 'F4'),
    statusItem('~C~ascade', Commands.cascade, 'F5'),
    statusItem('~Q~uit', Commands.quit, 'Alt+X'),
  ]);

  const app = createApplication({ caps, menuBar: bar, statusLine: status, viewport: { width: 54, height: 16 } });

  // Open three staggered windows, each holding a content line.
  const specs = [
    { title: 'Editor', rect: { x: 1, y: 2, width: 22, height: 7 } },
    { title: 'Files', rect: { x: 8, y: 4, width: 22, height: 7 } },
    { title: 'Output', rect: { x: 15, y: 6, width: 22, height: 7 } },
  ];
  const windows = specs.map((spec, i) => {
    const w = new Window(spec.title);
    w.number = i + 1;
    w.layout.rect = spec.rect;
    w.add(new Content(`# ${spec.title}`));
    app.desktop.addWindow(w);
    return w;
  });
  app.loop.renderRoot.flush();
  printFrame('Frame 1 — three windows; "Output" is active (top z)', app.loop.renderRoot.buffer().rows());

  // Raise the background "Editor" window by clicking its interior (the desktop sits one row below
  // the menu bar, so the window at rect.y=2 paints from absolute screen row 3).
  app.loop.dispatch(mouse('down', 4, 5));
  printFrame('Frame 2 — click raises + focuses "Editor"', app.loop.renderRoot.buffer().rows());

  // Drag "Editor" by its title bar (absolute screen row 3 = desktop row 0 + rect.y 2).
  app.loop.dispatch(mouse('down', 8, 3)); // grab the title (begins capture)
  app.loop.dispatch(mouse('drag', 16, 8));
  app.loop.dispatch(mouse('up', 16, 8));
  printFrame('Frame 3 — drag "Editor" by its title bar', app.loop.renderRoot.buffer().rows());

  // Zoom the active window to fill the desktop, then tile all three.
  windows[0]?.zoom();
  app.loop.renderRoot.flush();
  printFrame('Frame 4 — zoom "Editor" to fill the desktop', app.loop.renderRoot.buffer().rows());

  app.desktop.tile();
  app.loop.renderRoot.flush();
  // TV `mostEqualDivisors(3)` favors the Y axis ⇒ 1 column × 3 rows: a full-width stacked column, the
  // cells dividing the desktop with no remainder (not a 2×2 grid).
  printFrame(
    'Frame 5 — tile all three (TV no-remainder split ⇒ a stacked column)',
    app.loop.renderRoot.buffer().rows(),
  );

  // Open the Window menu (F10), move to "Cascade", and activate it.
  app.loop.dispatch(key('f10'));
  app.loop.dispatch(key('down')); // highlight "Cascade" (second item)
  app.loop.dispatch(key('enter')); // activate → emit Commands.cascade
  // TV `doCascade`: window i steps to (i,i) with its bottom-right pinned to the desktop corner — the
  // back window fills, each window in front offset +1/+1 and one cell smaller.
  printFrame('Frame 6 — F10 → Window ▸ Cascade (corner-pinned +1/+1 stagger)', app.loop.renderRoot.buffer().rows());

  // Fire a status-line command via its accelerator (F4 → Tile).
  app.loop.dispatch(key('f4'));
  printFrame('Frame 7 — status accelerator F4 → Tile', app.loop.renderRoot.buffer().rows());

  console.log('\nDone — a desktop window manager with menus + a status line, all from dispatch().');
}

main();
