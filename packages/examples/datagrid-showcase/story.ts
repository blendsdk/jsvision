/**
 * The datagrid-showcase **Story model** — a Storybook-for-TUI contract dedicated to `@jsvision/datagrid`.
 *
 * A `Story` is one self-contained live demo of a datagrid capability. Each capability contributes one
 * `*.story.ts` that exports a `Story`; `stories/index.ts` aggregates them into the registry the shell
 * reads. Adding a demo = one story file + one line in the index — that single-file contract is the
 * whole extensibility story.
 *
 * A story's `build(ctx)` returns a `Group` whose children are positioned **absolutely** within a
 * `ctx.width × ctx.height` canvas — the shell places that group and reserves the surrounding chrome, so
 * a story never touches the desktop/menu/status.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import type { CapabilityProfile } from '@jsvision/core';

/** What the shell hands a story at build time: the terminal caps + the canvas it may draw into. */
export interface StoryContext {
  /** Resolved terminal capabilities (color depth, glyphs, mouse) for the render. */
  readonly caps: CapabilityProfile;
  /** Usable canvas width in cells (the content pane, chrome already subtracted). */
  readonly width: number;
  /** Usable canvas height in cells. */
  readonly height: number;
  /**
   * Open a modal view and resolve to its terminating result. Populated by the live shell (wired to the
   * loop's `execView`); `undefined` in the headless smoke test, so a story that hosts a modal degrades
   * gracefully — it still renders its launch control.
   */
  readonly execView?: (modal: View) => Promise<unknown>;
}

/** One live demo entry in the showcase registry. */
export interface Story {
  /** Stable unique id, also used as the navigation command name (e.g. `'datagrid/editors/text'`). */
  readonly id: string;
  /** Sidebar/menu grouping (e.g. `'Editing'`). */
  readonly category: string;
  /** Display title (e.g. `'Text editor'`). */
  readonly title: string;
  /** One-line description of what the story demonstrates (shown above the canvas). */
  readonly blurb: string;
  /** Provenance RD (e.g. `'RD-05'`), shown as a chip; optional. */
  readonly rd?: string;
  /**
   * Build the live demo as a `Group` of absolutely-positioned children within `ctx.width ×
   * ctx.height`. Called fresh each time the story is shown (mount/unmount is the shell's job).
   *
   * @param ctx The canvas size + caps the story may render into.
   * @returns A `Group` ready to be placed by the shell.
   */
  build(ctx: StoryContext): Group;
}

/**
 * The absolute-placement builder, re-exported so every story places views through one import site.
 * See `at` in `@jsvision/ui` for its semantics.
 */
export { at } from '@jsvision/ui';

/**
 * Depth-first find the first focusable, visible, enabled view in a subtree — the shell focuses it when
 * a story opens so the demo is immediately interactive.
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
