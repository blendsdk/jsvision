/** Theme-role, contrast, focus, and keyboard-discoverability laboratory. */
import { defineExample } from '../_contract.js';
import { buildDataGridLab } from '#data-grid-lab';

export default defineExample({
  title: 'Theming and Accessibility',
  blurb: 'Audit selected, focused, and error cues plus keyboard guidance.',
  build: (ctx) =>
    buildDataGridLab(ctx, {
      scenario: 'theming-accessibility',
      title: 'Theming and Accessibility',
      objective: 'Theme roles keep focus, text cues, and keyboard input clear.',
    }),
});
