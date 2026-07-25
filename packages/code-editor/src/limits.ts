const MEBIBYTE = 1_048_576;

/** Hard safety ceilings shared by editor subsystems. Hosts may only lower these values. */
export interface CodeEditorLimits {
  readonly documentBytes: number;
  readonly documentLines: number;
  readonly historyEntries: number;
  readonly historyBytes: number;
  readonly editsPerTransaction: number;
  readonly replacementBytes: number;
  readonly decorations: number;
  readonly folds: number;
  readonly diagnostics: number;
  readonly completionItems: number;
  readonly symbols: number;
  readonly protocolMessageBytes: number;
  readonly protocolNestingDepth: number;
  readonly popupWidth: number;
  readonly popupHeight: number;
  readonly retainedTelemetryEvents: number;
}

/** Optional host limits. Invalid or excessive values resolve to immutable safe ceilings. */
export type CodeEditorLimitsInput = Readonly<Partial<CodeEditorLimits>>;

/** Immutable upper bounds enforced even when a host supplies larger values. */
export const HARD_CODE_EDITOR_LIMITS: CodeEditorLimits = Object.freeze({
  documentBytes: 64 * MEBIBYTE,
  documentLines: 1_000_000,
  historyEntries: 10_000,
  historyBytes: 64 * MEBIBYTE,
  editsPerTransaction: 5_000,
  replacementBytes: MEBIBYTE,
  decorations: 100_000,
  folds: 50_000,
  diagnostics: 5_000,
  completionItems: 512,
  symbols: 10_000,
  protocolMessageBytes: 8 * MEBIBYTE,
  protocolNestingDepth: 64,
  popupWidth: 240,
  popupHeight: 100,
  retainedTelemetryEvents: 1_024,
});

const DEFAULT_CODE_EDITOR_LIMITS: CodeEditorLimits = Object.freeze({
  ...HARD_CODE_EDITOR_LIMITS,
  historyEntries: 1_000,
  historyBytes: 16 * MEBIBYTE,
  replacementBytes: MEBIBYTE,
  completionItems: 12,
  diagnostics: 500,
  retainedTelemetryEvents: 128,
  popupWidth: 80,
  popupHeight: 12,
});

/** Features guaranteed to remain available in bounded and reduced document modes. */
export type EssentialCodeEditorFeature = 'edit' | 'search' | 'lineNumbers' | 'status' | 'save' | 'close';

/** Features whose availability is explained by document-size classification. */
export type CodeEditorSizeTierFeature =
  EssentialCodeEditorFeature | 'parser' | 'syntax' | 'folds' | 'diagnostics' | 'completion' | 'symbols';

/** Content-free availability record for one document-size-dependent feature. */
export interface CodeEditorDocumentFeatureState {
  readonly feature: CodeEditorSizeTierFeature;
  readonly status: 'enabled' | 'suspended' | 'truncated';
  readonly reason: string;
}

/** Observable document-size classification used before optional feature activation. */
export interface CodeEditorDocumentSizeClassification {
  readonly mode: 'full' | 'large' | 'reduced';
  readonly confirmationRequired: boolean;
  readonly language?: 'plain';
  readonly preservedFeatures: readonly EssentialCodeEditorFeature[];
  readonly featureStates: readonly CodeEditorDocumentFeatureState[];
}

const ESSENTIAL_FEATURES: readonly EssentialCodeEditorFeature[] = Object.freeze([
  'edit',
  'search',
  'lineNumbers',
  'status',
  'save',
  'close',
]);
const OPTIONAL_SIZE_FEATURES: readonly CodeEditorSizeTierFeature[] = Object.freeze([
  'parser',
  'syntax',
  'folds',
  'diagnostics',
  'completion',
  'symbols',
]);

/**
 * Resolves all host limits into a frozen policy without permitting a safety ceiling increase.
 *
 * @example
 * ```ts
 * const limits = resolveCodeEditorLimits({ diagnostics: 100 });
 * ```
 */
export function resolveCodeEditorLimits(input: CodeEditorLimitsInput = {}): CodeEditorLimits {
  const resolved = {} as Record<keyof CodeEditorLimits, number>;
  for (const key of Object.keys(HARD_CODE_EDITOR_LIMITS) as (keyof CodeEditorLimits)[]) {
    const ceiling = HARD_CODE_EDITOR_LIMITS[key];
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    const candidate = descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
    resolved[key] =
      typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 1
        ? Math.min(candidate, ceiling)
        : DEFAULT_CODE_EDITOR_LIMITS[key];
  }
  return Object.freeze(resolved);
}

/**
 * Classifies a document without allocating its content or changing it.
 *
 * @example
 * ```ts
 * classifyDocumentSize({ bytes: 2_000_000, lines: 20_000 }).mode;
 * ```
 */
export function classifyDocumentSize(size: {
  readonly bytes: number;
  readonly lines: number;
}): CodeEditorDocumentSizeClassification {
  if (!Number.isSafeInteger(size.bytes) || size.bytes < 0 || !Number.isSafeInteger(size.lines) || size.lines < 1) {
    throw new RangeError('Document size must contain bounded non-negative bytes and at least one line.');
  }
  if (size.bytes > 10 * MEBIBYTE) {
    return Object.freeze({
      mode: 'reduced',
      confirmationRequired: true,
      language: 'plain',
      preservedFeatures: ESSENTIAL_FEATURES,
      featureStates: documentFeatureStates('reduced'),
    });
  }
  if (size.bytes > MEBIBYTE || size.lines > 50_000) {
    return Object.freeze({
      mode: 'large',
      confirmationRequired: false,
      preservedFeatures: ESSENTIAL_FEATURES,
      featureStates: documentFeatureStates('large'),
    });
  }
  return Object.freeze({
    mode: 'full',
    confirmationRequired: false,
    preservedFeatures: ESSENTIAL_FEATURES,
    featureStates: documentFeatureStates('full'),
  });
}

function documentFeatureStates(
  mode: CodeEditorDocumentSizeClassification['mode'],
): readonly CodeEditorDocumentFeatureState[] {
  const essential = ESSENTIAL_FEATURES.map((feature) =>
    Object.freeze({
      feature,
      status: 'enabled' as const,
      reason: mode === 'full' ? 'full-feature tier' : 'preserved core feature',
    }),
  );
  const optional = OPTIONAL_SIZE_FEATURES.map((feature) =>
    Object.freeze({
      feature,
      status: mode === 'reduced' ? ('suspended' as const) : ('enabled' as const),
      reason:
        mode === 'full'
          ? 'full-feature tier'
          : mode === 'large'
            ? 'enabled with bounded large-document budgets'
            : 'reduced plain mode after explicit confirmation',
    }),
  );
  return Object.freeze([...essential, ...optional]);
}
