/** Host-effect authorization and service-recovery laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Host Recovery',
  blurb: 'Recover failed work only after an explicit, content-free host authorization.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'host-recovery',
      title: 'Host Recovery',
      objective: 'Dispose failed work before an authorized deterministic recovery.',
    }),
});
