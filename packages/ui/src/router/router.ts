/**
 * `createRouter` — a full-screen screen stack for `@jsvision/ui`.
 *
 * A router is the app body's answer to "one screen at a time, navigated as a stack" — wizards,
 * installers, drill-down browsers, dashboards — the complement to the `Desktop` window manager. It is
 * a `Group` (so it *is* the body view, swapping its single visible screen) that also carries the
 * navigation API (`push`/`back`/`replace`/`reset`) and reactive accessors (`location`/`canGoBack`).
 *
 * Pass a router as `createApplication({ content: router })`; the app hands it a chrome seam so each
 * screen can drive the shared menu/status bars. Navigating away disposes a screen by default (its
 * `onCleanup` runs); opt into `keepAlive` per route to keep one warm. A route's `build` that throws is
 * isolated — the navigation aborts, the current screen stays, and the error is logged.
 */
import { createLogger } from '@jsvision/core';
import type { Logger } from '@jsvision/core';
import { Group } from '../view/index.js';
import type { View } from '../view/index.js';
import { signal, batch, untrack } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type {
  Route,
  RouteMap,
  RouterOptions,
  RouterLocation,
  ScreenBundle,
  ChromeHost,
  ChromeHostAware,
} from './types.js';
import { pushEntry, backEntry, replaceEntry, resetEntry, canGoBack, topEntry } from './stack.js';
import type { StackEntry } from './stack.js';

/**
 * The trailing arguments of a navigation call for a route with param type `P`: none for a `void`
 * route, exactly `[params]` otherwise. This is what makes `router.push('detail', { id })` typed and
 * `router.push('home')` param-less against the same generic.
 */
export type NavArgs<P> = P extends void ? [] : [params: P];

/**
 * A navigation / screen router. Create one with {@link createRouter}; it is a `View` (a `Group`), so
 * it mounts as an application's `content` body. See {@link createRouter} for the full contract.
 */
export class Router<R> extends Group implements ChromeHostAware {
  private readonly routes: RouteMap<R>;
  private readonly logger: Logger;
  private readonly stackSig: Signal<StackEntry[]>;
  /** The single mounted screen; a change disposes the old view and mounts the new (dispose-default). */
  private readonly activeView: Signal<View | null> = signal<View | null>(null);
  /** The active screen's bundle, retained so chrome re-applies when the host attaches after construction. */
  private activeBundle: ScreenBundle | null = null;
  /** The app chrome seam; `null` until `createApplication` wires it (a standalone router has none). */
  private chromeHost: ChromeHost | null = null;

  /**
   * @param opts The initial route, the route table, and an optional logger for isolated build errors.
   */
  constructor(opts: RouterOptions<R>) {
    super();
    this.routes = opts.routes;
    this.logger = opts.logger ?? createLogger();
    const initial: StackEntry = {
      name: String(opts.initial.name),
      params: (opts.initial as { params?: unknown }).params,
    };
    this.stackSig = signal<StackEntry[]>([initial]);
    // Render exactly the active screen; when it changes, the old view unmounts+disposes and the new
    // mounts — that is the dispose-on-navigate-away default.
    this.addDynamic(() => () => this.activeView() ?? undefined);
    // Build the initial screen now, so it is ready when the router mounts.
    const bundle = this.tryBuild(initial.name, initial.params);
    if (bundle !== null) this.applyBundle(bundle);
  }

  /**
   * @internal Receive the app chrome seam (implements {@link ChromeHostAware}) and immediately apply
   * the current screen's chrome — the initial screen is built before the host attaches, so this
   * catches it up.
   */
  attachChromeHost(host: ChromeHost): void {
    this.chromeHost = host;
    if (this.activeBundle !== null) this.applyChrome(this.activeBundle);
  }

  /**
   * Push a new screen on top of the stack, making it the current screen. Typed against the route map:
   * a param-bearing route requires its params, a `void` route takes none.
   *
   * @param name   The route to navigate to.
   * @param args   The route's params (omitted for a `void` route).
   * @example
   * router.push('detail', { id: 42 });
   * router.push('home');
   */
  push<K extends keyof R>(name: K, ...args: NavArgs<R[K]>): void {
    this.navigate((stack) => pushEntry(stack, String(name), args[0]), String(name), args[0]);
  }

  /**
   * Replace the current top screen with a new one — the stack depth does not change.
   *
   * @param name The route to show in place of the current top.
   * @param args The route's params (omitted for a `void` route).
   */
  replace<K extends keyof R>(name: K, ...args: NavArgs<R[K]>): void {
    this.navigate((stack) => replaceEntry(stack, String(name), args[0]), String(name), args[0]);
  }

