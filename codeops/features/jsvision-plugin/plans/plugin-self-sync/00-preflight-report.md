# Preflight Report: plugin-self-sync (PL-02)

> **Status**: ✅ PASSED — all 7 findings resolved (0 critical, 3 major, 3 minor, 1 observation); fixes applied to the plan docs
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-plugin/plans/plugin-self-sync/`
> **Codebase Grounded**: 9 source/config files examined, ~25 references verified
> **Last Updated**: 2026-07-11
> **Review independence**: Plan authored in a prior session (commit `7eb6f26`); this scan runs in a fresh session — same-session bias risk is low.

### Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (yarn 1.x + Turborepo); Node scripts in plain `.mjs`; vitest; zero runtime deps in published packages.
**Architecture:** PL-01 shipped `scripts/check-plugin.mjs` — a repo-root integrity gate run as the final step of `yarn verify`. It exports pure checkers (`checkBarrelCoverage`, `checkDrift`, …) plus `runAllChecks()`, and reads the plugin tree via frozen module-level path consts (`CATALOG`, `RECIPE_DIR`, `SKILL_ROOT`, `UI_BARREL`). The plugin lives under `tools/claude-plugin/` (a `jsvision` router skill + a `jsvision-new-app` manual skill); recipe pages embed one `` ```ts `` block each, drift-checked against `packages/examples/recipes/*.ts` `#region example` blocks.
**Key Files Examined:** `scripts/check-plugin.mjs`, `tools/claude-plugin/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `tools/claude-plugin/skills/jsvision-new-app/SKILL.md`, `tools/claude-plugin/skills/jsvision/references/component-catalog.md`, `.github/workflows/ci.yml`, root `package.json`, `packages/examples/test/check-plugin.spec.test.ts`, recipe `.md`/`.ts` pairs.

**Reference verification highlights (what the plan got RIGHT):**
- All `02-current-state.md` line numbers verified accurate (`checkManifestData:60`, `checkDrift:148`, `checkBarrelCoverage:202`, `extractUiClassExports:226`, `runAllChecks:260`, snippet-drift `:286-293`).
- `disable-model-invocation: true` is a real frontmatter key (used by `jsvision-new-app`). ✅
- ci.yml header literally states "No secrets are referenced." and uses `actions/checkout@v5` + `actions/setup-node@v5` — matching the plan's proposed workflow. ✅
- `yarn verify` (`package.json:23`) chains `&& node scripts/check-plugin.mjs`; `check:deps` (`:21`) is a separate per-package turbo task, so a root devDep is trivially unaffected. ✅
- Each recipe `.md` has exactly one `` ```ts `` block → a first-block splice is safe. ✅
- Skills are registered by directory presence (neither `plugin.json` nor `marketplace.json` enumerates skills) — the plan's hedge is correct. ✅
- Empirically ran the `detectDrift` sketch's predicate vs the gate's on all 39 real class exports: both agree on the clean tree today (so ST-1 passes now).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | PF-003 | 🟠 |
| 2 | Implicit Assumptions | PF-004 | 🟡 |
| 3 | Logical Contradictions | PF-002 | 🟠 |
| 4 | Completeness Gaps | PF-001, PF-005 | 🟠 |
| 5 | Dependency Issues | PF-005 | 🟡 |
| 6 | Feasibility | PF-004 | 🟡 |
| 7 | Testability | PF-001, PF-003 | 🟠 |
| 8 | Security | — | — |
| 9 | Edge Cases | PF-007 | 🔵 |
| 10 | Scope Creep | PF-006 | 🟡 |
| 11 | Ordering | — | — |
| 12 | Consistency | PF-002 | 🟠 |
| 13 | Codebase Alignment | PF-001, PF-002, PF-006 | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | ✅ all resolved (fixes applied) |
| MINOR | 3 | ✅ all resolved (fixes applied) |
| OBSERVATION | 1 | ✅ resolved (fix applied) |

---

### PF-001: `detectDrift()` and the fix functions have no filesystem seam, but the spec tests require one 🟠 MAJOR

