/**
 * Implementation coverage for optional Datagrid accelerator-label recovery.
 */
import { expect, test } from 'vitest';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { datagridAcceleratorLabel } from '../src/i18n/label.js';

test('should accept an unmarked action and reject malformed optional accelerator markup', () => {
  const service = createI18n({
    locale: 'en',
    catalogs: [
      defineCatalog({
        schema: 1,
        locale: 'en',
        messages: {
          'datagrid.filter.action.apply': 'Apply',
          'datagrid.filter.action.clear': '~Ö~ffnen',
        },
      }),
    ],
  });

  expect(datagridAcceleratorLabel(service, 'datagrid.filter.action.apply', 'Apply', false)).toBe('Apply');
  expect(datagridAcceleratorLabel(service, 'datagrid.filter.action.clear', 'Clear', false)).toBe('Clear');
});
