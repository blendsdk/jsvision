import type { CodeEditorLspStateSnapshot } from './lsp/types.js';
import { sanitizeProtocolText } from './lsp/validation.js';

/** One inert completion candidate shared by manual and language-service assistance. */
export interface CodeEditorCompletionItem {
  /** Sanitized text displayed in the completion list. */
  readonly label: string;
  /** Optional sanitized supporting text. */
  readonly detail?: string;
  /** Optional source text inserted instead of the label. */
  readonly insertText?: string;
  /** Optional inclusive start offset for an explicit replacement range. */
  readonly from?: number;
  /** Optional exclusive end offset paired with `from`. */
  readonly to?: number;
}

/** The single completion list rendered and navigated by an editor. */
export interface CodeEditorCompletionPresentation {
  /** Identifies whether the host or language service supplied the list. */
  readonly source: 'manual' | 'language-service';
  /** Bounded immutable candidates safe for terminal projection. */
  readonly items: readonly CodeEditorCompletionItem[];
  /** Zero-based selected candidate index. */
  readonly selected: number;
  /** Document lineage for stale-result rejection. */
  readonly lineage: string;
  /** Document revision for stale-result rejection. */
  readonly revision: number;
}

/**
 * One non-completion terminal overlay sharing the editor's bounded popup.
 *
 * @example
 * ```ts
 * const overlay: CodeEditorOverlayPresentation = {
 *   kind: 'diagnostic',
 *   items: ['[error] Unexpected token'],
 *   selected: 0,
 * };
 * ```
 */
export interface CodeEditorOverlayPresentation {
  /** Interaction family represented by the rows. */
  readonly kind: 'hover' | 'signature' | 'diagnostic' | 'navigation' | 'symbols';
  /** Sanitized bounded rows rendered by the terminal popup. */
  readonly items: readonly string[];
  /** Zero-based row selected by chooser-style overlays. */
  readonly selected: number;
  /** Locale-neutral diagnostic wrapper retained until the final view projection. */
  readonly diagnostic?: {
    /** Stable severity used to select the localized editor-owned label. */
    readonly severity: 'error' | 'warning' | 'information' | 'hint';
    /** Sanitized external detail that must never be translated as a template. */
    readonly detail: string;
  };
}

/** Assistance state exposed by a controller without retaining terminal views. */
export interface CodeEditorAssistancePresentation {
  /** Current shared completion list, when open. */
  readonly completion?: CodeEditorCompletionPresentation;
  /** Current bounded hover content. */
  readonly hover?: CodeEditorLspStateSnapshot['presentation']['hover'];
  /** Current bounded signature-help lines. */
  readonly signature?: CodeEditorLspStateSnapshot['presentation']['signature'];
  /** Current immutable diagnostics projection. */
  readonly diagnostics: CodeEditorLspStateSnapshot['presentation']['diagnostics'];
  /** Current validated definition-target chooser. */
  readonly navigationChooser?: CodeEditorLspStateSnapshot['presentation']['navigationChooser'];
  /** Current validated document-symbol chooser. */
  readonly symbolChooser?: CodeEditorLspStateSnapshot['presentation']['symbolChooser'];
  /** Current non-completion overlay projected through the shared terminal popup. */
  readonly overlay?: CodeEditorOverlayPresentation;
}

/** Immutable render-facing state for one document controller. */
export interface CodeEditorControllerPresentation {
  /** Assistance surfaces owned by the controller. */
  readonly assistance: CodeEditorAssistancePresentation;
  /** Current language-service lifecycle state. */
  readonly serviceState: CodeEditorLspStateSnapshot['serviceState'];
  /** Current request progress indicator. */
  readonly operationState: CodeEditorLspStateSnapshot['operationState'];
  /** Commands enabled by negotiated capabilities. */
  readonly commandAvailability: CodeEditorLspStateSnapshot['commandAvailability'];
}

/**
 * Normalizes manual completion payloads without invoking accessors on hostile input objects.
 *
 * @param items - Candidate array supplied by a host.
 * @param itemLimit - Maximum number of candidates to retain.
 * @param labelLimit - Maximum display length for labels and details.
 * @param documentLength - Current UTF-16 document length used to validate explicit ranges.
 * @returns A detached immutable list, or `undefined` when the container is unsafe.
 */
