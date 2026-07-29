/** Document identity, revision, selection, and controller mutation laboratory. */
import { defineExample } from '../_contract.js';
import { buildCodeEditorLab } from '#code-editor-lab';

export default defineExample({
  title: 'Document Controller',
  blurb: 'Inspect one authoritative document while a controller applies a revisioned transaction.',
  build: (ctx) =>
    buildCodeEditorLab(ctx, {
      scenario: 'document-controller',
      title: 'Document Controller',
      objective: 'Observe identity, revision, selection, and mutation through public state.',
    }),
});
