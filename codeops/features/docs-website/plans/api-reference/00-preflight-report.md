# Preflight Report: API Reference (TypeDoc)

> **Artifact**: `codeops/features/docs-website/plans/api-reference/` (all 9 docs)
> **Scanned**: 2026-07-10 · **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2
> **Outcome**: ✅ PASSED — all 7 findings resolved (user accepted every recommendation 2026-07-10);
> the plan docs were updated in place (AR-18…AR-21 added to the register).
> ⚠️ **SAME-SESSION REVIEW** — this plan was authored earlier in the same session that reviewed it.
> Consider a fresh session for full independence. Findings below were re-grounded in the actual code
> (file:line evidence) to counteract same-agent bias, and each MAJOR was self-challenged before recording.

## Codebase Context Summary

| Claim in the plan | Verified against | Verdict |
| ----------------- | ---------------- | ------- |
| No TypeDoc in the repo | `grep -rI typedoc packages/ scripts/ package.json` → empty | ✅ true |
| `api/index.md` is a committed placeholder | `git ls-files` lists it; content is the placeholder | ✅ true |
| Entry points differ; core has no `src/index.ts` | `ls packages/core/src/index.ts` → absent; `src/engine/index.ts` present | ✅ true (RD-06 AC-1 text is stale — PF-004) |
| Export counts 14/55/25/6 (core/ui/files/web) | `grep -cE '^export '` on each barrel | ✅ exact match |
| nav `{text:'API'}`, static sidebar, `/api/` one-item entry | `config.ts` ~line 112 / 117 / 195 | ✅ true (line numbers ~±2) |
| `docs:build` = docs-site `vp:build` | root `package.json` scripts | ✅ true |
| `docs.yml` runs `yarn docs:build` (×2) | `docs.yml:55,:91` | ✅ true |
| docs-site test = vitest `unit`, `test/**/*.{spec,impl}.test.ts` | `vitest.config.ts` | ✅ true |
| component pages have `## Related` to hold forward links | `button.md:134` (+ `:140` already links `/api/`) | ✅ true |
| web `browser-stubs` is a subpath, not re-exported | `web/src/index.ts` + `package.json#exports` | ✅ true (⇒ PF-006) |

**New facts the recon surfaced (not in the plan):**

- `check-docs-build.mjs` is **plain Node ESM** — imports only `node:*` + `js-yaml`, run as `node …mjs` (AR-16). No `tsx`, no TS loader. → **PF-001**.
- `docs:dev` = `vitepress dev` with **no `docs:api` prefix** (root `package.json`). → **PF-002**.
- docs-site `tsconfig.json` `include` = `["examples/**/*.ts","src/**/*.ts"]` — a package-root `api-map.ts` is **out of typecheck scope**. → **PF-003**.
- `tsx` is present only as a **hoisted** `node_modules/.bin/tsx`, not a declared docs-site devDep. → folded into PF-001.

---

## Findings

### 🟠 PF-001 (MAJOR) — Node `.mjs` scripts cannot import the `.ts` pure helpers / `API_MAP`

**Dimension:** 6 Feasibility · 13 Codebase Alignment (Dependency Reality). **Verdict:** CONFIRMED.

The plan's anti-drift design rests on **one** `barrelExports` (and `injectBackLink`, `validateApiMap`,
`API_MAP`) authored as **`.ts`** under `src/api/` + `api-map.ts`, and consumed by **both**:
- the vitest specs (`.ts`; vitest transpiles TS natively — fine), **and**
- the two build scripts `gen-api.mjs` (walks `API_MAP`, calls `injectBackLink`) and
  `check-docs-build.mjs` (calls `barrelExports`, `validateApiMap`) — both **plain `node` ESM**.

`node packages/docs-site/scripts/check-docs-build.mjs` (AR-16) and `node scripts/gen-api.mjs` **cannot
`import` a `.ts` module** — there is no loader, and the current `check-docs-build.mjs` imports only
`node:*` + `js-yaml` (evidence: `check-docs-build.mjs:12-16`). No plan task bridges this. Self-challenge
("could it reimplement in `.mjs`?") fails: 03-03 §helpers explicitly names `barrel-exports.ts` as *the
single INDEPENDENT ground truth* shared by unit + e2e — reimplementing it in `.mjs` would fork the very
thing the design unifies.

