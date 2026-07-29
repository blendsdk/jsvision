/** Editing, selection, and navigation laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Editing and Navigation',
  blurb: 'Drive a real edit and selection while revision and caret feedback remain visible.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'editing-navigation',
      title: 'Editing and Navigation',
      objective: 'Exercise editing, selection, and navigation through one controller.',
    }),
});
