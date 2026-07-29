/** Dirty marker, veto, and successful commit laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Dirty and Commit',
  blurb: 'Observe accepted and vetoed commits without losing the proposed value.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'dirty-commit',
      title: 'Dirty and Commit',
      objective: 'Dirty state and persistence outcome remain visible and recoverable.',
    }),
});
