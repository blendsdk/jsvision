/**
 * The demo shell: wraps every live example — a single component or a whole app —
 * into a mountable `Application` with a consistent chrome and a live
 * Theme / Depth / About affordance.
 *
 * Two chrome modes:
 *  - `minimal` — the component centered in the viewport with a compact status
 *    line exposing Theme (cycle), Depth (cycle), and About. No menu bar.
 *  - `full` — a menu bar (a system menu with About + a View menu offering Theme
 *    and Depth over the 13 presets) plus a status line. For multi-widget demos
 *    and full apps.
 *
 * Content normalization: a bare `View` is placed into a shell the demo owns; an
 * `Application` (a full app that brings its own menu/status, e.g. a desktop demo)
 * is returned as-is with the shared About/Theme/Depth handlers wired onto its
 * loop. Either way the result is the `Application` that `mountApp` mounts.
 *
 * Theme switches use the app's own `setTheme` (a live recompose, no re-mount).
 * Depth is only *signalled* via `onDepthChange` — the caps profile is readonly,
 * so a depth change is a re-mount the Play layer performs, not a mutation here.
 */
import { createApplication, menuBar, subMenu, item, statusLine, statusItem, messageBox, View } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import {
  turboVisionTheme,
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
import type { CapabilityProfile, Theme } from '@jsvision/core';
import { SITE_META } from './site-meta.js';

/** The colour depths the Depth control offers (matches `buildBrowserCaps`'s union). */
export type Depth = 'truecolor' | '256' | '16' | 'mono';

/** Options for {@link demoShell}. */
export interface DemoShellOptions {
  /** The example's built content — a bare component (`View`) or a whole `Application`. */
  readonly content: Application | View;
  /** Terminal capability profile driving colour-depth encoding. */
  readonly caps: CapabilityProfile;
  /** Initial viewport in cells. */
  readonly viewport: { width: number; height: number };
  /** Which chrome wraps the content. */
  readonly chrome: 'minimal' | 'full';
  /** Initial theme; defaults to Turbo Vision. */
  readonly theme?: Theme;
  /** Called when the Depth control changes — the Play layer turns this into a re-mount. */
  readonly onDepthChange?: (depth: Depth) => void;
}

/** A named preset for the Theme menu. */
interface Preset {
  readonly name: string;
  readonly theme: Theme;
}

/** The 13 shipped presets, in menu order (default open = Turbo Vision). */
const PRESETS: readonly Preset[] = [
  { name: 'Turbo Vision', theme: turboVisionTheme },
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
const CMD_THEME_CYCLE = 'demo.theme.cycle';
const CMD_DEPTH_CYCLE = 'demo.depth.cycle';
const themeCmd = (index: number): string => `demo.theme.${index}`;
const depthCmd = (depth: Depth): string => `demo.depth.${depth}`;

/**
 * Wrap an example's content in a demo shell and return the mountable application.
 *
 * @param opts - the content, caps, viewport, chrome mode, and optional theme / depth hook.
 * @returns the `Application` to hand `mountApp`.
 * @example
 * import { demoShell } from '../src/demo-shell.js';
 * import { buildBrowserCaps } from '@jsvision/web';
 *
 * const caps = buildBrowserCaps();
 * const app = demoShell({
 *   content: def.build({ width: 80, height: 24 }),
 *   caps,
 *   viewport: { width: 80, height: 24 },
 *   chrome: 'minimal',
 *   onDepthChange: (depth) => remountAt(depth),
 * });
 * // mountApp({ element, app, caps, term });
 */
export function demoShell(opts: DemoShellOptions): Application {
  if (opts.content instanceof View) {
    return shellForView(opts, opts.content);
  }
  // An Application brings its own chrome; wire the shared handlers onto its loop.
  wireCommands(opts.content, opts);
  return opts.content;
}

/**
 * Build a demo-chromed, caps-correct application for an example that returns a
 * whole `Application` (a modal dialog host, a desktop, and so on).
 *
 * It bundles `createApplication` with the shared demo menu bar / status line and
 * the example's own capability profile, so the example only has to populate the
 * desktop — open its dialog, add its windows — and return the app. The demo shell
 * then wires the shared About / Theme / Depth handlers when it receives the
 * returned application, so those controls work without the example repeating them.
 *
 * @param ctx - the example context: the terminal `caps` plus the cell grid.
 * @param chrome - `'full'` (menu bar + status line) or `'minimal'` (status line only).
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
 *     const app = demoApp(ctx, 'full');
 *     void openFile(app, { fs, directory: '/home/demo' });
 *     return app;
 *   },
 * });
 */
export function demoApp(
  ctx: { readonly caps: CapabilityProfile; readonly width: number; readonly height: number },
  chrome: 'minimal' | 'full',
): Application {
  return createApplication({
    caps: ctx.caps,
    viewport: { width: ctx.width, height: ctx.height },
    theme: turboVisionTheme,
    menuBar: chrome === 'full' ? buildMenuBar() : undefined,
    statusLine: buildStatusLine(chrome),
  });
}

/** Build an owned application with the demo chrome and place the content in it. */
function shellForView(opts: DemoShellOptions, view: View): Application {
  const app = createApplication({
    caps: opts.caps,
    viewport: opts.viewport,
    theme: opts.theme ?? turboVisionTheme,
    menuBar: opts.chrome === 'full' ? buildMenuBar() : undefined,
    statusLine: buildStatusLine(opts.chrome),
  });
  placeContent(app, view, opts.chrome);
  wireCommands(app, opts);
  // The content is added after mount, so force one reflow to settle + paint it.
  app.loop.resize(opts.viewport);
  return app;
}

/** Place the content: centered (minimal) or filling the desktop (full). */
function placeContent(app: Application, view: View, chrome: 'minimal' | 'full'): void {
  const { width: dw, height: dh } = app.desktop.bounds;
  if (chrome === 'minimal') {
    const { width, height } = intendedSize(view);
    const cw = Math.min(width, dw);
    const ch = Math.min(height, dh);
    const x = Math.max(0, Math.floor((dw - cw) / 2));
    const y = Math.max(0, Math.floor((dh - ch) / 2));
    view.layout = { position: 'absolute', rect: { x, y, width: cw, height: ch } };
  } else {
    view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: dw, height: dh } };
  }
  app.desktop.add(view);
}

