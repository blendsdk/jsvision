/**
 * `createRouter` — a full-screen screen stack for `@jsvision/ui`.
 *
 * A router is the app body's answer to "one screen at a time, navigated as a stack" — wizards,
 * installers, drill-down browsers, dashboards — the complement to the `Desktop` window manager. It is
 * a `Group` (so it *is* the body view, swapping its single visible screen) that also carries the
 * navigation API (`push`/`back`/`replace`/`reset`) and reactive accessors (`location`/`canGoBack`).
 *
 * Pass a router as `createApplication({ content: router })`; the app hands it a chrome seam so each
 * screen can drive the shared menu/status bars, and a focus seam so focus survives navigation.
 * Navigating away disposes a screen by default (its `onCleanup` runs) and rebuilds it fresh on return;
 * opt into `keepAlive` per route to keep one mounted-but-hidden so its state survives a round-trip. A
 * route's `build` that throws is isolated — the navigation aborts, the current screen stays, and the
 * error is logged.
 */
import { createLogger } from '@jsvision/core';
import type { Logger } from '@jsvision/core';
import { Group } from '../view/index.js';
import type { View } from '../view/index.js';
import { signal, batch, untrack, For } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type {
  Route,
  RouteMap,
  RouterOptions,
  RouterLocation,
  ScreenBundle,
  ChromeHost,
  ChromeHostAware,
  FocusHost,
  FocusHostAware,
} from './types.js';
import { focusPath, viewAtPath, firstFocusableLeaf, findFocusByKey } from './focus.js';

/**
 * The trailing arguments of a navigation call for a route with param type `P`: none for a `void`
 * route, exactly `[params]` otherwise. This is what makes `router.push('detail', { id })` typed and
 * `router.push('home')` param-less against the same generic.
 */
export type NavArgs<P> = P extends void ? [] : [params: P];

/**
 * One entry on the router's screen stack — the imperative bookkeeping behind a route. A frame retains
 * its built screen `view` while it is the active top or kept warm, and drops it to `null` when a
 * default (non-`keepAlive`) screen is disposed on navigate-away, to be rebuilt on return. The saved
 * focus fields capture where focus sat when the frame was last left, so it can be restored.
 */
interface Frame {
  /** The route name this frame shows. */
  readonly name: string;
  /** The params the frame was entered with. */
  readonly params: unknown;
  /** Whether this route opted into staying mounted-hidden when navigated away from. */
  readonly keepAlive: boolean;
  /** The route's optional focus-key resolver, copied here so restore does not re-look-up the route. */
  readonly focusKey?: (view: View) => string;
  /** The mounted screen view, or `null` when disposed (a default frame that was navigated away from). */
  view: View | null;
  /** The screen's chrome contribution, retained so it re-applies on every activation (warm or rebuilt). */
  bundle: ScreenBundle | null;
  /** The exact view focused when this frame was last left (exact-restore tier for a warm frame). */
  savedFocus: View | null;
  /** The child-index path of the focused view (index-path restore tier for a rebuilt frame). */
  savedFocusPath: number[] | null;
  /** The `focusKey`-derived key of the focused view (screen-cooperative restore tier). */
  savedFocusKey: string | null;
}

/**
 * A navigation / screen router. Create one with {@link createRouter}; it is a `View` (a `Group`), so
 * it mounts as an application's `content` body. See {@link createRouter} for the full contract.
 */
export class Router<R> extends Group implements ChromeHostAware, FocusHostAware {
  private readonly routes: RouteMap<R>;
  private readonly logger: Logger;
  /** The screen stack, top last. Always holds at least the initial frame. Not reactive — see `rev`. */
  private frames: Frame[];
  /** Bumped on every navigation; drives the keyed-`For` reconcile and the reactive `location`/`canGoBack`. */
  private readonly rev: Signal<number>;
  /** The app chrome seam; `null` until `createApplication` wires it (a standalone router has none). */
  private chromeHost: ChromeHost | null = null;
  /** The app focus seam; `null` until wired (a standalone router relies on the loop's focus-healing floor). */
  private focusHost: FocusHost | null = null;

  /**
   * @param opts The initial route, the route table, and an optional logger for isolated build errors.
   */
  constructor(opts: RouterOptions<R>) {
    super();
    this.routes = opts.routes;
    this.logger = opts.logger ?? createLogger();
    this.rev = signal(0);
    // Render the live screens as direct children, keyed by view identity: the active screen plus any
    // kept-warm ones. Only the top is visible; hidden warm screens are omitted from reflow, so the
    // one visible `fr:1` screen fills the router. A view leaving the set is unmounted+disposed.
    this.addDynamic(() =>
      For(
        () => this.liveViews(),
        (view) => view,
        (view) => view,
      ),
    );
    // Build the initial screen now, so it is ready when the router mounts. A failed build leaves the
    // frame with no view (nothing renders) but still tracks the location.
    const name = String(opts.initial.name);
    const params = (opts.initial as { params?: unknown }).params;
    const built = this.buildScreen(name, params);
    this.frames = [this.makeFrame(name, params, built?.view ?? null, built?.bundle ?? null)];
  }

