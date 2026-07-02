/**
 * `Group` (RD-03) — the one concrete RD-03 container. It owns ordered `children` (array order =
 * z-order, back-to-front, AR-38), fills an optional `background` theme role so overlap never
 * leaks stale cells (AR-38), and wires each added child's owner scope **under its own** scope at
 * mount (AR-36, AR-43). The render root's compose walker (Phase 5) draws the background then
 * recurses into children; `Group.draw` itself only fills the background (child iteration stays
 * centralized in the walker, keeping clip/offset in one place).
 */
import type { Owner } from '../reactive/index.js';
import { runWithOwner, effect } from '../reactive/index.js';
import { View } from './view.js';
import type { ViewHost } from './view.js';
import type { DrawContext, ThemeRoleName } from './types.js';

/**
 * A reactive child producer: a `Show<View>` accessor (`() => View | undefined`) or a
 * `For<T, View>` accessor (`() => View[]`). Built by a {@link DynamicBuilder} at mount.
 */
type DynamicProducer = (() => View | undefined) | (() => View[]);

/**
 * A factory that **constructs** a {@link DynamicProducer} — i.e. calls `Show(...)`/`For(...)` — so the
 * combinator's driving effect/computeds are created under the group's owner scope (RD-13 HR-13). The
 * factory shape (`() => Show(...)`) is what lets the group own and dispose the combinator on unmount;
 * passing the already-constructed accessor would leave its nodes attached to the ambient owner at call
 * time (usually `null`) and leaking a live reconcile after the group is gone.
 */
type DynamicBuilder = () => DynamicProducer;

/** A retained container of child views. */
export class Group extends View {
  /** Ordered children; array order is paint order (back-to-front, AR-38). */
  readonly children: View[] = [];
  /** Optional background theme role filled before children compose (AR-38). */
  background?: ThemeRoleName;
  /**
   * @internal The focused child in this group's local order; `null` until focus enters this group.
   * The RD-04 focus manager maintains it; the root→leaf path of `current` pointers is the global
   * focus chain (AR-48).
   */
  current: View | null = null;

  /** Reactive child-producer factories registered via {@link addDynamic} (built + started at mount). */
  private readonly dynamicBuilders: DynamicBuilder[] = [];

  /** Fill the `background` role (if set) across the group rect; children are composed by the walker. */
  draw(ctx: DrawContext): void {
    if (this.background !== undefined) {
      ctx.fill(' ', ctx.color(this.background));
    }
  }

  /**
   * Add a child: set its parent and append it (z-order = array order). If this group is already
   * mounted, mount the child subtree immediately (its scope nests under this group's, AR-43) and
   * schedule a reflow for the structural change (AR-33); otherwise the child mounts when this
   * group itself mounts.
   *
   * @param child The view to append.
   */
  add(child: View): void {
    child.parent = this;
    this.children.push(child);
    if (this.mounted) {
      child.mount(this.host, this.scope);
      this.invalidateLayout();
    }
  }

  /**
   * Remove a child: dispose its scope (recursively disposing descendants and running their
   * `onCleanup`, AR-36), detach it, and schedule a reflow. Removing a non-child (or removing
   * twice) is a safe no-op.
   *
   * @param child The view to remove.
   */
  remove(child: View): void {
    const index = this.children.indexOf(child);
    if (index === -1) return;
    this.children.splice(index, 1);
    // HR-10 (PA-10): if the removed child was this group's focused child, clear the dangling `current`
    // pointer (the focus chain IS these pointers) and re-home focus to the next focusable sibling.
    const wasFocusChild = this.current === child;
    if (wasFocusChild) this.current = null;
    child.unmount(); // disposes the scope; the mount cleanup resets the child's wiring (RT-3)
    child.parent = null; // also cover the never-mounted case (unmount was a no-op)
    if (wasFocusChild) this.host?.healFocus?.(this);
    if (this.mounted) this.invalidateLayout();
  }

  /**
   * Register a reactive child producer — a `Show<View>` or `For<T, View>` accessor — distinct from
   * the static {@link add} because a producer is an accessor, not a `View` (AR-36, PF-001). When
   * this group is mounted a reconcile **effect** runs under the group's scope: it reads the
   * accessor (subscribing), diffs the produced views against the currently-mounted dynamic
   * children, mounts the new ones and unmounts the gone ones (their `onCleanup` fires), and
   * schedules a reflow on any change. If the group is not yet mounted the reconcile starts when it
   * mounts.
   *
   * @param build A factory that constructs the combinator, e.g. `() => Show(cond, then)` /
   *   `() => For(each, key, render)` (RD-13 HR-13 — the factory shape lets the group own the
   *   combinator's reactive nodes so they dispose on unmount).
   */
  addDynamic(build: DynamicBuilder): void {
    this.dynamicBuilders.push(build);
    if (this.mounted) this.startDynamic(build);
  }

  /**
   * @internal Mount the group, then mount every static child **under the group's scope** and start
   * each registered dynamic-child reconcile (AR-36, AR-43).
   */
  override mount(host: ViewHost | null, parentScope: Owner | null): void {
    super.mount(host, parentScope);
    for (const child of this.children) {
      child.mount(host, this.scope);
    }
    for (const build of this.dynamicBuilders) {
      this.startDynamic(build);
    }
  }

  /**
   * Construct the combinator and run its reconcile effect **under the group's scope** (AR-36, HR-13),
   * so both the combinator's own driving nodes and the reconcile effect are disposed on unmount.
   */
  private startDynamic(build: DynamicBuilder): void {
    let current: View[] = [];
    runWithOwner(this.scope, () => {
      // Build the Show/For here (owned by the group scope, HR-13), then subscribe to it.
      const producer = build();
      effect(() => {
        const produced = producer();
        const next: View[] = Array.isArray(produced)
          ? produced.filter((view): view is View => view !== undefined && view !== null)
          : produced !== undefined && produced !== null
            ? [produced]
            : [];

        for (const view of current) {
          if (!next.includes(view)) this.unmountDynamicChild(view);
        }
        for (const view of next) {
          if (!current.includes(view)) this.mountDynamicChild(view);
        }
        current = next;
        if (this.mounted) this.invalidateLayout(); // one structural reflow per reconcile
      });
    });
  }

  /** Mount a produced view as a child under this group's scope (no per-child reflow). */
  private mountDynamicChild(view: View): void {
    view.parent = this;
    this.children.push(view);
    view.mount(this.host, this.scope);
  }

  /** Unmount a produced view that is no longer produced (disposes its scope → onCleanup fires). */
  private unmountDynamicChild(view: View): void {
    const index = this.children.indexOf(view);
    if (index !== -1) this.children.splice(index, 1);
    // HR-10 (PA-10): heal a dangling focus pointer at the removed dynamic child, then re-home focus.
    const wasFocusChild = this.current === view;
    if (wasFocusChild) this.current = null;
    view.unmount();
    view.parent = null;
    if (wasFocusChild) this.host?.healFocus?.(this);
  }
}
