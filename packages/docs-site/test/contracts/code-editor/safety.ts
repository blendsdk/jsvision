import { codeEditorContract } from './_shared.js';

/** Theme, terminal-safety, and host-recovery contracts in teaching order. */
export const SAFETY_CODE_EDITOR_CONTRACTS = [
  codeEditorContract(
    'code-editor/themes',
    'editor theme switching',
    [{ probe: 'theme-name', operator: 'equals', value: 'classic' }],
    [
      { probe: 'theme-name', operator: 'equals', value: 'dark' },
      { probe: 'status-text', operator: 'contains', value: 'theme' },
    ],
  ),
  codeEditorContract(
    'code-editor/theme-fallback',
    'theme resolution fallback report',
    [{ probe: 'theme-rejection-count', operator: 'equals', value: 0 }],
    [
      { probe: 'theme-rejection-count', operator: 'greater-than', value: 0 },
      { probe: 'status-text', operator: 'contains', value: 'fallback' },
    ],
  ),
  codeEditorContract(
    'code-editor/safe-terminal-text',
    'terminal-safe protocol presentation',
    [{ probe: 'terminal-safe', operator: 'equals', value: true }],
    [
      { probe: 'terminal-safe', operator: 'equals', value: true },
      { probe: 'status-text', operator: 'excludes', value: '\u001b' },
    ],
  ),
  codeEditorContract(
    'code-editor/host-recovery',
    'authorized host effects and service recovery',
    [
      { probe: 'service-state', operator: 'equals', value: 'degraded' },
      { probe: 'host-callback-state', operator: 'equals', value: 'degraded' },
    ],
    [
      { probe: 'service-state', operator: 'equals', value: 'ready' },
      { probe: 'host-callback-state', operator: 'equals', value: 'enabled' },
      { probe: 'host-effects', operator: 'contains', value: 'authorized navigate' },
    ],
  ),
] as const;