**Dimension:** Testability / Completeness / Codebase Alignment
**Location:** `03-01-detector-and-fix.md` (`detectDrift()`, `fixSnippetDrift`), `03-03-api-script-and-ci.md` (`fixUndocumentedWidgets`), `07-testing-strategy.md` ST-2/ST-6, A-1.
**Codebase Evidence:** `scripts/check-plugin.mjs:18-27` — `CATALOG`, `RECIPE_DIR`, `SKILL_ROOT`, `UI_BARREL` are module-level consts derived from `import.meta.url`; `extractUiClassExports()` reads `UI_BARREL` directly. The sketches read/write these frozen consts (`readFileSync(CATALOG)`, `writeFileSync(CATALOG, …)`, `writeFileSync(join(SKILL_ROOT, md), …)`).
**The Problem:** `07`'s ST-2 requires "a seeded tree with one undocumented class export and one drifted recipe snippet **(via injected/temp fixtures)**" and asserts `detectDrift()` returns exactly that set. But `detectDrift()` is a **zero-arg** function bound to the real-tree consts — a unit test importing it directly cannot relocate `import.meta.url`, so it can only observe the real (clean) tree. ST-6 is worse: `fixUndocumentedWidgets` does `writeFileSync(CATALOG, …)` on the **real** `component-catalog.md`, so the test would mutate the repo. The client seam was injected (AR-10), but the **filesystem** seam — the one the seeded-drift tests actually need — was not. The pure functions (`replaceFencedBlock`, `applyCatalogEntry`, `buildCatalogEntryRequest`) are fine; the three consts-bound functions are the gap.

**Related:** AR-10 injected the model-client seam but ST-2/ST-6 also require filesystem injection, which AR-10 did not address.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add an injectable `paths`/`roots` param (defaulting to the real consts) to `detectDrift`, `fixSnippetDrift`, `fixUndocumentedWidgets`; tests pass a temp-dir roots object. | Mirrors AR-10's injection philosophy; unit-testable with zero repo mutation; small signature change. | Touches three sketches. |
| B | Keep zero-arg functions; test the seeded case only via the decomposed pure pieces (predicate, `checkDrift`, `replaceFencedBlock`, `applyCatalogEntry`) and cover the seeded end-to-end path solely in A-1 (a temp-checkout child process). Soften ST-2 to the real clean tree. | No signature change. | ST-2's "exactly this set on a seeded tree" oracle weakens; less direct coverage of `detectDrift`. |

**Recommendation:** Option A — an injectable roots seam is the faithful extension of AR-10 and makes ST-2/ST-6 implementable without touching the real tree. Add it to the three functions and note the default = today's consts, so `runAllChecks` and the CLI are unchanged.
**Confidence:** High. **Hardening:** self-challenged ("is this just an execution detail?") — no: ST-2/ST-6 are immutable spec oracles and the current design makes them unsatisfiable without repo mutation, which is precisely a pre-execution catch.

**User Decision:** ✅ Resolved — User accepted recommendation: Option A. Applied: `DriftRoots`/`DEFAULT_ROOTS` + injectable `roots` param on `detectDrift`/`fixSnippetDrift`/`fixUndocumentedWidgets` (03-01, 03-03); ST-2/ST-6 reworded to temp-dir roots (07); tasks 1.2/1.3/3.2 threaded (99).

---

### PF-002: `detectDrift()`'s undocumented-widget predicate (`**Name**`) diverges from the gate's (`\bName\b`) 🟠 MAJOR

