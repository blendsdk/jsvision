# Preflight Report — form-store

> **Artifact:** `codeops/features/jsvision-forms/plans/form-store/` (implementation plan, 8 docs)
> **Implements:** jsvision-forms/RD-01 + RD-02 · **Feature:** jsvision-forms
> **Scan date:** 2026-07-14 · **CodeOps Skills Version:** 3.7.0
> **Outcome:** ✅ **PASSED** — 0 critical, 0 major, 4 minor, 4 observations; **all 8 applied**
> (user decision 2026-07-14). No blocker: every high-risk claim was verified against the real code
> and against real `zod@4`. See **Resolution** at the bottom.

⚠️ **Same-model note.** This plan was very likely authored by the same model family. To counter
same-model bias, every external-standard claim (Zod behavior, vitest behavior, the TS type contract)
was **verified empirically** (installed `zod@4.4.3` + `vitest@4.1.10` in an isolated sandbox and ran
the plan's own fixture/contract) rather than reasoned from memory. Reactive-core claims were traced
to source `file:line`.

---

## Codebase Context Summary (Step 2 — reconnaissance)

The plan builds a new package `@jsvision/forms`: a headless `createForm` store over jsvision's
signals with synchronous Zod validation. Every load-bearing claim it makes was checked:

| Plan claim | Verified? | Evidence |
|---|---|---|
| `@jsvision/ui` re-exports the whole reactive core | ✅ | `packages/ui/src/index.ts:42` `export * from './reactive/index.js'` |
| `Signal<T>` has `.set`/`.update`/`.peek` (ST-01) | ✅ | `packages/ui/src/reactive/types.ts:19-28` |
| `computed` is lazy + memoized; single recompute per change (ST-11) | ✅ | `computed.ts:47-99` — the node is a direct observer of the field signals; `read` (`:87`) calls `updateIfNecessary`, which recomputes only when state is `DIRTY`. Memoizes even with no downstream effect. |
| `createRoot` sets an owner ⇒ no dev-warning (ST-10) | ✅ | `owner.ts:73-82` sets the scope active; `attachComputation` (`:26-38`) warns **only** when `getOwner()===null`. Computeds built in `buildForm` (inside `createRoot`) are owned. |
| `createRoot` parents to the ambient owner / detached at module scope | ✅ | `owner.ts:47-52` `createChildScope` parents to `getOwner()`; GC-reclaimed at module scope. |
| Zod not yet installed; add as peer `^4` + devDep | ✅ | `grep '"zod"'` → none; `node_modules/zod` absent. |
| Scaffold mirrors `@jsvision/files` (scripts, tsconfig, vitest) | ✅ | `packages/files/package.json`, `packages/files/tsconfig.json` (identical to `ui`), `packages/ui/vitest.config.ts`. |
| Global turbo tasks pick up the new package (no `turbo.json` edit) | ✅ | `turbo.json` defines `build/typecheck/test/test:e2e/check:deps/check:docs` globally; workspaces `packages/*` (`package.json:11`). |
| `check:deps` stays green (zod pure JS) | ✅ | `scripts/check-no-native-deps.mjs:65` scans only `dependencies` — peer/dev zod is never inspected. |
| `check:docs` requires `@example` on public class/function exports | ✅ | `scripts/check-jsdoc.mjs` Check B — types are exempt, so only `createForm` + `FormFieldError` need one (plan covers both). |

**Empirical Zod-4 verification (the highest-risk area):**

- The plan's **exact public type contract** (03-01 §3) + the **shared test fixture** (07) typecheck
  **clean** under `zod@4.4.3`/`tsc --strict` NodeNext (exit 0). Critically, the *refined* schema
  `z.object({...}).refine(...)` **satisfies** `S extends z.ZodObject<any>` — because Zod 4 dropped
  `ZodEffects` and `.refine()` returns the `ZodObject`. **The `^4` pin is load-bearing**; the same
  contract would **not** typecheck under `zod@3` (where `.refine` yields a `ZodEffects`).
- `import type { ZodIssue } from 'zod'` resolves in Zod 4; `import type { z }` used only in type
  positions compiles.
- Running the fixture through real `safeParse`: ST-04/07/08/12/14/15 expectations all hold. In
  particular, **Zod 4 runs object-level `.refine` even when a field is invalid**, so ST-14 works from
  the shared `initial` (`name:''`) and ST-13's path-less refine fires on a base-invalid object — no
  abort-early problem.

---

## Findings

### 🟡 PF-001 (MINOR) — T0.3's "test (passes with no tests)" fails on the empty scaffold
**Dimension:** Feasibility / Codebase Alignment (Test Impact).
The Phase-0 scaffold copies `@jsvision/files`' scripts verbatim; its unit `test` script is
`vitest run --project unit` **without** `--passWithNoTests` (`packages/files/package.json:47`). Only
`test:e2e` carries the flag (`:48`). T0.3 (99-execution-plan) asserts
`yarn workspace @jsvision/forms test` is "green (passes with no tests)". **Empirically false:**
`vitest run --project unit` with no test files exits **code 1** ("No test files found"); with
`--passWithNoTests` it exits 0 (verified with `vitest@4.1.10`).
**Options:** (a) **[Recommended]** add `--passWithNoTests` to the scaffold's **unit** `test` script
for Phase 0 (drop it once spec tests land, mirroring the e2e comment in `vitest.config.ts`); (b)
reorder so T0.3 verifies only `typecheck` + `check:deps`, deferring `test` to after T1.1/T1.2; (c)
land a trivial placeholder test in T0.1. Option (a) is smallest and keeps T0.3's checklist intact.

### 🟡 PF-002 (MINOR) — Scaffold `package.json` spec omits the `version` field
**Dimension:** Completeness / Convention Violation.
03-01 §1 enumerates the `package.json` keys (name/private/type/sideEffects/exports/engines/scripts/
deps/peer/dev) but **omits `version`**. Every sibling carries it (`packages/files/package.json:3`
`"version": "0.2.0"`), and versions are lockstep-managed by `@blendsdk/lockstep`
(`package.json:29` `lockstep:version`). A missing version is legal for a private package but breaks
lockstep parity with siblings.
**Options:** (a) **[Recommended]** add `"version": "0.2.0"` (the current lockstep version) to the
scaffold spec; (b) leave it out and rely on lockstep to inject it. (a) matches every sibling and is
what a reader mirroring `@jsvision/files` will do anyway. *(Note: `sync-package-versions.mjs`'s
`TARGETS` only covers packages exporting a `VERSION` constant — forms exports none, so it needs no
entry there.)*

### 🟡 PF-003 (MINOR) — Two spec oracles need fixtures the shared fixture can't provide
**Dimension:** Testability / Completeness.
07's single shared fixture is `{name, port, tls}` with a refine of `path:['port']`. But:
- **ST-05** asserts a `boolean[]` field "compares element-wise" — there is **no array field** in the
  fixture, so the array path is untestable from it.
- **ST-13** asserts a **path-less** `.refine` failure lands in `form.errors()` — the shared refine
  carries `path:['port']`, so it can **never** produce a path-less issue (confirmed: a path-less
  refine requires its own schema; I ran one to verify the behavior).
**Options:** (a) **[Recommended]** add two small dedicated fixtures to 07 (a check-group/array field
for ST-05; a second schema with a path-less `.refine` for ST-13); (b) leave it to the executor to
improvise at T1.1/T1.2. Since spec oracles are meant to be immutable and unambiguous, (a) removes the
improvisation.

### 🟡 PF-004 (MINOR) — `submitAttempted` is write-only, unobservable state (YAGNI)
**Dimension:** Scope Creep / Testability.
03-01 §5 introduces `submitAttempted = signal(false)`, set by `submit()`, cleared by `reset()`, but
**never read** by any accessor and **not** on the public `Form` surface — it "does not gate `error()`;
reserved for any future reveal-after-submit convenience." This is exactly the speculative generality
the feature's grill flagged twice (the user rejected over-engineering — see
`jsvision-forms-first-slice` memory). It is also untestable as written: the impl-test bullet
"`reset()` … clears `submitAttempted`" (07) has **no accessor to observe it**.
**Correction on apply:** dropping the flag was rejected — the **submit-attempted flag is
spec-mandated** by RD-01 FR-1.8 and AR-13 ("reset … clears the submit-attempted flag"), so removing
it would re-litigate a resolved register decision. The **applied** fix keeps the required flag but
resolves the real defect (its *unobservable* impl-test): 03-01 §5 now documents it as internal/latent
with no public accessor, and 07's impl-test list drops the black-box "reset clears submitAttempted"
assertion (there is nothing observable to assert until its reveal-after-submit consumer lands).

