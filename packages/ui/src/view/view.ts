/**
 * `View` — the base class for every widget in the tree.
 *
 * A view is a persistent object that keeps its identity across frames. It carries a parent-relative
 * `bounds`, a small set of `state` flags, layout props, an overridable `draw(ctx)`, an `onEvent`
 * hook, the reactive `bind` helper for binding signals to redraws, invalidation methods to request a
 * repaint or reflow, and a per-view reactive scope that is created at mount and disposed at unmount.
 *
 * Subclass `View` and override `draw()` (and optionally `onEvent`) to build a custom widget. Because
 * each view's scope is created **under its parent's** scope, unmounting any part of the tree disposes
 * every descendant's effects and runs their `onCleanup` — so views never leak.
 */
import type { Owner, Signal } from '../reactive/index.js';
import { runWithOwner, untrack, createRoot, effect, onCleanup, getOwner, signal, computed } from '../reactive/index.js';
import { TuiError } from '@jsvision/core';
import type { Rect, Size2D, LayoutProps } from '../layout/index.js';
import type { DrawContext, ViewState, DispatchEvent } from './types.js';
import type { Point } from './geometry.js';

/**
 * The internal seam a `View` uses to talk to its render root — how a view requests a repaint or
 * reflow. The `RenderRoot` implements this. Declared here (not in `types.ts`) so the method
 * signatures can reference `View` without a type cycle.
 */
export interface ViewHost {
  /** Mark a view as needing a repaint and schedule a frame. */
  markRepaint(view: View): void;
  /** Mark the tree as needing a reflow and schedule a frame. */
  markRelayout(): void;
  /**
   * Re-home focus after `group` lost its currently-focused child to removal. Optional: wired only
   * when an event loop is attached (it owns the focus manager). A standalone render root leaves it
   * unset, so `Group.remove` just clears its focus pointer.
   *
   * @param group The group whose focused child was removed.
   */
  healFocus?(group: View): void;
}

/**
 * Abstract widget base. Subclass it and implement `draw`; `Group` (the built-in container) is the
 * only concrete subclass shipped here.
 *
 * @example
 * import { View, Group, createRenderRoot, type DrawContext } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * class Clock extends View {
 *   constructor(private readonly read: () => string) { super(); }
 *   draw(ctx: DrawContext): void {
 *     ctx.fill(' ', ctx.color('statusBar'));
 *     ctx.text(1, 0, this.read(), ctx.color('statusBar'));
 *   }
 * }
 *
 * const clock = new Clock(() => new Date().toLocaleTimeString());
 * const root = new Group();
 * root.add(clock);
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * createRenderRoot({ width: 40, height: 3 }, { caps }).mount(root);
 */
export abstract class View {
  /** Parent-relative integer rect; written by the layout pass — read it in `draw`/hit-testing. */
  bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** Draw-against flags. The object reference is fixed; individual fields mutate (e.g. `focused`). */
  readonly state: ViewState = { visible: true, disabled: false, focused: false };
  /**
   * Layout props for this view (direction, size, padding, absolute placement, …) — **read-only**.
   *
   * Change them with {@link setLayout}, which is the only writer. The field and every prop on it are
   * closed, so neither `view.layout = {…}` nor `view.layout.rect = {…}` compiles, and neither does
   * editing a solved rect a field at a time (`view.layout.rect.x = 5`). That is deliberate: a
   * wholesale assignment silently drops every prop it omits and never reflows, and an in-place prop
   * write reflows only if you remember to ask.
   *
   * Read it freely — this is where a view's solved intent lives, and `layout.rect` is how an
   * absolutely-placed view reports where it was put.
   */
  readonly layout: Readonly<LayoutProps> = {};
  /** Optional intrinsic-size hook for `auto` sizing — return the size this view wants for `available`. */
  measure?(available: Size2D): Size2D;

  /**
   * When true, the renderer paints a drop shadow on the cells just below and to the right of this
   * view, in paint order (a later sibling's shadow falls over an earlier one). Default `false`. The
   * `Desktop` sets it per window.
   */
  castsShadow = false;

  /**
   * When true, the layout pass recentres this view within its parent after layout —
   * `origin = (parent - self) / 2` on both axes. Intended for absolutely-placed views (a modal
   * dialog, a message box) whose size is fixed and whose origin would otherwise be placed by the
   * caller. Default `false`; `Dialog` sets it when centered.
   */
  centered = false;

