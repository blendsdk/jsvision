/** Bounded work and honest performance-guidance laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Performance Boundaries',
  blurb: 'Inspect bounded reads and visible work without universal timing claims.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'performance-boundaries',
      title: 'Performance Boundaries',
      objective: 'Inspect bounded work; measure in your workload.',
    }),
});
