/** Invalid custom-theme fallback laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Theme Fallback',
  blurb: 'Reject an invalid override and retain a complete Classic-compatible palette.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'theme-fallback',
      title: 'Theme Fallback',
      objective: 'Make theme rejection and fallback visible and deterministic.',
    }),
});
