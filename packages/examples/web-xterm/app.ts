/**
 * The jsvision Turbo Vision application shown in the browser demo.
 *
 * This file is 100% ordinary `@jsvision/ui` — it is byte-for-byte the kind of app
 * you would write for a real terminal. Nothing here knows it is running in a
 * browser: the app shell composes a `Desktop` + `MenuBar` + `StatusLine` + windows
 * over the event loop, exactly as the native `demo:tvision` does. `main.ts` is the
 * only file that swaps the OS boundary (native host → xterm.js browser host).
 */
import { buildBrowserCaps } from '@jsvision/web';
import type { CapabilityProfile } from '@jsvision/core';
import {
  createApplication,
  Window,
  View,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  Commands,
  signal,
} from '@jsvision/ui';
import type { Application, Signal, Size2D, DrawContext } from '@jsvision/ui';

/**
 * The browser capability profile, built by `@jsvision/web`'s `buildBrowserCaps()`: a truecolor,
 * UTF-8 terminal with SGR mouse, drag tracking, and bracketed paste — so `serialize()` emits real
 * box-drawing (`┌─┐│└┘`) and block glyphs (`█▄▀▒`) instead of the ASCII fallback. Pass
 * `{ colorDepth: '16' }` to exercise the downsample chain.
 */
export const WEB_CAPS: CapabilityProfile = buildBrowserCaps();

/**
 * A window-content panel: fills the window's blue interior and draws its lines in
 * the `window` theme role. Unlike the bare `Text` control (which has no `measure()`
 * and so reflows to 0×0 with no explicit layout), this claims the full available
 * interior — the same idiom the native `demo:tvision` `HelpView` uses. Reactive:
 * a getter re-binds so signal changes (the clock) repaint.
 */
class PanelView extends View {
  constructor(private readonly lines: () => readonly string[]) {
    super();
    this.onMount(() => this.bind(this.lines));
  }

  /** Claim the whole window interior so the background fill covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const role = ctx.role('window');
    const style = { fg: role.fg, bg: role.bg };
    ctx.fill(' ', style);
    const lines = this.lines();
    for (let y = 0; y < ctx.size.height && y < lines.length; y += 1) {
      const line = lines[y];
      if (line !== undefined && line !== '') ctx.text(0, y, line, style);
    }
  }
}

/** The no-op command the clock timer emits to drive one coalesced repaint per tick. */
export const CMD_TICK = '__tick__';

/** Zero-pad to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a `Date` as `HH:MM:SS`. */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** Two-space-indented rows render blue (the info-window convention). */
const WELCOME_LINES = [
  'jsvision, in your browser.',
  '',
  'This whole desktop is the terminal',
  'SDK rendering to xterm.js — the same',
  'engine, unchanged, over a browser host.',
  '',
  '  F10      menu bar',
  '  drag     move a window',
  '  corner   resize a window',
  '  F5 / F4  cascade / tile',
  '  F6       next window',
  '  Tab      cycle focus',
];

/** The composed application plus the reactive clock the demo timer drives. */
export interface WebApp {
  readonly app: Application;
  readonly clock: Signal<string>;
}

/** Build the menu bar — a system menu plus a Window menu, classic Turbo Vision layout. */
function buildMenuBar(): ReturnType<typeof menuBar> {
  return menuBar([
    subMenu('≡', [item('~A~bout', 'about', 'F1')]),
    subMenu('~W~indow', [
      item('~N~ext', Commands.next, 'F6'),
      item('~Z~oom', Commands.zoom, 'F2'),
      separator(),
      item('~C~ascade', Commands.cascade, 'F5'),
      item('~T~ile', Commands.tile, 'F4'),
      separator(),
      item('~C~lose', Commands.close, 'F3'),
    ]),
  ]);
}

/** Build the status line — the classic hotkey row. */
function buildStatusLine(): ReturnType<typeof statusLine> {
  return statusLine([
    statusItem('~F10~ Menu', 'menu', 'F10'),
    statusItem('~F5~ Cascade', Commands.cascade, 'F5'),
    statusItem('~F4~ Tile', Commands.tile, 'F4'),
    statusItem('~F6~ Next', Commands.next, 'F6'),
    statusItem('~F3~ Close', Commands.close, 'F3'),
  ]);
}

/**
 * Compose the demo application against `viewport`.
 *
 * @param viewport - the initial cell grid (xterm's `cols`×`rows`); the host's first resize corrects it.
 * @returns the {@link Application} plus the clock signal `main.ts` ticks once a second.
 */
export function buildApp(viewport: Size2D): WebApp {
  const clock = signal('00:00:00');

  const app = createApplication({
    caps: WEB_CAPS,
    viewport,
    menuBar: buildMenuBar(),
    statusLine: buildStatusLine(),
  });
  app.desktop.shadow = true; // Turbo Vision drop-shadows under the windows.

  const welcome = new Window('Welcome');
  welcome.number = 1;
  welcome.setLayout({ rect: { x: 1, y: 1, width: 40, height: 15 } });
  welcome.add(new PanelView(() => WELCOME_LINES));
  app.desktop.addWindow(welcome);

  const time = new Window('Clock');
  time.number = 2;
  time.setLayout({ rect: { x: 44, y: 2, width: 26, height: 8 } });
  time.add(new PanelView(() => ['', '   Local time', '', `      ${clock()}`]));
  app.desktop.addWindow(time);

  return { app, clock };
}
