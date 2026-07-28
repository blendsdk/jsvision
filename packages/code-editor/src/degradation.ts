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

/** Accessible lifecycle state for one optional editor subsystem. */
export type CodeEditorFeatureStatus = 'enabled' | 'pending' | 'suspended' | 'truncated' | 'degraded';

/** One bounded content-free feature inspection record. */
export interface CodeEditorFeatureInspection {
  readonly feature: CodeEditorDegradedFeature;
  readonly status: CodeEditorFeatureStatus;
  readonly reason: string;
  readonly presented?: number;
  readonly discarded?: number;
}

/** One bounded, non-modal degradation notice suitable for accessible host presentation. */
export interface CodeEditorDegradationNotice {
  readonly feature: CodeEditorDegradedFeature;
  readonly reason: 'failure' | 'limit' | 'missing-adapter' | 'unavailable' | 'retry' | 'operation';
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
  readonly features: readonly CodeEditorFeatureInspection[];
  readonly availableActions: readonly string[];
}

/** Input accepted when a feature is suspended by a limit or unavailable adapter. */
export type CodeEditorSuspensionDetails =
  | { readonly reason: 'limit'; readonly presented: number; readonly discarded: number }
  | { readonly reason: 'missing-adapter' | 'unavailable' };

/** Input accepted while a bounded retry or background operation is pending. */
export interface CodeEditorPendingDetails {
  readonly reason: 'retry' | 'operation';
}

/** Mutable owner for bounded degradation state. */
export interface CodeEditorDegradationState {
  suspend(feature: CodeEditorDegradedFeature, details: CodeEditorSuspensionDetails): void;
  pending(feature: CodeEditorDegradedFeature, details: CodeEditorPendingDetails): void;
  fail(feature: CodeEditorDegradedFeature, error?: unknown): void;
  recover(feature: CodeEditorDegradedFeature): void;
  snapshot(): CodeEditorDegradationSnapshot;
  dispose(): void;
}

/** Optional observer invoked after an accepted degradation transition. */
export interface CodeEditorDegradationOptions {
  readonly onChange?: (snapshot: CodeEditorDegradationSnapshot) => void;
}

/**
 * Formats one editor-owned degradation notice with an explicit or isolated English service.
 *
 * @param notice - Stable editor degradation metadata.
 * @param i18n - Optional locale service.
 * @returns Localized wrapper text, or `undefined` when the notice has no compatible prose.
 * @example
 * ```ts
 * const state = createDegradationState();
 * state.fail('parser');
 * const message = formatCodeEditorDegradationNotice(state.snapshot().notices[0]!);
 * ```
 */
export function formatCodeEditorDegradationNotice(
  notice: CodeEditorDegradationNotice,
  i18n?: I18n,
): string | undefined {
  return formatNotice(notice, i18n);
}

