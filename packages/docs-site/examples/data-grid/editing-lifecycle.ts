/** Enter, commit, cancel, overlay, and focus lifecycle laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Editing Lifecycle',
  blurb: 'Begin, commit, and cancel typed cell edits through the real overlay.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'editing-lifecycle',
      title: 'Editing Lifecycle',
      objective: 'Enter opens an editor; commit or cancel restores grid focus.',
    }),
});
