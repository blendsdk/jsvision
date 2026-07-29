/** Hostile protocol-presentation sanitization laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Safe Terminal Text',
  blurb: 'Remove C0/C1 controls before hostile protocol text reaches terminal presentation.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'safe-terminal-text',
      title: 'Safe Terminal Text',
      objective: 'Treat diagnostic and host text as inert data at the terminal boundary.',
    }),
});
