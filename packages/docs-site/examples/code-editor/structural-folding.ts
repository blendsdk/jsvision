/** Structure-derived fold-range laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Structural Folding',
  blurb: 'Collapse a deterministic structural range independently of one parser.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'structural-folding',
      title: 'Structural Folding',
      objective: 'Keep structure-derived folds explicit, bounded, and reversible.',
    }),
});
