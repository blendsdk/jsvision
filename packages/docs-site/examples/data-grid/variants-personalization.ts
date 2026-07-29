/** Saved variant and reversible personalization semantics laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Variants and Personalization',
  blurb: 'Save and apply user-owned column layout snapshots.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'variants-personalization',
      title: 'Variants and Personalization',
      objective: 'Variants persist layout; Cancel and OK control a staged draft.',
    }),
});
