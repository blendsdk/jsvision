/**
 * Flex layout builders — the `col`/`row` containers and the `grow`/`fixed`/`spacer` size
 * shorthands, a thin, expression-oriented sugar over `Group`/`View` and their `layout` props, so a
 * whole screen can be composed in one nested expression instead of a sequence of `new`, `.add()`,
 * and `.layout = …` mutations.
 *
 * Because the builders only assemble ordinary views and set ordinary `layout` props, the result
 * reflows and resizes exactly like a hand-built tree — there is no separate runtime.
 *
 * This lives in the view layer (not the layout engine) because it constructs `Group`/`View`
 * instances; the engine stays free of any view dependency.
 */
import { View } from '../view.js';
import { Group } from '../group.js';
import type { ThemeRoleName } from '../types.js';
import type { Direction, LayoutProps, Size } from '../../layout/index.js';

/**
 * A child accepted by {@link col}/{@link row}: a real {@link View}, or a falsy value
 * (`null`/`undefined`/`false`) that is skipped so the `cond && child` conditional-render idiom
 * composes without a manual `.add()` dance.
 */
type Child = View | null | undefined | false;

/**
 * Container props for {@link col}/{@link row}: every {@link LayoutProps} field except `direction`
 * (the builder sets that), plus size shorthands and a `background` role.
 *
 * `grow`/`fixed`/`fill` are shorthands for the `size` token — `grow: n` → `{ kind:'fr', weight:n }`,
 * `fixed: n` → `{ kind:'fixed', cells:n }`, `fill: true` → `{ kind:'fr', weight:1 }`. An explicit
 * `size` always wins over the shorthands. `background` sets the group's fill role (it is not a layout
 * prop). All fields are optional.
 *
 * @example
 * import { col, row } from '@jsvision/ui';
 *
 * // A fixed-width sidebar next to a growing main area, with 1 cell of gap and a filled background.
 * const layout: import('@jsvision/ui').Flex = { gap: 1, background: 'desktop' };
 * const screen = row(layout, col({ fixed: 20 }, sidebar), col({ grow: 1 }, main));
 */
export type Flex = Omit<LayoutProps, 'direction'> & {
  /**
   * Flex-grow weight — shorthand for `size: { kind:'fr', weight }`. The object form adds a `min`
   * cell floor: `{ weight, min }` → `{ kind:'fr', weight, min }` (the box never solves below `min`).
   */
  grow?: number | { weight: number; min?: number };
  /** Fixed cell count — shorthand for `size: { kind:'fixed', cells }`. */
  fixed?: number;
  /** Take a flex share of `1` — shorthand for `size: { kind:'fr', weight:1 }`. */
  fill?: boolean;
  /** Theme role filled behind the children before they paint. */
  background?: ThemeRoleName;
};

/**
 * Resolve a {@link Flex} into concrete {@link LayoutProps}: pick the one `size` token (explicit
 * `size` wins, else `fixed` → `grow` → `fill` → none), drop `background` (a Group property, not a
 * layout prop), and merge the container `direction`.
 */
export function toLayout(f: Flex, direction: Direction): LayoutProps {
  const { grow: growN, fixed: fixedN, fill: fillOn, background: _bg, ...rest } = f;
  const size: Size | undefined =
    rest.size ??
    (fixedN !== undefined
      ? { kind: 'fixed', cells: fixedN }
      : growN !== undefined
        ? growFrom(growN)
        : fillOn === true
          ? { kind: 'fr', weight: 1 }
          : undefined);
  const props: LayoutProps = { ...rest, direction };
  if (size !== undefined) props.size = size;
  return props;
}

/** Resolve the `Flex.grow` shorthand (a bare weight or a `{ weight, min }` object) into an fr size. */
function growFrom(g: number | { weight: number; min?: number }): Size {
  if (typeof g === 'number') return { kind: 'fr', weight: g };
  return { kind: 'fr', weight: g.weight, ...(g.min !== undefined ? { min: g.min } : {}) };
}

/**
 * Build a flex container in the given direction. The first argument may be a {@link Flex} props
 * object or the first child; every remaining argument is a child view, added in order (paint order,
 * back-to-front).
 */
function container(direction: Direction, args: Array<Flex | Child>): Group {
  const group = new Group();
  const first = args[0];
  let children: Array<Flex | Child>;
  // A props object is a *truthy non-View* first argument; a View or a falsy value (a skipped child)
  // is not — so a leading `cond && child` is never mistaken for props.
  if (first !== null && first !== undefined && first !== false && !(first instanceof View)) {
    const props = first as Flex;
    children = args.slice(1);
    group.setLayout(toLayout(props, direction));
    if (props.background !== undefined) group.background = props.background;
  } else {
    children = args;
    group.setLayout({ direction });
  }
  // Skip null/undefined/false so `col(cond && fixed(x, 1), grow(y))` composes; anything else is a View.
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) group.add(child as View);
  }
  return group;
}

