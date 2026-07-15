/**
 * Types for the navigation router's interaction with the application shell.
 *
 * The {@link ChromeHost} seam lets a router-style body drive the shared menu bar and status line as
 * the user moves between screens, without ever reaching into the bar internals. `createApplication`
 * implements it over the real bars and hands it to a {@link ChromeHostAware} body.
 */
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
