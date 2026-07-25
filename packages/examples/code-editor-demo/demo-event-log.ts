/** Fixed-capacity content-free event log used by the visible host inspector. */
export interface BoundedDemoEventLog {
  record(event: string): void;
  snapshot(): readonly string[];
}

/** Complete content-free vocabulary allowed into the visible host-event ring. */
const demoHostEventNames = new Set([
  'navigate',
  'workspace-edit',
  'command-authorization',
  'save',
  'close',
  'external-change',
  'readonly-blocked',
  'request-cancelled',
  'service-recovered',
  'diagnostic-detail',
  'decision:accepted',
  'decision:rejected',
  'decision:version-conflict',
]);

/** Creates a bounded enum-only event log whose snapshots cannot mutate retained demo state. */
export function createBoundedDemoEventLog(): BoundedDemoEventLog {
  const events: string[] = [];
  return Object.freeze({
    record(event: string) {
      if (!demoHostEventNames.has(event)) return;
      if (events.length >= 32) events.shift();
      events.push(event);
    },
    snapshot() {
      return Object.freeze([...events]);
    },
  });
}
