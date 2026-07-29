/** Symbols, definition, and formatting availability laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'LSP Navigation',
  blurb: 'Expose deterministic navigation and capability availability as host-owned effects.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'lsp-navigation',
      title: 'LSP Navigation',
      objective: 'Reveal definitions without implying ungranted filesystem authority.',
    }),
});
