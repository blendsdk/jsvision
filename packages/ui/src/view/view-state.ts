/**
 * Development-only diagnostics for direct writes to a view's `state` flags.
 *
 * `view.state.visible` and `view.state.disabled` are plain fields with no invalidation hook, so
 * writing one changes what the next paint *would* draw without ever asking for that paint. The
 * result is a view that stays on screen after being hidden, or a control that keeps drawing enabled
 * — until something unrelated happens to trigger a frame, which makes it look intermittent.
 *
 * Detecting the mistake needs to distinguish "wrote and forgot" from "wrote and immediately
 * invalidated", and the framework itself does the latter constantly. So the check is deferred by one
 * microtask: a write arms it, any repaint or relayout requested before the microtask runs disarms it,
 * and only a write that is still unaccounted for by then is reported. A relayout disarms *every*
 * pending write rather than just its own view's, because it re-lays and re-composes the whole tree —
 * which is exactly how the framework's own multi-view visibility flips stay correct.
 *
 * In a production build none of this exists: `createViewState` returns a plain object literal and the
 * two notification hooks return immediately.
 */
import { devWarn } from '../shared/warnings.js';
import type { ViewState } from './types.js';
import type { View } from './view.js';

/**
 * Whether the diagnostics run at all. Read once at module load: these hooks sit on `invalidate()`,
 * which runs on every reactive update, and a shipped build must not pay for a check it cannot act on.
 */
const DIAGNOSTICS_ENABLED = process.env.NODE_ENV !== 'production';

/** The state flags that change what is drawn but carry no invalidation of their own. */
type TrackedFlag = 'visible' | 'disabled';

/**
 * State written during the current turn, and which flags. Entries live at most one microtask — the
 * check that consumes them always clears the map — so holding the views strongly cannot leak.
 */
const writtenThisTurn = new Map<View, Set<TrackedFlag>>();

/** Views whose repaint was requested during the current turn. */
const repaintedThisTurn = new Set<View>();

/** Whether a relayout — which repaints the whole tree — was requested during the current turn. */
let relayoutThisTurn = false;

/** Whether the end-of-turn check is already armed, so each turn queues exactly one microtask. */
let checkArmed = false;

/**
 * Arm the end-of-turn check, which decides whether each write was covered and then resets the turn.
 *
 * The window is the microtask turn rather than the moment of the write, because a frame is produced
 * asynchronously: an invalidation raised *before* a write still repaints it, which is exactly what
 * `Group.add` does for a container that flips its own visibility right afterwards. Anything that
 * requested a frame in the same turn therefore covers every write in that turn.
 */
function armTurnEndCheck(): void {
  if (checkArmed) return;
  checkArmed = true;
  queueMicrotask(() => {
    for (const [view, flags] of writtenThisTurn) {
      if (relayoutThisTurn || repaintedThisTurn.has(view)) continue;
      warnUnpaintedWrite(view, flags);
    }
    writtenThisTurn.clear();
    repaintedThisTurn.clear();
    relayoutThisTurn = false;
    checkArmed = false;
  });
}

/** Report an unaccounted-for write, naming the flags, the view, and the call that was missing. */
function warnUnpaintedWrite(view: View, flags: ReadonlySet<TrackedFlag>): void {
  const written = [...flags].map((flag) => `state.${flag}`).join(' and ');
  const name = view.constructor.name;
  devWarn(
    'view',
    `${name} had ${written} written directly, but nothing requested a frame, so the change will not ` +
      `show until something else happens to repaint. Call ${name}.invalidate() after the write — or ` +
      `invalidateLayout() when it changes size or position, which a visibility flip does.`,
  );
}

/**
 * Record a write to a tracked flag for the end-of-turn check.
 *
 * Unmounted views are ignored: nothing is painting them yet, so there is no missing repaint to
 * report — the first frame after they are mounted draws them from scratch.
 */
function noteStateWrite(view: View, flag: TrackedFlag): void {
  if (!view.mounted) return;

  const already = writtenThisTurn.get(view);
  if (already !== undefined) already.add(flag);
  else writtenThisTurn.set(view, new Set([flag]));
  armTurnEndCheck();
}

/**
 * Note that `view` has asked for a repaint, which covers any state write it is carrying this turn.
 *
 * @param view The view whose repaint was requested.
 * @internal Called from `View.invalidate`; a no-op in a production build.
 */
export function notePaintRequested(view: View): void {
  if (!DIAGNOSTICS_ENABLED) return;
  repaintedThisTurn.add(view);
  armTurnEndCheck();
}

/**
 * Note that a relayout has been requested, which covers every state write this turn. A relayout
 * re-solves and re-composes the whole tree, so it genuinely does paint every view that was touched —
 * including the common pattern of flipping several sibling views' visibility and relayouting once.
 *
 * @internal Called from `View.invalidateLayout`; a no-op in a production build.
 */
export function noteRelayoutRequested(): void {
  if (!DIAGNOSTICS_ENABLED) return;
  relayoutThisTurn = true;
  armTurnEndCheck();
}

/**
 * Build the `state` object for a view.
 *
 * In development `visible` and `disabled` are accessors that arm the missing-repaint check;
 * `focused` stays a plain field because the focus manager is the only writer and it always repaints.
 * In production every flag is a plain field, so `state` is exactly the object literal it always was.
 *
 * @param view The view the state belongs to — used to name it in a diagnostic and to skip views that
 *   are not mounted yet.
 * @returns The view's mutable state flags.
 * @example
 * import { createViewState } from './view-state.js';
 * import { Group } from './group.js';
 *
 * // `View` already does this for every view; a widget never calls it itself.
 * const view = new Group();
 * const state = createViewState(view);
 * state.visible = false; // in a development build this arms the missing-repaint check
 */
export function createViewState(view: View): ViewState {
  if (!DIAGNOSTICS_ENABLED) return { visible: true, disabled: false, focused: false };

  let visible = true;
  let disabled = false;
  return {
    get visible(): boolean {
      return visible;
    },
    set visible(next: boolean) {
      if (next === visible) return; // an idempotent write changes nothing, so nothing is owed
      visible = next;
      noteStateWrite(view, 'visible');
    },
    get disabled(): boolean {
      return disabled;
    },
    set disabled(next: boolean) {
      if (next === disabled) return;
      disabled = next;
      noteStateWrite(view, 'disabled');
    },
    focused: false,
  };
}
