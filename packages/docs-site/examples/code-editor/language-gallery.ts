/** Built-in language adapter selection laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Language Gallery',
  blurb: 'Cycle all four built-in language IDs with the active adapter visible.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'language-gallery',
      title: 'Language Gallery',
      objective: 'Select plain, JavaScript, TypeScript, or PostgreSQL deliberately.',
    }),
});
