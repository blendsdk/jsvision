/** Flagship comparison of the read-only and editable public grid surfaces. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Choose a Grid',
  blurb: 'Compare DataGrid and EditableDataGrid in one focused Classic-theme laboratory.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'quick-start',
      title: 'Choose a Grid',
      objective: 'Choose read-only display or typed grid interaction.',
    }),
});
