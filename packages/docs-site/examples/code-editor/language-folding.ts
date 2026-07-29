/** Language-provided fold-range laboratory. */
import { defineExample } from '../_contract.js';
import { buildFlagshipCodeEditorLab } from '#code-editor-flagship';

export default defineExample({
  title: 'Language Folding',
  blurb: 'Collapse real parser-provided regions in a highlighted TypeScript release summary.',
  build: (ctx) =>
    buildFlagshipCodeEditorLab(ctx, {
      scenario: 'language-folding',
      title: 'Explore TypeScript Code Folding',
      instruction: 'Scan the release formatter, then collapse its parser-provided regions with Alt+R.',
    }),
});
