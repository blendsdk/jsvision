/** Loading, ready, empty, filtered-empty, and error lifecycle laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Lifecycle States',
  blurb: 'Present source lifecycle states without replacing the host grid.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'lifecycle-states',
      title: 'Lifecycle States',
      objective: 'Loading, ready, empty, filtered-empty, and error stay distinct.',
    }),
});