  /**
   * Collapse the whole stack and start fresh with a single screen (`canGoBack()` becomes `false`).
   *
   * @param name The sole route to reset to.
   * @param args The route's params (omitted for a `void` route).
   */
  reset<K extends keyof R>(name: K, ...args: NavArgs<R[K]>): void {
    this.navigate(() => resetEntry(String(name), args[0]), String(name), args[0]);
  }

  /**
   * Pop the top screen and return to the previous one, rebuilding it. A no-op at the root (a single
   * frame): the state is unchanged and it returns `false`, so an app can decide its own root-back
   * policy from the return value.
   *
   * @returns `true` if a screen was popped, `false` when already at the root.
   */
  back(): boolean {
    const stack = this.stackSig();
    if (!canGoBack(stack)) return false;
    const next = backEntry(stack);
    const previous = topEntry(next);
    const bundle = this.tryBuild(previous.name, previous.params);
    if (bundle === null) return false; // rebuild failed → abort, current screen stays
    batch(() => {
      this.stackSig.set(next);
      this.applyBundle(bundle);
    });
    return true;
  }

  /**
   * The current location as `{ name, params }`. Reactive: reading it inside an `effect`/`bind`
   * re-runs that scope on every navigation.
   *
   * @returns The current route name and params.
   */
  location(): RouterLocation<R> {
    const top = topEntry(this.stackSig());
    return { name: top.name as keyof R, params: top.params as R[keyof R] };
  }

  /**
   * Whether there is a screen to go back to (the stack has more than one frame). Reactive: reading it
   * inside an `effect`/`bind` re-runs when the depth crosses one.
   *
   * @returns `true` if `back()` would pop a screen.
   */
  canGoBack(): boolean {
    return canGoBack(this.stackSig());
  }

  /**
   * Build the target screen first (isolated), then — only on success — update the stack and swap the
   * active view in one coalesced reactive batch. Building first means a throwing `build` aborts the
   * navigation with the current screen untouched.
   */
  private navigate(reduce: (stack: StackEntry[]) => StackEntry[], name: string, params: unknown): void {
    const bundle = this.tryBuild(name, params);
    if (bundle === null) return; // build failed → abort, current screen stays
    batch(() => {
      this.stackSig.set(reduce(this.stackSig()));
      this.applyBundle(bundle);
    });
  }

  /** Make `bundle` the active screen: swap the visible view and apply the screen's chrome contribution. */
  private applyBundle(bundle: ScreenBundle): void {
    this.activeBundle = bundle;
    this.activeView.set(bundle.view);
    this.applyChrome(bundle);
  }

  /**
   * Apply a screen's chrome to the shared bars: a present `status`/`menu` replaces that bar, an
   * absent one restores the app base (`null`). A no-op until the app wires a chrome host.
   */
  private applyChrome(bundle: ScreenBundle): void {
    this.chromeHost?.setStatus(bundle.status ?? null);
    this.chromeHost?.setMenu(bundle.menu ?? null);
  }

  /** Build a route's screen bundle, isolating a throw (logged, returns `null`) — mirrors draw-error isolation. */
  private tryBuild(name: string, params: unknown): ScreenBundle | null {
    const route = this.routes[name as keyof R] as Route<unknown> | undefined;
    try {
      if (route === undefined) throw new Error(`unknown route: ${name}`);
      // `untrack` so a signal a screen reads while building does not subscribe the router's own scope.
      return untrack(() => route.build({ params }));
    } catch (error) {
      this.logger.error('router', 'route build threw', { route: name, error: String(error) });
      return null;
    }
  }
}

/**
 * Create a navigation / screen router — a full-screen screen stack that mounts as an application's
 * `content` body. Typed by a `Routes` map (`{ routeName: paramsType }`), so navigation is param-safe.
 *
 * @param opts The initial route, the route table, and an optional logger.
 * @returns A {@link Router} — pass it as `createApplication({ content: router })` and drive it with
 *   `push`/`back`/`replace`/`reset`.
 * @example
 * import { createApplication, createRouter } from '@jsvision/ui';
 *
 * type Routes = { home: void; detail: { id: number } };
 *
 * const router = createRouter<Routes>({
 *   initial: { name: 'home' },
 *   routes: {
 *     home: { build: () => ({ view: new HomeScreen() }) },
 *     detail: { build: (ctx) => ({ view: new DetailScreen(ctx.params.id) }) },
 *   },
 * });
 *
 * const app = createApplication({ content: router });
 * router.push('detail', { id: 42 }); // typed against Routes
 */
export function createRouter<R>(opts: RouterOptions<R>): Router<R> {
  return new Router<R>(opts);
}
