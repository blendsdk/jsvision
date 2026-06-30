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
 * `For<T, View>` accessor (`() => View[]`). Registered via {@link Group.addDynamic}.
 */
type DynamicProducer = (() => View | undefined) | (() => View[]);

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

  /** Reactive child producers registered via {@link addDynamic} (started at mount). */
  private readonly dynamicProducers: DynamicProducer[] = [];

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
    child.unmount(); // disposes the scope; the mount cleanup resets the child's wiring (RT-3)
    child.parent = null; // also cover the never-mounted case (unmount was a no-op)
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
   * @param producer A `Show<View>(...)` / `For<T, View>(...)` accessor.
   */
  addDynamic(producer: DynamicProducer): void {
    this.dynamicProducers.push(producer);
    if (this.mounted) this.startReconcile(producer);
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
    for (const producer of this.dynamicProducers) {
      this.startReconcile(producer);
    }
  }

  /** Run the reconcile effect for one producer under the group's scope (AR-36). */
  private startReconcile(producer: DynamicProducer): void {
    let current: View[] = [];
    runWithOwner(this.scope, () => {
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
    view.unmount();
    view.parent = null;
  }
}
