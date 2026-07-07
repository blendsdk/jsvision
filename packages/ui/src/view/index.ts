/**
 * View/Group spine — the retained widget tree.
 *
 * A `View`/`Group` tree of persistent nodes that keep identity across frames, each with its own
 * reactive scope and a `bind` helper, a stateless clipped `DrawContext` for painting, named
 * theme-role colors, an automatic layout pass, and a coalescing repaint loop. Subclass `View` to
 * build a custom widget; use `Group` to nest and stack them; mount a tree with `createRenderRoot`.
 * All of these are re-exported through `@jsvision/ui`.
 */
export { View } from './view.js';
export type { ViewHost } from './view.js';
export { Group } from './group.js';
export { intersect, translate, contains } from './geometry.js';
export type { Point } from './geometry.js';
export type { ViewState, DrawContext, ThemeRoleName, RenderRootOptions } from './types.js';
// Event-handler contract types (declared here rather than in the event module to avoid an import cycle).
export type { CommandEvent, AppEvent, DispatchEvent, PopupHost } from './types.js';
// Paint seams used by the render root and by custom widgets/tests: the clipped DrawContext factory
// and the theme-role→Style adapter.
export { makeDrawContext } from './draw-context.js';
export { themeRoleToStyle } from './theme-style.js';
export { reflow } from './reflow.js';
export { createRenderRoot } from './render-root.js';
export type { RenderRoot } from './render-root.js';
