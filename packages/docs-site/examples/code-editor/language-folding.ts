/** Language-provided fold-range laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Language Folding',
  blurb: 'Collapse a revision-matched language range while preserving source text.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'language-folding',
      title: 'Language Folding',
      objective: 'Consume parser-informed folds through public controller commands.',
    }),
});
