import type { I18n } from '@jsvision/i18n';
import { stringWidth } from '@jsvision/ui';

import type { CodeEditorDegradationNotice } from '../degradation.js';
import type { InvisibleCharacterWarning } from '../languages/invisibles.js';
import { sanitizeProtocolText } from '../lsp/validation.js';
import type { CodeEditorOverlayPresentation } from '../presentation.js';
import { createEnglishCodeEditorI18n } from './catalog.js';

const DEGRADED_FEATURES: ReadonlySet<string> = new Set([
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

const DIAGNOSTIC_DEFAULTS = Object.freeze({
  error: 'Error',
  warning: 'Warning',
  information: 'Info',
  hint: 'Hint',
});

/**
 * Clips text to terminal display cells without splitting a wide code point.
 *
 * Combining marks are retained only when their preceding base glyph fits. When clipping is needed,
 * the default ellipsis consumes one cell and makes the truncation visible.
 *
 * @param text - Inert terminal text to clip.
 * @param maximumWidth - Available terminal cells.
 * @param ellipsis - Whether to reserve a final cell for an ellipsis when text is truncated.
 * @returns A display-cell-bounded prefix.
 * @example
 * ```ts
 * clipCodeEditorDisplayText('A界B', 3); // 'A界'
 * ```
 */
export function clipCodeEditorDisplayText(text: string, maximumWidth: number, ellipsis = true): string {
  const width = boundedWidth(maximumWidth);
  if (width === 0 || typeof text !== 'string') return '';
  const normalized: { text: string; width: number }[] = [];
  for (const character of text) {
    const characterWidth = stringWidth(character);
    if (characterWidth === 0) {
      const previous = normalized.at(-1);
      if (previous !== undefined) previous.text += character;
      continue;
    }
    normalized.push({ text: character, width: characterWidth });
  }
  if (normalized.reduce((total, unit) => total + unit.width, 0) <= width) {
    return normalized.map(({ text: unit }) => unit).join('');
  }
  const units: { text: string; width: number }[] = [];
  let used = 0;
  for (const unit of normalized) {
    if (used + unit.width > width) break;
    units.push(unit);
    used += unit.width;
  }
  if (ellipsis) {
    if (used < width) units.push({ text: '…', width: 1 });
    else if (units.at(-1)?.width === 1) units.splice(-1, 1, { text: '…', width: 1 });
  }
  return units.map(({ text: unit }) => unit).join('');
}

/**
 * Formats a structured diagnostic overlay at the final locale-bound view boundary.
 *
 * Older/custom overlays without metadata retain their compatible rows unchanged.
 *
 * @param overlay - Controller-owned overlay presentation.
 * @param i18n - Explicit locale service, defaulting to an isolated English service.
 * @param maximumWidth - Available popup content cells.
 * @returns Bounded localized rows.
 * @example
 * ```ts
 * formatCodeEditorDiagnosticOverlay({
 *   kind: 'diagnostic',
 *   items: ['[error] Unexpected token'],
 *   selected: 0,
 *   diagnostic: { severity: 'error', detail: 'Unexpected token' },
 * });
 * ```
 */
export function formatCodeEditorDiagnosticOverlay(
  overlay: CodeEditorOverlayPresentation,
  i18n: I18n = createEnglishCodeEditorI18n(),
  maximumWidth = 240,
): readonly string[] {
  const diagnostic = ownData(overlay, 'diagnostic');
  if (isObject(diagnostic)) {
    const severity = ownData(diagnostic, 'severity');
    const detail = sanitizeProtocolText(ownData(diagnostic, 'detail'), 65_536);
    if (isDiagnosticSeverity(severity) && detail !== undefined) {
      const label = i18n.t(`code-editor.diagnostic.severity.${severity}`, {
        defaultMessage: DIAGNOSTIC_DEFAULTS[severity],
      });
      return Object.freeze([clipCodeEditorDisplayText(`[${label}] ${detail}`, maximumWidth)]);
    }
  }
  const items = ownData(overlay, 'items');
  if (!Array.isArray(items)) return Object.freeze([]);
  const length = ownData(items, 'length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 512) {
    return Object.freeze([]);
  }
  const rows: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const row = sanitizeProtocolText(ownData(items, String(index)), 65_536);
    if (row !== undefined) rows.push(clipCodeEditorDisplayText(row, maximumWidth));
  }
  return Object.freeze(rows);
}

/**
 * Formats one editor-owned degradation notice without inspecting errors or external content.
 *
 * @param notice - Stable degradation metadata produced by the editor.
 * @param i18n - Explicit locale service, defaulting to isolated English.
 * @returns Localized wrapper text, or `undefined` for unsupported/unsafe input.
 * @example
 * ```ts
 * formatCodeEditorDegradationNotice({
 *   feature: 'parser',
 *   reason: 'failure',
 *   nonModal: true,
 *   truncated: false,
 * });
 * ```
 */
export function formatCodeEditorDegradationNotice(
  notice: CodeEditorDegradationNotice,
  i18n: I18n = createEnglishCodeEditorI18n(),
): string | undefined {
  const reason = ownData(notice, 'reason');
  const feature = ownData(notice, 'feature');
  if (typeof feature !== 'string' || !DEGRADED_FEATURES.has(feature)) return undefined;
  if (reason === 'missing-adapter' || reason === 'unavailable' || reason === 'failure') {
    return i18n.t('code-editor.degradation.feature-unavailable', {
      defaultMessage: '${feature} unavailable',
      params: { feature },
    });
  }
  if (reason === 'retry' || reason === 'operation') {
    return i18n.t('code-editor.degradation.operation-pending', {
      defaultMessage: '${feature} pending',
      params: { feature },
    });
  }
  return undefined;
}

/**
 * Formats one invisible-character warning while leaving detector offsets and source text untouched.
 *
 * @param warning - Existing detector warning.
 * @param i18n - Explicit locale service, defaulting to isolated English.
 * @returns A localized warning or its compatible safe label when metadata is invalid.
 * @example
 * ```ts
 * formatInvisibleCharacterWarning({ offset: 4, codePoint: 'U+202E', label: 'warning U+202E' });
 * ```
 */
export function formatInvisibleCharacterWarning(
  warning: InvisibleCharacterWarning,
  i18n: I18n = createEnglishCodeEditorI18n(),
): string {
  const codePoint = ownData(warning, 'codePoint');
  if (typeof codePoint !== 'string' || !/^U\+[0-9A-F]{4,6}$/u.test(codePoint)) {
    return 'warning';
  }
  return i18n.t('code-editor.invisible.warning', {
    defaultMessage: 'warning ${codePoint}',
    params: { codePoint },
  });
}

/**
 * Formats status values with line and column before lower-priority language text.
 *
 * @param status - Stable language and one-based caret coordinates.
 * @param i18n - Locale service used for labels and number formatting.
 * @param maximumWidth - Actual status-row width in terminal cells.
 * @returns A bounded status row.
 * @example
 * ```ts
 * formatCodeEditorStatus({ language: 'typescript', line: 12, column: 34 });
 * ```
 */
export function formatCodeEditorStatus(
  status: { readonly language: string; readonly line: number; readonly column: number },
  i18n: I18n = createEnglishCodeEditorI18n(),
  maximumWidth = 2_000,
): string {
  const language = sanitizeProtocolText(ownData(status, 'language'), 2_000) ?? '';
  const lineValue = positiveInteger(ownData(status, 'line'));
  const columnValue = positiveInteger(ownData(status, 'column'));
  const line = i18n.t('code-editor.status.line', { defaultMessage: 'Ln' });
  const column = i18n.t('code-editor.status.column', { defaultMessage: 'Col' });
  const position = `${line} ${i18n.number(lineValue)}, ${column} ${i18n.number(columnValue)}`;
  const complete = language.length === 0 ? position : `${position}  ${language}`;
  const width = boundedWidth(maximumWidth);
  if (stringWidth(complete) <= width) return complete;
  const positionWidth = stringWidth(position);
  if (positionWidth === width) return position;
  if (positionWidth < width) return `${position}${clipCodeEditorDisplayText('…', width - positionWidth, false)}`;
  return clipCodeEditorDisplayText(position, width);
}

/** Reads an own data property without invoking hostile getters or proxy traps beyond the descriptor lookup. */
function ownData(value: unknown, name: string): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/** Identifies the only stable diagnostic severities accepted by the public projector. */
function isDiagnosticSeverity(value: unknown): value is 'error' | 'warning' | 'information' | 'hint' {
  return value === 'error' || value === 'warning' || value === 'information' || value === 'hint';
}

/** Narrows values before nested own-property inspection. */
function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Uses one as the safe one-based fallback for malformed status coordinates. */
function positiveInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : 1;
}

/** Converts an arbitrary numeric width into the editor's supported non-negative cell range. */
function boundedWidth(width: number): number {
  return Number.isFinite(width) ? Math.max(0, Math.min(2_000, Math.trunc(width))) : 0;
}
