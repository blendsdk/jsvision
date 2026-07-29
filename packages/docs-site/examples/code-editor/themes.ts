/** Live Code Editor preset theme laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Editor Themes',
  blurb: 'Switch the editor palette while the application remains on the Classic shell.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'themes',
      title: 'Editor Themes',
      objective: 'Compare editor palettes without overriding the template1 dialog surface.',
    }),
});
