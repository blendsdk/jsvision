import type { CodeEditorCapabilityInventoryEntry, CodeEditorDemoAction } from './scenarios.js';

/**
 * Exhaustive capability-level manifest for the standalone showcase.
 *
 * Interactive entries name a reachable scenario and concrete interaction. Deferred entries remain
 * visible with a durable reason so the demo never implies support by omission.
 */
export const CODE_EDITOR_CAPABILITY_INVENTORY: readonly CodeEditorCapabilityInventoryEntry[] = Object.freeze([
  interactive('surface.direct-editor', 'Direct embedded editor', 'direct-editor'),
  interactive('surface.windowed-editor', 'Window-hosted editor', 'typescript-window'),
  interactiveNative('window.move', 'Move an editor window', 'viewport-and-mouse'),
  interactiveNative('window.resize', 'Resize an editor window', 'viewport-and-mouse'),
  interactiveNative('window.maximize-restore', 'Maximize and restore an editor window', 'viewport-and-mouse'),
  interactiveAction('editing.text-input', 'Source text input', 'direct-editor', 'edit', 'document.revision'),
  interactiveAction(
    'editing.selection',
    'Keyboard and mouse selection',
    'modern-keyboard-editing',
    'select',
    'document.selection',
  ),
  interactiveAction(
    'editing.modern-keyboard',
    'Modern indentation and navigation keys',
    'modern-keyboard-editing',
    'indent',
    'document.revision',
  ),
  interactiveAction('editing.search', 'In-document search', 'typescript-window', 'search', 'publicState.selection'),
  interactiveAction('editing.history', 'Undo and redo', 'modern-keyboard-editing', 'history', 'document.revision'),
  interactiveAction(
    'editing.clipboard',
    'Copy, cut, and paste commands',
    'modern-keyboard-editing',
    'clipboard',
    'document.revision',
  ),
  interactiveAction(
    'editing.read-only',
    'Read-only document behavior',
    'read-only-editor',
    'readonly-attempt',
    'host.readonly-blocked',
  ),
  interactive('gutter.line-numbers', 'Optional line-number gutter', 'line-number-gutter'),
  interactiveAction(
    'language.postgresql',
    'PostgreSQL source',
    'language-gallery',
    'language-postgresql',
    'publicState.language',
  ),
  interactiveAction(
    'language.javascript',
    'JavaScript source',
    'language-gallery',
    'language-javascript',
    'publicState.language',
  ),
  interactiveAction(
    'language.typescript',
    'TypeScript source',
    'language-gallery',
    'language-typescript',
    'publicState.language',
  ),
  interactiveAction(
    'language.plain-text',
    'Plain text source',
    'language-gallery',
    'language-plain',
    'publicState.language',
  ),
  interactiveAction(
    'language.syntax-highlighting',
    'Parser-backed syntax highlighting',
    'language-gallery',
    'syntax-edit',
    'language.syntax',
  ),
  interactiveAction(
    'language.brackets',
    'Bracket matching',
    'structural-folding',
    'bracket-select',
    'document.selection',
  ),
  interactiveAction('language.folding', 'Structural code folding', 'structural-folding', 'fold', 'language.folds'),
  interactiveAction(
    'language.switching',
    'Language adapter switching',
    'language-gallery',
    'language',
    'publicState.language',
  ),
  interactiveAction(
    'lsp.completion',
    'Completion assistance',
    'language-intelligence',
    'completion',
    'presentation.completion',
  ),
  interactiveAction('lsp.hover', 'Keyboard hover assistance', 'language-intelligence', 'hover', 'presentation.overlay'),
  interactiveAction(
    'lsp.signature',
    'Signature assistance',
    'language-intelligence',
    'signature',
    'presentation.overlay',
  ),
  interactiveAction(
    'lsp.diagnostics',
    'Diagnostics',
    'language-intelligence',
    'diagnostic-detail',
    'host.diagnostic-detail',
  ),
  interactiveAction('lsp.symbols', 'Document symbols', 'language-intelligence', 'symbols', 'presentation.overlay'),
  interactiveAction(
    'lsp.navigation',
    'Authorized definition navigation',
    'language-intelligence',
    'navigate',
    'host.navigate',
  ),
  interactiveAction(
    'lsp.navigation-back',
    'Local navigation back',
    'language-intelligence',
    'navigation-back',
    'publicState.selection',
  ),
  interactiveAction('lsp.formatting', 'Document formatting', 'language-intelligence', 'format', 'document.revision'),
  interactiveAction(
    'lsp.snippet-traversal',
    'Snippet placeholder traversal',
    'language-intelligence',
    'snippet',
    'publicState.selection',
  ),
  interactiveAction(
    'lsp.multi-document-isolation',
    'Shared-session document isolation',
    'shared-session-editors',
    'peer-edit',
    'peer.revision',
  ),
  interactiveAction(
    'host.authorization',
    'Host-authorized effects',
    'language-intelligence',
    'host-reject',
    'host.save',
  ),
  interactiveAction('lifecycle.close', 'Host-authorized close', 'language-intelligence', 'close', 'host.close'),
  interactiveAction(
    'lifecycle.external-change',
    'External document change',
    'language-intelligence',
    'external-change',
    'host.external-change',
  ),
  interactiveAction('editing.replace', 'Search and replace', 'language-intelligence', 'replace', 'replace.result'),
  interactiveAction(
    'lsp.cancellation-and-recovery',
    'Cancellation and recovery',
    'language-intelligence',
    'cancel-recover',
    'host.recovery',
  ),
  interactiveAction('theme.hybrid', 'Independent editor themes', 'themes-and-fallbacks', 'theme', 'theme.palette'),
  interactive('terminal.hostile-text', 'Hostile terminal text sanitization', 'safe-terminal-text'),
  interactive('document.full-tier', 'Full document tier', 'full-document-tier'),
  interactive('document.large-tier', 'Large degradable document tier', 'large-document-tier'),
  interactiveAction(
    'terminal.unicode',
    'Unicode source handling',
    'themes-and-fallbacks',
    'unicode',
    'document.unicode',
  ),
  automatedOnly(
    'terminal.ascii',
    'ASCII glyph fallback',
    'The active terminal profile is host-owned; deterministic profile-matrix tests verify the ASCII presentation.',
  ),
  automatedOnly(
    'terminal.monochrome',
    'Monochrome non-color cues',
    'The active terminal profile is host-owned; deterministic profile-matrix tests verify non-color cues.',
  ),
  automatedOnly(
    'document.confirmation-tier',
    'Confirmation-required document tier',
    'The live fixture stays compact to avoid allocating a ten-MiB payload; classification is exercised by automated tests.',
  ),
  automatedOnly(
    'lsp.external-process',
    'External language-server process transport',
    'The deterministic showcase cannot start or trust an external process; package integration tests cover the transport.',
  ),
  unsupported(
    'window.minimize',
    'Taskbar-style window minimization',
    'The JSVision window manager supports maximize and restore but has no minimized-window state.',
  ),
  unsupported(
    'folding.multi-chord-keymap',
    'Multi-chord folding shortcuts',
    'The terminal keymap cannot represent the complete desktop-editor chord set reliably.',
  ),
  unsupported('navigation.page', 'Page navigation', 'Page navigation remains outside the approved editor scope.'),
  unsupported(
    'editing.word-deletion',
    'Word deletion shortcuts',
    'Word deletion shortcuts remain outside the approved editor scope.',
  ),
  unsupported('navigation.go-to-line', 'Go to line', 'Go-to-line remains outside the approved editor scope.'),
  unsupported(
    'indentation.structural-auto',
    'Automatic structural indentation',
    'Parser-driven structural indentation remains outside the approved editor scope.',
  ),
  unsupported('layout.word-wrap', 'Word wrap', 'Word wrapping remains outside the approved editor scope.'),
  unsupported('editing.multicaret', 'Multiple carets', 'Multiple carets remain outside the approved editor scope.'),
  unsupported('lsp.rename', 'Language-service rename', 'Rename remains outside the approved editor scope.'),
  unsupported(
    'lsp.code-actions',
    'Language-service code actions',
    'Code actions remain outside the approved editor scope.',
  ),
  unsupported(
    'lsp.semantic-tokens',
    'Language-service semantic tokens',
    'Semantic tokens remain outside the approved editor scope.',
  ),
  unsupported(
    'lsp.workspace-symbols',
    'Workspace symbols',
    'Workspace-wide symbols would cross the single-document editor boundary.',
  ),
  unsupported('lsp.mouse-hover', 'Mouse hover assistance', 'Mouse-triggered hover remains outside the approved scope.'),
  unsupported('lsp.bundled-server', 'Bundled language server', 'The package deliberately bundles no language server.'),
]);

