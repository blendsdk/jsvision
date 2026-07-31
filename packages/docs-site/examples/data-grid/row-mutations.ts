/** Stable-key insert, duplicate, and delete laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Row Mutations',
  blurb: 'Insert, duplicate, and delete records without index-based identity.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'row-mutations',
      title: 'Row Mutations',
      objective: 'Every structural mutation preserves explicit record identity.',
    }),
});
