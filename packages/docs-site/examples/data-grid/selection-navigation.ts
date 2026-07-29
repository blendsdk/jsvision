/** Cursor, checkbox, multi-selection, and keyboard-navigation laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Selection and Navigation',
  blurb: 'Keep cursor, stable-key selection, gutter, and Tab traversal distinct.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'selection-navigation',
      title: 'Selection and Navigation',
      objective: 'Cursor and selection stay separate and use stable row keys.',
    }),
});