const AVAILABLE_ACTIONS = Object.freeze(['edit', 'search', 'save', 'close', 'retryLanguageService']);
const FEATURE_LIST: readonly CodeEditorDegradedFeature[] = Object.freeze([
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
const FEATURES = new Set(FEATURE_LIST);

/**
 * Creates isolated, bounded degradation state.
 *
 * Error objects are deliberately not inspected because their messages can contain source,
 * URIs, credentials, terminal controls, or hostile accessors. The optional observer receives only
 * immutable content-free snapshots, and observer exceptions cannot escape into editor work.
 *
 * @example
 * ```ts
 * const degradation = createDegradationState();
 * degradation.fail('parser');
 * degradation.pending('parser', { reason: 'retry' });
 * ```
 */
export function createDegradationState(options: CodeEditorDegradationOptions = {}): CodeEditorDegradationState {
  const notices = new Map<CodeEditorDegradedFeature, CodeEditorDegradationNotice>();
  const states = new Map<CodeEditorDegradedFeature, CodeEditorFeatureInspection>(
    FEATURE_LIST.map((feature) => [feature, featureState(feature, 'enabled', 'available')]),
  );
  const onChange = ownFunction(options, 'onChange');
  let disposed = false;
  let notificationScheduled = false;
  let notifying = false;

  const snapshot = (): CodeEditorDegradationSnapshot => {
    const values = Object.freeze([...notices.values()]);
    return Object.freeze({
      mode: values.length === 0 ? 'ready' : 'degraded',
      affectedFeatures: Object.freeze(values.map((notice) => notice.feature)),
      notices: values,
      features: Object.freeze(FEATURE_LIST.map((feature) => states.get(feature) ?? featureState(feature))),
      availableActions: AVAILABLE_ACTIONS,
    });
  };

  const publish = (): void => {
    if (onChange === undefined || notificationScheduled || notifying || disposed) return;
    notificationScheduled = true;
    queueMicrotask(() => {
      notificationScheduled = false;
      if (disposed || onChange === undefined) return;
      notifying = true;
      try {
        onChange(snapshot());
      } catch {
        // Observation is optional and cannot make local editing fail.
      } finally {
        notifying = false;
      }
    });
  };

  const put = (
    feature: CodeEditorDegradedFeature,
    state: CodeEditorFeatureInspection,
    notice: CodeEditorDegradationNotice,
  ): void => {
    if (disposed || !FEATURES.has(feature)) return;
    const current = states.get(feature);
    const currentNotice = notices.get(feature);
    if (
      current?.status === state.status &&
      current.reason === state.reason &&
      current.presented === state.presented &&
      current.discarded === state.discarded &&
      currentNotice?.reason === notice.reason
    )
      return;
    states.set(feature, Object.freeze(state));
    notices.set(feature, Object.freeze(notice));
    publish();
  };

  const state: CodeEditorDegradationState = {
    suspend(feature: CodeEditorDegradedFeature, details: CodeEditorSuspensionDetails) {
      if (!FEATURES.has(feature) || !isObject(details)) return;
      const reason = safeOwnData(details, 'reason');
      if (reason === 'missing-adapter' || reason === 'unavailable') {
        put(feature, featureState(feature, 'suspended', reason), {
          feature,
          reason,
          nonModal: true,
          truncated: false,
          message: 'An optional editor feature is unavailable.',
        });
        return;
      }
      if (reason !== 'limit') return;
      const presented = boundedCount(safeOwnData(details, 'presented'));
      const discarded = boundedCount(safeOwnData(details, 'discarded'));
      if (presented === undefined || discarded === undefined) return;
      const status = discarded > 0 ? 'truncated' : 'suspended';
      put(feature, featureState(feature, status, 'limit', presented, discarded), {
        feature,
        reason: 'limit',
        nonModal: true,
        truncated: discarded > 0,
        presented,
        discarded,
      });
    },
    pending(feature: CodeEditorDegradedFeature, details: CodeEditorPendingDetails) {
      if (!FEATURES.has(feature) || !isObject(details)) return;
      const candidate = safeOwnData(details, 'reason');
      const reason = candidate === 'retry' ? 'retry' : candidate === 'operation' ? 'operation' : undefined;
      if (reason === undefined) return;
      put(feature, featureState(feature, 'pending', reason), {
        feature,
        reason,
        nonModal: true,
        truncated: false,
        message: 'An optional editor operation is pending.',
      });
    },
    fail(feature: CodeEditorDegradedFeature, _error?: unknown) {
      if (!FEATURES.has(feature)) return;
      put(feature, featureState(feature, 'degraded', 'failure'), {
        feature,
        reason: 'failure',
        nonModal: true,
        truncated: false,
        message: 'An optional editor feature is unavailable.',
      });
    },
    recover(feature: CodeEditorDegradedFeature) {
      if (disposed || !FEATURES.has(feature)) return;
      const current = states.get(feature);
      if (current?.status === 'enabled' && current.reason === 'recovered') return;
      notices.delete(feature);
      states.set(feature, featureState(feature, 'enabled', 'recovered'));
      publish();
    },
    snapshot,
    dispose() {
      disposed = true;
      notificationScheduled = false;
      notices.clear();
      for (const feature of FEATURE_LIST) states.set(feature, featureState(feature));
    },
  };
  return Object.freeze(state);
}

function featureState(
  feature: CodeEditorDegradedFeature,
  status: CodeEditorFeatureStatus = 'enabled',
  reason = 'available',
  presented?: number,
  discarded?: number,
): CodeEditorFeatureInspection {
  return Object.freeze({
    feature,
    status,
    reason,
    ...(presented === undefined ? {} : { presented }),
    ...(discarded === undefined ? {} : { discarded }),
  });
}

function boundedCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, 1_000_000_000)
    : undefined;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function safeOwnData(value: object, name: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function ownFunction(
  options: CodeEditorDegradationOptions,
  name: keyof CodeEditorDegradationOptions,
): ((snapshot: CodeEditorDegradationSnapshot) => void) | undefined {
  const value = safeOwnData(options, name);
  return typeof value === 'function' ? (snapshot) => Reflect.apply(value, undefined, [snapshot]) : undefined;
}
import type { I18n } from '@jsvision/i18n';

import { formatCodeEditorDegradationNotice as formatNotice } from './i18n/presentation.js';
