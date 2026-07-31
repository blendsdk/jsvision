import type { AppEvent } from '@jsvision/ui';

/** The learner-visible labels used by the routing laboratory. */
export type RoutePhase = 'pre' | 'focused' | 'post' | 'target' | 'parent';

/**
 * Describe one public event without exposing payloads beyond the laboratory's bounded fixture.
 *
 * @param event Event delivered by the real JSVision event loop.
 * @returns A concise label suitable for the laboratory's visible trace.
 */
export function eventTraceLabel(event: AppEvent): string {
  switch (event.type) {
    case 'key':
      return `Key ${event.key}`;
    case 'paste':
      return `Paste ${event.text}`;
    case 'command':
      return `Command ${event.command}`;
    case 'mouse':
      return 'Mouse';
    case 'wheel':
      return 'Wheel';
    case 'focus':
      return `Focus ${event.focused ? 'in' : 'out'}`;
  }
}
