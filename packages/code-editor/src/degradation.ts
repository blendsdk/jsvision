/** Optional subsystems that may degrade independently from document editing. */
export type CodeEditorDegradedFeature =
  | 'documentModel'
  | 'parser'
  | 'languageAdapter'
  | 'languageService'
  | 'sharedSession'
  | 'popupRenderer'
  | 'diagnosticProducer'
  | 'hostCallback'
  | 'observabilityCallback'
  | 'diagnostics'
  | 'completion'
  | 'symbols';

/** One bounded, non-modal degradation notice suitable for accessible host presentation. */
export interface CodeEditorDegradationNotice {
  readonly feature: CodeEditorDegradedFeature;
  readonly reason: 'failure' | 'limit';
  readonly nonModal: true;
  readonly truncated: boolean;
  readonly presented?: number;
  readonly discarded?: number;
  readonly message?: string;
}

/** Machine-readable degradation state that never contains document or protocol content. */
export interface CodeEditorDegradationSnapshot {
  readonly mode: 'ready' | 'degraded';
  readonly affectedFeatures: readonly CodeEditorDegradedFeature[];
  readonly notices: readonly CodeEditorDegradationNotice[];
  readonly availableActions: readonly string[];
}

/** Mutable owner for bounded degradation state. */
export interface CodeEditorDegradationState {
  suspend(
    feature: CodeEditorDegradedFeature,
    details: { readonly reason: 'limit'; readonly presented: number; readonly discarded: number },
  ): void;
  fail(feature: CodeEditorDegradedFeature, error?: unknown): void;
  recover(feature: CodeEditorDegradedFeature): void;
  snapshot(): CodeEditorDegradationSnapshot;
  dispose(): void;
}

const MAX_NOTICES = 32;
const AVAILABLE_ACTIONS = Object.freeze(['edit', 'search', 'save', 'close', 'retryLanguageService']);
const FEATURES = new Set<CodeEditorDegradedFeature>([
  'documentModel',
  'parser',
  'languageAdapter',
  'languageService',
  'sharedSession',
  'popupRenderer',
  'diagnosticProducer',
  'hostCallback',
  'observabilityCallback',
  'diagnostics',
  'completion',
  'symbols',
]);

/**
 * Creates isolated, rate-limited degradation state.
 *
 * Error objects are deliberately not inspected because their messages can contain source,
 * URIs, credentials, terminal controls, or hostile accessors.
 *
 * @example
 * ```ts
 * const degradation = createDegradationState();
 * degradation.fail('parser');
 * ```
 */
export function createDegradationState(): CodeEditorDegradationState {
  const notices = new Map<CodeEditorDegradedFeature, CodeEditorDegradationNotice>();
  let disposed = false;
  const put = (feature: CodeEditorDegradedFeature, notice: CodeEditorDegradationNotice): void => {
    if (disposed || !FEATURES.has(feature) || (!notices.has(feature) && notices.size >= MAX_NOTICES)) return;
    notices.set(feature, Object.freeze(notice));
  };
  const state: CodeEditorDegradationState = {
    suspend(
      feature: CodeEditorDegradedFeature,
      details: { readonly reason: 'limit'; readonly presented: number; readonly discarded: number },
    ) {
      if (!FEATURES.has(feature) || typeof details !== 'object' || details === null) return;
      const presented = boundedCount(safeOwnData(details, 'presented'));
      const discarded = boundedCount(safeOwnData(details, 'discarded'));
      put(feature, {
        feature,
        reason: 'limit',
        nonModal: true,
        truncated: discarded > 0,
        presented,
        discarded,
      });
    },
    fail(feature: CodeEditorDegradedFeature, _error?: unknown) {
      if (!FEATURES.has(feature)) return;
      put(feature, {
        feature,
        reason: 'failure',
        nonModal: true,
        truncated: false,
        message: 'An optional editor feature is unavailable.',
      });
    },
    recover(feature: CodeEditorDegradedFeature) {
      if (!disposed && FEATURES.has(feature)) notices.delete(feature);
    },
    snapshot() {
      const values = Object.freeze([...notices.values()]);
      return Object.freeze({
        mode: values.length === 0 ? 'ready' : 'degraded',
        affectedFeatures: Object.freeze(values.map((notice) => notice.feature)),
        notices: values,
        availableActions: AVAILABLE_ACTIONS,
      });
    },
    dispose() {
      disposed = true;
      notices.clear();
    },
  };
  return Object.freeze(state);
}

function boundedCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;
}

function safeOwnData(value: object, name: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}
