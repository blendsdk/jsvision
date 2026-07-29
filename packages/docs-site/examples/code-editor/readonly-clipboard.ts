/** Read-only navigation and safe-copy laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Read-only Clipboard',
  blurb: 'Select and copy from a locked document without changing its revision.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'readonly-clipboard',
      title: 'Read-only Clipboard',
      objective: 'Keep navigation and copy useful while source mutation stays blocked.',
    }),
});
