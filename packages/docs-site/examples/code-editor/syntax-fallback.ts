/** Invalid-source syntax fallback laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Syntax Fallback',
  blurb: 'Preserve incomplete source while falling back to safe plain presentation.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'syntax-fallback',
      title: 'Syntax Fallback',
      objective: 'Make parser failure visible without discarding source text.',
    }),
});
