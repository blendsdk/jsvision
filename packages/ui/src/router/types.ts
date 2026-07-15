/**
 * Types for the navigation router's interaction with the application shell.
 *
 * The {@link ChromeHost} seam lets a router-style body drive the shared menu bar and status line as
 * the user moves between screens, without ever reaching into the bar internals. `createApplication`
 * implements it over the real bars and hands it to a {@link ChromeHostAware} body.
 */
import type { Logger } from '@jsvision/core';
import type { View } from '../view/index.js';
import type { MenuItem } from '../menu/index.js';

/**
 * The chrome seam an application hands to a router-style body so each screen can define its own
 * status line and menu. A screen calls `setStatus`/`setMenu` on activation; passing `null` falls back
 * to the application's base bar (whatever `createApplication` was given). The router carries no merge
 * rules — a present contribution fully defines that bar, `null` restores the base.
 *
 * @example
 * // On entering a screen with its own affordances:
 * chrome.setStatus([statusItem('~Esc~ Back', 'back', 'Escape')]);
 * chrome.setMenu(null); // this screen keeps the app's base menu
 */
export interface ChromeHost {
  /**
   * Replace the status line's items with `items`; pass `null` to restore the application's base
   * status line (whatever `createApplication({ statusLine })` was given). Swapped-in command items
   * are re-wired so their greyed/enabled state stays correct.
   *
   * @param items The status items/spacers for the active screen, or `null` to restore the base.
   */
  setStatus(items: View[] | null): void;
  /**
   * Replace the menu bar's top-level items with `items`, rebuilding its navigation controller; pass
   * `null` to restore the application's base menu.
   *
   * @param items The top-level menu nodes for the active screen, or `null` to restore the base.
   */
  setMenu(items: MenuItem[] | null): void;
}

/**
 * Implemented by an application body (e.g. a router) that wants to drive the shared chrome. When such
 * a body is passed as `createApplication({ content })`, the application hands it a {@link ChromeHost}
 * once the menu/status bars are wired. A body that does not implement this (a plain `Desktop`) is
 * left untouched.
 *
 * @example
 * import { Group } from '@jsvision/ui';
 *
 * class Router extends Group {
 *   private chrome: ChromeHost | null = null;
 *   attachChromeHost(host: ChromeHost): void { this.chrome = host; }
 * }
 */
export interface ChromeHostAware {
  /**
   * Receive the application's chrome seam. Called once by `createApplication` after the menu/status
   * bars are attached.
   *
   * @param host The chrome seam that drives the shared menu bar and status line.
   */
  attachChromeHost(host: ChromeHost): void;
}

/**
 * The focus seam an application hands to a router-style body so it can save and restore keyboard
 * focus across navigation — restoring the exact field a warm screen had focused, or the same-position
 * field of a rebuilt one. `createApplication` implements it over the event loop. A standalone-mounted
 * router (no application) gets none, and the loop's own focus-healing provides the first-focusable
 * floor automatically.
 *
 * @example
 * // Restore the previously focused view when returning to a screen:
 * const previous = focus.getFocused();
 * // …navigate away and back…
 * if (previous !== null) focus.focusView(previous);
 */
export interface FocusHost {
  /** Move keyboard focus to `view` (a no-op if the view is not currently mounted). */
  focusView(view: View): void;
  /** The currently focused view, or `null` when nothing holds focus. */
  getFocused(): View | null;
}

/**
 * Implemented by an application body (e.g. a router) that saves/restores focus across navigation. When
 * such a body is passed as `createApplication({ content })`, the application hands it a
 * {@link FocusHost} once the loop exists. A body that does not implement this is left untouched.
 *
 * @example
 * import { Group } from '@jsvision/ui';
 *
 * class Router extends Group {
 *   private focus: FocusHost | null = null;
 *   attachFocusHost(host: FocusHost): void { this.focus = host; }
 * }
 */
export interface FocusHostAware {
  /**
   * Receive the application's focus seam. Called once by `createApplication` after the loop is built.
   *
   * @param host The focus seam that moves and reads keyboard focus.
   */
  attachFocusHost(host: FocusHost): void;
}

/** The context a route's `build` receives: the typed params the screen was navigated to. */
export interface RouteContext<P> {
  /** The params the route was entered with. */
  params: P;
}

/**
 * What a route's `build` returns: the screen view plus its optional per-screen chrome. `status`
 * replaces the status line and `menu` replaces the menu bar on activation (each `null`/omitted falls
 * back to the app base).
 */
export interface ScreenBundle {
  /** The full-screen view for this screen. */
  view: View;
  /** Optional status-line items for this screen; omit to keep the app base. */
  status?: View[];
  /** Optional menu-bar items for this screen; omit to keep the app base. */
  menu?: MenuItem[];
}

/**
 * A route definition: how to build the screen for a set of params, plus optional keep-alive, focus,
 * and (de)serialization behavior.
 *
 * @example
 * const detail: Route<{ id: number }> = {
 *   build: (ctx) => ({ view: new DetailScreen(ctx.params.id) }),
 *   keepAlive: false,
 *   serialize: (p) => `id=${p.id}`,
 *   parse: (s) => ({ id: Number(new URLSearchParams(s).get('id')) }),
 * };
 */
export interface Route<P> {
  /** Build this route's screen bundle for the given params. Called on each activation unless kept alive. */
  build: (ctx: RouteContext<P>) => ScreenBundle;
  /** Keep the screen mounted-but-hidden when navigating away, so its state survives a round-trip. Default off. */
  keepAlive?: boolean;
  /** Optional exact-restore key: derive a stable key from the focused view so focus survives a rebuild. */
  focusKey?: (view: View) => string;
  /** Optional codec: serialize this route's params to a string (designed for deep-linking). */
  serialize?: (params: P) => string;
  /** Optional codec: parse this route's params back from a string. */
  parse?: (s: string) => P;
}

/** The route table: one {@link Route} per key of the `Routes` map, typed to that route's params. */
export type RouteMap<R> = { [K in keyof R]: Route<R[K]> };

/** The reactive current location: the top route's name and the params it was entered with. */
export interface RouterLocation<R> {
  /** The current route name. */
  name: keyof R;
  /** The current params. */
  params: R[keyof R];
}

/**
 * The initial route for a router: a route name plus its params. Params are required for a route with
 * a non-`void` param type and omittable for a `void` one.
 */
export type InitialRoute<R> = {
  [K in keyof R]: { name: K } & (R[K] extends void ? { params?: undefined } : { params: R[K] });
}[keyof R];

/** Options for `createRouter`. */
export interface RouterOptions<R> {
  /** The route to show first (structured + typed, so it can carry params). */
  initial: InitialRoute<R>;
  /** The route table. */
  routes: RouteMap<R>;
  /** Optional logger for isolated `build` errors; defaults to the framework's screen-safe logger. */
  logger?: Logger;
}
