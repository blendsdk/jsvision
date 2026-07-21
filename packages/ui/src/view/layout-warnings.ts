/**
 * Development-only layout diagnostics — the three ways a view silently lays out to nothing.
 *
 * Each of these produces a view that is simply not on the screen, with no error and nothing to
 * search for. They are detected here, in the reflow pass, rather than inside the layout engine: the
 * engine works on anonymous `LayoutBox`es and has no idea which widget a box came from, whereas the
 * reflow pass holds the box→view mapping and can name the class the developer wrote.
 *
 * Detection is deliberately post-hoc. Rather than predicting which boxes *would* collapse, each check
 * looks at a rect that already came out degenerate and asks whether one of these known causes explains
 * it — so a legitimately zero-sized view (a zero-cell spacer, a container with nothing in it) is never
 * accused of a bug it does not have.
 *
 * **The verdict is deferred by a microtask, and that is load-bearing.** A solved rect is not the last
 * word on where a view ends up: a container may assign its children's bounds itself while painting (a
 * `Scroller` does exactly this for its content and owned bars), and a widget may position its children
 * from `onMount`, which runs *during* the very reflow that flagged them. Judging at reflow time
 * therefore accuses a string of views that are about to be placed perfectly well. So a suspect view is
 * only recorded during reflow, and the condition is re-tested once the frame has settled — by which
 * point a corrected bounds or a corrected layout prop has cleared it.
 */
import { devWarn } from '../shared/warnings.js';
import type { Rect } from '../layout/index.js';
import { normalizeProps } from '../layout/types.js';
import { View } from './view.js';
import { Group } from './group.js';

/**
 * Whether diagnostics run at all. Read once at module load rather than per view: this sits in the
 * reflow pass, which runs for every view on every layout, and a shipped build must not pay for a
 * check it can never act on.
 */
const DIAGNOSTICS_ENABLED = process.env.NODE_ENV !== 'production';

/** Which footgun a suspect view is being held for. Re-tested before anything is reported. */
type Suspicion = 'rect-ignored' | 'absolute-without-rect' | 'auto-without-measure' | 'children-all-out-of-flow';

/** Suspects from the current reflow, awaiting the deferred re-test. Cleared by that re-test. */
let suspects = new Map<View, Suspicion>();

/** The class name a developer would recognise in their own source. */
function viewName(view: View): string {
  return view.constructor.name;
}

/** The visible children a container derives its intrinsic size from. */
function visibleChildren(group: Group): readonly View[] {
  return group.children.filter((child) => child.state.visible);
}

/**
 * Which footgun `view` currently looks like it has hit, or `null` when it looks fine.
 *
 * Called twice for a suspect: once during reflow to decide whether to hold it, and once after the
 * frame has settled to decide whether to report it. Both callers pass the view's *current* rect, so a
 * container that placed the view itself in the meantime shows up as fixed.
 */
function diagnose(view: View, rect: Rect): Suspicion | null {
  // Absolute placement needs both halves. Read the view's own props rather than the resolved ones —
  // resolution is exactly what discards the mismatched half.
  const hasRect = view.layout.rect !== undefined;
  const position = view.layout.position ?? 'flow';
  if (hasRect && position !== 'absolute') return 'rect-ignored';
  if (!hasRect && position === 'absolute') return 'absolute-without-rect';

  if (rect.width > 0 && rect.height > 0) return null; // it has area, so nothing collapsed

  // Only a flowing, auto-sized box without a measure() can collapse for the remaining reasons. An
  // absolute or fill box is placed by its parent, and a fixed/fr box was given the size it asked for.
  const resolved = normalizeProps(view.layout);
  if (resolved.position !== 'flow' || resolved.size.kind !== 'auto' || view.measure !== undefined) return null;

  if (!(view instanceof Group)) return 'auto-without-measure';

  // A container derives its size from its *flowing* children only. If every visible child was lifted
  // out of the flow there is nothing left to size against, and the children are then clipped away by
  // the zero-sized parent they were placed inside.
  const children = visibleChildren(view);
  if (children.length === 0) return null; // genuinely empty — nothing collapsed, there was nothing there
  const allOutOfFlow = children.every((child) => (child.layout.position ?? 'flow') !== 'flow');
  return allOutOfFlow ? 'children-all-out-of-flow' : null;
}