function interactive(id: string, title: string, ...scenarioIds: string[]): CodeEditorCapabilityInventoryEntry {
  const scenarioId = scenarioIds[0] ?? '';
  return Object.freeze({
    id,
    title,
    status: 'interactive',
    scenarioIds: Object.freeze(scenarioIds),
    evidence: Object.freeze({ scenarioId, interaction: 'scenario-selection', observable: `scenario:${scenarioId}` }),
  });
}

function interactiveAction(
  id: string,
  title: string,
  scenarioId: string,
  action: CodeEditorDemoAction,
  observable: string,
): CodeEditorCapabilityInventoryEntry {
  return Object.freeze({
    id,
    title,
    status: 'interactive',
    scenarioIds: Object.freeze([scenarioId]),
    evidence: Object.freeze({ scenarioId, interaction: 'action', action, observable }),
  });
}

function interactiveNative(id: string, title: string, scenarioId: string): CodeEditorCapabilityInventoryEntry {
  return Object.freeze({
    id,
    title,
    status: 'interactive',
    scenarioIds: Object.freeze([scenarioId]),
    evidence: Object.freeze({ scenarioId, interaction: 'native-window', observable: 'window.geometry' }),
  });
}

function automatedOnly(id: string, title: string, reason: string): CodeEditorCapabilityInventoryEntry {
  return Object.freeze({ id, title, status: 'automated-only', scenarioIds: Object.freeze([]), reason });
}

function unsupported(id: string, title: string, reason: string): CodeEditorCapabilityInventoryEntry {
  return Object.freeze({ id, title, status: 'unsupported', scenarioIds: Object.freeze([]), reason });
}
