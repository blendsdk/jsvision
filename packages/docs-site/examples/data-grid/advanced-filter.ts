/** Condition and value-list filtering laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Advanced Filters',
  blurb: 'Compare typed conditions and distinct-value selection.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'advanced-filter',
      title: 'Advanced Filters',
      objective: 'Conditions and value lists disclose criteria and matching counts.',
    }),
});
