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
 */

/** @returns {DriftFinding[]} the machine-readable drift set (a superset-free view of runAllChecks). */
export function detectDrift() {
  const findings = [];

  // Undocumented widgets: the class exports not present in the catalog and not denylisted.
  const catalog = readFileSync(CATALOG, 'utf8');
  for (const name of extractUiClassExports()) {
    if (CATALOG_DENYLIST.includes(name)) continue;
    if (!new RegExp(`\\*\\*${name}\\*\\*`).test(catalog)) {
      findings.push({ kind: 'undocumented-widget', name });
    }
  }

  // Drifted snippets: a recipe module whose #region differs from the embedded block in its .md.
  for (const { md, module } of DRIFT_PAIRS) {
    const region = extractRegion(readFileSync(join(RECIPE_DIR, `${module}.ts`), 'utf8'));
    if (region === null) continue; // absent-region is a runAllChecks error, not a syncable delta
    if (checkDrift(readFileSync(join(SKILL_ROOT, md), 'utf8'), region).length > 0) {
      findings.push({ kind: 'snippet-drift', module });
    }
  }
  return findings;
}
```

Notes:
- The undocumented-widget branch mirrors `checkBarrelCoverage`'s **forward** direction exactly (a
  catalog-name-not-exported *reverse* gap is a `runAllChecks` error, not an auto-syncable delta — you
  cannot invent a widget, so it is out of `detectDrift`).
- `extractRegion` is currently module-internal; export it (or a small `readRegion(module)` helper) so
  the fixer and the request builder (03-02) share it. (AR-6)

## Deterministic snippet fix — `plugin-sync.mjs --fix` (FR-2, AR-3)

A new root CLI `scripts/plugin-sync.mjs` (sibling of `check-plugin.mjs`/`gate.mjs`), wired as
`yarn plugin:sync`:

```js
// scripts/plugin-sync.mjs (sketch)
import { detectDrift, /* path consts + */ syncSnippet } from './check-plugin.mjs';

export function fixSnippetDrift(findings) {
  const fixed = [];
  for (const f of findings) {
    if (f.kind !== 'snippet-drift') continue;
    const region = readRegion(f.module);                 // source of truth
    const md = join(SKILL_ROOT, driftMdFor(f.module));   // DRIFT_PAIRS lookup
    writeFileSync(md, replaceFencedBlock(readFileSync(md, 'utf8'), region)); // deterministic splice
    fixed.push(f.module);
  }
  return fixed;
}
```

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

- **Edit** `scripts/check-plugin.mjs` — add `detectDrift`; export `extractRegion`/`readRegion` +
  needed path consts; no behavior change to `runAllChecks`/`check-plugin: PASS`.
- **New** `scripts/plugin-sync.mjs` — `fixSnippetDrift` + `replaceFencedBlock` (pure) + a guarded
  `main()` handling `--fix` (this phase) and, in 03-03, the AI path.
- **Edit** root `package.json` — add `"plugin:sync": "node scripts/plugin-sync.mjs"`.
