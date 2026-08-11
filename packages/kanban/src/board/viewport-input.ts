import type { DispatchEvent, PointerCaptureLostHandler, View } from '@jsvision/ui';

import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanPointerInput } from '../interaction/pointer-router.js';
import type { KanbanActionTarget } from '../layout/hit-map.js';

/** Current semantic evidence needed to normalize one mounted mouse report. */
export interface NormalizeKanbanViewportPointerInputOptions {
  /** View receiving capture for a threshold-crossing drag. */
  readonly owner: View;
  /** Current final clipped action target under the pointer. */
  readonly target?: KanbanActionTarget;
  /** Equality-only scene revision owning target geometry. */
  readonly sceneRevision: KanbanRevision;
}

/**
 * Converts one mounted UI mouse event into the closed Kanban pointer contract.
 *
 * Bare test envelopes remain useful: when capture is absent, the result still supports click
 * routing but cannot start a drag.
 *
 * @example
 * ```ts
 * const input = normalizeKanbanViewportPointerInput(event, {
 *   owner: viewport,
 *   target,
 *   sceneRevision: 'scene-r4',
 * });
 * ```
 */
export function normalizeKanbanViewportPointerInput(
  event: DispatchEvent,
  options: NormalizeKanbanViewportPointerInputOptions,
): KanbanPointerInput | undefined {
  if (event.event.type !== 'mouse' || event.local === undefined) return undefined;
  const acquireCapture = event.acquireCapture;
  return Object.freeze({
    kind: event.event.kind,
    button: event.event.button,
    ctrl: event.event.ctrl === true,
    shift: event.event.shift === true,
    alt: event.event.alt === true,
    point: Object.freeze({ x: event.local.x, y: event.local.y }),
    ...(options.target === undefined ? {} : { target: options.target }),
    sceneRevision: options.sceneRevision,
    ...(event.clickCount === undefined ? {} : { clickCount: event.clickCount }),
    ...(acquireCapture === undefined
      ? {}
      : { acquireCapture: (onLost: PointerCaptureLostHandler) => acquireCapture(options.owner, onLost) }),
  });
}
