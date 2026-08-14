import { snapshotKanbanLabel, snapshotKanbanReasonCode } from '../contract/capability.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import type { KanbanActionCapability, KanbanActionCapabilityContext, KanbanCapabilityProvider } from './types.js';

/** Exact members accepted from one capability-provider result. */
const CAPABILITY_RESULT_KEYS = new Set(['state', 'reasonCode', 'label']);
/** Shared immutable allowed result used when no provider is configured. */
const ALLOWED: KanbanActionCapability = Object.freeze({ state: 'allowed' });
/** Payload-free result used when a provider throws or returns unsafe data. */
const FAILED: KanbanActionCapability = Object.freeze({
  state: 'disabled',
  reasonCode: 'capability-failed',
});

/** Copies one provider result into the closed, bounded capability union. */
function snapshotCapability(value: unknown): KanbanActionCapability {
  const properties = snapshotKanbanDataProperties(value, CAPABILITY_RESULT_KEYS.size);
  validateKanbanDataKeys(properties, CAPABILITY_RESULT_KEYS);
  if (properties.state === 'allowed') return ALLOWED;
  if (properties.state === 'hidden') return Object.freeze({ state: 'hidden' });
  if (properties.state !== 'disabled') throw new Error('Invalid capability state.');
  const reasonCode = snapshotKanbanReasonCode(properties.reasonCode);
  if (reasonCode === undefined) throw new Error('Invalid capability reason code.');
  const label = snapshotKanbanLabel(properties.label);
  return Object.freeze({
    state: 'disabled',
    reasonCode,
    ...(label === undefined ? {} : { label }),
  });
}

/**
 * Evaluates one synchronous provider and contains every exception as redacted disabled feedback.
 *
 * The provider is a presentation policy only. This function never authorizes a mutation and never
 * bypasses the board's application-owned request dispatcher.
 */
export function evaluateKanbanActionCapability(
  provider: KanbanCapabilityProvider | undefined,
  context: KanbanActionCapabilityContext,
): KanbanActionCapability {
  if (provider === undefined) return ALLOWED;
  try {
    const result = provider(context);
    if (result instanceof Promise) return FAILED;
    return snapshotCapability(result);
  } catch {
    return FAILED;
  }
}

/**
 * Creates the standard read-only UX capability policy.
 *
 * Pointer mutation affordances are hidden so they cannot become hit targets. Keyboard, menu, and
 * programmatic mutation routes remain discoverable as disabled, while non-mutating actions remain
 * available. Application authorization is still required for every raw request.
 *
 * @example
 * ```ts
 * const capability = createKanbanReadOnlyCapabilityProvider();
 * const router = createKanbanActionRouter({ registry, capability });
 * ```
 */
export function createKanbanReadOnlyCapabilityProvider(): KanbanCapabilityProvider {
  return (context) => {
    if (context.definition.mutation !== true) return ALLOWED;
    return context.origin === 'pointer'
      ? Object.freeze({ state: 'hidden' })
      : Object.freeze({ state: 'disabled', reasonCode: 'read-only' });
  };
}
