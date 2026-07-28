import type { CodeEditorDemoAction } from './scenarios.js';

/**
 * Returns the controls exposed by a showcase scenario.
 *
 * The registry is kept separate from scenario construction so the large runtime module remains
 * focused on mounting and disposing editor surfaces.
 */
export function actionsForCodeEditorScenario(id: string): readonly CodeEditorDemoAction[] {
  const qaAction = qaActionForScenario(id);
  if (qaAction !== undefined) return Object.freeze([qaAction]);
  if (id === 'language-intelligence')
    return Object.freeze([
      'completion',
      'hover',
      'signature',
      'symbols',
      'diagnostic-detail',
      'snippet',
      'format',
      'replace',
      'navigate',
      'navigation-back',
      'save',
      'close',
      'external-change',
      'cancel-recover',
      'host-accept',
      'host-reject',
      'host-conflict',
    ]);
  if (id === 'language-gallery')
    return Object.freeze([
      'language',
      'language-postgresql',
      'language-javascript',
      'language-typescript',
      'language-plain',
      'syntax-edit',
      'edit',
      'search',
    ]);
  if (id === 'themes-and-fallbacks') return Object.freeze(['theme', 'unicode', 'edit', 'search']);
  if (id === 'modern-keyboard-editing')
    return Object.freeze(['select', 'indent', 'history', 'clipboard', 'edit', 'search']);
  if (id === 'read-only-editor') return Object.freeze(['readonly-attempt', 'search']);
  if (id === 'shared-session-editors') return Object.freeze(['peer-edit']);
  if (id === 'typescript-window') return Object.freeze(['edit', 'search', 'fold', 'save']);
  if (id === 'structural-folding') return Object.freeze(['bracket-select', 'fold', 'search']);
  if (id === 'postgresql-folding') return Object.freeze(['fold', 'search']);
  return Object.freeze(['edit', 'search']);
}

/** Maps each dedicated QA scenario to its single primary interaction. */
function qaActionForScenario(id: string): CodeEditorDemoAction | undefined {
  if (id === 'qa-lsp-completion') return 'completion';
  if (id === 'qa-lsp-hover') return 'hover';
  if (id === 'qa-lsp-signature') return 'signature';
  if (id === 'qa-lsp-diagnostics') return 'diagnostic-detail';
  if (id === 'qa-lsp-symbols') return 'symbols';
  if (id === 'qa-lsp-formatting') return 'format';
  if (id === 'qa-lsp-navigation') return 'navigate';
  if (id === 'qa-lsp-recovery') return 'cancel-recover';
  if (id === 'qa-host-save-accepted') return 'host-accept';
  if (id === 'qa-host-save-rejected') return 'host-reject';
  if (id === 'qa-host-save-conflict') return 'host-conflict';
  return undefined;
}
