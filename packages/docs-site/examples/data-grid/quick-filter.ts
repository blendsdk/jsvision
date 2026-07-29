/** Live per-column quick-filter laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Quick Filters',
  blurb: 'Type or apply a per-column query and inspect live N-of-M results.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'quick-filter',
      title: 'Quick Filters',
      objective: 'Per-column text filters update the visible records immediately.',
    }),
});
