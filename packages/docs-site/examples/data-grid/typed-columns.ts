/** Typed-value, formatting, parsing, and null-policy laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Typed Columns',
  blurb: 'Keep typed values distinct from formatting, parsing, and null presentation.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'typed-columns',
      title: 'Typed Columns',
      objective: 'Typed values keep format, parse, and null policies separate.',
    }),
});
