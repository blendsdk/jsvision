/** Bounded and terminal-safe diagnostics laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'LSP Diagnostics',
  blurb: 'Publish a hostile diagnostic through bounded terminal-safe projection.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'lsp-diagnostics',
      title: 'LSP Diagnostics',
      objective: 'Validate ranges, severity, count, and terminal presentation.',
    }),
});
