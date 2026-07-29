/** Procedural 100,000-row bounded-window source laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Windowed 100k Source',
  blurb: 'Start maximized and read bounded slices from 100,000 procedural rows without a full array.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'windowed',
      title: 'Windowed 100k Source',
      objective: 'A 100k source serves and reports only bounded windows.',
    }),
});
