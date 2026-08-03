import { createKanbanExtensionId } from './identity.js';
import type { KanbanExtensionId } from './identity.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from './data-snapshot.js';
import { KanbanInvalidSemanticValueError } from './error.js';
import { KANBAN_LIMITS } from './limits.js';
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
/** Exact top-level capability members. */
const CAPABILITY_KEYS = new Set(['extensions']);
/** Exact members accepted for one extension description. */
const DESCRIPTION_KEYS = new Set(['state', 'reasonCode', 'label']);
/** Bounded number of entries accepted in any generic application-owned capability record. */
const MAX_EXTENSIONS = KANBAN_LIMITS.semanticObjectKeys.safe;

/** Copies one bounded reason code or returns no value when it is unsafe. */
export function snapshotKanbanReasonCode(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= MAX_REASON_CODE_CHARACTERS && REASON_CODE.test(value)
    ? value
    : undefined;
}

/** Copies one sanitized bounded UX label. */
export function snapshotKanbanLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = sanitizeContractText(value, MAX_LABEL_CHARACTERS)
    .replace(/[\t\n]+/gu, ' ')
    .trim();
  if (cleaned.length === 0) return undefined;
  return cleaned;
}

/** Creates a detached deeply frozen capability snapshot without changing authorization semantics. */
export function snapshotKanbanCapabilities(capabilities: unknown): KanbanCapabilities {
  const properties = snapshotKanbanDataProperties(capabilities);
  validateKanbanDataKeys(properties, CAPABILITY_KEYS);
  const source = properties.extensions;
  if (source === undefined) return Object.freeze({});

  const sourceProperties = snapshotKanbanDataProperties(source, MAX_EXTENSIONS);
  const extensions: Record<string, KanbanCapabilityDescription> = {};
  for (const extensionId of Object.keys(sourceProperties).sort()) {
    createKanbanExtensionId(extensionId);
    const description = snapshotKanbanDataProperties(sourceProperties[extensionId]);
    validateKanbanDataKeys(description, DESCRIPTION_KEYS);
    const state = description.state;
    if (state !== 'allowed' && state !== 'disabled' && state !== 'hidden') {
      throw new KanbanInvalidSemanticValueError();
    }
    const reasonCode = snapshotKanbanReasonCode(description.reasonCode);
    const label = snapshotKanbanLabel(description.label);
    extensions[extensionId] = Object.freeze({
      state,
      ...(reasonCode === undefined ? {} : { reasonCode }),
      ...(label === undefined ? {} : { label }),
    });
  }
  return Object.freeze({ extensions: Object.freeze(extensions) });
}
