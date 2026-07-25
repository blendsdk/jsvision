import { defineCatalog } from '@jsvision/i18n';
import type { AcceleratorManifest } from '@jsvision/i18n';

/**
 * Accelerator scopes owned by `@jsvision/forms`.
 *
 * Applications can reuse this manifest when strictly validating framework-label overrides.
 */
export const FORMS_ACCELERATOR_MANIFEST: AcceleratorManifest = Object.freeze({
  scopes: Object.freeze([
    Object.freeze({
      name: 'forms.form-dialog.actions',
      keys: Object.freeze(['forms.action.ok', 'forms.action.cancel']),
    }),
  ]),
});

/** Canonical English messages owned by `@jsvision/forms`. */
export const FORMS_ENGLISH_CATALOG = defineCatalog(
  {
    schema: 1,
    locale: 'en',
    messages: {
      'forms.action.ok': '~O~K',
      'forms.action.cancel': '~C~ancel',
    },
  },
  { acceleratorManifest: FORMS_ACCELERATOR_MANIFEST },
);