  // --- Input/focus surface (defaults keep a plain view inert) -----------------------------------
  /**
   * Whether this view can receive keyboard focus. Effective focusability also requires the view to be
   * visible and enabled with no hidden/disabled ancestor. Default `false`; the focus manager drives
   * the `state.focused` flag.
   */
  focusable = false;
  /**
   * Whether a mouse-down that hits this view moves keyboard focus to it. Default `true` — the usual
   * click-to-focus. Set `false` for a control that should act on a click without stealing focus from
   * whatever is focused (e.g. a dialog Cancel button, or a toolbar/stepper button): the click still
   * dispatches, but the previously-focused view keeps focus, so it never fires a focus-leave side
   * effect such as a field's blur-validation. Independent of {@link focusable} — a `grabsFocus: false`
   * view can still be reached by `Tab` and activated by `Space`.
   */
  grabsFocus = true;
  /** Take part in the pre-process sweep (root→down, before the focused view sees the event). */
  preProcess = false;
  /** Take part in the post-process sweep (after the focused view sees the event). */
  postProcess = false;

  /**
   * @internal When true, this view roots its own accelerator scope, so an enclosing scope's
   * duplicate-accelerator check stops descending here (a nested `Dialog`/`TabView` owns its own
   * check). Default `false`; scope-owning containers set it in their constructor.
   */
  acceleratorScope = false;

  /**
   * The `Alt`+hotkey accelerator characters (lowercase) this view claims in its focus scope, for
   * duplicate-accelerator detection. The base returns none; accelerator-bearing widgets
   * (`Button`/`Label`/`CheckGroup`/`RadioGroup`) override it to report their `~X~` hotkey(s).
   *
   * @returns The claimed accelerator chars, or an empty list when the view claims none.
   */
  accelerators(): readonly string[] {
    return [];
  }

  /**
   * @internal Reactive focus-change tick. Lazily created by {@link focusSignal} the first time a
   * view's focus is observed; the focus manager pokes it on every focus flip. Stays `undefined`
   * (zero cost) for views nobody observes.
   */
  focusTick?: Signal<void>;

  /**
   * Subscribe to this view's focus changes. Reading the returned signal inside a `bind`/`effect`
   * re-runs that effect whenever this view gains or loses focus — including from *another* view (e.g.
   * a `Label` repainting when the control it labels is focused). The signal notifies on every poke
   * even without a value change. Lazy: the backing signal is created on first call.
   *
   * @returns A signal that ticks whenever this view gains or loses focus.
   * @example
   * import { View, Button, type DrawContext } from '@jsvision/ui';
   *
   * // A caption that highlights while the control it labels holds focus.
   * class Caption extends View {
   *   constructor(
   *     private readonly text: string,
   *     private readonly target: View,
   *   ) {
   *     super();
   *     // Reading the target's focus signal inside bind() ties this view's repaint to the target's
   *     // focus flips — a view can observe focus it does not own.
   *     this.onMount(() => this.bind(() => this.target.focusSignal()()));
   *   }
   *
   *   draw(ctx: DrawContext): void {
   *     ctx.text(0, 0, this.text, ctx.color(this.target.state.focused ? 'labelSelected' : 'label'));
   *   }
   * }
   *
   * const ok = new Button('~O~K');
   * const caption = new Caption('Confirm:', ok);
   */
  focusSignal(): Signal<void> {
    return (this.focusTick ??= signal(undefined, { equals: () => false }));
  }

  // --- Internal wiring --------------------------------------------------------------------------
  // These cross the module boundary to the render root, so they are `public` but marked `@internal`
  // — not part of the widget-author API.
  /** @internal The parent view, or `null` at the root / before wiring. */
  parent: View | null = null;
  /** @internal This view's reactive owner scope, created at mount; `null` before mount. */
  scope: Owner | null = null;
  /** @internal Disposes this view's scope. */
  disposeScope: (() => void) | null = null;
  /** @internal The render-root seam; `null` until mounted by a render root. */
  host: ViewHost | null = null;
  /** @internal Whether the view is currently in the live tree. */
  mounted = false;

  private readonly pendingMounts: Array<() => void> = [];
  private mountFired = false;

  /**
   * Paint this view through a clipped, view-local context. Every widget overrides this to draw
   * itself; the base declares it abstract so a subclass must supply it.
   *
   * @param ctx The view-local, auto-clipped paint API (see {@link DrawContext}).
   */
  abstract draw(ctx: DrawContext): void;

  /**
   * Handle an input event — a no-op by default. The event loop wraps each event in a
   * {@link DispatchEvent} envelope and routes it to the views; override this to react to keys/mouse
   * and set `ev.handled = true` to consume the event so it does not propagate further.
   *
   * @param _ev The dispatch envelope (the wrapped event plus the mutable `handled` flag).
   */
  onEvent(_ev: DispatchEvent): void {
    // intentionally empty (the base is inert; widgets override to handle input)
  }

