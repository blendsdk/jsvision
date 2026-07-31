/** External-change and save-outcome decision laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'External Changes',
  blurb: 'Accept a bounded external revision and keep the save outcome visibly host-owned.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'external-changes',
      title: 'External Changes',
      objective: 'Resolve an external mutation explicitly and report its save outcome.',
    }),
});