  /**
   * @internal Receive the app chrome seam (implements {@link ChromeHostAware}) and immediately apply
   * the current screen's chrome — the initial screen is built before the host attaches, so this
   * catches it up.
   */
  attachChromeHost(host: ChromeHost): void {
    this.chromeHost = host;
    const top = this.top();
    if (top.bundle !== null) this.applyChrome(top.bundle);
  }

  /**
   * @internal Receive the app focus seam (implements {@link FocusHostAware}), enabling exact/rebuilt
   * focus restore across navigation. Without it, the loop's own focus-healing still provides the
   * first-focusable floor.
   */
  attachFocusHost(host: FocusHost): void {
    this.focusHost = host;
  }

  /**
   * Push a new screen on top of the stack, making it the current screen. Typed against the route map:
   * a param-bearing route requires its params, a `void` route takes none.
   *
   * @param name The route to navigate to.
   * @param args The route's params (omitted for a `void` route).
   * @example
   * router.push('detail', { id: 42 });
   * router.push('home');
   */
  push<K extends keyof R>(name: K, ...args: NavArgs<R[K]>): void {
    const params = args[0];
    const built = this.buildScreen(String(name), params);
    if (built === null) return; // build failed → abort, current screen stays
    const current = this.top();
    const frame = this.makeFrame(String(name), params, built.view, built.bundle);
    batch(() => {
      this.saveFocus(current); // remember where focus sat, to restore on `back`
      if (!current.keepAlive) current.view = null; // dispose a default frame; keep a warm one mounted
      this.frames.push(frame);
      this.commit();
    });
    this.afterActivate(frame); // a fresh screen → chrome + first-focusable
  }

  /**
   * Replace the current top screen with a new one — the stack depth does not change.
   *
   * @param name The route to show in place of the current top.
   * @param args The route's params (omitted for a `void` route).
   */
  replace<K extends keyof R>(name: K, ...args: NavArgs<R[K]>): void {
    const params = args[0];
    const built = this.buildScreen(String(name), params);
    if (built === null) return; // build failed → abort, current screen stays
    const current = this.top();
    const frame = this.makeFrame(String(name), params, built.view, built.bundle);
    batch(() => {
      current.view = null; // the replaced screen is discarded (disposed)
      this.frames[this.frames.length - 1] = frame;
      this.commit();
    });
    this.afterActivate(frame);
  }

  /**
   * Collapse the whole stack and start fresh with a single screen (`canGoBack()` becomes `false`).
   *
   * @param name The sole route to reset to.
   * @param args The route's params (omitted for a `void` route).
   */
  reset<K extends keyof R>(name: K, ...args: NavArgs<R[K]>): void {
    const params = args[0];
    const built = this.buildScreen(String(name), params);
    if (built === null) return; // build failed → abort, current stack stays
    const frame = this.makeFrame(String(name), params, built.view, built.bundle);
    batch(() => {
      for (const f of this.frames) f.view = null; // dispose every screen, warm ones included
      this.frames = [frame];
      this.commit();
    });
    this.afterActivate(frame);
  }

  /**
   * Pop the top screen and return to the previous one — reusing it if it was kept warm, else rebuilding
   * it fresh. A no-op at the root (a single frame): the state is unchanged and it returns `false`, so an
   * app can decide its own root-back policy from the return value.
   *
   * @returns `true` if a screen was popped, `false` when already at the root.
   */
  back(): boolean {
    if (this.frames.length <= 1) return false;
    const current = this.top();
    const previous = this.frames[this.frames.length - 2];
    // Rebuild the previous screen only if it was disposed (a default frame). A warm frame is reused.
    let rebuilt: { view: View; bundle: ScreenBundle } | null = null;
    if (previous.view === null) {
      rebuilt = this.buildScreen(previous.name, previous.params);
      if (rebuilt === null) return false; // rebuild failed → abort, current screen stays
    }
    batch(() => {
      current.view = null; // the popped screen leaves the stack → disposed
      this.frames.pop();
      if (rebuilt !== null) {
        previous.view = rebuilt.view;
        previous.bundle = rebuilt.bundle;
        previous.savedFocus = null; // the old view ref is stale; restore via index-path/key/floor
      }
      this.commit();
    });
    this.afterActivate(previous);
    return true;
  }

  /**
   * The current location as `{ name, params }`. Reactive: reading it inside an `effect`/`bind`
   * re-runs that scope on every navigation.
   *
   * @returns The current route name and params.
   */
  location(): RouterLocation<R> {
    this.rev(); // subscribe: re-run on navigation
    const top = this.top();
    return { name: top.name as keyof R, params: top.params as R[keyof R] };
  }

  /**
   * Whether there is a screen to go back to (the stack has more than one frame). Reactive: reading it
   * inside an `effect`/`bind` re-runs when the depth crosses one.
   *
   * @returns `true` if `back()` would pop a screen.
   */
  canGoBack(): boolean {
    this.rev(); // subscribe: re-run on navigation
    return this.frames.length > 1;
  }

