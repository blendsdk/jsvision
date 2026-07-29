/** Cell, row, and before-save validation laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Validation Gates',
  blurb: 'Distinguish cell validation from row and save acceptance.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'validation',
      title: 'Validation Gates',
      objective: 'Cell, row, and save gates report distinct results.',
    }),
});