**Dimension:** Logical Contradictions / Consistency / Codebase Alignment (Redundancy)
**Location:** `03-01-detector-and-fix.md` `detectDrift()` (`new RegExp(\`\\*\\*${name}\\*\\*\`)`) and its JSDoc `@returns` ("a **superset-free** view of runAllChecks"); `00-ambiguity-register.md` AR-6; `01-requirements.md` FR-1 ("derived from the same checks `check-plugin.mjs` already runs").
**Codebase Evidence:** `scripts/check-plugin.mjs:208` — `checkBarrelCoverage` tests `new RegExp(\`\\b${cls}\\b\`)` (word-boundary, matches a name **anywhere**, including incidental prose). The plan's `detectDrift` sketch tests `**Name**` (bold bullet only). `**Name**` ⊂ `\bName\b`, so `detectDrift` is a **strict superset** of the gate's forward findings — it can flag a class the gate considers documented (e.g. a class named only in another bullet's prose, like `ListView` inside `**ListBox** — a \`ListView<string>\` preset`).
**The Problem:** AR-6, FR-1, and `02-current-state.md` all promise "one source of truth / reuses the existing checkers," and `detectDrift`'s own JSDoc calls itself a "superset-free view of runAllChecks" — but the sketch hand-rolls a *different, stricter* predicate, making it a potential superset. The plan's core premise ("each `detectDrift` finding is a gate finding to resolve") then doesn't hold: the fixer could draft a bullet the gate never demanded. **Not currently breaking** — on today's clean tree all 39 class exports satisfy both predicates (ST-1 passes) — but it is a latent contradiction that widens as the catalog evolves.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reuse `checkBarrelCoverage` directly: run it, map its "missing entry for exported class X" errors back to `undocumented-widget` findings. | True one-source-of-truth; findings ≡ gate findings by construction; honors AR-6/FR-1 and the "superset-free" JSDoc. | Slight parsing of error strings (or refactor `checkBarrelCoverage` to also return structured names). |
| B | Keep a hand-rolled predicate but use the gate's **exact** `\b${name}\b` regex. | Minimal change; findings match the gate. | Still duplicates the predicate (two copies to keep in sync); reverts to the looser prose-match. |
| C | Keep `**Name**` deliberately (stricter/better), and update AR-6/FR-1/JSDoc to say `detectDrift` is intentionally stricter than the gate. | Arguably more correct (demands a real bullet). | Breaks the "each finding = a gate finding" invariant; the fixer acts on findings verify never raised. |

**Recommendation:** Option A — reuse `checkBarrelCoverage` so the structured findings are, by construction, exactly the gate's findings. This is what AR-6 and the JSDoc already promise; it also eliminates the second copy of the predicate.
**Confidence:** High that it's a real inconsistency; the severity is calibrated for the AR-6 contradiction, not runtime breakage (latent today).

**User Decision:** ✅ Resolved — User accepted recommendation: Option A. Applied: `detectDrift` now calls `checkBarrelCoverage` and maps its "missing entry" errors back to findings (one predicate); the "superset-free view" JSDoc is now literally true (03-01); task 1.2 notes the reuse (99).

---

### PF-003: "the correct `##` section" is not deterministically derivable — `sectionFor(name)` has no grounded source 🟠 MAJOR

**Dimension:** Ambiguities / Testability / Completeness
**Location:** `03-02-generation-and-skill.md` (`target: { file: CATALOG, afterHeading: sectionFor(name) }`, `applyCatalogEntry(mdText, bullet, section)` "under the right `##` section"); `07-testing-strategy.md` ST-5 ("under the correct `##` section") and ST-7 ("inserts it under the right section").
**Codebase Evidence:** `component-catalog.md` is organized into editorial `##` sections (Controls, Data views, Feedback, Date & color pickers, …) with `- **Name** —` bullets; there is **no** widget→category metadata anywhere in the code. `checkBarrelCoverage` (`scripts/check-plugin.mjs:202-217`) only checks that `\bName\b` appears **somewhere** — it never checks section placement.
**The Problem:** For a brand-new undocumented widget, nothing in the code says which `##` section it belongs to — the categorization is human editorial judgment. So `sectionFor(name)` has no deterministic answer, and ST-5/ST-7 assert an **undefined oracle** ("the correct section"). Meanwhile the gate the whole loop is gated on doesn't care about placement, so the promise is both unfulfillable *and* unnecessary for greening verify. (A `src`-subdir→section heuristic is plausible — `packages/ui/src/date/` → "Date & color pickers" — but that mapping table isn't in the plan and still fails for a widget in a new directory.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Insert at a **deterministic** location (e.g. a dedicated "## New — needs categorization" area, or immediately before "## The escape hatch"); the human re-files during review. Soften ST-5/ST-7 to what's gate-checkable: the bullet exists and `checkBarrelCoverage` no longer reports the name. | Fully deterministic; honest oracle; greens the gate; human owns categorization (already in-loop per AR-13). | Bullet lands in a holding area, not its final section, until a human moves it. |
| B | Add a `src`-dir→section lookup table so `sectionFor` derives the section from the widget's source directory, with a "needs categorization" fallback. | Usually lands in the right section automatically. | New brittle mapping table not in the plan; still undefined for a new directory; more surface to maintain. |

**Recommendation:** Option A — place deterministically in a holding area and let the human (already required by AR-13) re-file. Relax ST-5/ST-7's oracle to the gate-checkable fact (name present + barrel-coverage passes), which is what actually unblocks `yarn verify`.
**Confidence:** High.

**User Decision:** ✅ Resolved — User accepted recommendation: Option A. Applied: `sectionFor` dropped for a fixed `## New — needs categorization` holding heading (`NEEDS_CATEGORISATION`); `applyCatalogEntry` creates it if absent; human re-files during review (03-02); ST-5/ST-7 oracles softened to the gate-checkable fact (07); task 2.2 updated (99).

---

### PF-004: `readWidgetDoc` is understated — it needs new TS-compiler doc/@example extraction, not just "reuse the machinery" 🟡 MINOR

**Dimension:** Feasibility / Implicit Assumptions
**Location:** `03-02-generation-and-skill.md` — "`readWidgetDoc(name)` reuses the TS-compiler machinery behind `extractUiClassExports` to pull the class's leading JSDoc + its `@example`."
**Codebase Evidence:** `scripts/check-plugin.mjs:226-245` — `extractUiClassExports` only returns **names**: it iterates exports, follows `getAliasedSymbol`, and pushes `getName()` for class symbols. It extracts **no** doc comments. Pulling the lead sentence + `@example` requires additional work: `sym.getDocumentationComment(checker)` and `sym.getJsDocTags(checker)` (filtering `@example`), on the **aliased** class symbol.
**The Problem:** The plan frames `readWidgetDoc` as reuse when it is a genuinely new code path over the same `Program`. Feasible (the `@example` grounding data is guaranteed present — `check:docs`/`check-jsdoc.mjs` fails `verify` on any public export missing `@example`), but the plan should acknowledge the new extraction logic and that it must follow the alias chain to reach the declaration's JSDoc, or the executor may under-scope task 2.2.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reword 03-02 to say `readWidgetDoc` **adds** doc-comment + `@example` extraction over the same TypeScript `Program` (via `getDocumentationComment`/`getJsDocTags` on the aliased class symbol). | Accurate scope; guides the executor. | Doc edit only. |

**Recommendation:** Option A — a one-line scope correction; no design change. Note the grounding data is guaranteed by the existing `@example` gate.
**Confidence:** High.

**User Decision:** ✅ Resolved — User accepted recommendation: Option A. Applied: 03-02 now states `readWidgetDoc` adds `getDocumentationComment`/`getJsDocTags` extraction over the extractor's `Program` (following the alias to the class decl), with `@example` guaranteed by `check:docs`; task 2.2 updated (99).

---

### PF-005: Adding `@anthropic-ai/sdk` requires a yarn.lock update, not called out 🟡 MINOR

**Dimension:** Dependency Issues / Completeness
**Location:** `03-03-api-script-and-ci.md` "Files" (Edit root `package.json` — add `@anthropic-ai/sdk` to `devDependencies`); `99-execution-plan.md` task 3.4.
**Codebase Evidence:** `.github/workflows/ci.yml:39` runs `yarn install --frozen-lockfile`, which **fails** if `package.json` and `yarn.lock` disagree. The plan mentions editing `package.json` but never regenerating/committing `yarn.lock`.
**The Problem:** If task 3.4 edits `package.json` without running `yarn install` to update the lockfile, CI's frozen-lockfile install fails before any test runs. Mechanical, but a real completeness gap in a spec-first plan.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Extend task 3.4 to "add the devDep **and** run `yarn install` to update + commit `yarn.lock`." | Closes the CI gap explicitly. | Doc edit only. |

**Recommendation:** Option A.
**Confidence:** High.

**User Decision:** ✅ Resolved — User accepted recommendation: Option A. Applied: task 3.4 now runs `yarn install` to update `yarn.lock`; 03-03 "Files" edits `package.json` **+ `yarn.lock`** with the frozen-lockfile rationale.

---

### PF-006: `jsvision-plugin-sync` is a maintainer-only tool bundled into the consumer-facing plugin 🟡 MINOR

**Dimension:** Scope Creep / Codebase Alignment (Architecture Mismatch)
**Location:** `03-02-generation-and-skill.md` — skill placed at `tools/claude-plugin/skills/jsvision-plugin-sync/SKILL.md` (inside the distributed plugin).
**Codebase Evidence:** `.claude-plugin/marketplace.json` distributes `jsvision-plugin` with source `./tools/claude-plugin`; `plugin.json` describes it as "Build jsvision terminal-UI applications … scaffold, compose, run, verify, and extend." The self-sync skill references repo-internal `scripts/plugin-sync.mjs`, `packages/ui`, and `packages/examples/recipes` — none of which exist in a consumer's project.
**The Problem:** The self-sync skill maintains **this repo's** plugin content; it is useless (or errors) in an installed consumer's project, yet it ships inside the plugin a consumer installs, polluting their command surface with a `/jsvision-plugin-sync` that has nothing to sync. It is `disable-model-invocation` (manual), so harm is low, but the placement is a scope decision the plan should make explicitly.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep it in the plugin, accept the bleed (manual-only, plugin is pre-release 0.1.0). | Simplest; matches PL-01 tooling-lives-alongside precedent. | Consumers eventually receive an inert maintainer command. |
| B | Place the skill outside the distributed plugin dir (a repo-local `.claude/skills/jsvision-plugin-sync/` or a non-distributed tools path) so consumers never get it. | Clean separation of maintainer vs consumer surface. | Diverges from the `jsvision-new-app` co-location; the plan's `plugin.json`/marketplace wiring changes. |

**Recommendation:** Confirm intent with the user. If the plugin is genuinely consumer-facing at release, Option B; if it stays an internal/pre-release artifact for now, Option A is acceptable — but the decision should be recorded, not incidental.
**Confidence:** Medium — hinges on distribution intent, which is exactly why it's worth a user decision.

**User Decision:** ✅ Resolved — User chose Option A (keep in plugin). Applied: 03-02 records the skill as a maintainer-facing tool co-located in the distributed plugin (accepted pre-release trade-off; manual-only, never auto-fires in a consumer's project).

---

### PF-007: Real Anthropic adapter leaves model id + `max_tokens` unspecified 🔵 OBSERVATION

**Dimension:** Edge Cases / Completeness
**Location:** `03-03-api-script-and-ci.md` — `scripts/plugin-sync-anthropic.mjs` "maps `{system,user}` → a `messages.create` call and returns the text."
**Codebase Evidence:** No existing Anthropic usage in the repo (grep-confirmed no AI-in-repo precedent); the adapter is new.
**The Problem:** `messages.create` requires a `model` and `max_tokens`. Since the adapter is behind the injected seam and never unit-tested, this is a runtime detail, but the plan should name a default model (a current Claude model id) and a small `max_tokens` (a one-bullet draft is tiny) so the executor isn't guessing.

**Recommendation:** Note a default model + a modest `max_tokens` in 03-03; keep it in the real adapter only (never the tested path). Non-blocking.

**User Decision:** ✅ Resolved — User accepted recommendation. Applied: 03-03 real adapter now names a default model (`claude-haiku-4-5-20251001`, override to `claude-sonnet-5` for higher-quality prose) + `max_tokens` ~256; task 3.3 updated (99).

---

## Verdict

✅ **PREFLIGHT PASSED — all 7 findings resolved.** Strong, well-grounded plan: every line-number and
CI/manifest claim checked out, security posture is conservative (no wired secret, injected client,
human-in-loop, no auto-commit), and the reuse-PL-01 discipline is real. No CRITICAL findings. The user
accepted every recommendation (PF-006 → keep-in-plugin), and the fixes were applied to the plan docs
(03-01, 03-02, 03-03, 07, 99). The plan is ready for `exec_plan`.

Net design deltas from this preflight:
1. An injectable `roots` filesystem seam (`DEFAULT_ROOTS`) on `detectDrift`/`fixSnippetDrift`/`fixUndocumentedWidgets` — the filesystem analogue of AR-10's injected client, so seeded-drift specs never touch the repo.
2. `detectDrift` reuses `checkBarrelCoverage` — its findings are, by construction, exactly the gate's (honoring AR-6 + its own "superset-free" JSDoc).
3. Deterministic `New — needs categorization` holding heading replaces the underivable `sectionFor`; the human re-files during review; ST-5/ST-7 oracles softened to the gate-checkable fact.
4. `readWidgetDoc` scope corrected; `yarn.lock` update called out; real-adapter model + `max_tokens` named.
