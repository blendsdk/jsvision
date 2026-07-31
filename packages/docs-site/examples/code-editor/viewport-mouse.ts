/** Responsive viewport and pointer-projection laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Viewport and Mouse',
  blurb: 'Resize or maximize the lab and inspect bounded line-number selection geometry.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'viewport-mouse',
      title: 'Viewport and Mouse',
      objective: 'Keep caret, gutter, scroll, and pointer projection aligned after resize.',
    }),
});
