import { createKanbanExtensionId } from './identity.js';
import type { KanbanExtensionId } from './identity.js';
import { sanitizeContractText } from './text-safety.js';

/** Presentation state for one application extension action. */
export type KanbanCapabilityState = 'allowed' | 'disabled' | 'hidden';

/** Immutable UX description for one application-owned extension. */
export interface KanbanCapabilityDescription {
  /** Whether a component may present the action as available, disabled, or hidden. */
  readonly state: KanbanCapabilityState;
  /** Optional stable application reason code for diagnostics or localization. */
  readonly reasonCode?: string;
  /** Optional sanitized display label. */
  readonly label?: string;
}

/** Reactive capability snapshot supplied by the host application. */
export interface KanbanCapabilities {
  /** Per-extension UX descriptions; an absent entry is presented as allowed. */
  readonly extensions?: Readonly<Partial<Record<KanbanExtensionId, KanbanCapabilityDescription>>>;
}

/** Context captured and passed to the application dispatcher. */
export interface KanbanRequestContext {
  /** UX capability descriptions for diagnostics only, never authorization. */
  readonly capabilities: KanbanCapabilities;
}

/** Stable reason-code grammar shared by capability and request outcomes. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;
/** Maximum reason-code characters retained at the dispatcher boundary. */
const MAX_REASON_CODE_CHARACTERS = 128;
/** Maximum sanitized capability label characters. */
const MAX_LABEL_CHARACTERS = 512;

/** Copies one bounded reason code or returns no value when it is unsafe. */
export function snapshotKanbanReasonCode(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= MAX_REASON_CODE_CHARACTERS && REASON_CODE.test(value)
    ? value
    : undefined;
}

/** Copies one sanitized bounded UX label. */
export function snapshotKanbanLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = sanitizeContractText(value)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (cleaned.length === 0) return undefined;
  return Array.from(cleaned).slice(0, MAX_LABEL_CHARACTERS).join('');
}

/** Creates a detached deeply frozen capability snapshot without changing authorization semantics. */
export function snapshotKanbanCapabilities(capabilities: KanbanCapabilities): KanbanCapabilities {
  const source = capabilities.extensions;
  if (source === undefined) return Object.freeze({});

  const extensions: Record<string, KanbanCapabilityDescription> = {};
  for (const extensionId of Object.keys(source).sort()) {
    createKanbanExtensionId(extensionId);
    const description = source[extensionId];
    if (
      description === undefined ||
      (description.state !== 'allowed' && description.state !== 'disabled' && description.state !== 'hidden')
    ) {
      continue;
    }
    const reasonCode = snapshotKanbanReasonCode(description.reasonCode);
    const label = snapshotKanbanLabel(description.label);
    extensions[extensionId] = Object.freeze({
      state: description.state,
      ...(reasonCode === undefined ? {} : { reasonCode }),
      ...(label === undefined ? {} : { label }),
    });
  }
  return Object.freeze({ extensions: Object.freeze(extensions) });
}
