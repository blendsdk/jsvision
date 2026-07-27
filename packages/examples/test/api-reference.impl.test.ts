import { expect, test } from 'vitest';

import { generateApiDocs } from '../../../scripts/gen-plugin-api.mjs';

test('generated interface signatures preserve optional methods', () => {
  const webReference = generateApiDocs().files['web.md'];

  expect(webReference).toContain('attachCustomKeyEventHandler?(');
  expect(webReference).toContain('focus?(): void');
  expect(webReference).toContain('dispose?(): void');
});
