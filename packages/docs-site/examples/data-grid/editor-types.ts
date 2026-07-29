/** Built-in text, enum, decimal, and boolean editor laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Editor Types',
  blurb: 'Compare built-in editors while the column model remains typed.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'editor-types',
      title: 'Editor Types',
      objective: 'Each domain type selects a deliberate built-in editor and parser.',
    }),
});