  /**
   * Optional "select + raise on click" hook. Left undefined on the base, so a plain view is not a
   * select/raise target. A container that owns z-order (a `Window`) overrides it to select and raise
   * itself. The hit-test invokes the first ancestor that defines this — *before* delivering the
   * mouse-down — so a click always raises the window even if the interior also consumes the click.
   */
  selectByClick?(): void;

  /**
   * Where this view wants the hardware text cursor, in view-local cells, or `null` for no cursor (the
   * default — most views never show one). A focused text input overrides this to place the caret at
   * the edit position; the event loop reads it after each frame, converts it to an absolute cell, and
   * moves the terminal cursor there.
   *
   * @returns The view-local caret point (0-based, relative to this view's origin), or `null`.
   */
  desiredCaret(): Point | null {
    return null;
  }

  /** Request a repaint of this view. A no-op before the view is mounted (the first frame paints everything). */
  invalidate(): void {
    this.host?.markRepaint(this);
  }

  /** Request a reflow (re-run layout, then repaint). Use this when a change affects size/position, not just pixels. */
  invalidateLayout(): void {
    this.host?.markRelayout();
  }

  /**
   * Change some of this view's {@link layout} props and request a reflow — the **only** way to write
   * layout. Props the patch does not name are kept, and the reflow happens for you.
   *
   * The merge is **shallow**, deliberately: `size` and `rect` are replaced whole rather than merged
   * field-by-field. That is what makes a variant swap correct — going from `{kind:'fixed',cells:1}` to
   * `{kind:'fr',weight:1}` must not leave a stale `cells` behind. The cost is that per-side `padding`
   * cannot be patched one side at a time; pass the whole padding value.
   *
   * Two behaviours worth knowing:
   *
   * - **An explicit `undefined` resets that prop to its layout default.** `setLayout({ size: undefined })`
   *   makes the view auto-sized again, and `setLayout({ position: 'flow' })` puts an absolutely-placed
   *   view back in the flow (its now-unused `rect` is simply ignored).
   * - **Do not call it in a constructor of a class that subclasses may extend.** A base constructor
   *   body runs *before* a subclass's `override readonly layout = {…}` field initializer, and that
   *   initializer installs a fresh object, so the call would be erased. Call it after construction,
   *   or from `onMount`.
   *
   * Reflowing an unmounted view is a no-op, so calling it before mount is safe.
   *
   * @param patch The layout props to change; anything omitted is preserved.
   * @example
   * import { Group } from '@jsvision/ui';
   *
   * const panel = new Group();
   * panel.setLayout({ direction: 'col', padding: 1 });
   * // Later — `direction` and `padding` survive; once `panel` is mounted this also reflows:
   * panel.setLayout({ size: { kind: 'fr', weight: 1 } });
   */
  setLayout(patch: Partial<LayoutProps>): void {
    // Shallow on purpose: `size` is a discriminated union, so a deep merge would carry the previous
    // variant's fields into the new one and produce a token that matches no branch cleanly.
    //
    // In place rather than by replacement: the field is read-only, so it cannot be reassigned without
    // a cast, and identity-preservation is the documented contract — anything holding the object goes
    // on seeing current props rather than a snapshot frozen at the moment it took the reference.
    Object.assign(this.layout, patch);
    this.invalidateLayout();
  }

  /**
   * Bind a reactive value to a redraw. Creates an effect (owned by this view's scope) that reads
   * `reader()` — subscribing to whatever signals it touches — runs the optional `apply(value)`, then
   * requests a frame: a repaint by default, or a reflow when `{ relayout: true }`. It re-runs
   * automatically whenever those signals change, and is disposed when the view unmounts.
   *
   * Call it from {@link onMount}, not the constructor — the view's scope only exists once mounted, so
   * a pre-mount `bind` throws rather than silently dropping the binding.
   *
   * @param reader  Reads the reactive source; the signals it reads become dependencies.
   * @param apply   Optional: apply the read value to the widget (e.g. store it in a field).
   * @param opts    Pass `{ relayout: true }` when the change affects layout, so it reflows instead of
   *   just repainting.
   * @example
   * import { View, signal, type DrawContext } from '@jsvision/ui';
   *
   * const count = signal(0);
   *
   * class StatusLine extends View {
   *   draw(ctx: DrawContext): void {
   *     ctx.text(0, 0, `${count()} pending`, ctx.color('statusBar'));
   *   }
   * }
   *
   * const status = new StatusLine();
   * // In onMount, not the constructor: bind() needs the view's scope, which only exists once mounted.
   * status.onMount(() => {
   *   status.bind(() => count()); // repaint the status line whenever `count` changes
   * });
   */
  bind<T>(reader: () => T, apply?: (v: T) => void, opts?: { relayout?: boolean }): void {
    if (this.scope === null) {
      throw new TuiError('view.bind() requires a mounted view; call it in onMount()');
    }
    runWithOwner(this.scope, () => {
      effect(() => {
        const value = reader();
        apply?.(value);
        if (opts?.relayout === true) this.invalidateLayout();
        else this.invalidate();
      });
    });
  }

