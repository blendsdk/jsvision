/** Query navigation laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Search',
  blurb: 'Find repeated text and move the real document selection without mutation.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'search',
      title: 'Search',
      objective: 'Navigate bounded matches against the current document snapshot.',
    }),
});
