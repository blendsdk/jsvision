/**
 * Implementation coverage for the accelerator rules used by package locale manifests.
 */
import { describe, expect, test } from 'vitest';
import { validateCatalog } from '../src/validation.js';

describe('package accelerator manifest validation', () => {
  test('should accept escaped tildes and an optional label without an accelerator', () => {
    const issues = validateCatalog(
      {
        schema: 1,
        locale: 'en',
        messages: {
          'app.required': '~O~pen ~~ recent',
          'app.optional': 'Details',
        },
      },
      {
        official: true,
        acceleratorManifest: {
          scopes: [
            {
              name: 'dialog.actions',
              keys: ['app.required', 'app.optional'],
              requiredKeys: ['app.required'],
            },
          ],
        },
      },
    );

    expect(issues).toEqual([]);
  });

  test('should reject malformed markup even when the label accelerator is optional', () => {
    const issues = validateCatalog(
      {
        schema: 1,
        locale: 'en',
        messages: {
          'app.required': '~O~pen',
          'app.optional': '~Ö~ptions',
        },
      },
      {
        official: true,
        acceleratorManifest: {
          scopes: [
            {
              name: 'dialog.actions',
              keys: ['app.required', 'app.optional'],
              requiredKeys: ['app.required'],
            },
          ],
        },
      },
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_MESSAGE',
        severity: 'error',
        key: 'app.optional',
        path: ['messages', 'app.optional', 'accelerator'],
      }),
    );
  });
});
