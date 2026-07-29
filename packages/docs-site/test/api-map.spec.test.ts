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

test('accepts code-editor and fragment-aware component targets from the shared package list', () => {
  expect(
    validateApiMap([
      {
        symbol: 'CodeEditor',
        pkg: 'code-editor',
        apiPath: '/api/code-editor/classes/CodeEditor',
        componentPage: '/components/code-editor/#quick-start',
      },
      {
        symbol: 'DataGrid',
        pkg: 'ui',
        apiPath: '/api/ui/classes/DataGrid',
        componentPage: '/components/data-grid/',
      },
    ]),
  ).toEqual([]);
});

test('reports malformed component routes and permits equal symbol names in different packages', () => {
  const violations = validateApiMap([
    {
      symbol: 'SharedName',
      pkg: 'ui',
      apiPath: '/api/ui/classes/SharedName',
      componentPage: '/components/controls/button#Bad Fragment',
    },
    {
      symbol: 'SharedName',
      pkg: 'files',
      apiPath: '/api/files/classes/SharedName',
      componentPage: '/components/files/file-dialog',
    },
  ]);

  expect(violations).toHaveLength(1);
  expect(violations[0]).toContain('invalid componentPage');
});

test('rejects traversal and non-canonical API paths before they reach file generation', () => {
  const violations = validateApiMap([
    {
      symbol: 'Button',
      pkg: 'ui',
      apiPath: '/api/ui/../../../README',
      componentPage: '/components/controls/button',
    },
    {
      symbol: 'Input',
      pkg: 'ui',
      apiPath: '/api/ui/classes/%2e%2e/Input',
      componentPage: '/components/controls/input',
    },
  ]);

  expect(violations).toHaveLength(2);
  expect(violations.every((violation) => violation.includes('apiPath not under'))).toBe(true);
});
