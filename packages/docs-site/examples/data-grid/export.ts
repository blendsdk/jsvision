/** Safe public export laboratory for hostile cell text. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Safe Export',
  blurb: 'Inspect output produced by the public CSV, TSV, HTML, and JSON serializers.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'export',
      title: 'Safe Export',
      objective: 'Export safely handles formulas, delimiters, markup, and quotes.',
    }),
});
