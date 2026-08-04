import { createI18n, defineCatalog } from '@jsvision/i18n';
import type { AcceleratorManifest, I18n } from '@jsvision/i18n';

/**
 * Co-visible action groups owned by `@jsvision/datagrid`.
 *
 * Datagrid's historical English labels do not define accelerators, but the scopes remain public so
 * applications can validate accelerator-bearing translations and overrides consistently.
 */
export const DATAGRID_ACCELERATOR_MANIFEST: AcceleratorManifest = Object.freeze({
  scopes: Object.freeze([
    Object.freeze({
      name: 'datagrid.filter.actions',
      keys: Object.freeze(['datagrid.filter.action.apply', 'datagrid.filter.action.clear']),
      requiredKeys: Object.freeze([]),
    }),
    Object.freeze({
      name: 'datagrid.filter.value-list.actions',
      keys: Object.freeze(['datagrid.filter.action.select-all', 'datagrid.filter.action.apply']),
      requiredKeys: Object.freeze([]),
    }),
    Object.freeze({
      name: 'datagrid.personalize.variant-actions',
      keys: Object.freeze([
        'datagrid.personalize.action.save',
        'datagrid.personalize.action.apply',
        'datagrid.personalize.action.delete',
        'datagrid.personalize.action.default',
        'datagrid.personalize.action.reset',
      ]),
      requiredKeys: Object.freeze([]),
    }),
  ]),
});

/** Canonical English messages owned by `@jsvision/datagrid`. */
export const DATAGRID_ENGLISH_CATALOG = defineCatalog(
  {
    schema: 1,
    locale: 'en',
    messages: {
      'datagrid.boolean.yes': 'Yes',
      'datagrid.boolean.no': 'No',
      'datagrid.empty': 'No rows',
      'datagrid.empty.filtered': 'No matching rows',
      'datagrid.lifecycle.loading': 'Loading…',
      'datagrid.lifecycle.retry': 'Retry',
      'datagrid.validation.row-trapped': '${message} · Esc reverts row changes',
      'datagrid.revert.pending': 'Reverting row…',
      'datagrid.revert.failed': 'Could not revert row changes',
      'datagrid.revert.unavailable': 'Row changes cannot be reverted',
      'datagrid.filter.operator.contains': 'contains',
      'datagrid.filter.operator.starts-with': 'starts with',
      'datagrid.filter.operator.ends-with': 'ends with',
      'datagrid.filter.operator.equals': 'equals',
      'datagrid.filter.operator.greater-than': 'greater than',
      'datagrid.filter.operator.less-than': 'less than',
      'datagrid.filter.operator.between': 'between',
      'datagrid.filter.operator.before': 'before',
      'datagrid.filter.operator.after': 'after',
      'datagrid.filter.operator.on': 'on',
      'datagrid.filter.field.from': 'From',
      'datagrid.filter.field.value': 'Value',
      'datagrid.filter.field.to': 'To',
      'datagrid.filter.field.search': 'Search',
      'datagrid.filter.action.apply': 'Apply',
      'datagrid.filter.action.clear': 'Clear',
      'datagrid.filter.action.select-all': 'Select All',
      'datagrid.filter.status.loading': 'loading…',
      'datagrid.filter.status.error': 'could not load values',
      'datagrid.filter.status.truncated': 'list truncated — refine search',
      'datagrid.personalize.title': 'Personalize columns',
      'datagrid.personalize.visible-count': '${visible} of ${total} columns visible',
      'datagrid.personalize.action.save': 'Save',
      'datagrid.personalize.action.apply': 'Apply',
      'datagrid.personalize.action.delete': 'Delete',
      'datagrid.personalize.action.default': 'Default',
      'datagrid.personalize.action.reset': 'Reset',
      'datagrid.personalize.header.show': 'Show',
      'datagrid.personalize.header.column': 'Column',
      'datagrid.personalize.header.freeze': 'Freeze',
      'datagrid.personalize.header.width': 'Width',
      'datagrid.personalize.saved-layouts': 'Saved layouts',
      'datagrid.personalize.save-as': 'Save as:',
      'datagrid.personalize.variant-name': 'variant name',
      'datagrid.personalize.width.auto': 'auto',
      'datagrid.personalize.freeze.none': 'None',
      'datagrid.personalize.freeze.left': 'Left',
      'datagrid.personalize.freeze.right': 'Right',
      'datagrid.personalize.confirm.overwrite': 'Overwrite "${name}"?',
      'datagrid.personalize.confirm.delete': 'Delete "${name}"?',
    },
  },
  {
    acceleratorManifest: DATAGRID_ACCELERATOR_MANIFEST,
    placeholderManifest: {
      'datagrid.personalize.visible-count': ['visible', 'total'],
      'datagrid.personalize.confirm.overwrite': ['name'],
      'datagrid.personalize.confirm.delete': ['name'],
      'datagrid.validation.row-trapped': ['message'],
    },
  },
);

/**
 * Creates an isolated English service containing the Datagrid catalog.
 *
 * @returns A locale-bound service containing only the canonical Datagrid English catalog.
 */
export function createEnglishDatagridI18n(): I18n {
  return createI18n({ locale: 'en', catalogs: [DATAGRID_ENGLISH_CATALOG] });
}
