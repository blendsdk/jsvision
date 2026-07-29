/** Stable-key master and detail binding laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Master and Detail',
  blurb: 'Bind detail state to the focused master record key.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'master-detail',
      title: 'Master and Detail',
      objective: 'Detail follows stable master identity, never a visual row index.',
    }),
});
