// Specification oracle for the plugin self-sync detector + deterministic snippet fix (ST-1…ST-4,
// ST-11). Derived from the requirements and the AR decisions, never from the implementation: a
// failing spec means the code is wrong, not the test.
//
// detectDrift() turns the integrity gate's two syncable findings — an undocumented @jsvision/ui
// widget and a drifted recipe snippet — into machine-readable objects, reusing the gate's own
// checkers so its finding set is, by construction, a subset of what `yarn verify` reports. The
// deterministic --fix re-syncs a drifted snippet with no AI. Every mutating path takes an injectable
// `roots` object so these tests run against a temp-dir copy and never touch the real repo.

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, expect, test } from 'vitest';

import { DEFAULT_ROOTS, detectDrift, checkDrift, runAllChecks } from '../../../scripts/check-plugin.mjs';
import { fixSnippetDrift, replaceFencedBlock } from '../../../scripts/plugin-sync.mjs';
import { buildCatalogEntryRequest, readWidgetDoc } from '../../../scripts/plugin-sync-request.mjs';

// A distinctive widget whose class name appears exactly once in the catalog (its own bullet), so
// deleting that bullet is a clean, unambiguous "undocumented widget" seed.
const SEED_WIDGET = 'ColorSwatch';
// A recipe module ↔ page pair to drift (see DRIFT_PAIRS in the gate).
const SEED_MODULE = 'data-grid';
const SEED_MD = join('references', 'recipes', 'data-driven.md');

const tmpDirs: string[] = [];

/**
 * Copy the real skill tree + recipe modules into a throwaway temp dir and return a `roots` object
 * pointing at the copy. The caller mutates the copy freely; nothing under the repo is touched.
 */
function seededRoots(): {
  catalogPath: string;
  recipeDir: string;
  skillRoot: string;
  listClassExports: () => string[];
} {
  const tmp = mkdtempSync(join(tmpdir(), 'plugin-sync-'));
  tmpDirs.push(tmp);
  const skillRoot = join(tmp, 'skill');
  const recipeDir = join(tmp, 'recipes');
  cpSync(DEFAULT_ROOTS.skillRoot, skillRoot, { recursive: true });
  cpSync(DEFAULT_ROOTS.recipeDir, recipeDir, { recursive: true });
  return {
    catalogPath: join(skillRoot, 'references', 'component-catalog.md'),
    recipeDir,
    skillRoot,
    // Reuse the real, read-only @jsvision/ui class extractor — the export set is not what we drift.
    listClassExports: DEFAULT_ROOTS.listClassExports,
  };
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

// ST-1 — the real (clean) plugin tree has no drift.
test('ST-1: detectDrift() returns [] on the clean tree', () => {
  expect(detectDrift()).toEqual([]);
});

// ST-2 — a seeded temp tree (one missing catalog bullet + one drifted recipe snippet) yields exactly
// those two findings, order-independent, and mutates no repo file.
test('ST-2: detectDrift(roots) returns exactly the seeded findings, touching no repo file', () => {
  const roots = seededRoots();

  // Seed 1 — remove the widget's catalog bullet so barrel-coverage no longer finds it.
  const catalog = readFileSync(roots.catalogPath, 'utf8');
  const withoutBullet = catalog
    .split('\n')
    .filter((line) => !new RegExp(`\\*\\*${SEED_WIDGET}\\*\\*`).test(line))
    .join('\n');
  expect(withoutBullet).not.toBe(catalog); // the bullet really existed
  writeFileSync(roots.catalogPath, withoutBullet);

  // Seed 2 — drift the recipe page's embedded block (a comment right after the ```ts fence).
  const mdPath = join(roots.skillRoot, SEED_MD);
  writeFileSync(mdPath, readFileSync(mdPath, 'utf8').replace('```ts', '```ts\n// seeded drift'));

  // Guard: the real repo catalog is byte-identical before and after (detectDrift only reads).
  const realCatalogBefore = readFileSync(DEFAULT_ROOTS.catalogPath, 'utf8');
  const findings = detectDrift(roots);
  const realCatalogAfter = readFileSync(DEFAULT_ROOTS.catalogPath, 'utf8');

  expect(realCatalogAfter).toBe(realCatalogBefore);
  expect(findings).toHaveLength(2);
  expect(findings).toContainEqual({ kind: 'undocumented-widget', name: SEED_WIDGET });
  expect(findings).toContainEqual({ kind: 'snippet-drift', module: SEED_MODULE });
});

// ST-3 — replaceFencedBlock is the inverse of the drift check: after it, checkDrift passes.
test('ST-3: replaceFencedBlock re-syncs an embedded block so checkDrift passes', () => {
  const md = '# Recipe\n\nsome prose\n\n```ts\nconst answer = 1;\n```\n\nmore prose\n';
  const region = 'const answer = 2;\nconst other = 3;';
  const result = replaceFencedBlock(md, region);
  expect(checkDrift(result, region)).toEqual([]);
});

// ST-4 — on a clean tree there is nothing to fix; fixSnippetDrift is a no-op returning [].
test('ST-4: fixSnippetDrift(detectDrift()) is a no-op on the clean tree', () => {
  expect(fixSnippetDrift(detectDrift())).toEqual([]);
});

// ST-11 — detectDrift is purely additive: PL-01's gate still passes on the real tree.
test('ST-11: runAllChecks() still passes on the real tree (detectDrift is additive)', () => {
  expect(runAllChecks().ok).toBe(true);
});

// ST-5 — the request builder grounds its prompt in the widget's real JSDoc + @example and targets
// the deterministic holding heading; it invents no behavior.
test('ST-5: buildCatalogEntryRequest grounds the request in the widget doc + targets the holding heading', () => {
  const { lead, example } = readWidgetDoc('Button');
  // Independent reality anchors: the real Button doc says "command button" and shows `new Button`.
  expect(lead.toLowerCase()).toContain('command button');
  expect(example).toContain('new Button');

  const req = buildCatalogEntryRequest('Button');
  expect(req.target.afterHeading).toBe('New — needs categorization');
  expect(req.user).toContain('Button');
  expect(req.user).toContain(lead); // grounded in the real lead sentence
  expect(req.user).toContain(example); // grounded in the real @example
});

// ST-8 — the manual sync skill exists with valid, manual-only frontmatter.
test('ST-8: the jsvision-plugin-sync skill exists with manual-only frontmatter', () => {
  const skill = fileURLToPath(
    new URL('../../../tools/claude-plugin/skills/jsvision-plugin-sync/SKILL.md', import.meta.url),
  );
  expect(existsSync(skill)).toBe(true);
  const fm = readFileSync(skill, 'utf8').split('---')[1] ?? '';
  expect(fm).toMatch(/^name:\s*jsvision-plugin-sync/m);
  expect(fm).toMatch(/^description:\s*\S/m);
  expect(fm).toMatch(/^disable-model-invocation:\s*true/m);
});