/** The actionable message for a confirmed footgun — what went wrong, and what to do about it. */
function message(view: View, suspicion: Suspicion): string {
  const name = viewName(view);
  const resolved = `${view.bounds.width}×${view.bounds.height}`;

  switch (suspicion) {
    case 'rect-ignored':
      return (
        `${name} sets layout.rect but its position is '${view.layout.position ?? 'flow'}', so the rect ` +
        `is ignored and the view is placed by the flow instead. Pass position: 'absolute' alongside the rect.`
      );
    case 'absolute-without-rect':
      return (
        `${name} sets position: 'absolute' with no rect, so it resolves to a zero rect and never ` +
        `appears. Pass rect: { x, y, width, height } alongside the position.`
      );
    case 'auto-without-measure':
      return (
        `${name} is auto-sized but has no measure(), so it laid out to ${resolved} and never appears. ` +
        `Implement measure(available) to report the size it wants, or give it an explicit size with ` +
        `setLayout({ size: { kind: 'fixed', cells: n } }).`
      );
    case 'children-all-out-of-flow':
      return (
        `${name} is auto-sized from its flowing children, but all ${visibleChildren(view as Group).length} ` +
        `of its visible children are out of flow ('absolute'/'fill'), so it laid out to ${resolved} and ` +
        `clipped them away. Give it position: 'fill' to take the parent's content box, or an explicit size.`
      );
  }
}

/**
 * Re-test every suspect now that the frame has settled, and report the ones that are still wrong.
 *
 * A suspect clears itself by any of the routes that legitimately fix it: its container assigned it
 * real bounds while painting, its layout props were corrected from `onMount`, or it was hidden or
 * unmounted before it ever mattered.
 */
function reportConfirmedSuspects(): void {
  const held = suspects;
  suspects = new Map();
  for (const [view, suspicion] of held) {
    // Detached or hidden in the meantime: whatever it laid out to stopped mattering. `mounted` is
    // deliberately not the test — `reflow()` is also run directly over an unmounted tree.
    if (view.parent === null || !view.state.visible) continue;
    if (diagnose(view, view.bounds) !== suspicion) continue;
    // The message quotes the live rect, but the condition is "this class hit this footgun" — keying
    // on the message would re-warn for every size a still-broken view is resized to.
    devWarn('layout', message(view, suspicion), `${viewName(view)}:${suspicion}`);
  }
}

/**
 * Check one just-laid-out view for the silent layout footguns, holding any suspect for the deferred
 * re-test. Called once per view per reflow, and a no-op in a production build.
 *
 * The root is exempt: it is sized by the viewport rather than by its own props, so none of these
 * rules apply to it.
 *
 * @param view The view whose bounds were just written.
 * @param rect The rect the engine produced for it.
 * @example
 * import { checkLayoutFootguns } from './layout-warnings.js';
 * import { Group } from './group.js';
 *
 * // What the reflow pass does for each view, right after writing the solved rect back onto it.
 * const view = new Group();
 * const rect = { x: 0, y: 0, width: 0, height: 0 };
 * view.bounds = rect;
 * checkLayoutFootguns(view, rect);
 */
export function checkLayoutFootguns(view: View, rect: Rect): void {
  if (!DIAGNOSTICS_ENABLED || view.parent === null) return;

  const suspicion = diagnose(view, rect);
  if (suspicion === null) return;

  // One microtask per reflow pass, not per suspect: it re-tests whatever the pass collected.
  const firstOfThisPass = suspects.size === 0;
  suspects.set(view, suspicion);
  if (firstOfThisPass) queueMicrotask(reportConfirmedSuspects);
}
