/**
 * Implementation test — barrel surface lock for @jsvision/forms.
 *
 * The package's public surface is exactly five runtime values: `createForm`, `bindField`,
 * `bindRadio`, `bindCheck`, and `FormFieldError`. This test fails the instant an internal helper is
 * accidentally re-exported (or a public one is dropped) — the regression guard for "importing
 * anything not in the list fails". The type-only exports (`Form`, `Field`, `CreateFormOptions`) are
 * compile-time and carry no runtime key, so they are intentionally absent here; the type surface is
 * held by `typecheck`, not this assertion.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import * as forms from '../src/index.js';

test('the barrel exports exactly the specified runtime surface', () => {
  expect(Object.keys(forms).sort()).toEqual(
    ['FormFieldError', 'bindCheck', 'bindField', 'bindRadio', 'createForm'].sort(),
  );
});
