import { codeEditorContract } from './_shared.js';

/** Language-service and viewport contracts in teaching order. */
export const INTELLIGENCE_CODE_EDITOR_CONTRACTS = [
  codeEditorContract(
    'code-editor/lsp-completion',
    'bounded completion and signature service',
    [{ probe: 'completion-count', operator: 'equals', value: 0 }],
    [
      { probe: 'completion-count', operator: 'greater-than', value: 0 },
      { probe: 'intelligence-kinds', operator: 'greater-than', value: 2 },
      { probe: 'service-state', operator: 'equals', value: 'ready' },
    ],
  ),
  codeEditorContract(
    'code-editor/lsp-diagnostics',
    'diagnostic projection and safe overlay',
    [{ probe: 'diagnostic-count', operator: 'equals', value: 0 }],
    [
      { probe: 'diagnostic-count', operator: 'greater-than', value: 0 },
      { probe: 'terminal-safe', operator: 'equals', value: true },
    ],
  ),
  codeEditorContract(
    'code-editor/lsp-navigation',
    'symbols navigation and formatting availability',
    [{ probe: 'caret-offset', operator: 'equals', value: 0 }],
    [
      { probe: 'service-state', operator: 'equals', value: 'ready' },
      { probe: 'caret-offset', operator: 'greater-than', value: 0 },
    ],
  ),
  codeEditorContract(
    'code-editor/viewport-mouse',
    'responsive viewport and mouse selection',
    [{ probe: 'selection-size', operator: 'equals', value: 0 }],
    [
      { probe: 'selection-size', operator: 'greater-than', value: 0 },
      { probe: 'status-text', operator: 'contains', value: 'viewport' },
    ],
  ),
  codeEditorContract(
    'code-editor/large-document-tiers',
    'bounded large-document degradation tiers',
    [{ probe: 'large-tier', operator: 'equals', value: 'full' }],
    [
      { probe: 'large-tier', operator: 'equals', value: 'large' },
      { probe: 'status-text', operator: 'contains', value: 'degraded' },
    ],
  ),
] as const;
