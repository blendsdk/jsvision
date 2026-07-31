import type { EventLoop, View } from '@jsvision/ui';

/**
 * Build a reactive, non-colour focus readout for a bounded set of teaching views.
 *
 * Reading each view's focus signal makes the returned getter repaint whenever focus enters or
 * leaves the labelled set. A focus outside that set is described with the caller's fallback,
 * which is useful while a nested modal owns the active focus scope.
 *
 * @param loop Event loop that owns the current focus chain.
 * @param labels Stable labels for the views the lesson names.
 * @param outsideLabel Text used when another mounted subtree owns focus.
 * @returns A getter suitable for a reactive `Text` control.
 */
export function focusReadout(
  loop: Pick<EventLoop, 'getFocused'>,
  labels: ReadonlyMap<View, string>,
  outsideLabel = 'outside the labelled set',
): () => string {
  return () => {
    for (const view of labels.keys()) view.focusSignal()();
    const focused = loop.getFocused();
    return `Focused: ${focused === null ? 'none' : (labels.get(focused) ?? outsideLabel)}`;
  };
}
