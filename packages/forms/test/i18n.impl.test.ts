/**
 * Implementation coverage for Forms accelerator-label recovery.
 */
import { expect, test } from 'vitest';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { formsAcceleratorLabel } from '../src/i18n/label.js';

test('should fall back only a malformed Forms accelerator label', () => {
  const service = createI18n({
    locale: 'en',
    catalogs: [
      defineCatalog({
        schema: 1,
        locale: 'en',
        messages: {
          'forms.action.ok': 'Accept',
          'forms.action.cancel': '~D~ecline',
        },
      }),
    ],
  });

  expect(formsAcceleratorLabel(service, 'forms.action.ok', '~O~K')).toBe('~O~K');
  expect(formsAcceleratorLabel(service, 'forms.action.cancel', '~C~ancel')).toBe('~D~ecline');
});