### 🔵 PF-005 (OBSERVATION) — Inherited stale command `yarn sync-versions`
**Dimension:** Phantom Reference (via the RD-04 packaging subset this plan pulls in).
RD-04 FR-4.1 (`requirements/RD-04-non-functional.md:24`) and the project CLAUDE.md say "Lockstep
version via `yarn sync-versions`". **No such script exists** — the root has `sync-package-versions`
(`package.json:31`) and `lockstep:version` (`:29`). The form-store plan docs don't invoke it
directly, so impact is low, but an executor following the packaging trail could run a non-existent
command. Recommend a one-line correction in RD-04 (and CLAUDE.md, out of this artifact's scope).

### 🔵 PF-006 (OBSERVATION) — ST-16 is a weak passthrough oracle; note Zod-4 default wording
**Dimension:** Testability.
ST-16 checks `field('port').error()!.message` for `port:'0'` "equals the schema's min message
verbatim". The fixture's `.min(1)` has **no custom message**, so this only asserts the engine doesn't
mangle Zod's **default** — and Zod 4's default is `'Too small: expected number to be >=1'` (verified),
different from Zod 3. Author-message passthrough is already proven by ST-12 (`'Required'`) and ST-14
(`'TLS not on 23'`). **Recommend:** give the fixture a custom `.min(1, '…')` message so ST-16 actually
tests passthrough of an author message, and avoid hard-coding a Zod-3-style literal.

### 🔵 PF-007 (OBSERVATION) — Kitchen-sink NON-NEGOTIABLE story is (justifiably) deferred
**Dimension:** Scope vs. Reality.
The repo gate says "a component is not done until its story exists". This plan defers the `forms/*`
story to the RD-04 plan. That is **defensible** — the store is headless and a meaningful story needs
RD-03 widget binding — but exec_plan's enforcement ("don't mark `[x]` without a story") could trip on
the Phase-1 store tasks. **Recommend:** add one explicit line to 99-execution-plan's Definition of
Done recording the conscious deferral (headless slice; story rides RD-03/RD-04) so the enforcement is
satisfied transparently.

### 🔵 PF-008 (OBSERVATION) — RD-01 FR-1.12 "owner-free / nothing to dispose" superseded by PA-1
**Dimension:** Consistency.
RD-01 FR-1.12 says `createForm` "creates only signals and **lazy** computeds — no effects, nothing to
dispose". The plan (correctly) wraps the graph in `createRoot` to avoid the owner-less dev-warning
(`owner.ts:34`), which **does** create an owned, disposable scope (there is just no *public*
`dispose`). PA-1 documents this refinement and it is user-confirmed, so it is not a contradiction —
but the requirement's wording is now slightly inaccurate. Optional: update RD-01 FR-1.12 to
"internally owned via `createRoot`; no public `dispose`".

---

## Pass determination

- **CRITICAL:** 0 · **MAJOR:** 0 · **MINOR:** 4 · **OBSERVATION:** 4.
- No 🔴/🟠 ⇒ **not blocked.** Final tier is **PASSED** (if the minors are fixed) or **PASSED WITH
  NOTES** (if some are explicitly accepted), pending user decisions on PF-001…PF-004.
- The plan is fundamentally sound: its architecture and every externally-dependent claim
  (Zod-4 typing + runtime, vitest, the reactive-core memoization/ownership) were verified to hold.

## Adversarial checklist (same-model safeguard)

- **"Does the type contract actually compile?"** → Ran it under real `zod@4` + `tsc --strict`. Yes.
- **"Does `.refine` abort when a field is invalid, breaking ST-13/ST-14?"** → Ran real `safeParse`.
  No — Zod 4 runs the refine anyway. Oracles hold.
- **"Is `ZodIssue` still exported by Zod 4?"** → Yes (verified import).
- **"Does the empty scaffold `test` really pass?"** → No — ran `vitest`; exits 1 without
  `--passWithNoTests` (PF-001).
- **"Is the memoization claim (ST-11) real without an effect?"** → Traced `computed.ts` — the node
  observes the signals directly; memoizes cold. Yes.

---

## Resolution (fixes applied 2026-07-14, per user "apply all 8")

| # | Applied | Where |
|---|---|---|
| PF-001 | ✅ Unit `test` gets `--passWithNoTests` for the scaffold phase | 03-01 §1, 99 T0.1 |
| PF-002 | ✅ `"version": "0.2.0"` added to the scaffold spec | 03-01 §1, 99 T0.1 |
| PF-003 | ✅ Dedicated `ArraySchema` (ST-05) + `CrossSchema` path-less refine (ST-13) fixtures added | 07 |
| PF-004 | ⚠️ Kept the **spec-required** flag (FR-1.8/AR-13); fixed the unobservable impl-test instead | 03-01 §5, 07 |
| PF-005 | ✅ `yarn sync-versions` → `lockstep:version` / `sync-package-versions` | RD-04 FR-4.1 |
| PF-006 | ✅ Custom `.min(1, 'Min 1')` message so ST-16 tests real passthrough | 07 (fixture + ST-16 row) |
| PF-007 | ✅ Kitchen-sink deferral recorded explicitly in the DoD | 99 |
| PF-008 | ✅ FR-1.12 reworded to "no public dispose; internally owned via `createRoot`" | RD-01 |

**Out-of-artifact follow-up (flagged, not edited):** the project `CLAUDE.md` still references the
stale `yarn sync-versions` in three places (§Toolchain, §Commands, §structure) — correct it to
`lockstep:version` / `sync-package-versions` when convenient.