export function normalizeCodeEditorCompletionItems(
  items: readonly CodeEditorCompletionItem[],
  itemLimit: number,
  labelLimit: number,
  documentLength: number,
): readonly CodeEditorCompletionItem[] | undefined {
  const normalized: CodeEditorCompletionItem[] = [];
  try {
    if (!Array.isArray(items) || items.length > 100_000) return undefined;
    for (let index = 0; index < Math.min(items.length, itemLimit); index += 1) {
      const item = ownData(items, String(index));
      const label = sanitizeProtocolText(ownData(item, 'label'), labelLimit);
      const detail = sanitizeProtocolText(ownData(item, 'detail'), labelLimit);
      const insertText = ownBoundedString(item, 'insertText', 65_536);
      const from = ownInteger(item, 'from');
      const to = ownInteger(item, 'to');
      if (label === undefined || label.length === 0 || (from === undefined) !== (to === undefined)) continue;
      if (from !== undefined && (from < 0 || to === undefined || to < from || to > documentLength)) continue;
      normalized.push(
        Object.freeze({
          label,
          ...(detail === undefined ? {} : { detail }),
          ...(insertText === undefined ? {} : { insertText }),
          ...(from === undefined ? {} : { from, to }),
        }),
      );
    }
  } catch {
    return undefined;
  }
  return Object.freeze(normalized);
}

/**
 * Returns the identifier run replaced by a manual completion with no explicit edit range.
 *
 * @param text - Current document source.
 * @param caret - Current UTF-16 caret offset.
 * @returns A bounded half-open identifier range around the caret.
 */
export function codeEditorCompletionWordRange(
  text: string,
  caret: number,
): { readonly from: number; readonly to: number } {
  let from = Math.max(0, Math.min(caret, text.length));
  let to = from;
  while (from > 0 && /[A-Za-z0-9_$]/u.test(text[from - 1] ?? '')) from -= 1;
  while (to < text.length && /[A-Za-z0-9_$]/u.test(text[to] ?? '')) to += 1;
  return Object.freeze({ from, to });
}

/**
 * Creates a frozen controller snapshot from protocol state and an optional manual completion.
 *
 * @param state - Latest immutable coordinator state, when a service is configured.
 * @param manualCompletion - Compatible host completion used only while protocol completion is absent.
 * @param overlay - Current controller-owned non-completion terminal overlay.
 * @returns One immutable render-facing controller projection.
 */
export function projectCodeEditorControllerPresentation(
  state: CodeEditorLspStateSnapshot | undefined,
  manualCompletion?: CodeEditorCompletionPresentation,
  overlay?: CodeEditorOverlayPresentation,
): CodeEditorControllerPresentation {
  const protocolCompletion = state?.presentation.completion;
  const completion =
    protocolCompletion === undefined
      ? manualCompletion
      : Object.freeze({
          source: 'language-service' as const,
          items: protocolCompletion.items,
          selected: protocolCompletion.selected,
          lineage: protocolCompletion.lineage,
          revision: protocolCompletion.revision,
        });
  const diagnostics =
    state?.presentation.diagnostics ??
    Object.freeze({
      items: Object.freeze([]),
      totalCount: 0,
      truncated: false,
      versioned: false,
    });
  const assistance = Object.freeze({
    ...(completion === undefined ? {} : { completion }),
    ...(state?.presentation.hover === undefined ? {} : { hover: state.presentation.hover }),
    ...(state?.presentation.signature === undefined ? {} : { signature: state.presentation.signature }),
    diagnostics,
    ...(state?.presentation.navigationChooser === undefined
      ? {}
      : { navigationChooser: state.presentation.navigationChooser }),
    ...(state?.presentation.symbolChooser === undefined ? {} : { symbolChooser: state.presentation.symbolChooser }),
    ...(overlay === undefined ? {} : { overlay }),
  });
  return Object.freeze({
    assistance,
    serviceState: state?.serviceState ?? 'plain',
    operationState: state?.operationState ?? 'idle',
    commandAvailability: state?.commandAvailability ?? EMPTY_COMMAND_AVAILABILITY,
  });
}

const EMPTY_COMMAND_AVAILABILITY = Object.freeze({
  completion: false,
  hover: false,
  signatureHelp: false,
  diagnostics: false,
  definition: false,
  documentSymbols: false,
  documentFormatting: false,
  rangeFormatting: false,
});

function ownBoundedString(value: unknown, key: string, limit: number): string | undefined {
  const candidate = ownData(value, key);
  return typeof candidate === 'string' && candidate.length <= limit ? candidate : undefined;
}

function ownInteger(value: unknown, key: string): number | undefined {
  const candidate = ownData(value, key);
  return Number.isSafeInteger(candidate) ? (candidate as number) : undefined;
}

function ownData(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== 'object') return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}