/** The content's intended size (from its absolute rect, or a modest default box). */
function intendedSize(view: View): { width: number; height: number } {
  const rect = view.layout.rect;
  if (rect !== undefined) return { width: rect.width, height: rect.height };
  return { width: 40, height: 10 };
}

/** The full-chrome menu bar: a system menu (About) + a View menu (Theme + Depth). */
function buildMenuBar(): ReturnType<typeof menuBar> {
  return menuBar([
    subMenu('≡', [item('~A~bout', CMD_ABOUT, 'F1')]),
    subMenu('~V~iew', [
      subMenu(
        '~T~heme',
        PRESETS.map((p, i) => item(p.name, themeCmd(i))),
      ),
      subMenu(
        '~D~epth',
        DEPTHS.map((d) => item(d, depthCmd(d))),
      ),
    ]),
  ]);
}

/** The status line: a compact Theme/Depth/About row (minimal) or a hotkey row (full). */
function buildStatusLine(chrome: 'minimal' | 'full'): ReturnType<typeof statusLine> {
  if (chrome === 'minimal') {
    return statusLine([
      statusItem('~T~heme', CMD_THEME_CYCLE),
      statusItem('~D~epth', CMD_DEPTH_CYCLE),
      statusItem('~A~bout', CMD_ABOUT, 'F1'),
    ]);
  }
  return statusLine([statusItem('~F1~ About', CMD_ABOUT, 'F1'), statusItem('~F10~ Menu', 'menu', 'F10')]);
}

/** Wire the shared About/Theme/Depth command handlers onto an application's loop. */
function wireCommands(app: Application, opts: DemoShellOptions): void {
  const host = { loop: app.loop, desktop: app.desktop };
  app.onCommand(CMD_ABOUT, () => {
    void messageBox(host, { title: `About ${SITE_META.name}`, text: aboutText() });
  });
  PRESETS.forEach((preset, i) => {
    app.onCommand(themeCmd(i), () => app.setTheme(preset.theme));
  });
  DEPTHS.forEach((depth) => {
    app.onCommand(depthCmd(depth), () => opts.onDepthChange?.(depth));
  });
  // The minimal chrome cycles rather than listing every option.
  let themeIndex = 0;
  app.onCommand(CMD_THEME_CYCLE, () => {
    themeIndex = (themeIndex + 1) % PRESETS.length;
    app.setTheme(PRESETS[themeIndex].theme);
  });
  let depthIndex = 0;
  app.onCommand(CMD_DEPTH_CYCLE, () => {
    depthIndex = (depthIndex + 1) % DEPTHS.length;
    opts.onDepthChange?.(DEPTHS[depthIndex]);
  });
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
