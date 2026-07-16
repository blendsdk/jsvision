/**
 * The cell-aligned overlay helper — how an editor view is mounted over a grid cell.
 *
 * `mountCellOverlay` translates a body-local cell rect into the overlay host's own frame, mounts the
 * editor as an absolutely-placed child of the grid's overlay host, focuses it, and returns a disposer
 * that removes it and tears down its reactive scope. It is built from public `@jsvision/ui` primitives —
 * no frame or border chrome — so an editor that needs its own dropdown opens it through its own
 * widget.
 */
import { View, Group } from '@jsvision/ui';
import { createRoot } from '@jsvision/ui';

/** A cell rect in the grid body's local coordinates. */
export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A mounted view's absolute top-left, by summing parent-relative `bounds.x`/`y` up the tree (the root
 * bounds are absolute). Use it to get the body's absolute origin to pass as `origin` to
 * {@link mountCellOverlay}.
 *
 * @param view A mounted view.
 * @returns The view's absolute top-left cell `{ x, y }`.
 * @example
 * import { absoluteRect } from '@jsvision/datagrid';
 * // Given a mounted grid body view:
 * const origin = absoluteRect(grid.rows); // e.g. { x: 4, y: 3 }
 */
export function absoluteRect(view: View): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: View | null = view;
  while (node !== null) {
    x += node.bounds.x;
    y += node.bounds.y;
    node = node.parent;
  }
  return { x, y };
}

/**
 * Mount `view` over a cell: place it on the cell derived from a body-local cell rect (correct even
 * when the grid is nested far from the screen origin — the host's own offset is not double-counted),
 * focus it through the loop seam, and return a disposer that removes the view and disposes its reactive
 * scope (so its binding effects do not leak after the overlay closes). There is no frame or border — it
 * is a bare cell-aligned mount.
 *
 * Pass either a pre-built `view` or a `build` callback. `build` runs **inside** the mount's reactive
 * root, so an editor that creates binding effects at construction time (a typed editor's field bridges
 * do) has those effects owned by this scope and disposed on close. A `build` that returns `null` mounts
 * nothing (a read-only editor) and the returned disposer just tears down the empty root.
 *
 * @param args `host` (the grid's absolute overlay group), `loop` (the focus seam), `rect` (body-local
 *   cell rect), `origin` (the body's absolute origin, e.g. from {@link absoluteRect}), exactly one of
 *   `view` (a pre-built editor) or `build` (a factory run inside the root, returning the editor or
 *   `null`), and optional `clamp` — pass the host-local viewport `{ width, height }` to keep the mounted
 *   view within it (right-aligned/clamped so it never renders off-screen); omit it for a cell-pinned
 *   editor. If the built view set its own absolute `layout`, that size is honored (so a larger custom
 *   popup fits and is clamped by its true size).
 * @returns A `dispose()` that removes the view and disposes its reactive scope (idempotent-safe to
 *   call once).
 * @example
 * import { mountCellOverlay, absoluteRect } from '@jsvision/datagrid';
 * // Mount an editor over the focused cell (rect in body-local coords):
 * const dispose = mountCellOverlay({
 *   host: grid.overlay,
 *   loop,
 *   rect: { x: 2, y: 1, width: 8, height: 1 },
 *   origin: absoluteRect(grid.rows),
 *   view: editor,
 * });
 * // ...later, when editing ends:
 * dispose();
 */
export function mountCellOverlay(args: {
  host: Group;
  loop: { focusView(v: View): void };
  rect: CellRect;
  origin: { x: number; y: number };
  view?: View;
  build?: () => View | null;
  clamp?: { width: number; height: number };
}): () => void {
  const { host, loop, rect, origin } = args;
  // One reactive owner for the mount: any binding effects the editor sets up are torn down together
  // with the view when `dispose()` runs. `host.add` mounts the view under the host's scope; `remove`
  // disposes that scope (firing the view's `onCleanup`), and `dispose()` clears this owner too.
  return createRoot((dispose) => {
    // Build inside the root so factory-time effects (typed editor bridges) are owned by this scope.
    const view = args.build ? args.build() : (args.view ?? null);
    if (view === null) return dispose; // nothing to mount (e.g. a read-only editor resolved to null)
    // The absolute cell position is `origin + rect`. But an absolute-positioned view is placed
    // RELATIVE to its parent's content origin, and the parent here is `host` — itself already at some
    // absolute position (a grid nested inside an app shell sits far from the screen origin). So express
    // the cell in the host's local frame by subtracting the host's own absolute origin; otherwise the
    // host's offset is double-counted and the editor lands elsewhere. When the host is at the screen
    // origin this subtracts zero, so a grid at (0, 0) is unaffected.
    const hostOrigin = absoluteRect(host);
    // Honor a size the built view chose for itself (a custom filter popup that set its own absolute
    // layout can be larger than the default cell size); otherwise use the passed rect's size.
    const pre = view.layout;
    const width = pre?.position === 'absolute' && pre.rect ? pre.rect.width : rect.width;
    const height = pre?.position === 'absolute' && pre.rect ? pre.rect.height : rect.height;
    let x = origin.x + rect.x - hostOrigin.x;
    let y = origin.y + rect.y - hostOrigin.y;
    // Keep the overlay within the viewport when asked (a filter popup anchored near an edge):
    // right-align/clamp so it never renders off-screen. The caller passes the host-local viewport size
    // (the host is a fill layer that may not be re-laid-out yet, so its own bounds are unreliable here).
    // In-cell editors pass no clamp — they must stay pinned exactly to their cell.
    if (args.clamp !== undefined && args.clamp.width > 0) {
      // Horizontal: always keep the right edge on-screen (a too-narrow viewport pins it to x=0).
      x = Math.max(0, Math.min(x, args.clamp.width - width));
    }
    // Vertical: only clamp when the view actually fits — the popup anchors under the header row (near the
    // top), so a taller-than-viewport popup keeps its natural anchor and clips downward rather than being
    // yanked up over the header on a short terminal.
    if (args.clamp !== undefined && height <= args.clamp.height) {
      y = Math.max(0, Math.min(y, args.clamp.height - height));
    }
    view.layout = { position: 'absolute', rect: { x, y, width, height } };
    host.add(view);
    loop.focusView(view);
    return () => {
      host.remove(view);
      dispose();
    };
  });
}
