/** Replacement and revision laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Replace',
  blurb: 'Replace one match as a document transaction and inspect its revision.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'replace',
      title: 'Replace',
      objective: 'Make replacement count and revision movement observable.',
    }),
});
