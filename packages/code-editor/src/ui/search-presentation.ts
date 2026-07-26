import type { I18n } from '@jsvision/i18n';
import { stringWidth } from '@jsvision/ui';

import { createEnglishCodeEditorI18n } from '../i18n/catalog.js';
import { clipCodeEditorDisplayText } from '../i18n/presentation.js';
import { sanitizeProtocolText } from '../lsp/validation.js';
import type { CodeEditorSearchState } from './search-session.js';

/** Immutable terminal rows reserved for the editor's find/replace surface. */
export interface CodeEditorSearchPresentation {
  /** Zero while closed, one for find, and two for replace. */
  readonly rowCount: 0 | 1 | 2;
  /** Display-cell-bounded localized rows in top-to-bottom order. */
  readonly rows: readonly string[];
}

/**
 * Projects immutable search state into localized, display-cell-bounded terminal rows.
 *
 * Caller query and replacement strings are concatenated as inert content. They are never passed
 * through translation templates or normalized for presentation.
 *
 * @param state - Locale-neutral search session snapshot.
 * @param i18n - Locale service used only for editor-owned wrapper text.
 * @param width - Available terminal cells per row.
 * @returns Zero, one, or two immutable presentation rows.
 */
export function projectCodeEditorSearchPresentation(
  state: CodeEditorSearchState,
  i18n: I18n = createEnglishCodeEditorI18n(),
  width = 2_000,
): CodeEditorSearchPresentation {
  const safeState = normalizeSearchState(state);
  if (!safeState.open) return Object.freeze({ rowCount: 0, rows: Object.freeze([]) });
  const query = requiredField(
    i18n.t('code-editor.search.find', { defaultMessage: 'Find' }),
    safeState.query,
    safeState.activeField === 'query',
  );
  const matches = i18n.t('code-editor.search.matches', {
    defaultMessage: { kind: 'plural', parameter: 'count', cases: { one: '${count} match', other: '${count} matches' } },
    params: { count: safeState.total },
  });
  const caseState = i18n.t(
    safeState.caseSensitive ? 'code-editor.search.case-sensitive.on' : 'code-editor.search.case-sensitive.off',
    { defaultMessage: safeState.caseSensitive ? 'on' : 'off' },
  );
  const caseLabel = i18n.t('code-editor.search.case-sensitive', { defaultMessage: 'Case sensitive' });
  const actions = [
    `[Enter] ${i18n.t('code-editor.search.action.next', { defaultMessage: 'next' })}`,
    `[Shift+Enter] ${i18n.t('code-editor.search.action.previous', { defaultMessage: 'previous' })}`,
    `[Esc] ${i18n.t('code-editor.search.action.close', { defaultMessage: 'close' })}`,
  ];
  const queryRow = prioritizedRow(query, [matches, `${caseLabel}: ${caseState}`, ...actions], width);
  if (!safeState.replace) {
    return Object.freeze({ rowCount: 1, rows: Object.freeze([queryRow]) });
  }
  const replacement = requiredField(
    i18n.t('code-editor.search.replace', { defaultMessage: 'Replace' }),
    safeState.replacement,
    safeState.activeField === 'replacement',
  );
  const replacementActions = [
    `[search.replaceCurrent] ${i18n.t('code-editor.search.action.replace', { defaultMessage: 'replace' })}`,
    `[search.replaceAll] ${i18n.t('code-editor.search.action.replace-all', { defaultMessage: 'replace all' })}`,
  ];
  return Object.freeze({
    rowCount: 2,
    rows: Object.freeze([queryRow, prioritizedRow(replacement, replacementActions, width)]),
  });
}

/** Marks the active field without changing the caller-owned field value. */
function requiredField(label: string, value: string, active: boolean): string {
  return `${active ? '›' : ' '}${label}: ${value}`;
}

/** Retains the required field first, then appends optional segments only when each fits completely. */
function prioritizedRow(required: string, optional: readonly string[], width: number): string {
  const maximumWidth = Number.isFinite(width) ? Math.max(0, Math.min(2_000, Math.trunc(width))) : 0;
  if (stringWidth(required) > maximumWidth) return clipCodeEditorDisplayText(required, maximumWidth);
  let result = required;
  for (const segment of optional) {
    const candidate = `${result}  ${segment}`;
    if (stringWidth(candidate) > maximumWidth) break;
    result = candidate;
  }
  return result;
}

/** Detaches and sanitizes public search state without invoking accessor-backed properties. */
function normalizeSearchState(state: CodeEditorSearchState): CodeEditorSearchState {
  const activeField = ownData(state, 'activeField');
  const total = ownData(state, 'total');
  const current = ownData(state, 'current');
  return Object.freeze({
    open: ownData(state, 'open') === true,
    replace: ownData(state, 'replace') === true,
    activeField: activeField === 'replacement' ? 'replacement' : 'query',
    query: sanitizeProtocolText(ownData(state, 'query'), 65_536) ?? '',
    replacement: sanitizeProtocolText(ownData(state, 'replacement'), 65_536) ?? '',
    caseSensitive: ownData(state, 'caseSensitive') === true,
    current: safeCount(current),
    total: safeCount(total),
  });
}

/** Reads an own data property without evaluating getters or proxy-provided accessors. */
function ownData(value: unknown, name: string): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/** Bounds malformed public counts to safe non-negative presentation values. */
function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;
}
