// Implementation-detail tests for the plugin self-sync detector + deterministic snippet fix. These
// cover edges beyond the ST oracles: multiple simultaneous findings, the absent-region skip, and
// idempotent fixing. All run against a temp-dir copy of the real tree — never the repo.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, expect, test } from 'vitest';

import { DEFAULT_ROOTS, detectDrift } from '../../../scripts/check-plugin.mjs';
import {
  fixSnippetDrift,
  fixUndocumentedWidgets,
  normalizeBullet,
  replaceFencedBlock,
} from '../../../scripts/plugin-sync.mjs';
import {
  applyCatalogEntry,
  buildCatalogEntryRequest,
  NEEDS_CATEGORISATION,
  readWidgetDoc,
} from '../../../scripts/plugin-sync-request.mjs';

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

test('denylisted base classes are never emitted as undocumented-widget findings', () => {
  const roots = seededRoots();
  // Remove the abstract View base's catalog bullet. Because View is denylisted, barrel-coverage never
  // requires it, so detectDrift emits no finding for it (you would never ask an AI to draft its entry).
  removeBullet(roots, 'View');
  const findings = detectDrift(roots);
  expect(findings.some((f) => f.kind === 'undocumented-widget' && f.name === 'View')).toBe(false);
});

test('the request builder throws on a name that is not a @jsvision/ui class export', () => {
  // A real widget always has a lead + @example (check:docs guarantees the @example), so the failure
  // mode worth guarding is an unknown/removed name — it must throw, not draft from empty grounding.
  expect(() => readWidgetDoc('DefinitelyNotARealWidget')).toThrow(/no @jsvision\/ui class export/);
  expect(() => buildCatalogEntryRequest('DefinitelyNotARealWidget')).toThrow();
});

test('a real widget yields a grounded, non-empty request', () => {
  const { lead, example } = readWidgetDoc('ProgressBar');
  expect(lead.length).toBeGreaterThan(0);
  expect(example.length).toBeGreaterThan(0);
  const req = buildCatalogEntryRequest('ProgressBar');
  expect(req.user).toContain('ProgressBar');
  expect(req.target.afterHeading).toBe(NEEDS_CATEGORISATION);
});

test('applyCatalogEntry inserts under the holding heading, creating it when absent', () => {
  const withHeading = `# Cat\n\n## ${NEEDS_CATEGORISATION}\n\n- **Existing** — x.\n`;
  const out1 = applyCatalogEntry(withHeading, '- **Ghost** — a widget.', NEEDS_CATEGORISATION);
  expect(out1).toContain('- **Ghost** — a widget.');
  expect(out1.indexOf(`## ${NEEDS_CATEGORISATION}`)).toBeLessThan(out1.indexOf('- **Ghost**'));

  const noHeading = '# Cat\n\n## Controls\n\n- **Button** — a button.\n';
  const out2 = applyCatalogEntry(noHeading, '- **Ghost** — a widget.', NEEDS_CATEGORISATION);
  expect(out2).toContain(`## ${NEEDS_CATEGORISATION}`);
  expect(out2).toContain('- **Ghost** — a widget.');
});

test('fixUndocumentedWidgets documents the widget so detectDrift stops reporting it (idempotent)', async () => {
  const roots = seededRoots();
  removeBullet(roots, 'Button');
  expect(detectDrift(roots)).toContainEqual({ kind: 'undocumented-widget', name: 'Button' });

  const fake = { draft: async () => '- **Button** — a command button.' };
  const undocumented = detectDrift(roots).filter((f) => f.kind === 'undocumented-widget');
  expect(await fixUndocumentedWidgets(undocumented, fake, roots)).toContain('Button');

  // Documented now → no finding; a second run over the fresh findings drafts nothing.
  const after = detectDrift(roots);
  expect(after.some((f) => f.kind === 'undocumented-widget' && f.name === 'Button')).toBe(false);
  expect(await fixUndocumentedWidgets(after, fake, roots)).toEqual([]);
});

test('the drafted bullet lands under the holding heading', async () => {
  const roots = seededRoots();
  removeBullet(roots, 'Button');
  const fake = { draft: async () => '- **Button** — a command button.' };
  await fixUndocumentedWidgets([{ kind: 'undocumented-widget', name: 'Button' }], fake, roots);

  const catalog = readFileSync(roots.catalogPath, 'utf8');
  expect(catalog).toContain(`## ${NEEDS_CATEGORISATION}`);
  expect(catalog.indexOf(`## ${NEEDS_CATEGORISATION}`)).toBeLessThan(catalog.lastIndexOf('**Button**'));
});

test('fixUndocumentedWidgets is a no-op for empty or non-widget findings', async () => {
  const roots = seededRoots();
  const fake = { draft: async () => '- **X** — y.' };
  const before = readFileSync(roots.catalogPath, 'utf8');
  expect(await fixUndocumentedWidgets([], fake, roots)).toEqual([]);
  expect(await fixUndocumentedWidgets([{ kind: 'snippet-drift', module: 'data-grid' }], fake, roots)).toEqual([]);
  expect(readFileSync(roots.catalogPath, 'utf8')).toBe(before); // catalog untouched
});

test('normalizeBullet reduces a model reply to a single leading-dash bullet', () => {
  expect(normalizeBullet('\n- **Ghost** — a widget.\n')).toBe('- **Ghost** — a widget.');
  expect(normalizeBullet('**Ghost** — a widget.')).toBe('- **Ghost** — a widget.');
  expect(normalizeBullet('Here you go:\n- **Ghost** — a widget.\nthanks')).toBe('- **Ghost** — a widget.');
});

// A-1 acceptance — the full loop end to end over a seeded temp copy, with a FAKE client and NO
// network: seed both drift kinds, run the deterministic + AI fixes, and prove the gate's own checkers
// then report no drift (detectDrift === [] is the barrel-coverage + snippet-drift gate passing for
// this tree). Zero repo mutation, zero network.
test('A-1 acceptance: seeded drift → --fix + fake-client AI path → gate reports clean, no network', async () => {
  const roots = seededRoots();
  removeBullet(roots, 'Button'); // seed: undocumented widget
  driftPage(roots, join('references', 'recipes', 'data-driven.md')); // seed: snippet drift

  expect(detectDrift(roots)).toHaveLength(2);

  expect(fixSnippetDrift(detectDrift(roots), roots)).toEqual(['data-grid']);
  const fake = { draft: async () => '- **Button** — a command button; `new Button("~O~K")`.' };
  expect(await fixUndocumentedWidgets(detectDrift(roots), fake, roots)).toEqual(['Button']);

  // Loop closed: the same checkers the gate runs now report nothing to sync.
  expect(detectDrift(roots)).toEqual([]);
});
