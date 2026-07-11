# Preflight Report: jsvision-plugin / plugin-v1

> **Artifact**: `codeops/features/jsvision-plugin/plans/plugin-v1/` (implementation plan)
> **Date**: 2026-07-11
> **Status**: ✅ PASSED — all 7 findings resolved (fixes applied to the plan 2026-07-11) ·
> **🎯 EXECUTION CLOSED 2026-07-11** — plan shipped 37/37; every finding's fix confirmed in the
> shipped code (see [Post-Execution Outcome](#post-execution-outcome-2026-07-11))
> **⚠️ SAME-SESSION REVIEW** — the plan was authored in this session. To counteract same-agent
> bias, every format claim was re-verified against the **live Claude Code docs** (code.claude.com,
> fetched 2026-07-11) and every codebase claim against the real code via an independent recon pass.

## Codebase Context Summary

The plan targets a yarn+turbo monorepo. Verified against real code:
- **Smoke harness real** — `packages/examples/test/kitchen-sink.smoke.spec.test.ts:41-46,68-72,221-232`
  (`createRoot` → `createRenderRoot` → `paintedCells > 0`). Recipes can reuse it verbatim.
- **examples deps real** — `packages/examples/package.json:44-49` declares `@jsvision/{core,ui,web,files}: "*"`.
- **vitest projects real** — `packages/examples/vitest.config.ts:10-30` (`unit` = `test/**/*.{spec,impl}.test.ts`, `e2e` = `test/**/*.e2e.test.ts`).
- **`verify` script** — `package.json:23`: `yarn lint && turbo run typecheck build test check:docs`.
- **barrel-extractor precedent real** — `packages/docs-site/src/api/barrel-exports.mjs:41` + coverage/leakage diff in `check-docs-build.mjs:522-543`.
- **Plugin/skill format** — verified against live docs (see findings). Skill design fully validated;
  marketplace schema was mis-specified.

## Findings

### 🟠 PF-001 (MAJOR) — `marketplace.json` schema and location are wrong
**Dimension:** 13 Codebase/Standard Alignment · **Evidence:** live docs `plugin-marketplaces` (fetched 2026-07-11).
The plan (`03-01`) specifies a root `marketplace.json` with `{"version":"1","plugins":[{"id":…,"source":{"type":"local","path":…}}]}`. The real schema:
- File location is **`.claude-plugin/marketplace.json`** at the repo root (not a bare root `marketplace.json`).
- Required root fields: **`name`** (kebab-case), **`owner`** (object), **`plugins`** (array). No root `version`.
- Each plugin entry needs **`name`** (not `id`) + **`source`**. A **local** source is a **string** relative path (`"./tools/claude-plugin"`), resolved against the marketplace root (the dir containing `.claude-plugin/`); `../` outside it is forbidden. A git source is `{"source":"github","repo":"owner/repo"}` — the discriminator key is **`source`**, not `type`.

**Options:** (A) Correct the schema per the docs *(recommended)*. (B) Skip the marketplace file entirely and support only `claude --plugin-dir` for now. **Recommendation: A** — one small correct file; keeps the marketplace path open. **Fix:** rewrite the `03-01` marketplace block; `./tools/claude-plugin` resolves cleanly from a repo-root `.claude-plugin/`.

### 🟠 PF-002 (MAJOR) — the recipe-quoting mechanism (`<<< @/…#region`) does not work in a skill
**Dimension:** 6 Feasibility / 13 Alignment · **Evidence:** recon Claim 4 (repo-wide grep: no `<<<` in `.md`, no `#region`; `packages/docs-site/test/snippet-drift.spec.test.ts:1-9` shows docs-site does the *inverse* — it forbids pasted source and runs examples live via `<PlayExample>`).
The plan (`AR-5`, `02`, `03-02`, `03-03`) says recipe pages "quote the module via the docs-site `<<< @/…#region` idiom." That idiom (a) has **no precedent** in this repo, and (b) is a **VitePress build-time** transclusion — a Claude Code skill/reference file is rendered as plain markdown with **no build step**, so `<<< @/…` would appear to Claude literally, not expand into code.

**Options:** (A) Embed a **literal fenced code block copied from the source module's marked region**, and have `check-plugin.mjs` enforce it equals the source (drift = mismatch); a future `--fix` regenerates it *(recommended)*. (B) Reference the module by path only, no inline code (weakest — the skill then shows no code). **Recommendation: A** — the "shown code == running code" goal is preserved via copy+drift-check, which is what a build-less skill actually needs. **Fix:** update `AR-5`/`02`/`03-02`/`03-03`/`07 ST-15`; recipe modules carry comment-delimited regions the check extracts.

### 🟠 PF-003 (MAJOR) — the barrel-coverage gate has no clean deterministic basis as written
**Dimension:** 7 Testability / 13 Alignment · **Evidence:** recon Claim 7 (`packages/ui/src/index.ts` mixes widget classes, factory/util functions, constants, re-exported `@jsvision/core` values, dozens of `export type`, and `export * from './reactive'`; `barrelExports()` returns a flat type+value name list that can't distinguish widgets).
`AR-18`/`03-01`/`07 ST-18` specify "every `@jsvision/ui` export appears in `component-catalog.md` and vice versa." Taken literally that demands catalog entries for types (`Rect`, `Column`, all `*Options`), reactivity primitives (`signal`, `effect`), and core re-exports (`resolveCapabilities`, `Attr`) — noisy and high-maintenance. This matters because barrel-coverage is the whole Tier-0 answer to "a new widget goes silently undocumented."

**Options:** (A) Scope the check to **class value exports** (symbols whose declaration is a `ClassDeclaration`, via the TS checker — extend the existing `barrelExports()` machinery to filter by symbol kind), with a tiny maintained denylist for any intentionally-undocumented base class (`View`/`Group`) *(recommended)*. (B) Reverse-only: assert the catalog names no phantom widget (deterministic) but drop additive detection (loses the "new widget" catch). (C) A hand-maintained widget allow-list file. **Recommendation: A** — "class value exports of the ui barrel" ≈ exactly the widget set + base classes, a deterministic, low-noise signal that still trips on a newly-added widget. **Fix:** redefine `AR-18`/`03-01` check + `ST-18` in class-export terms.

### 🟡 PF-004 (MINOR) — ensure recipe *modules* are in the examples typecheck/`test` scope
**Dimension:** 5 Dependencies · **Evidence:** recon Claim 3 (unit glob is `test/**`).
The plan already places recipe *tests* under `packages/examples/test/` (correct — they match the glob). Confirm the recipe *modules* under `packages/examples/recipes/` fall within `packages/examples/tsconfig.json`'s include so they typecheck. **Recommendation:** add `recipes/` to the examples tsconfig include (or nest modules under an already-included path). **Fix:** one line in `03-03`/`07`.

### 🟡 PF-005 (MINOR) — `license` is an unrecognized `plugin.json` field
**Dimension:** 13 Alignment · **Evidence:** live docs — "`name` is the only required field"; `claude plugin validate` reports unknown fields as **warnings**. The plan's `plugin.json` includes `license`, which will warn.
**Recommendation:** drop `license` (keep `name`/`description`/`version`/`author`). **Fix:** `03-01`.

### 🟡 PF-006 (MINOR) — marketplace-install copies only the plugin dir; state the supported path
**Dimension:** 6 Feasibility · **Evidence:** live docs — marketplace installs are copied to `~/.claude/plugins/cache`; `--plugin-dir`/local plugins run in place; `../` references outside the plugin dir are not copied.
Recipe *modules* live in `packages/examples/` (outside the plugin dir), so a marketplace-installed copy carries only the embedded literal snippets (PF-002), not the live modules or the drift check. This is consistent with the in-repo decision (AR-2) but must be explicit: **the primary dev/use path is `claude --plugin-dir tools/claude-plugin`** (in place, `packages/examples` reachable for verify + drift check); the marketplace entry is a secondary convenience. **Fix:** note in `03-01`/README + a line on `AR-2`/`AR-5`.

### 🔵 PF-007 (OBSERVATION) — cite `gate.mjs`, not `check-jsdoc.mjs`, as the "outside-turbo" precedent
**Dimension:** 12 Consistency · **Evidence:** recon Claim 6 — `gate.mjs` runs outside turbo (`package.json:24`), but `check-jsdoc.mjs` runs **inside** turbo as each package's `check:docs`. The plan's actual approach (append `&& node scripts/check-plugin.mjs` to `verify`, like `gate`) is correct; only the cited precedent in `02`/`03-01` is imprecise. **Fix:** cite `gate.mjs`.

## What held up (no finding)

The skill design is fully validated by the live docs: `skills/<name>/SKILL.md`; `description`-driven
auto-invocation (1,536-char listing cap); `disable-model-invocation: true` for the manual scaffolder;
`argument-hint`; `allowed-tools`; `user-invocable`; supporting-file progressive disclosure;
`${CLAUDE_PLUGIN_ROOT}`; `claude plugin validate [--strict]`; `claude --plugin-dir`. The recipe smoke
harness, examples deps, vitest projects, the `verify` wiring, and the `barrelExports()` precedent are
all real. The core architecture (skill + references + deterministic scaffolder + real smoke-tested
recipes + a verify-wired gate) is sound; every finding is a fixable specification correction.

## Verdict

**✅ PASSED** — the user approved all recommended fixes (2026-07-11) and they were applied to the
plan documents: register (AR-5/AR-18 refined + new AR-20), `01`, `02`, `03-01`, `03-02`, `03-03`,
`07`, and `99`. No residual MAJOR/MINOR. The plan is ready for `exec_plan plugin-v1`.

**Confidence:** High — format findings cite primary docs; codebase findings cite file:line from an
independent recon. **Hardening:** external-standard claims were verified against live documentation
rather than memory; the plan's own author-session bias was countered by independent verification of
every load-bearing claim.

## Post-Execution Outcome (2026-07-11)

The plan executed to completion via `exec_plan plugin-v1 --ask-commit` — **37/37 tasks, 5 phases,
spec-first** (commits `8fea5e4` · `4bf7f5f` · `28286df` · `c93437d` · `ce9acd6`). Full `yarn verify`
is green (22/22 turbo tasks, 134 examples tests, `check-plugin: PASS`), and **ST-17 acceptance**
passed end-to-end (scaffolded `packages/sample/` → `tsc --noEmit` exit 0 + smoke 1/1 → removed;
`claude plugin validate` passed). This section closes the preflight loop: each finding's fix is
confirmed **realized in the shipped code**, not just in the plan.

| Finding | Fix as executed | Shipped evidence |
|---|---|---|
| 🟠 PF-001 | Marketplace at repo-root `.claude-plugin/`, correct schema (`name`/`owner`/`plugins`; entry `name` + string `source`) | `.claude-plugin/marketplace.json` (tracked): `"source": "./tools/claude-plugin"`, no root `version`, `owner` object |
| 🟠 PF-002 | Recipes = literal drift-checked copies, not `<<<` transclusion; gate extracts a comment-delimited region and asserts equality | `scripts/check-plugin.mjs` `checkDrift`/`DRIFT_PAIRS` (5 md↔module pairs) parsing `// #region example`; `packages/examples/recipes/data-grid.ts:11` carries the region |
| 🟠 PF-003 | Barrel-coverage scoped to **class value exports** via the TS checker + a tiny denylist | `check-plugin.mjs` `extractUiClassExports()` + `CATALOG_DENYLIST = ['View', 'ReactiveCycleError']`; forward+reverse checks (spec `ST-18`) |
| 🟡 PF-004 | Recipe modules brought into the examples typecheck scope | `packages/examples/tsconfig.json:7` include adds `"recipes"` |
| 🟡 PF-005 | `license` dropped from `plugin.json` (unrecognized field ⇒ warning) | `tools/claude-plugin/.claude-plugin/plugin.json` = `name`/`description`/`version`/`author` only |
| 🟡 PF-006 | Primary dev/use path documented as `claude --plugin-dir` (marketplace secondary; recipes live outside the plugin dir) | `tools/claude-plugin/README.md:21` `claude --plugin-dir tools/claude-plugin` |
| 🔵 PF-007 | Gate runs outside turbo via the `gate.mjs` pattern (append to `verify`), not the in-turbo `check:docs` | `package.json:23` `verify` ends `&& node scripts/check-plugin.mjs`, mirroring `gate` on line 24 |

**No preflight concern regressed or resurfaced during execution.** The one item the preflight
explicitly left to the runtime — a scaffolded `packages/<slug>/` resolving `@jsvision/ui` without a
fresh `yarn install` — was validated by ST-6 (in-process paint) and ST-17 (real `tsc` + `claude
plugin validate`), both green. Preflight → execution loop **closed**.
