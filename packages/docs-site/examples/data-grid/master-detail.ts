/** Stable-key master and detail binding laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Master and Detail',
  blurb: 'Move through the top customer grid and watch the lower work-item grid follow.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'master-detail',
      title: 'Master and Detail',
      objective: 'The lower grid follows the focused master key, never a visual row index.',
    }),
});
