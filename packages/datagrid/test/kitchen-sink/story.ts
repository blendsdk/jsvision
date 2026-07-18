/**
 * The datagrid in-package kitchen-sink Story contract — a trimmed copy of the examples showcase model.
 * Test infrastructure only (never on the public barrel): a `Story` is one self-contained live demo of
 * a datagrid component, and adding one is a single file plus one line in the registry. When datagrid
 * ships genuinely user-facing components, a story is promoted into the shared showcase.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group } from '@jsvision/ui';
import type { View, LayoutProps } from '@jsvision/ui';
import type { CapabilityProfile } from '@jsvision/core';

/** What the harness hands a story at build time: the terminal caps + the canvas it may draw into. */
export interface StoryContext {
  /** Resolved terminal capabilities (colour depth, glyphs, mouse) for the render. */
  readonly caps: CapabilityProfile;
  /** Usable canvas width in cells. */
  readonly width: number;
  /** Usable canvas height in cells. */
  readonly height: number;
}

/** One live demo entry in the datagrid showcase registry. */
export interface Story {
  /** Stable unique id (e.g. `'datagrid/foundation'`). */
  readonly id: string;
  /** Grouping category (e.g. `'DataGrid'`). */
  readonly category: string;
  /** Display title. */
  readonly title: string;
  /** One-line description of what the story demonstrates. */
  readonly blurb: string;
  /** Provenance chip; optional. */
  readonly rd?: string;
  /**
   * Build the live demo as a `Group` of absolutely-positioned children within `ctx.width × ctx.height`.
   *
   * @param ctx The canvas size + caps to render into.
   * @returns A `Group` ready to mount.
   */
  build(ctx: StoryContext): Group;
}

/**
 * Position a view absolutely at a canvas-relative rect and return it (chainable).
 *
 * @param view The view to place.
 * @param x Canvas-relative left, in cells.
 * @param y Canvas-relative top, in cells.
 * @param width Width in cells.
 * @param height Height in cells.
 * @returns The same `view`, now absolutely placed.
 */
export function at<T extends View>(view: T, x: number, y: number, width: number, height: number): T {
  const layout: LayoutProps = { position: 'absolute', rect: { x, y, width, height } };
  view.layout = layout;
  return view;
}

/**
 * Depth-first find the first focusable, visible, enabled view in a subtree.
 *
 * @param view The subtree root.
 * @returns The first focusable descendant (or `view` itself), or `null` if none.
 */
export function firstFocusable(view: View): View | null {
  if (view.focusable && view.state.visible && !view.state.disabled) return view;
  if (view instanceof Group) {
    for (const child of view.children) {
      const found = firstFocusable(child);
      if (found !== null) return found;
    }
  }
  return null;
}
