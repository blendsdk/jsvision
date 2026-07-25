import type { AcceleratorManifest } from '@jsvision/i18n';

/**
 * Co-visible accelerator groups for the built-in UI catalog.
 *
 * Nested controls have their own accelerator scopes at runtime, so option labels and dialog action
 * buttons are validated independently instead of reporting false collisions.
 */
export const UI_ACCELERATOR_MANIFEST: AcceleratorManifest = {
  scopes: [
    { name: 'dialog-ok-cancel', keys: ['ui.action.ok', 'ui.action.cancel'] },
    { name: 'dialog-yes-no', keys: ['ui.action.yes', 'ui.action.no'] },
    { name: 'dialog-yes-no-cancel', keys: ['ui.action.yes', 'ui.action.no', 'ui.action.cancel'] },
    {
      name: 'editor-find-options',
      keys: ['ui.editor.case-sensitive', 'ui.editor.whole-words'],
    },
    {
      name: 'editor-replace-options',
      keys: [
        'ui.editor.case-sensitive',
        'ui.editor.whole-words',
        'ui.editor.prompt-on-replace',
        'ui.editor.replace-all',
      ],
    },
  ],
};
