import type { AcceleratorManifest } from '@jsvision/i18n';

/**
 * Co-visible accelerator groups for the built-in UI catalog.
 *
 * Each scope contains every accelerator-bearing control reachable in one composed dialog.
 */
export const UI_ACCELERATOR_MANIFEST: AcceleratorManifest = Object.freeze({
  scopes: Object.freeze([
    Object.freeze({
      name: 'dialog-ok-cancel',
      keys: Object.freeze(['ui.action.ok', 'ui.action.cancel']),
    }),
    Object.freeze({
      name: 'dialog-yes-no',
      keys: Object.freeze(['ui.action.yes', 'ui.action.no']),
    }),
    Object.freeze({
      name: 'dialog-yes-no-cancel',
      keys: Object.freeze(['ui.action.yes', 'ui.action.no', 'ui.action.cancel']),
    }),
    Object.freeze({
      name: 'editor-find-dialog',
      keys: Object.freeze([
        'ui.editor.find.label',
        'ui.editor.case-sensitive',
        'ui.editor.whole-words',
        'ui.action.ok',
        'ui.action.cancel',
      ]),
    }),
    Object.freeze({
      name: 'editor-replace-dialog',
      keys: Object.freeze([
        'ui.editor.find.label',
        'ui.editor.replace.label',
        'ui.editor.case-sensitive',
        'ui.editor.whole-words',
        'ui.editor.prompt-on-replace',
        'ui.editor.replace-all',
        'ui.action.ok',
        'ui.action.cancel',
      ]),
    }),
  ]),
});
