/** Aggregate footer scope and partial-data honesty laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Aggregates',
  blurb: 'Inspect sticky typed totals and explicit aggregation scope.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'aggregates',
      title: 'Aggregates',
      objective: 'Totals disclose visible, selected, loaded, or complete scope.',
    }),
});