  /**
   * Create a **stable derived accessor** owned by this view's scope. The returned `() => T` keeps the
   * same identity for the life of the view, so it is safe to build in the constructor and hand to
   * child views before this view mounts. The backing `computed` is created lazily under the view's
   * own scope, so it is always owned and disposed at unmount — unlike a bare `computed()` in the
   * constructor, which would run before any scope exists, leak, and warn.
   *
   * Reads behave sensibly across the lifecycle:
   * - **Before mount:** evaluates `fn()` directly (correct current value, nothing persisted). Good
   *   for a pre-mount natural-size measure.
   * - **After mount:** builds and memoizes a `computed(fn)` under the view's scope.
   * - **After an unmount→remount:** the memo is keyed to the scope it was built under, so a remounted
   *   view (which gets a fresh scope) re-derives under the new scope instead of returning the
   *   previous mount's disposed, now-frozen computed — keeping a `Show`/`For`-remounted widget
   *   reactive.
   *
   * @param fn The derivation (pure; the signals it reads become the computed's dependencies).
   * @returns A stable accessor; call it to read the derived value.
   */
  protected derived<T>(fn: () => T): () => T {
    let memo: (() => T) | null = null;
    let memoScope: Owner | null = null;
    return (): T => {
      // Pre-mount: no scope yet — evaluate directly rather than leak an unowned computed.
      if (this.scope === null) return fn();
      // Build lazily under the current scope; re-derive if the scope changed (unmount→remount).
      if (memo === null || memoScope !== this.scope) {
        memoScope = this.scope;
        memo = runWithOwner(this.scope, () => computed(fn));
      }
      return memo();
    };
  }

  /**
   * Register a callback to run once when the view becomes live (after its first layout gives it
   * bounds). This is where to call {@link bind}, since the view's reactive scope exists by then.
   * Registering after the view is already live runs the callback immediately.
   *
   * @param fn Post-mount setup.
   */
  onMount(fn: () => void): void {
    if (this.mountFired) {
      fn();
      return;
    }
    this.pendingMounts.push(fn);
  }

  /**
   * Register a teardown callback that runs once when this view unmounts. Requires a mounted view — so
   * call it from within {@link onMount}. Use it to release anything the view acquired (a timer, an
   * external subscription).
   *
   * @param fn The teardown callback.
   */
  onCleanup(fn: () => void): void {
    if (this.scope === null) {
      throw new TuiError('view.onCleanup() requires a mounted view; call it in onMount()');
    }
    // A reactive `onCleanup` binds to the running effect first, so calling this inside a `bind` body
    // would attach `fn` to that effect and re-fire it on every re-run. `untrack` clears the running
    // effect so the cleanup falls through to the view scope, firing exactly once at unmount.
    runWithOwner(this.scope, () => untrack(() => onCleanup(fn)));
  }

  /**
   * @internal Mount this view: create its reactive scope **under `parentScope`** and wire the host. A
   * cleanup on the scope resets this view's wiring when disposed, so an unmount cascade auto-clears
   * every descendant. `Group` overrides this to recurse into its children under the new scope.
   *
   * @param host        The render-root seam (or `null` in lifecycle-only contexts).
   * @param parentScope The scope to nest this view's scope under.
   */
  mount(host: ViewHost | null, parentScope: Owner | null): void {
    // `untrack` so the scope setup (and its wiring-reset cleanup) binds to THIS view's scope, never to
    // an ambient effect — a view may be mounted from inside a reconcile effect (dynamic children),
    // where the cleanup would otherwise attach to that effect and fire at the wrong time.
    runWithOwner(parentScope, () => {
      untrack(() => {
        createRoot((dispose) => {
          this.scope = getOwner();
          this.disposeScope = dispose;
          this.host = host;
          this.mounted = true;
          onCleanup(() => {
            this.mounted = false;
            this.scope = null;
            this.host = null;
            this.parent = null;
            this.disposeScope = null;
            this.mountFired = false;
          });
        });
      });
    });
  }

  /**
   * @internal Fire the pending `onMount` callbacks exactly once, after the first layout gives the view
   * bounds (called by the layout pass for newly-mounted views). Idempotent.
   */
  runPendingMounts(): void {
    if (this.mountFired) return;
    this.mountFired = true;
    const callbacks = this.pendingMounts.splice(0, this.pendingMounts.length);
    for (const fn of callbacks) fn();
  }

  /**
   * @internal Unmount this view: dispose its scope, which recursively disposes descendant scopes and
   * runs their `onCleanup`. Idempotent.
   */
  unmount(): void {
    this.disposeScope?.();
  }
}
