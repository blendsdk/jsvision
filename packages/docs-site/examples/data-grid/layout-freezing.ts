/** Column resize, order, visibility, and freeze laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Layout and Freezing',
  blurb: 'Resize, reorder, freeze, show, and hide real grid columns.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'layout-freezing',
      title: 'Layout and Freezing',
      objective: 'Change real column geometry, order, visibility, and freeze state.',
    }),
});
