import { codeEditorContract } from './_shared.js';

/** Document, interaction, language, folding, and search contracts in teaching order. */
export const FOUNDATION_CODE_EDITOR_CONTRACTS = [
  codeEditorContract(
    'code-editor/quick-start',
    'direct and windowed composition',
    [
      { probe: 'surface-kind', operator: 'equals', value: 'direct' },
      { probe: 'document-revision', operator: 'equals', value: 0 },
    ],
    [
      { probe: 'surface-kind', operator: 'equals', value: 'windowed' },
      { probe: 'status-text', operator: 'contains', value: 'window chrome' },
    ],
  ),
  codeEditorContract(
    'code-editor/document-controller',
    'document controller mutation flow',
    [{ probe: 'document-revision', operator: 'equals', value: 0 }],
    [
      { probe: 'document-revision', operator: 'greater-than', value: 0 },
      { probe: 'status-text', operator: 'contains', value: 'revision' },
    ],
  ),
  codeEditorContract(
    'code-editor/external-changes',
    'external change decision and save outcome',
    [{ probe: 'host-effects', operator: 'equals', value: 'none' }],
    [
      { probe: 'host-effects', operator: 'contains', value: 'external-change reloaded' },
      { probe: 'status-text', operator: 'contains', value: 'save' },
    ],
  ),
  codeEditorContract(
    'code-editor/editing-navigation',
    'editing selection and navigation',
    [{ probe: 'selection-size', operator: 'equals', value: 0 }],
    [
      { probe: 'selection-size', operator: 'greater-than', value: 0 },
      { probe: 'document-revision', operator: 'greater-than', value: 0 },
    ],
  ),
  codeEditorContract(
    'code-editor/readonly-clipboard',
    'read-only navigation and safe copy',
    [
      { probe: 'read-only', operator: 'equals', value: true },
      { probe: 'document-revision', operator: 'equals', value: 0 },
    ],
    [
      { probe: 'document-revision', operator: 'equals', value: 0 },
      { probe: 'host-effects', operator: 'contains', value: 'copied selection' },
    ],
  ),
  codeEditorContract(
    'code-editor/language-gallery',
    'built-in language adapter switching',
    [{ probe: 'language', operator: 'equals', value: 'plain' }],
    [
      { probe: 'language', operator: 'equals', value: 'javascript' },
      { probe: 'status-text', operator: 'contains', value: 'adapter' },
    ],
  ),
  codeEditorContract(
    'code-editor/syntax-fallback',
    'invalid source syntax fallback',
    [{ probe: 'language', operator: 'equals', value: 'typescript' }],
    [
      { probe: 'language', operator: 'equals', value: 'plain' },
      { probe: 'syntax-state', operator: 'equals', value: 'degraded' },
      { probe: 'status-text', operator: 'contains', value: 'fallback' },
    ],
  ),
  codeEditorContract(
    'code-editor/invisibles-line-endings',
    'invisible characters and line endings',
    [{ probe: 'invisible-warning-count', operator: 'equals', value: 0 }],
    [
      { probe: 'status-text', operator: 'contains', value: 'CRLF' },
      { probe: 'invisible-warning-count', operator: 'greater-than', value: 0 },
    ],
  ),
  codeEditorContract(
    'code-editor/language-folding',
    'language-provided folding',
    [{ probe: 'fold-count', operator: 'equals', value: 0 }],
    [
      { probe: 'fold-count', operator: 'greater-than', value: 0 },
      { probe: 'status-text', operator: 'contains', value: 'language fold' },
    ],
  ),
  codeEditorContract(
    'code-editor/structural-folding',
    'structure-derived folding',
    [{ probe: 'fold-count', operator: 'equals', value: 0 }],
    [
      { probe: 'fold-count', operator: 'greater-than', value: 0 },
      { probe: 'status-text', operator: 'contains', value: 'structural fold' },
    ],
  ),
  codeEditorContract(
    'code-editor/search',
    'query navigation and presentation',
    [{ probe: 'search-query', operator: 'equals', value: '' }],
    [
      { probe: 'search-query', operator: 'equals', value: 'message' },
      { probe: 'selection-size', operator: 'greater-than', value: 0 },
    ],
  ),
  codeEditorContract(
    'code-editor/replace',
    'replacement flow and document revision',
    [{ probe: 'document-revision', operator: 'equals', value: 0 }],
    [
      { probe: 'document-revision', operator: 'greater-than', value: 0 },
      { probe: 'status-text', operator: 'contains', value: 'replacement' },
    ],
  ),
] as const;
