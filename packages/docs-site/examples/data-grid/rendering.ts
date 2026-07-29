/** Alignment, formatter, conditional-style, and custom-renderer laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Cell Rendering',
  blurb: 'Compare typed formatting, alignment, conditional roles, and a clipped renderer.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'rendering',
      title: 'Cell Rendering',
      objective: 'Change presentation while preserving typed cell values.',
    }),
});
