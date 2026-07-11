# 03-01 — Structured detector + deterministic snippet fix

> Extends `scripts/check-plugin.mjs` (AR-6). No new file for the detector; the fixer is a thin new
> `scripts/plugin-sync.mjs` CLI that imports the detector. Reuses PL-01's checkers verbatim.

## `detectDrift()` — structured findings (FR-1)

Add an exported `detectDrift()` to `check-plugin.mjs` that returns typed findings instead of strings.
It reuses the existing checkers so there is one source of truth.

```js
/**
 * @typedef {{ kind: 'undocumented-widget', name: string }
 *          | { kind: 'snippet-drift', module: string }} DriftFinding
 * @typedef {{ catalogPath: string, recipeDir: string, skillRoot: string,
 *             listClassExports: () => string[] }} DriftRoots
 */

/** The real plugin tree — the default target for `detectDrift` and the fixers. */
export const DEFAULT_ROOTS = {
  catalogPath: CATALOG,
  recipeDir: RECIPE_DIR,
  skillRoot: SKILL_ROOT,
  listClassExports: extractUiClassExports,
};

/**
 * @param {DriftRoots} [roots] defaults to the real plugin tree; a spec test passes a temp-dir roots
 *   object so it observes seeded drift without touching (or mutating) the repo.
 * @returns {DriftFinding[]} the machine-readable drift set — exactly the findings `runAllChecks`
 *   raises for these two kinds (undocumented widget, snippet drift), no more, no fewer.
 */
export function detectDrift(roots = DEFAULT_ROOTS) {
  const findings = [];
  const catalog = readFileSync(roots.catalogPath, 'utf8');

  // Undocumented widgets: REUSE the gate's own checker and map its "missing entry" errors back to
  // findings, so the finding set is — by construction — identical to what barrel-coverage reports.
  // One predicate, one source of truth (AR-6); no second hand-rolled regex to drift from the gate.
  for (const err of checkBarrelCoverage(roots.listClassExports(), catalog, CATALOG_DENYLIST)) {
    const m = err.match(/missing entry for exported class "(.+)"/);
    if (m) findings.push({ kind: 'undocumented-widget', name: m[1] });
  }

  // Drifted snippets: a recipe module whose #region differs from the embedded block in its .md.
  for (const { md, module } of DRIFT_PAIRS) {
    const region = extractRegion(readFileSync(join(roots.recipeDir, `${module}.ts`), 'utf8'));
    if (region === null) continue; // absent-region is a runAllChecks error, not a syncable delta
    if (checkDrift(readFileSync(join(roots.skillRoot, md), 'utf8'), region).length > 0) {
      findings.push({ kind: 'snippet-drift', module });
    }
  }
  return findings;
}
```

Notes:
- The undocumented-widget branch is the gate's `checkBarrelCoverage` **forward** direction verbatim —
  `detectDrift` calls the checker rather than re-deriving the predicate, so a `detectDrift` finding is
  always a real gate finding (the catalog-name-not-exported *reverse* gap stays a `runAllChecks`
  error, not an auto-syncable delta — you cannot invent a widget). (AR-6)
- `extractRegion` is currently module-internal; export it (or a small `readRegion(module, roots)`
  helper) so the fixer and the request builder (03-02) share it. Export `DEFAULT_ROOTS` too. (AR-6)

## Deterministic snippet fix — `plugin-sync.mjs --fix` (FR-2, AR-3)

A new root CLI `scripts/plugin-sync.mjs` (sibling of `check-plugin.mjs`/`gate.mjs`), wired as
`yarn plugin:sync`:

```js
// scripts/plugin-sync.mjs (sketch)
import { detectDrift, DEFAULT_ROOTS, /* path consts + */ readRegion } from './check-plugin.mjs';

export function fixSnippetDrift(findings, roots = DEFAULT_ROOTS) {
  const fixed = [];
  for (const f of findings) {
    if (f.kind !== 'snippet-drift') continue;
    const region = readRegion(f.module, roots);              // source of truth
    const md = join(roots.skillRoot, driftMdFor(f.module));  // DRIFT_PAIRS lookup
    writeFileSync(md, replaceFencedBlock(readFileSync(md, 'utf8'), region)); // deterministic splice
    fixed.push(f.module);
  }
  return fixed;
}
```

The `roots` param (default = the real tree) is the injectable filesystem seam the specs need: a test
passes a temp-dir `roots` so `fixSnippetDrift`/`detectDrift` run against a seeded copy and never write
to the repo. It is the filesystem analogue of the injected model client (AR-10).

- `replaceFencedBlock(mdText, region)` is a **pure** function: it locates the existing embedded
  ```ts fenced block that check-plugin compares and replaces its body with `region`, byte-for-byte.
  It is the inverse of `checkDrift` and must leave a clean tree that `checkDrift` then passes.
- Deterministic, no network, no key. `yarn plugin:sync --fix` runs only this branch and prints
  `synced N snippet(s)` (or `nothing to sync`). It leaves changes **unstaged** for review (AR-13).

## CLI surface (AR-11, AR-12)

| Invocation | Does | AI? | Key? |
|-----------|------|-----|------|
| `yarn plugin:sync --fix` | deterministic snippet re-sync only | no | no |
| `yarn plugin:sync` | snippet re-sync **+** draft catalog entries for undocumented widgets via the injected Anthropic client | yes | yes (runtime) |
| `/jsvision-plugin-sync` (skill) | reads `detectDrift()`, drafts catalog entries in-session, dev reviews | yes (in-session) | no |

`plugin-sync.mjs` is `main()`-guarded exactly like `check-plugin.mjs` (`import.meta.url ===
pathToFileURL(process.argv[1]).href`), so it is importable by the spec tests without side effects.

## Files

- **Edit** `scripts/check-plugin.mjs` — add `detectDrift(roots)` (reusing `checkBarrelCoverage`);
  export `extractRegion`/`readRegion`, `DEFAULT_ROOTS` + needed path consts; no behavior change to
  `runAllChecks`/`check-plugin: PASS`.
- **New** `scripts/plugin-sync.mjs` — `fixSnippetDrift` + `replaceFencedBlock` (pure) + a guarded
  `main()` handling `--fix` (this phase) and, in 03-03, the AI path.
- **Edit** root `package.json` — add `"plugin:sync": "node scripts/plugin-sync.mjs"`.
