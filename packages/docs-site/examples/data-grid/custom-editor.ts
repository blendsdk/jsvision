/** Public custom-editor factory and cleanup laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Custom Editor',
  blurb: 'Mount a custom editor through the public cell-editor seam.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'custom-editor',
      title: 'Custom Editor',
      objective: 'A custom editor shares Enter, Escape, focus, and cleanup behavior.',
    }),
});
