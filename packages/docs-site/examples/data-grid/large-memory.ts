/** Bounded large in-memory tier laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Large In-Memory Tier',
  blurb: 'Compare deliberate 1,000- and 10,000-row in-memory collections.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'large-memory',
      title: 'Large In-Memory Tier',
      objective: 'In-memory data stays simple when it has an explicit upper bound.',
    }),
});
