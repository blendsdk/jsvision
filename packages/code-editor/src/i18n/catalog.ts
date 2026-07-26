import { createI18n, defineCatalog, plural } from '@jsvision/i18n';
import type { AcceleratorManifest, I18n, Message } from '@jsvision/i18n';

/**
 * Exact message inventory required from every Code Editor locale.
 *
 * Keeping this map explicit makes a missing or invented locale key a TypeScript error instead of
 * silently filling the gap with English.
 */
export interface CodeEditorMessageMap {
  readonly 'code-editor.window.title': Message;
  readonly 'code-editor.status.line': Message;
  readonly 'code-editor.status.column': Message;
  readonly 'code-editor.search.find': Message;
  readonly 'code-editor.search.replace': Message;
  readonly 'code-editor.search.matches': Message;
  readonly 'code-editor.search.case-sensitive': Message;
  readonly 'code-editor.search.case-sensitive.on': Message;
  readonly 'code-editor.search.case-sensitive.off': Message;
  readonly 'code-editor.search.action.next': Message;
  readonly 'code-editor.search.action.previous': Message;
  readonly 'code-editor.search.action.replace': Message;
  readonly 'code-editor.search.action.replace-all': Message;
  readonly 'code-editor.search.action.close': Message;
  readonly 'code-editor.diagnostic.severity.error': Message;
  readonly 'code-editor.diagnostic.severity.warning': Message;
  readonly 'code-editor.diagnostic.severity.information': Message;
  readonly 'code-editor.diagnostic.severity.hint': Message;
  readonly 'code-editor.degradation.feature-unavailable': Message;
  readonly 'code-editor.degradation.operation-pending': Message;
  readonly 'code-editor.invisible.warning': Message;
}

/**
 * Accelerator scopes owned by `@jsvision/code-editor`.
 *
 * Editor hints intentionally display stable key tokens instead of assigning translated mnemonics,
 * so the manifest has no collision scopes.
 */
export const CODE_EDITOR_ACCELERATOR_MANIFEST: AcceleratorManifest = Object.freeze({
  scopes: Object.freeze([]),
});

/** Canonical English message inventory used by the catalog and safe call-site defaults. */
export const CODE_EDITOR_ENGLISH_MESSAGES = {
  'code-editor.window.title': 'Code Editor',
  'code-editor.status.line': 'Ln',
  'code-editor.status.column': 'Col',
  'code-editor.search.find': 'Find',
  'code-editor.search.replace': 'Replace',
  'code-editor.search.matches': plural('count', {
    one: '${count} match',
    other: '${count} matches',
  }),
  'code-editor.search.case-sensitive': 'Case sensitive',
  'code-editor.search.case-sensitive.on': 'on',
  'code-editor.search.case-sensitive.off': 'off',
  'code-editor.search.action.next': 'next',
  'code-editor.search.action.previous': 'previous',
  'code-editor.search.action.replace': 'replace',
  'code-editor.search.action.replace-all': 'replace all',
  'code-editor.search.action.close': 'close',
  'code-editor.diagnostic.severity.error': 'Error',
  'code-editor.diagnostic.severity.warning': 'Warning',
  'code-editor.diagnostic.severity.information': 'Info',
  'code-editor.diagnostic.severity.hint': 'Hint',
  'code-editor.degradation.feature-unavailable': '${feature} unavailable',
  'code-editor.degradation.operation-pending': '${feature} pending',
  'code-editor.invisible.warning': 'warning ${codePoint}',
} satisfies CodeEditorMessageMap;

/** Canonical English messages owned by `@jsvision/code-editor`. */
export const CODE_EDITOR_ENGLISH_CATALOG = defineCatalog(
  {
    schema: 1,
    locale: 'en',
    messages: CODE_EDITOR_ENGLISH_MESSAGES,
  },
  {
    acceleratorManifest: CODE_EDITOR_ACCELERATOR_MANIFEST,
    placeholderManifest: {
      'code-editor.search.matches': ['count'],
      'code-editor.degradation.feature-unavailable': ['feature'],
      'code-editor.degradation.operation-pending': ['feature'],
      'code-editor.invisible.warning': ['codePoint'],
    },
  },
);

/**
 * Creates an isolated English service containing the Code Editor catalog.
 *
 * A fresh instance prevents runtime overlays and diagnostics from leaking between editor trees.
 */
export function createEnglishCodeEditorI18n(): I18n {
  return createI18n({ locale: 'en', catalogs: [CODE_EDITOR_ENGLISH_CATALOG] });
}
