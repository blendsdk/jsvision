/** Bounded and terminal-safe diagnostics laboratory. */
import { defineExample } from '../_contract.js';
import { buildFlagshipCodeEditorLab } from '#code-editor-flagship';

export default defineExample({
  title: 'LSP Diagnostics',
  blurb: 'Reveal a clear TypeScript mistake through editor markers and a readable diagnostic panel.',
  build: (ctx) =>
    buildFlagshipCodeEditorLab(ctx, {
      scenario: 'lsp-diagnostics',
      title: 'Understand TypeScript Diagnostics',
      instruction: 'Find the suspicious property in describeInvoice(), then reveal diagnostics with Alt+R.',
    }),
});
