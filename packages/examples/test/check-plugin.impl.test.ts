import { expect, test } from 'vitest';

import { checkBarrelCoverage } from '../../../scripts/check-plugin.mjs';

test('should accept an explicitly documented class from another public package', () => {
  const catalog = '- **Button** — a button.\n- **I18nError** — a translation error.\n';

  expect(checkBarrelCoverage(['Button'], catalog, [], ['I18nError'])).toEqual([]);
});

test('should reject a catalog class that no public package exports', () => {
  const catalog = '- **Button** — a button.\n- **RemovedThing** — gone.\n';

  expect(checkBarrelCoverage(['Button'], catalog, [], ['I18nError'])).toEqual([
    'component-catalog.md: names "RemovedThing", which is not a public JSVision class export',
  ]);
});
