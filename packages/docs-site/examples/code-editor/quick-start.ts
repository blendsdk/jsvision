/** Flagship comparison of direct and windowed Code Editor composition. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Code Editor Quick Start',
  blurb: 'Compare the embeddable editor with complete window chrome in a responsive Classic lab.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'quick-start',
      title: 'Code Editor Quick Start',
      objective: 'Choose direct composition or conventional CodeEditorWindow chrome.',
    }),
});
