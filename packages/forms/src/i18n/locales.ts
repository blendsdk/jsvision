import { defineCatalog } from '@jsvision/i18n';
import type { Catalog, Message } from '@jsvision/i18n';
import { FORMS_ACCELERATOR_MANIFEST, FORMS_ENGLISH_CATALOG } from './catalog.js';

/** Build one complete Forms catalog from reviewed overrides and canonical English keys. */
function formsCatalog(locale: string, messages: Readonly<Record<string, Message>>): Catalog {
  return defineCatalog(
    {
      schema: 1,
      locale,
      messages: { ...FORMS_ENGLISH_CATALOG.messages, ...messages },
    },
    { acceleratorManifest: FORMS_ACCELERATOR_MANIFEST },
  );
}

/** Official English Forms catalog. */
export const formsEn = formsCatalog('en', {});
/** Official Dutch Forms catalog. */
export const formsNl = formsCatalog('nl', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': '~A~nnuleren',
});
/** Official German Forms catalog. */
export const formsDe = formsCatalog('de', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': '~A~bbrechen',
});
/** Official French Forms catalog. */
export const formsFr = formsCatalog('fr', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': '~A~nnuler',
});
/** Official Spanish Forms catalog. */
export const formsEs = formsCatalog('es', {
  'forms.action.ok': '~A~ceptar',
  'forms.action.cancel': '~C~ancelar',
});
/** Official Italian Forms catalog. */
export const formsIt = formsCatalog('it', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': 'A~n~nulla',
});
/** Official European Portuguese Forms catalog. */
export const formsPtPT = formsCatalog('pt-PT', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': '~C~ancelar',
});
/** Official Polish Forms catalog. */
export const formsPl = formsCatalog('pl', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': '~A~nuluj',
});
/** Official Romanian Forms catalog. */
export const formsRo = formsCatalog('ro', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': '~A~nulează',
});
/** Official Swedish Forms catalog. */
export const formsSv = formsCatalog('sv', {
  'forms.action.ok': '~O~K',
  'forms.action.cancel': '~A~vbryt',
});
