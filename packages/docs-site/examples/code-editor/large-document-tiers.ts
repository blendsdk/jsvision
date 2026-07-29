/** Bounded large-document classification laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Large Document Tiers',
  blurb: 'Classify a bounded synthetic fixture and display its honest degradation state.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'large-document-tiers',
      title: 'Large Document Tiers',
      objective: 'Compare full and large tiers without allocating pathological source.',
    }),
});
