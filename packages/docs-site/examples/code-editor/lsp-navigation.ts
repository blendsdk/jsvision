/** Symbols, definition, and formatting availability laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'LSP Navigation',
  blurb: 'Validate a definition response and reveal its same-document target without filesystem authority.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'lsp-navigation',
      title: 'LSP Navigation',
      objective: 'Reveal definitions without implying ungranted filesystem authority.',
    }),
});