**Failure at exec time:** Phase 1.2 / 2.2 / 3.1 all assume node scripts import `src/api/*.ts` → a hard
stop mid-execution.

**Options:**
1. **Author the helpers as `.mjs`/`.js` (plain ESM, using the `typescript` package for `barrelExports`);
   the `.ts` spec tests import them normally.** *(Recommended.)* Node imports `.mjs` directly; vitest
   imports `.mjs` from `.ts` fine; zero loader. Cost: the helpers lose TS type-checking on themselves
   (acceptable — small, spec-covered, pure). Keeps ONE implementation shared by both layers, honoring
   AR-15's intent.
2. Keep helpers `.ts`; have `gen-api.mjs`/`check-docs-build.mjs` shell out to a **`tsx`** runner that
   imports them. Cost: adds `tsx` as an explicit docs-site devDep (today it is only hoisted) + a
   child-process seam in two scripts; slower.
3. Keep helpers `.ts` and **precompile** `src/api/**` to JS before the gate runs. Cost: a new
   build/emit step in a package whose build is deliberately isolated — most friction.

**Recommendation: Option 1.** It preserves the "single source of truth" that is the whole point of
AR-15, needs no loader/devDep/build step, and the helpers are pure and fully spec-covered so losing
self-typecheck is low-cost. **Confidence: High** (grounded in `check-docs-build.mjs:12-16` + AR-16).
**Hardening:** in-context self-challenge run; refutation failed.

---

### 🟠 PF-002 (MAJOR) — `yarn docs:dev` breaks on a fresh checkout (config imports a gitignored, ungenerated JSON)

**Dimension:** 4 Completeness · 6 Feasibility · 13 (Migration & Compatibility). **Verdict:** CONFIRMED.

03-02 wires `config.ts` with a **static** `import typedocSidebar from '../api/typedoc-sidebar.json'
with { type: 'json' }`. That file is **gitignored + generated only by `docs:api`** (AR-5). But
`docs:dev` = `vitepress dev` with **no `docs:api` prefix** (root `package.json`), and root `docs:build`
is the *only* script the plan chains `docs:api` into. On a fresh clone (or after `git clean` / a CI
job that runs the dev server), `yarn docs:dev` fails at config load — a static import of a missing
module is a hard error that can't be caught. The plan's error table only anticipates the
`vp:build`-run-directly case, **missing `docs:dev`** — the primary authoring workflow.

*(Mitigating fact: no test imports `config.ts` — verified — so `yarn verify` itself is NOT broken by
this. The blast radius is the dev server + any direct `vp:build`.)*

**Options:**
1. **Import the sidebar defensively in `config.ts`:** `existsSync(p) ? JSON.parse(readFileSync(p)) : []`
   instead of a static `import … with { type:'json' }`. *(Recommended.)* Dev/build both work whether or
   not `docs:api` has run; the anti-drift gate still guarantees real content in the shipped build. Also
   resolves the `with { type: 'json' }` assertion-syntax fragility (PF-005, folded here).
2. Change `docs:dev` to `docs:api && vitepress dev` (and keep the static import). Cost: every dev-server
   start pays a full TypeDoc generation (slow inner loop); still hard-fails if someone runs `vitepress
   dev` directly.
3. Commit a stub `typedoc-sidebar.json` (`[]`). Cost: a committed generated artifact — contradicts AR-5.

