/** Reactive source-mode laboratory with visible row-count changes. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Data Sources',
  blurb: 'Compare deterministic in-memory and reactive source ownership.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'data-sources',
      title: 'Data Sources',
      objective: 'Source modes expose counts, updates, and stable row keys.',
    }),
});
