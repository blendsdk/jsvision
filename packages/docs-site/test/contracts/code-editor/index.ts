import { FOUNDATION_CODE_EDITOR_CONTRACTS } from './foundation.js';
import { INTELLIGENCE_CODE_EDITOR_CONTRACTS } from './intelligence.js';
import { SAFETY_CODE_EDITOR_CONTRACTS } from './safety.js';

/** Exact Code Editor hub example population in teaching order. */
export const CODE_EDITOR_EXAMPLE_IDS = [
  'code-editor/quick-start',
  'code-editor/document-controller',
  'code-editor/external-changes',
  'code-editor/editing-navigation',
  'code-editor/readonly-clipboard',
  'code-editor/language-gallery',
  'code-editor/syntax-fallback',
  'code-editor/invisibles-line-endings',
  'code-editor/language-folding',
  'code-editor/structural-folding',
  'code-editor/search',
  'code-editor/replace',
  'code-editor/lsp-completion',
  'code-editor/lsp-diagnostics',
  'code-editor/lsp-navigation',
  'code-editor/viewport-mouse',
  'code-editor/large-document-tiers',
  'code-editor/themes',
  'code-editor/theme-fallback',
  'code-editor/safe-terminal-text',
  'code-editor/host-recovery',
] as const;

/** Complete typed behavior-contract population in the same teaching order. */
export const CODE_EDITOR_CONTRACTS = [
  ...FOUNDATION_CODE_EDITOR_CONTRACTS,
  ...INTELLIGENCE_CODE_EDITOR_CONTRACTS,
  ...SAFETY_CODE_EDITOR_CONTRACTS,
] as const;

export type { CodeEditorExpectation, CodeEditorProbe } from './_shared.js';
