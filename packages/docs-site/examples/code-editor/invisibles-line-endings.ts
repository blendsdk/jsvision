/** Invisible-character and line-ending presentation laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Invisibles and Endings',
  blurb: 'Inspect tabs, trailing spaces, and CRLF metadata through safe visible markers.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'invisibles-line-endings',
      title: 'Invisibles and Endings',
      objective: 'Present invisible characters and line endings without changing source.',
    }),
});
