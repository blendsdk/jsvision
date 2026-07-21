/**
 * The demo shell: wraps every live example — a single component or a whole app —
 * in ONE consistent chrome and a live Theme / Depth / About affordance, then
 * returns the mountable `Application`.
 *
 * There is a single chrome for every example: a desktop with a menu bar
 * (`System ▸ About / Exit`, `View ▸ Theme / Depth`, and — for windowing apps — a
 * `Window` menu) and a minimal status line whose only item is `Alt+X Exit`. Every
 * primary control (About, Theme, Depth, window management) lives in the menu, never
 * the footer. `Exit` emits the quit command; a host (the Play modal) observes it via
 * `onClose` to dismiss itself.
 *
 * An example is one of two kinds:
 *  - `component` — its `build()` returns a bare `View`; the shell wraps it in a
 *    titled, non-closable `Window` on the desktop so the component sits on the
 *    window's clean interior surface (never the desktop pattern) and can never
 *    vanish to an empty desktop.
 *  - `app` — its `build()` returns a whole `Application` (it owns its desktop
 *    content: a desktop demo, a modal-dialog host). The shell only wires the
 *    shared About / Theme / Depth handlers onto it.
 *
 * Theme switches use the app's own `setTheme` (a live recompose, no re-mount).
 * Depth is only *signalled* via `onDepthChange` — the caps profile is readonly,
 * so a depth change is a re-mount the Play layer performs, not a mutation here.
 */
import {
  createApplication,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  messageBox,
  Window,
  View,
  Commands,
} from '@jsvision/ui';
import type { Application, DesktopApplication } from '@jsvision/ui';
import {
  classicTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  janusTheme,
  warpTheme,
  solsticeTheme,
  platinumTheme,
  workbenchTheme,
  horizonTheme,
} from '@jsvision/core';
import type { CapabilityProfile, Theme, Keymap } from '@jsvision/core';
import type { ExampleContext } from '../examples/_contract.js';
import { SITE_META } from './site-meta.js';

/** The colour depths the Depth control offers (matches `buildBrowserCaps`'s union). */
export type Depth = 'truecolor' | '256' | '16' | 'mono';

/** Whether an example builds a bare component (`View`) or a whole `Application`. */
export type ExampleKind = 'component' | 'app';

/** Options for {@link demoShell}. */
export interface DemoShellOptions {
  /**
   * Compose the example for a given cell grid. A `component` build receives the
   * stage window's interior size; an `app` build receives the full viewport.
   */
  readonly build: (ctx: ExampleContext) => Application | View;
  /** The example title — used as the stage window's title for a `component`. */
  readonly title: string;
  /** Whether `build` returns a bare `View` (`component`) or an `Application` (`app`). */
  readonly kind: ExampleKind;
  /** Terminal capability profile driving colour-depth encoding. */
  readonly caps: CapabilityProfile;
  /** Initial viewport in cells. */
  readonly viewport: { width: number; height: number };
  /** Initial theme; defaults to Turbo Vision. */
  readonly theme?: Theme;
  /**
   * Show the `View ▸ Theme` preset submenu. Off by default: a theme switcher is a distraction in an
   * example about something else, so only an example that is *about* theming asks for it. The theme
   * commands stay wired either way — this hides the menu, it does not unwire the handlers.
   *
   * Applies to a `component` example, whose chrome this shell owns. An `app` example builds its own
   * menu bar, so it passes the same flag to {@link demoApp} instead.
   */
  readonly themeMenu?: boolean;
  /** Called when the Depth control changes — the Play layer turns this into a re-mount. */
  readonly onDepthChange?: (depth: Depth) => void;
  /**
   * Teardown registrar handed to the example as `ctx.onCleanup`. The Play layer collects what the
   * example registers (its animation timer, say) and runs it on close. Omitted in a headless mount,
   * where an example's own `unref()` keeps its timer harmless instead.
   */
  readonly onCleanup?: (fn: () => void) => void;
  /**
   * Called when the in-app Exit is chosen (it emits the quit command). The Play layer uses this to
   * dismiss the host modal, so the terminal app can close itself — not only the modal's × button.
   */
  readonly onClose?: () => void;
}

/** A named preset for the Theme menu. */
interface Preset {
  readonly name: string;
  readonly theme: Theme;
}

/** The 13 shipped presets, in menu order (default open = Turbo Vision). */
const PRESETS: readonly Preset[] = [
  { name: 'Classic', theme: classicTheme },
  { name: 'Monochrome', theme: monochromeTheme },
  { name: 'Slate', theme: slateTheme },
  { name: 'Nord', theme: nordTheme },
  { name: 'Dracula', theme: draculaTheme },
  { name: 'Solarized Dark', theme: solarizedDarkTheme },
  { name: 'Gruvbox Dark', theme: gruvboxDarkTheme },
  { name: 'Janus', theme: janusTheme },
  { name: 'Warp', theme: warpTheme },
  { name: 'Solstice', theme: solsticeTheme },
  { name: 'Platinum', theme: platinumTheme },
  { name: 'Workbench', theme: workbenchTheme },
  { name: 'Horizon', theme: horizonTheme },
];

