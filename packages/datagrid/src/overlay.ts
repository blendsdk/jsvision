/**
 * The cell-aligned overlay helper — how an editor view is mounted over a grid cell.
 *
 * `mountCellOverlay` translates a body-local cell rect to absolute coordinates, mounts the editor as
 * an absolutely-placed child of the grid's overlay host, focuses it, and returns a disposer that
 * removes it and tears down its reactive scope. It is built from public `@jsvision/ui` primitives —
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
 * Mount `view` over a cell: place it at the absolute position derived from a body-local cell rect,
 * focus it through the loop seam, and return a disposer that removes the view and disposes its
 * reactive scope (so its binding effects do not leak after the overlay closes). There is no frame or
 * border — it is a bare cell-aligned mount.
 *
 * @param args `host` (the grid's absolute overlay group), `loop` (the focus seam), `rect` (body-local
 *   cell rect), `origin` (the body's absolute origin, e.g. from {@link absoluteRect}), and `view` (the
 *   editor to mount).
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
  view: View;
}): () => void {
  const { host, loop, rect, origin, view } = args;
  view.layout = {
    position: 'absolute',
    rect: { x: origin.x + rect.x, y: origin.y + rect.y, width: rect.width, height: rect.height },
  };
  // One reactive owner for the mount: any binding effects the editor sets up are torn down together
  // with the view when `dispose()` runs. `host.add` mounts the view under the host's scope; `remove`
  // disposes that scope (firing the view's `onCleanup`), and `dispose()` clears this owner too.
  return createRoot((dispose) => {
    host.add(view);
    loop.focusView(view);
    return () => {
      host.remove(view);
      dispose();
    };
  });
}
