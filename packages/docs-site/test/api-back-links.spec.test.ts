/**
 * Specification test (immutable oracle) — the reference→component back-link injector.
 *
 * After TypeDoc writes a symbol's page, injectBackLink() adds a
 * "> **Documented in:** [<page>](<componentPage>)" note pointing at the hand-written
 * component page, inserted immediately after the page's frontmatter. It must be
 * idempotent — generation reruns every build, so applying it to an already-noted
 * page must return the markdown unchanged (no doubled notes).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { injectBackLink } from '../src/api/inject-back-links.mjs';

const PAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'api', 'page.md'), 'utf8');
const LINK = {
  symbol: 'Button',
  pkg: 'ui',
  apiPath: '/api/ui/classes/Button',
  componentPage: '/components/controls/button',
};

test('inserts a Documented-in back-link after the frontmatter, before the heading', () => {
  const out = injectBackLink(PAGE, LINK);
  expect(out).toContain('> **Documented in:** [Button](/components/controls/button)');

  const frontmatterEnd = out.indexOf('---', out.indexOf('---') + 3) + 3;
  const noteIndex = out.indexOf('> **Documented in:**');
  const headingIndex = out.indexOf('# Class:');
  expect(noteIndex).toBeGreaterThan(frontmatterEnd);
  expect(noteIndex).toBeLessThan(headingIndex);
});

test('is idempotent — re-applying leaves the markdown unchanged', () => {
  const once = injectBackLink(PAGE, LINK);
  const twice = injectBackLink(once, LINK);
  expect(twice).toBe(once);
});