**Recommendation: Option 1.** One-line-ish change, no perf hit on the dev loop, no committed artifact,
and it neutralizes the import-assertion fragility too. **Confidence: High** (grounded in root
`package.json#docs:dev` + AR-5 gitignore). **Hardening:** self-challenge ("do devs always run docs:api
first?") — nothing documents or enforces it for dev; refutation failed.

---

### 🟡 PF-003 (MINOR) — `api-map.ts` at the package root is outside the typecheck `include`

**Dimension:** 12 Consistency · 13 (Convention Violations). **Verdict:** CONFIRMED.

00-index and 03-02 place the map at `packages/docs-site/api-map.ts` (package root). The docs-site
`tsconfig.json` `include` is `["examples/**/*.ts","src/**/*.ts"]` — a root-level file is **never
typechecked**, and it compounds PF-001 (a root `.ts` still can't be imported by the node scripts).

**Recommendation:** move it under `src/` (e.g. `src/api/api-map.ts`), co-located with the other pure
helpers, so it is typechecked and lives in one `src/api/` module group. (If PF-001 → Option 1, it
becomes `src/api/api-map.mjs` alongside the others.) **Confidence: High.**

---

### 🟡 PF-004 (MINOR) — RD-06 AC-1 scopes coverage to `src/index.ts`, but core has none

**Dimension:** 3 Contradiction · 12 Consistency. **Verdict:** CONFIRMED.

RD-06 AC-1 says "**every** symbol exported from each package's `src/index.ts`". `@jsvision/core` has
**no** `src/index.ts` (verified) — its public entry is `src/engine/index.ts`. The plan correctly uses
`src/engine/index.ts` (AR-8), but this **silent correction of the RD** isn't called out, so AC-1's
literal spot-check wording is self-contradictory for core.

**Recommendation:** add a one-line note in `01-requirements.md` (or AR-8) that AC-1's "`src/index.ts`"
is read as "each package's **public entry point**", which is `src/engine/index.ts` for core — so the
oracle (ST-3/ST-4) is unambiguous. Optionally reconcile RD-06 AC-1's text. **Confidence: High.**

---

### 🔵 PF-005 (OBSERVATION) — `with { type: 'json' }` static assertion is fragile — folded into PF-002 Option 1

The literal import-assertion form is both engine-version-sensitive and hard-fails on absence; the
PF-002 Option-1 fs-read pattern supersedes it. No separate action if PF-002 → Option 1.

### 🔵 PF-006 (OBSERVATION) — excluding `web/browser-stubs` (AR-10) is effectively moot

`browser-stubs` is reachable only via the `package.json` subpath, **not** from `web/src/index.ts`
(verified). With `entryPointStrategy: resolve` on the barrel, TypeDoc never reaches it, so the explicit
exclusion is harmless belt-and-suspenders, not a functional requirement. Keep or drop — no risk either
way.

### 🔵 PF-007 (OBSERVATION) — state the clean→generate→inject order for determinism (ST-6)

`docs:api` = TypeDoc + in-place back-link injection. ST-6 (byte-identical re-run) holds only if TypeDoc
wipes `out` first (its `cleanOutputDir` defaults **true**, so it does) before re-injecting. The plan
relies on this implicitly; a one-line note in 03-01 that generation cleans then injects would make ST-6
robust against a future config change.

---

## Disposition

| # | Severity | Status | Resolution applied |
| - | -------- | ------ | ------------------ |
| PF-001 | 🟠 MAJOR | ✅ resolved (AR-18) | Pure helpers authored as plain-ESM `.mjs` (`barrel-exports`/`inject-back-links`/`validate-api-map`/`api-map`); `typescript` added as a docs-site devDep; JSDoc `@typedef` for `ApiLink`. Updated 03-01/03-02/03-03/99/00-index |
| PF-002 | 🟠 MAJOR | ✅ resolved (AR-19) | `config.ts` uses a defensive `existsSync ? JSON.parse(readFileSync) : []` load; error table gains the `docs:dev` fresh-checkout row. Updated 03-02/99 |
| PF-003 | 🟡 MINOR | ✅ resolved (AR-20) | `api-map` co-located under `src/api/api-map.mjs`. Updated 03-02/99/00-index |
| PF-004 | 🟡 MINOR | ✅ resolved (AR-21) | 01-requirements notes AC-1's "`src/index.ts`" reads as "public entry" (core = `src/engine/index.ts`) |
| PF-005 | 🔵 OBS | ✅ folded into PF-002 | fs-read supersedes the `with { type: 'json' }` assertion |
| PF-006 | 🔵 OBS | accepted (no action) | `browser-stubs` unreachable from the barrel — exclusion is harmless |
| PF-007 | 🔵 OBS | ✅ resolved | 03-01 determinism note: clean→generate→inject order (`cleanOutputDir`) |

**Gate:** ✅ PASSED — both MAJOR blockers resolved with the accepted low-cost fixes; all minors +
actionable observations applied. The design was sound throughout; the fixes were wiring-layer only, no
architectural change. Plan is execution-ready.
