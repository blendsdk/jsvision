/** Cell, row, and before-save validation laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Validation and Escape Recovery',
  blurb: 'Trap an invalid cross-field row, restore it with Escape, then arm a retryable persistence veto.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'validation',
      title: 'Validation & Recovery',
      objective: 'Commit Start ≥ End, test row-leave, then use Escape to restore the session baseline.',
    }),
});