/**
 * Build a **vertical** flex container (`direction: 'col'`) — children stack top to bottom. Pass an
 * optional {@link Flex} props object first, then the child views.
 *
 * A falsy child (`null`/`undefined`/`false`) is skipped, so `col(showMenu && fixed(menu, 1), body)`
 * composes without a manual `.add()` dance.
 *
 * @param args An optional {@link Flex} props object followed by child views (or just child views); a
 *   falsy child is skipped.
 * @returns A `Group` with `layout.direction = 'col'` and the (truthy) children added in order.
 * @example
 * import { col, fixed, grow } from '@jsvision/ui';
 *
 * // A header of fixed height above a growing body; the status bar only when there is a message.
 * const page = col({ gap: 1 }, fixed(header, 3), grow(body), message && fixed(status, 1));
 */
export function col(...args: [Flex, ...Child[]] | Child[]): Group {
  return container('col', args);
}

/**
 * Build a **horizontal** flex container (`direction: 'row'`) — children sit left to right. Pass an
 * optional {@link Flex} props object first, then the child views.
 *
 * A falsy child (`null`/`undefined`/`false`) is skipped, so `row(grow(main), showAside && aside)`
 * composes without a manual `.add()` dance.
 *
 * @param args An optional {@link Flex} props object followed by child views (or just child views); a
 *   falsy child is skipped.
 * @returns A `Group` with `layout.direction = 'row'` and the (truthy) children added in order.
 * @example
 * import { row, fixed, grow } from '@jsvision/ui';
 *
 * // A fixed-width sidebar beside a growing main pane.
 * const body = row(fixed(sidebar, 20), grow(main));
 */
export function row(...args: [Flex, ...Child[]] | Child[]): Group {
  return container('row', args);
}

/**
 * Give a view a flex-grow size: it takes a share of the container's leftover main-axis space
 * proportional to `n`. Mutates the view's `layout.size` (preserving its other layout props) and
 * returns the same view, so it composes inline inside a `col`/`row`.
 *
 * Pass `{ min }` to add a cell floor: the view then never solves below `min` cells, even as the
 * container shrinks (forwarding the engine's `Size.fr.min`). The floor binds only when it exceeds the
 * view's fair share; a lone floored view is still capped at its track (the engine never overflows).
 *
 * Re-tagging an already-mounted view requests a reflow for you — no manual `invalidateLayout()`.
 *
 * @param view The view to size.
 * @param n The flex weight (default `1`). Two `grow(v, 1)` children split the space evenly; a
 *   `grow(v, 2)` child gets twice the share of a `grow(v, 1)` sibling.
 * @param opts Optional `{ min }` cell floor. A negative `min` is forwarded and the engine clamps it
 *   to `0` at solve time (no double-clamp here). There is no `max` — the engine has no ceiling.
 * @returns The same `view`, for inline chaining.
 * @example
 * import { row, grow } from '@jsvision/ui';
 *
 * // `main` takes twice the width of `aside`; `aside` never shrinks below 12 cells.
 * const body = row(grow(aside, 1, { min: 12 }), grow(main, 2));
 */
export function grow<V extends View>(view: V, n = 1, opts?: { min?: number }): V {
  const size: Size = { kind: 'fr', weight: n, ...(opts?.min !== undefined ? { min: opts.min } : {}) };
  view.setLayout({ size });
  return view;
}

/**
 * Give a view a fixed size of `n` cells along its container's main axis (columns in a `row`, rows in
 * a `col`). Mutates the view's `layout.size` (preserving its other layout props) and returns the same
 * view, so it composes inline inside a `col`/`row`.
 *
 * Re-tagging an already-mounted view requests a reflow for you — no manual `invalidateLayout()`.
 *
 * @param view The view to size.
 * @param n The fixed extent in whole cells.
 * @returns The same `view`, for inline chaining.
 * @example
 * import { col, fixed, grow } from '@jsvision/ui';
 *
 * // A 3-row status bar pinned below a growing body.
 * const app = col(grow(body), fixed(statusBar, 3));
 */
export function fixed<V extends View>(view: V, n: number): V {
  view.setLayout({ size: { kind: 'fixed', cells: n } });
  return view;
}

/** An invisible view used only to reserve space in a `col`/`row`. */
class Empty extends View {
  draw(): void {
    // nothing to paint — a spacer only occupies layout space
  }
}

/**
 * Insert an empty spacer between children. With a numeric `weight` (default `1`) it is flexible —
 * it absorbs leftover space, pushing later children toward the far edge; with `{ fixed: n }` it is a
 * hard, exact `n`-cell gap.
 *
 * @param arg A flex weight (default `1`), or `{ fixed: n }` for an exact `n`-cell gap.
 * @returns A fresh invisible view with the requested size, ready to drop into a `col`/`row`.
 * @example
 * import { row, spacer } from '@jsvision/ui';
 *
 * // Push `help` to the right edge; keep a hard 2-cell gap before `cancel`.
 * const bar = row(ok, spacer({ fixed: 2 }), cancel, spacer(), help);
 */
export function spacer(arg: number | { fixed: number } = 1): View {
  const view = new Empty();
  view.setLayout(
    typeof arg === 'number' ? { size: { kind: 'fr', weight: arg } } : { size: { kind: 'fixed', cells: arg.fixed } },
  );
  return view;
}
