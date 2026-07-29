/** Bounded in-process completion laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'LSP Completion',
  blurb: 'Issue a deterministic in-process request and inspect bounded completion items.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'lsp-completion',
      title: 'LSP Completion',
      objective: 'Bound completion content, request lifecycle, and presentation.',
    }),
});
