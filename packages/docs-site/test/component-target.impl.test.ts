/**
 * Edge and rejection coverage for the shared component-target parser.
 */
import { describe, expect, test } from 'vitest';
import { parseComponentTarget } from '../src/api/component-target.mjs';

describe('parseComponentTarget', () => {
  test.each([
    '',
    '/guide/button',
    '/components/../guide',
    '/components/button?mode=raw',
    '/components/button#Bad Fragment',
    '/components/button#one#two',
    '/components/%2e%2e/guide',
    String.raw`/components\button`,
  ])('rejects malformed or non-canonical target %j', (target) => {
    expect(() => parseComponentTarget(target)).toThrow(TypeError);
  });

  test('returns a frozen result that cannot drift between consumers', () => {
    expect(Object.isFrozen(parseComponentTarget('/components/controls/button'))).toBe(true);
  });

  test.each([
    ['/components/code-editor/', 'Code Editor', 'components/code-editor/index.html'],
    ['/components/data-grid/#editable-data-grid', 'Data Grid', 'components/data-grid/index.html'],
    ['/components/files/file-info-pane', 'File Info Pane', 'components/files/file-info-pane.html'],
  ])('projects %s to a readable label and fragment-free build key', (target, label, buildKey) => {
    expect(parseComponentTarget(target)).toMatchObject({ label, buildKey });
  });
});