const DEPTHS: readonly Depth[] = ['truecolor', '256', '16', 'mono'];

// Internal command names the chrome emits and the shared wiring handles.
const CMD_ABOUT = 'demo.about';
const themeCmd = (index: number): string => `demo.theme.${index}`;
const depthCmd = (depth: Depth): string => `demo.depth.${depth}`;

/**
 * Wrap an example's build in the demo shell and return the mountable application.
 *
 * @param opts - the deferred build, title, kind, caps, viewport, and optional theme / depth hook.
 * @returns the `Application` to hand `mountApp`.
 * @example
 * import { demoShell } from '../src/demo-shell.js';
 * import { buildBrowserCaps } from '@jsvision/web';
 *
 * const caps = buildBrowserCaps();
 * const app = demoShell({
 *   build: (ctx) => def.build(ctx),
 *   title: def.title,
 *   kind: 'component',
 *   caps,
 *   viewport: { width: 80, height: 24 },
 *   onDepthChange: (depth) => remountAt(depth),
 * });
 * // mountApp({ element, app, caps, term });
 */
export function demoShell(opts: DemoShellOptions): Application {
  if (opts.kind === 'app') {
    // An `app` example builds its own chrome (via demoApp) at the full viewport; only wire commands.
    const built = opts.build({
      width: opts.viewport.width,
      height: opts.viewport.height,
      caps: opts.caps,
      onCleanup: opts.onCleanup,
    });
    if (built instanceof View) throw new Error("an 'app' example must build an Application, not a View");
    wireCommands(built, opts);
    return built;
  }
  return shellForView(opts);
}

/**
 * Build a demo-chromed, caps-correct application for an example that returns a
 * whole `Application` (a modal dialog host, a desktop, and so on).
 *
 * It bundles `createApplication` with the shared demo menu bar / status line and
 * the example's own capability profile, so the example only has to populate the
 * desktop — open its dialog, add its windows — and return the app. The demo shell
 * then wires the shared About / Theme / Depth handlers onto the returned
 * application, so those controls work without the example repeating them.
 *
 * @param ctx - the example context: the terminal `caps` plus the cell grid.
 * @param opts - optional flags; `windowMenu` adds the `Window` menu + window hints for a windowing
 * app, `themeMenu` adds the `View ▸ Theme` preset submenu (off by default — see
 * {@link DemoShellOptions.themeMenu}).
 * @returns a mountable {@link Application} with the demo chrome already in place.
 * @example
 * import { defineExample } from '../_contract.js';
 * import { openFile } from '@jsvision/files';
 * import { demoApp } from '../../src/demo-shell.js';
 *
 * export default defineExample({
 *   title: 'File dialog',
 *   blurb: 'Browse a virtual file tree in a modal dialog.',
 *   build: (ctx) => {
 *     const app = demoApp(ctx);
 *     void openFile(app, { fs, directory: '/home/demo' });
 *     return app;
 *   },
 * });
 */
export function demoApp(
  ctx: { readonly caps: CapabilityProfile; readonly width: number; readonly height: number },
  opts?: { readonly windowMenu?: boolean; readonly themeMenu?: boolean; readonly keymap?: Keymap },
): DesktopApplication {
  const windowMenu = opts?.windowMenu ?? false;
  const themeMenu = opts?.themeMenu ?? false;
  return createApplication({
    caps: ctx.caps,
    viewport: { width: ctx.width, height: ctx.height },
    theme: classicTheme,
    menuBar: buildMenuBar({ windowMenu, themeMenu }),
    statusLine: buildStatusLine(),
    // App-wide extra chords (e.g. an app's own F-key) — bound regardless of which view has focus, so
    // an example can add a shortcut the shared chrome does not carry. Merges over the defaults.
    keymap: opts?.keymap,
  });
}

/** Build an owned application with the shared chrome and host the component in a stage Window. */
function shellForView(opts: DemoShellOptions): Application {
  const app = createApplication({
    caps: opts.caps,
    viewport: opts.viewport,
    theme: opts.theme ?? classicTheme,
    menuBar: buildMenuBar({ windowMenu: false, themeMenu: opts.themeMenu ?? false }),
    statusLine: buildStatusLine(),
  });
  // The stage window fills the desktop minus a 1-cell margin, so the desktop pattern frames it.
  const { width: dw, height: dh } = app.desktop.bounds;
  const winRect = { x: 1, y: 0, width: dw - 2, height: dh - 1 };
  // The window frame + padding eat one cell on each side, leaving this interior for the component.
  const interiorW = winRect.width - 2;
  const interiorH = winRect.height - 2;

  const built = opts.build({ width: interiorW, height: interiorH, caps: opts.caps, onCleanup: opts.onCleanup });
  if (!(built instanceof View)) throw new Error("a 'component' example must build a View, not an Application");
  centerInInterior(built, interiorW, interiorH);

  const win = new Window(opts.title);
  win.closable = false; // a demo can never be closed away to an empty desktop
  win.setLayout({ rect: winRect });
  win.add(built);
  app.desktop.addWindow(win);

  wireCommands(app, opts);
  // The window is added after mount, so force one reflow to settle + paint it.
  app.loop.resize(opts.viewport);
  return app;
}

