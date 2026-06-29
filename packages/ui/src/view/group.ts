/**
 * `Group` (RD-03) — the one concrete RD-03 container. It owns ordered `children` (array order =
 * z-order, back-to-front, AR-38), fills an optional `background` theme role so overlap never
 * leaks stale cells (AR-38), and wires each added child's owner scope **under its own** scope at
 * mount (AR-36, AR-43). The render root's compose walker (Phase 5) draws the background then
 * recurses into children; `Group.draw` itself only fills the background (child iteration stays
 * centralized in the walker, keeping clip/offset in one place).
 */
import type { Owner } from '../reactive/index.js';
import { View } from './view.js';
import type { ViewHost } from './view.js';
import type { DrawContext, ThemeRoleName } from './types.js';

/** A retained container of child views. */
export class Group extends View {
  /** Ordered children; array order is paint order (back-to-front, AR-38). */
  readonly children: View[] = [];
  /** Optional background theme role filled before children compose (AR-38). */
  background?: ThemeRoleName;

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
   * @internal Mount the group, then mount every child **under the group's scope** so disposing the
   * group disposes the whole subtree (AR-36, AR-43).
   */
  override mount(host: ViewHost | null, parentScope: Owner | null): void {
    super.mount(host, parentScope);
    for (const child of this.children) {
      child.mount(host, this.scope);
    }
  }
}