  // --- internals --------------------------------------------------------------------------------

  /** The top (active) frame; the stack always holds at least the initial frame. */
  private top(): Frame {
    return this.frames[this.frames.length - 1];
  }

  /** The mounted screen views, active + warm, in stack order — the keyed-`For` input (reads `rev`). */
  private liveViews(): View[] {
    this.rev(); // subscribe so a navigation re-runs the reconcile
    const out: View[] = [];
    for (const frame of this.frames) if (frame.view !== null) out.push(frame.view);
    return out;
  }

  /**
   * Finish a navigation inside the reactive batch: flip visibility so only the top screen shows, then
   * bump `rev` to drive the `For` reconcile (mount/dispose) and the reactive accessors in one frame.
   */
  private commit(): void {
    const top = this.top();
    for (const frame of this.frames) {
      if (frame.view !== null) frame.view.state.visible = frame === top;
    }
    this.rev.update((n) => n + 1);
  }

  /** After the batch mounts the new view: apply the screen's chrome and restore/settle its focus. */
  private afterActivate(frame: Frame): void {
    if (frame.bundle !== null) this.applyChrome(frame.bundle);
    this.restoreFocus(frame);
  }

  /** Build a route's screen and pin it to fill the router (`fr:1`); isolate a throw (logged → `null`). */
  private buildScreen(name: string, params: unknown): { view: View; bundle: ScreenBundle } | null {
    const bundle = this.tryBuild(name, params);
    if (bundle === null) return null;
    // A screen fills the router: an `fr:1` child of the default-row router takes the full area, and
    // hidden warm siblings are omitted from reflow. Merge so a screen keeps its own inner layout.
    bundle.view.layout = { ...bundle.view.layout, size: { kind: 'fr', weight: 1 } };
    return { view: bundle.view, bundle };
  }

  /** Build a route's bundle, isolating a throw (logged, returns `null`) — mirrors draw-error isolation. */
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

  /** Build a frame descriptor, copying the route's keep-alive + focus-key policy for later use. */
  private makeFrame(name: string, params: unknown, view: View | null, bundle: ScreenBundle | null): Frame {
    const route = this.routes[name as keyof R] as Route<unknown> | undefined;
    return {
      name,
      params,
      keepAlive: route?.keepAlive === true,
      focusKey: route?.focusKey,
      view,
      bundle,
      savedFocus: null,
      savedFocusPath: null,
      savedFocusKey: null,
    };
  }

  /**
   * Apply a screen's chrome to the shared bars: a present `status`/`menu` replaces that bar, an
   * absent one restores the app base (`null`). A no-op until the app wires a chrome host.
   */
  private applyChrome(bundle: ScreenBundle): void {
    this.chromeHost?.setStatus(bundle.status ?? null);
    this.chromeHost?.setMenu(bundle.menu ?? null);
  }

  /**
   * Capture where focus sits within `frame`'s screen so `back()` can restore it. Records the exact
   * view (for a warm frame), its child-index path (for a rebuilt one), and its `focusKey` (if the
   * route supplies one). A no-op without a focus host or when focus is not inside this screen.
   */
  private saveFocus(frame: Frame): void {
    frame.savedFocus = null;
    frame.savedFocusPath = null;
    frame.savedFocusKey = null;
    const host = this.focusHost;
    if (host === null || frame.view === null) return;
    const focused = host.getFocused();
    if (focused === null) return;
    const path = focusPath(frame.view, focused);
    if (path === null) return; // focus was not within this screen
    frame.savedFocus = focused;
    frame.savedFocusPath = path;
    if (frame.focusKey !== undefined) frame.savedFocusKey = frame.focusKey(focused);
  }

  /**
   * Restore focus into a re-activated screen in tier order: the exact saved view for a warm frame, a
   * `focusKey` match or same-position (index-path) view for a rebuilt one, else the first focusable
   * leaf. A no-op without a focus host — the loop's focus-healing floors it instead.
   */
  private restoreFocus(frame: Frame): void {
    const host = this.focusHost;
    const view = frame.view;
    if (host === null || view === null) return;

    // Exact: a warm frame whose saved view is still mounted and still inside this screen.
    if (frame.savedFocus !== null && frame.savedFocus.mounted && focusPath(view, frame.savedFocus) !== null) {
      host.focusView(frame.savedFocus);
      return;
    }
    // Screen-cooperative: a rebuilt frame whose route supplies a focus key.
    if (frame.savedFocusKey !== null && frame.focusKey !== undefined) {
      const target = findFocusByKey(view, frame.focusKey, frame.savedFocusKey);
      if (target !== null) {
        host.focusView(target);
        return;
      }
    }
    // Index-path (automatic): the same-position leaf of an identically-structured rebuild.
    if (frame.savedFocusPath !== null) {
      const target = viewAtPath(view, frame.savedFocusPath);
      if (target !== null) {
        host.focusView(target);
        return;
      }
    }
    // Floor: the screen's first focusable (also the target for a brand-new pushed screen).
    const floor = firstFocusableLeaf(view);
    if (floor !== null) host.focusView(floor);
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