/**
 * Center the component within the window interior, clamped to fit. A fixed-size
 * component (its own small rect) is centered; a component built to the interior
 * size fills it. The rect is window-interior-local — the window's `padding: 1`
 * places `{0,0}` just inside the border, so no extra margin is added.
 *
 * Placement is written through `setLayout`, which merges — it sets `position` and `rect` and leaves
 * everything else alone. That matters for an example whose root is a flex container: dropping its
 * `direction` would silently re-solve a column as a row and lay the composition out sideways.
 */
function centerInInterior(view: View, interiorW: number, interiorH: number): void {
  const { width, height } = intendedSize(view);
  const cw = Math.min(width, interiorW);
  const ch = Math.min(height, interiorH);
  const x = Math.max(0, Math.floor((interiorW - cw) / 2));
  const y = Math.max(0, Math.floor((interiorH - ch) / 2));
  view.setLayout({ position: 'absolute', rect: { x, y, width: cw, height: ch } });
}

/** The content's intended size (from its absolute rect, or a modest default box). */
function intendedSize(view: View): { width: number; height: number } {
  const rect = view.layout.rect;
  if (rect !== undefined) return { width: rect.width, height: rect.height };
  return { width: 40, height: 10 };
}

/**
 * The shared menu bar: System (About) + View (Depth, and Theme only when asked for) + (optionally) a
 * Window menu. The Theme submenu is opt-in because a preset switcher pulls attention away from the
 * component an example is there to show; the example about theming turns it on.
 */
function buildMenuBar({
  windowMenu,
  themeMenu,
}: {
  windowMenu: boolean;
  themeMenu: boolean;
}): ReturnType<typeof menuBar> {
  const viewItems = [
    subMenu(
      '~D~epth',
      DEPTHS.map((d) => item(d, depthCmd(d))),
    ),
  ];
  if (themeMenu) {
    viewItems.unshift(
      subMenu(
        '~T~heme',
        PRESETS.map((p, i) => item(p.name, themeCmd(i))),
      ),
    );
  }
  const menus = [
    subMenu('≡', [item('~A~bout', CMD_ABOUT, 'F1'), separator(), item('E~x~it', Commands.quit, 'Alt+X')]),
    subMenu('~V~iew', viewItems),
  ];
  if (windowMenu) {
    menus.push(
      subMenu('~W~indow', [
        item('~N~ext', Commands.next, 'F6'),
        item('~Z~oom', Commands.zoom, 'F2'),
        separator(),
        item('~C~ascade', Commands.cascade, 'F5'),
        item('~T~ile', Commands.tile, 'F4'),
        separator(),
        item('~C~lose', Commands.close, 'F3'),
      ]),
    );
  }
  return menuBar(menus);
}

/**
 * The shared status line: a single Exit affordance. `Alt+X` emits the quit command, which the shell
 * forwards to `onClose` so the host (the Play modal) dismisses itself. Everything else — About,
 * Theme, Depth, window management — lives in the menu bar, reached via F10 / Alt+hotkey / click.
 */
function buildStatusLine(): ReturnType<typeof statusLine> {
  return statusLine([statusItem('~Alt+X~ Exit', Commands.quit, 'Alt+X')]);
}

/** Wire the shared About/Theme/Depth command handlers onto an application's loop. */
function wireCommands(app: Application, opts: DemoShellOptions): void {
  app.onCommand(CMD_ABOUT, () => {
    // The About box is hosted as a desktop window; a router-bodied app (no desktop) simply skips it.
    if (app.desktop === undefined) return;
    void messageBox({ loop: app.loop, desktop: app.desktop }, { title: `About ${SITE_META.name}`, text: aboutText() });
  });
  PRESETS.forEach((preset, i) => {
    app.onCommand(themeCmd(i), () => app.setTheme(preset.theme));
  });
  DEPTHS.forEach((depth) => {
    app.onCommand(depthCmd(depth), () => opts.onDepthChange?.(depth));
  });
  // Exit emits the standard quit command; the shell forwards it to the host so the terminal app can
  // dismiss its own Play modal. Harmless when unwired (no host modal) — the callback is optional.
  app.onCommand(Commands.quit, () => opts.onClose?.());
}

/** The About dialog body: name + version + links. */
function aboutText(): string {
  return [
    `${SITE_META.name} v${SITE_META.version}`,
    '',
    `Repository: ${SITE_META.links.repo}`,
    `Docs: ${SITE_META.links.docs}`,
  ].join('\n');
}
