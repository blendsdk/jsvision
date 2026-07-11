/**
 * Specification test (immutable oracle) — the symbol↔page map validator.
 *
 * validateApiMap() keeps API_MAP honest so a malformed row can never ship a dead
 * cross-link: it reports a violation for a duplicate `symbol`, an `apiPath` not
 * under `/api/<pkg>/`, or a `componentPage` not under `/components/`. A well-formed
 * map returns an empty list.
 */
import { test, expect } from 'vitest';
import { validateApiMap } from '../src/api/validate-api-map.mjs';

test('reports duplicate symbols and an apiPath outside /api/<pkg>/', () => {
  const violations = validateApiMap([
    { symbol: 'Button', pkg: 'ui', apiPath: '/api/ui/classes/Button', componentPage: '/components/controls/button' },
    { symbol: 'Button', pkg: 'ui', apiPath: '/api/ui/classes/Button', componentPage: '/components/controls/button' },
    { symbol: 'Input', pkg: 'ui', apiPath: '/nope/ui/classes/Input', componentPage: '/components/controls/input' },
  ]);

  expect(violations.length).toBeGreaterThan(0);
  const joined = violations.join('\n');
  expect(joined).toContain('Button'); // the duplicate symbol
  expect(joined).toContain('/nope/ui/classes/Input'); // the out-of-tree apiPath
});

test('a well-formed map returns no violations', () => {
  const violations = validateApiMap([
    { symbol: 'Button', pkg: 'ui', apiPath: '/api/ui/classes/Button', componentPage: '/components/controls/button' },
    {
      symbol: 'ScreenBuffer',
      pkg: 'core',
      apiPath: '/api/core/classes/ScreenBuffer',
      componentPage: '/components/terminal/terminal',
    },
  ]);
  expect(violations).toEqual([]);
});
