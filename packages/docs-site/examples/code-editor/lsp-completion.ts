/** Bounded in-process completion laboratory. */
import { defineExample } from '../_contract.js';
import { buildFlagshipCodeEditorLab } from '#code-editor-flagship';

export default defineExample({
  title: 'LSP Completion',
  blurb: 'Request smart suggestions in a substantial highlighted TypeScript profile formatter.',
  build: (ctx) =>
    buildFlagshipCodeEditorLab(ctx, {
      scenario: 'lsp-completion',
      title: 'Smart TypeScript Completion',
      instruction: 'Inspect profile. in formatProfile(), then request suggestions with Alt+R.',
    }),
});
