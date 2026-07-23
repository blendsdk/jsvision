/**
 * `Group` — a container view that holds and stacks child views.
 *
 * Children are kept in an ordered `children` array, and that order is the paint order:
 * back-to-front, so a later child draws over an earlier one. Set an optional `background` theme role
 * to fill the group's rect before children paint, so overlapping windows never leak stale cells.
 * Each child added to a mounted group gets its reactive scope nested under the group's, so unmounting
 * the group (or removing the child) tears the child's effects down automatically.
 *
 * Use {@link add}/{@link remove} for static children, and {@link addDynamic} to drive children
 * reactively from a `Show`/`For` accessor.
 */
import type { Owner } from '../reactive/index.js';
import { runWithOwner, effect } from '../reactive/index.js';
import { View } from './view.js';
import type { ViewHost } from './view.js';
import type { DrawContext, ThemeRoleName } from './types.js';

/**
 * A reactive child producer: a `Show<View>` accessor (`() => View | undefined`) or a `For<T, View>`
 * accessor (`() => View[]`). Built by a {@link DynamicBuilder} at mount.
 */
type DynamicProducer = (() => View | undefined) | (() => View[]);

/**
 * A factory that **constructs** a {@link DynamicProducer} — i.e. it calls `Show(...)`/`For(...)`
 * inside itself. The factory shape (`() => Show(...)`) is what lets the group create the combinator
 * under its own scope and dispose it on unmount; passing an already-constructed accessor would leave
 * the combinator's reactive nodes attached to whatever scope was active at call time (usually none),
 * leaking a live reconcile after the group is gone.
 */
type DynamicBuilder = () => DynamicProducer;

/**
 * A retained container of child views.
 *
 * @example
 * import { View, createRenderRoot, row, grow, type DrawContext } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * class Panel extends View {
 *   constructor(private readonly label: string) { super(); }
 *   draw(ctx: DrawContext) { ctx.fill(' ', ctx.color('window')); ctx.text(1, 0, this.label); }
 * }
 *
 * const left = new Panel('left');
 * const right = new Panel('right');
 * // Argument order is paint order, back-to-front: `left` is drawn first.
 * const root = row({ gap: 1, padding: 1 }, grow(left), grow(right));
 * root.background = 'desktop';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * createRenderRoot({ width: 40, height: 8 }, { caps }).mount(root);
 */
export class Group extends View {
  /** Ordered children; array order is paint order (back-to-front). */
  readonly children: View[] = [];
  /** Optional background theme role filled before children compose, so overlap never leaks cells. */
  background?: ThemeRoleName;
  /**
   * @internal The focused child in this group's local order; `null` until focus enters this group.
   * The focus manager maintains it; the root→leaf path of `current` pointers is the global focus chain.
   */
  current: View | null = null;

  /** Reactive child-producer factories registered via {@link addDynamic} (built + started at mount). */
  private readonly dynamicBuilders: DynamicBuilder[] = [];

  /** Fill the `background` role (if set) across the group rect; children are composed by the render root. */
  draw(ctx: DrawContext): void {
    if (this.background !== undefined) {
      ctx.fill(' ', ctx.color(this.background));
    }
  }

  /**
   * Add a child, appending it on top (later in the array draws in front). If this group is already
   * mounted, the child mounts immediately — its scope nested under this group's — and a reflow is
   * scheduled for the new layout; otherwise the child mounts when this group itself mounts.
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
   * Remove a child: dispose its scope (recursively disposing its descendants and running their
   * `onCleanup`), detach it, and schedule a reflow. Removing a non-child (or removing twice) is a
   * safe no-op.
   *
   * @param child The view to remove.
   */
  remove(child: View): void {
    const index = this.children.indexOf(child);
    if (index === -1) return;
    this.children.splice(index, 1);
    // If the removed child held this group's focus, clear the dangling `current` pointer (the focus
    // chain IS these pointers) and re-home focus to the next focusable sibling.
    const wasFocusChild = this.current === child;
    if (wasFocusChild) this.current = null;
    child.unmount(); // disposes the scope; the mount cleanup resets the child's wiring
    child.parent = null; // also covers the never-mounted case (unmount was a no-op)
    if (wasFocusChild) this.host?.healFocus?.(this);
    if (this.mounted) this.invalidateLayout();
  }

  /**
   * Add children reactively from a `Show`/`For` accessor, so the set of children updates itself as
   * signals change. When the group is mounted, an effect reads the accessor, mounts any newly
   * produced views, unmounts any that disappeared (firing their `onCleanup`), and schedules a
   * reflow on change. Pass a factory that *builds* the combinator inside itself, not an
   * already-built accessor — this lets the group own and dispose the combinator's reactive nodes on
   * unmount.
   *
   * @param build A factory that constructs the combinator, e.g. `() => Show(cond, then)` or
   *   `() => For(each, key, render)`.
   * @example
   * import { Group, View, signal, Show, type DrawContext } from '@jsvision/ui';
   *
   * class Panel extends View {
   *   draw(ctx: DrawContext) {
   *     ctx.fill(' ', ctx.color('window'));
   *   }
   * }
   *
   * const open = signal(false);
   * const group = new Group();
   * group.addDynamic(() => Show(() => open(), () => new Panel())); // Panel appears when `open` is true
   */
  addDynamic(build: DynamicBuilder): void {
    this.dynamicBuilders.push(build);
    if (this.mounted) this.startDynamic(build);
  }

  /**
   * @internal Mount the group, then mount every static child **under the group's scope** and start
   * each registered dynamic-child reconcile.
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
   * Construct the combinator and run its reconcile effect **under the group's scope**, so both the
   * combinator's own driving nodes and the reconcile effect are disposed on unmount.
   */
  private startDynamic(build: DynamicBuilder): void {
    let current: View[] = [];
    runWithOwner(this.scope, () => {
      // Build the Show/For here so it is owned by the group scope, then subscribe to it.
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
    // Heal a dangling focus pointer at the removed dynamic child, then re-home focus.
    const wasFocusChild = this.current === view;
    if (wasFocusChild) this.current = null;
    view.unmount();
    view.parent = null;
    if (wasFocusChild) this.host?.healFocus?.(this);
  }
}
