// Implementation-detail tests for the plugin self-sync detector + deterministic snippet fix. These
// cover edges beyond the ST oracles: multiple simultaneous findings, the absent-region skip, and
// idempotent fixing. All run against a temp-dir copy of the real tree — never the repo.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, expect, test } from 'vitest';

import { DEFAULT_ROOTS, detectDrift } from '../../../scripts/check-plugin.mjs';
import { fixSnippetDrift, replaceFencedBlock } from '../../../scripts/plugin-sync.mjs';

const tmpDirs: string[] = [];

type Roots = { catalogPath: string; recipeDir: string; skillRoot: string; listClassExports: () => string[] };

function seededRoots(): Roots {
  const tmp = mkdtempSync(join(tmpdir(), 'plugin-sync-impl-'));
  tmpDirs.push(tmp);
  const skillRoot = join(tmp, 'skill');
  const recipeDir = join(tmp, 'recipes');
  cpSync(DEFAULT_ROOTS.skillRoot, skillRoot, { recursive: true });
  cpSync(DEFAULT_ROOTS.recipeDir, recipeDir, { recursive: true });
  return {
    catalogPath: join(skillRoot, 'references', 'component-catalog.md'),
    recipeDir,
    skillRoot,
    listClassExports: DEFAULT_ROOTS.listClassExports,
  };
}

/** Delete a widget's single-line catalog bullet in the seeded copy. */
function removeBullet(roots: Roots, widget: string): void {
  const catalog = readFileSync(roots.catalogPath, 'utf8');
  const next = catalog
    .split('\n')
    .filter((line) => !new RegExp(`\\*\\*${widget}\\*\\*`).test(line))
    .join('\n');
  writeFileSync(roots.catalogPath, next);
}

/** Drift a recipe page's embedded block by inserting a comment right after the ```ts fence. */
function driftPage(roots: Roots, mdRel: string): void {
  const p = join(roots.skillRoot, mdRel);
  writeFileSync(p, readFileSync(p, 'utf8').replace('```ts', '```ts\n// drift'));
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

test('multiple findings: two undocumented widgets + two drifted snippets are all detected', () => {
  const roots = seededRoots();
  removeBullet(roots, 'DatePicker');
  removeBullet(roots, 'SurfaceView');
  driftPage(roots, join('references', 'recipes', 'data-driven.md')); // data-grid
  driftPage(roots, join('references', 'recipes', 'forms-dialogs.md')); // form-dialog

  const findings = detectDrift(roots);
  expect(findings).toHaveLength(4);
  expect(findings).toContainEqual({ kind: 'undocumented-widget', name: 'DatePicker' });
  expect(findings).toContainEqual({ kind: 'undocumented-widget', name: 'SurfaceView' });
  expect(findings).toContainEqual({ kind: 'snippet-drift', module: 'data-grid' });
  expect(findings).toContainEqual({ kind: 'snippet-drift', module: 'form-dialog' });
});

test('absent region: a module missing its #region markers is skipped, not reported as drift', () => {
  const roots = seededRoots();
  // Strip the region markers from the source module, then drift its page. With no comparable source
  // region, this is a runAllChecks error — not a syncable delta — so detectDrift must skip it.
  const modulePath = join(roots.recipeDir, 'file-tools.ts');
  const stripped = readFileSync(modulePath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '// #region example' && l.trim() !== '// #endregion example')
    .join('\n');
  writeFileSync(modulePath, stripped);
  driftPage(roots, join('references', 'recipes', 'file-text.md')); // file-tools

  const findings = detectDrift(roots);
  expect(findings.some((f) => f.kind === 'snippet-drift' && f.module === 'file-tools')).toBe(false);
});

test('fixSnippetDrift greens the drift and is idempotent', () => {
  const roots = seededRoots();
  driftPage(roots, join('references', 'recipes', 'data-driven.md'));

  // First pass: the drift is present and gets fixed.
  expect(detectDrift(roots)).toContainEqual({ kind: 'snippet-drift', module: 'data-grid' });
  const fixed = fixSnippetDrift(detectDrift(roots), roots);
  expect(fixed).toEqual(['data-grid']);

  // After fixing: no more drift, and a second fix is a no-op.
  expect(detectDrift(roots).some((f) => f.kind === 'snippet-drift')).toBe(false);
  expect(fixSnippetDrift(detectDrift(roots), roots)).toEqual([]);
});

test('fixSnippetDrift ignores non-snippet findings and unknown modules', () => {
  const roots = seededRoots();
  expect(fixSnippetDrift([{ kind: 'undocumented-widget', name: 'Whatever' }], roots)).toEqual([]);
  expect(fixSnippetDrift([{ kind: 'snippet-drift', module: 'does-not-exist' }], roots)).toEqual([]);
});

test('replaceFencedBlock returns the text unchanged when there is no ```ts block', () => {
  const md = '# Page\n\njust prose, no code block\n';
  expect(replaceFencedBlock(md, 'const x = 1;')).toBe(md);
});
