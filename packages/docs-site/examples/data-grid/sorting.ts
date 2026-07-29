/** Single, multi-key, and typed-value sorting laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Sorting',
  blurb: 'Inspect typed ordering and explicit multi-sort priorities.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'sorting',
      title: 'Sorting',
      objective: 'Sort typed values and keep row order, direction, and priority visible.',
    }),
});
