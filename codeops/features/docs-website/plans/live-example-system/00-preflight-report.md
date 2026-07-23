# Preflight Report: Live-Example System (docs-website / RD-03)

> **Status**: ✅ PASSED — all 7 findings resolved (0 critical, 3 major, 3 minor, 1 observation), fixes applied
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation Plan at `codeops/features/docs-website/plans/live-example-system/` (12 docs)
> **Codebase Grounded**: 15 source/config files examined, ~20 references verified
> **Last Updated**: 2026-07-09

### Codebase Context Summary

**Tech Stack:** TypeScript ESM (NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, VitePress
(docs-site), xterm.js (`@xterm/xterm` + `@xterm/headless`). Zero runtime deps in shipped packages.

**Architecture:** `@jsvision/core` (pure engine) → `@jsvision/ui` (widget framework) → `@jsvision/web`
(browser host: `mountApp`/`buildBrowserCaps`/`createBrowserFileSystem`/`attachKeyReclaim`) +
`@jsvision/files` (file dialogs). `@jsvision/docs-site` is a VitePress site currently **isolated** from
`yarn verify` (script `vp:build`, not `build`). RD-03 makes it a verify participant (adds `test` +
`typecheck`) hosting a live-example runner (registry + DemoShell + client-only Vue Play component).

**Key Files Examined:** `packages/web/src/{index,mount,caps,host,virtual-fs,key-reclaim}.ts`;
`packages/examples/web-xterm/{main,app}.ts`; `packages/ui/src/app/application.ts`;
`packages/ui/src/view/render-root.ts`; `packages/ui/src/event/event-loop.ts`;
`packages/files/src/{index.ts,dialog/file-dialog.ts}`; `packages/docs-site/.vitepress/config.ts`;
`turbo.json`; root + docs-site `package.json`; `packages/examples/{vitest.config.ts,test/kitchen-sink.smoke.spec.test.ts}`.

**Reference Verification:** Verified accurate — `mountApp`/`buildBrowserCaps`/`createBrowserFileSystem`/
`attachKeyReclaim` signatures; `application.setTheme` → `loop.setTheme` (application.ts:108, forwards
293); `render-root.ts:238` caps `private readonly`; `:312` `setTheme`; strict CSP in `.vitepress/config.ts`
(no `unsafe-eval`/`unsafe-inline` for scripts); `FileDialogOptions.fs?` seam; the kitchen-sink paint-smoke
pattern; RD-04/05/07/09 cross-refs all exist. **Mismatches found → the 7 findings below.**

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 3 | Logical Contradictions | PF-003 (+PF-002) | 🟠 MAJOR |
| 4 | Completeness Gaps | PF-005, PF-006 | 🟡 MINOR |
| 7 | Testability | PF-001 (secondary) | 🟠 MAJOR |
| 12 | Consistency | PF-002 (secondary) | 🟠 MAJOR |
| 13 | Codebase Alignment | PF-001, PF-002, PF-004, PF-007 | 🟠 MAJOR |

All other dimensions (1 Ambiguities, 2 Assumptions, 5 Dependencies, 6 Feasibility, 8 Security, 9 Edge
Cases, 10 Scope Creep, 11 Ordering) scanned — no findings. Security is well-covered (sanitize on paint,
escaped source via text-binding not `v-html`, one-dialog cap, strict CSP with a verification task).

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | ✅ all resolved (fixes applied) |
| MINOR | 3 | ✅ all resolved (fixes applied) |
| OBSERVATION | 1 | ✅ resolved (fix applied) |

---

## PF-001: Tier-1 paint-smoke uses the wrong primitive for an Application 🟠 MAJOR

**Dimension:** 13 Codebase Alignment (Architecture Mismatch) · 7 Testability
**Location:** `03-06-testing-and-ci-integration.md` "Tier-1 — paint-smoke"; `07-testing-strategy.md` ST-2
**Codebase Evidence:** `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (`createRenderRoot(...).mount(view)` on a **Group**); `packages/ui/src/app/application.ts` (`Application` = `{loop, setTheme, onCommand, run}`, not a `View`); `packages/ui/src/event/event-loop.ts:205,515` ("`renderRoot.mount(root)` paints the initial frame internally"; "reading `loop.renderRoot.buffer()` for the composed frame — no terminal required")

**The Problem:** Tier-1 gates *every* example. 03-06 describes it as `demoShell({content}) → createRenderRoot(...) → mount + compose → paintedCells > 0`, and the immutable oracle ST-2 says "built + composed via `createRenderRoot`". But `demoShell()` **always returns an `Application`** (03-02), and `createRenderRoot().mount()` takes a **`View`** — an `Application` is not a `View`. The recipe is an API/type mismatch, and it is baked into a spec oracle, so an executor following spec-first would write a red test that can never go green.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Tier-1 reads the demoShell Application's **own** render root: `app.loop.renderRoot.buffer().rows()`; reword ST-2 off "createRenderRoot". | The documented headless pattern (event-loop.ts:515); the Application already paints its first frame at mount (event-loop.ts:205) — zero extra code, no new surface. | ST-2 (a spec oracle) is reworded — allowed pre-execution; AC-6 never mentioned `createRenderRoot`. |
| B | Keep `createRenderRoot`; make `demoShell` also expose a mountable root `View` and mount that. | Keeps the literal ST-2 wording. | Re-composes a tree the Application's loop already composed — duplicate work, no loop/theme/focus wiring, divergence risk. |

**Recommendation:** Option **A** — compose via `app.loop.renderRoot.buffer()`. It is literally the pattern the engine documents for headless frames; B reimplements what the Application already does to satisfy a wording detail. "via createRenderRoot" is an implementation detail smuggled into the oracle, not a requirement of AC-6.
*Confidence: High — Challenger: converged.*

**User Decision:** ✅ Resolved — User accepted recommendation (fix applied to the plan docs).

---

## PF-002: `ColorDepth` encoding contradicts `buildBrowserCaps` (and the plan's own Depth labels) 🟠 MAJOR

**Dimension:** 13 Codebase Alignment (Stale Assumption) · 3 Contradictions · 12 Consistency
**Location:** `03-03-play-component.md` (`export type ColorDepth = '24'|'8'|'4'|'1'`, `buildBrowserCaps({ colorDepth: depth })`); `03-02-demoshell.md` (`onDepthChange?: (depth: '24'|'8'|'4'|'1')` vs the Depth menu labeled "truecolor / 256 / 16 / mono")
**Codebase Evidence:** `packages/web/src/caps.ts:16` — `colorDepth?: 'truecolor' | '256' | '16' | 'mono'`

**The Problem:** The plan types color depth as `'24'|'8'|'4'|'1'` and passes it straight into `buildBrowserCaps({ colorDepth })`, whose union is `'truecolor'|'256'|'16'|'mono'`. That is a concrete type error at the call site — and `play-controller.ts`/`demo-shell.ts` live under `src/**`, which the plan's **newly-added** `docs-site#typecheck` covers. The plan as written cannot pass the very gate it introduces. It is also self-inconsistent: the same 03-02 doc labels the Depth menu with the correct caps vocabulary.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Use the real union `'truecolor'\|'256'\|'16'\|'mono'` as the depth type throughout; drop the bit-depth encoding. Ideally reuse `BrowserCapsOptions['colorDepth']` (or a named export from `@jsvision/web`) rather than re-declaring a local alias, so the two can never drift again. | Matches the API + the plan's own menu labels; single source of truth; trivial. | None material. |
| B | Keep `'24'/'8'/'4'/'1'` as UI labels + a mapping fn to the caps union before `buildBrowserCaps`. | — | Solves a non-problem — nothing uses bit-depth labels, the menu already shows the caps vocabulary; adds a mapping + a fresh drift site. |

**Recommendation:** Option **A** — adopt the real caps union everywhere and reuse the `@jsvision/web` type instead of re-declaring. B adds indirection for a label the plan doesn't want.
*Confidence: High on A; the severity is borderline MINOR but the fact that it defeats the plan's own new typecheck gate keeps it MAJOR. Challenger: converged.*

**User Decision:** ✅ Resolved — User accepted recommendation (fix applied to the plan docs).

---

## PF-003: `files/file-dialog` must import `@jsvision/web`, contradicting the "no browser import" rule 🟠 MAJOR

**Dimension:** 3 Logical Contradictions · 13 Codebase Alignment
**Location:** `03-05-seed-examples.md` (`FileDialog` over `createBrowserFileSystem({tree, home})`; authoring rule "No browser/xterm import"); `03-01` + `01-requirements` #1 ("100% @jsvision/ui — no browser import"; "nothing in it knows it is in a browser"); `07` impl / `99` task 1.5 (static scan for "no @xterm/browser import")
**Codebase Evidence:** `packages/web/src/virtual-fs.ts` — `createBrowserFileSystem` is exported **only** from `@jsvision/web`; `packages/files/src/index.ts` — exports only `nodeFileSystem` (imports `node:fs`) + the `FileSystem` type, **no** in-memory FS; `packages/files/src/dialog/file-dialog.ts:33` — `FileDialogOptions.fs?: FileSystem`

**The Problem:** `files/file-dialog` is a **core, non-droppable** example (the AC-9 demo + the AC-3 leak-test target). To seed a virtual tree it needs `createBrowserFileSystem`, which lives only in `@jsvision/web` — a "browser" package — directly contradicting the module rule "100% @jsvision/ui, no browser import" and the static-scan impl test. There is no host-neutral in-memory FS in `@jsvision/ui` or `@jsvision/files`. (Mitigant: `createBrowserFileSystem` is genuinely **pure/headless-safe** — zero `node:`/DOM, runs in Node — so runtime blast radius is low; the defect is a hard *plan-internal contradiction* the executor hits head-on.) Related: `apps/desktop` is "re-authored from `web-xterm/app.ts`", which itself imports `buildBrowserCaps` from `@jsvision/web` (app.ts:10) — the re-author must strip that (caps come from DemoShell/PlayController).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Explicitly permit the **pure** `createBrowserFileSystem` in examples; scope the static-scan ban to `@xterm/*` + DOM globals + the *impure* `@jsvision/web` surface (`createBrowserHost`/`mountApp`/`attachKeyReclaim`/`setClipboard`); reword the rule from "no browser import" to "no xterm/DOM import". | Stays in RD-03 scope (no new shipped primitive); the FS is provably pure; a backendless-FileDialog demo showing the virtual FS is on-message for a browser docs site. | Dilutes the rule to an allow-list ("which `@jsvision/web` symbols are pure?") — a future-author footgun A only manages, not eliminates. |
| B | Inject the `FileSystem` through `ExampleContext` (add `fs`, supplied by DemoShell/controller). | Module imports nothing browser-y. | Expands the example contract for one example; degrades the *shown code* (the source **is** the doc, whole-file `<<<`) — imperative host-injected seeding is a worse snippet, and the ESC-byte fixture (ST-14) is intrinsic to this example. |
| D | **Root-cause:** move the pure in-memory FS into `@jsvision/files` (e.g. `createMemoryFileSystem`, beside `nodeFileSystem`); `@jsvision/web` re-exports it. Example imports it from `@jsvision/files` (already an allowed example dep). | Keeps AR-14 crisp with **no** rule dilution, no contract change, no duplication; the pure FS belongs beside the `FileSystem` type, not in the browser package. | A shipped-package change: JSDoc `@example` obligation, lockstep version — and RD-03's success criteria explicitly scoped **no new `@jsvision/*` primitives**. |

*(Option C — hand-author a tiny FS inside docs-site — rejected: re-implements 14 tested, security-relevant methods for no benefit and bloats the shown code.)*

**Recommendation:** Option **A** for RD-03's stated scope (it adds no shipped primitive, and the FS is pure), **and record Option D as the correct follow-up** so the "no browser import" principle can later be restored to full crispness by relocating the pure FS to `@jsvision/files`. The root cause is a pure utility trapped in a browser-named package; A manages it now, D fixes it properly.
*Confidence: Med — the finding is High-confidence real; the A-vs-D call trades RD-03 scope-minimalism against architectural crispness (your call). Challenger: converged (added D).*

**User Decision:** ✅ Resolved — User accepted recommendation (fix applied to the plan docs).

---

## PF-004: turbo `test` already `dependsOn ["^build"]` — the C1 no-op-build premise is stale 🟡 MINOR

**Dimension:** 13 Codebase Alignment (Stale Assumption)
**Location:** `03-06-testing-and-ci-integration.md` "turbo ordering (C1)"; `99` task 0.3
**Codebase Evidence:** `turbo.json:11-13` — `"test": { "dependsOn": ["build", "^build"] }`

**The Problem:** 03-06 states turbo's `test` task "`dependsOn: ["build"]` … not its deps — so … give docs-site a no-op build (or rely on `^build` if the pipeline uses it)". The actual config **already** has `^build`. So once docs-site declares `@jsvision/core`/`ui`/`web`/`files` as workspace deps (Phase 0.1 already does), C1 ordering is satisfied with **zero** turbo edits. Adding a no-op `build` script is unnecessary and puts docs-site into the turbo `build` task — mild tension with C2 ("`vp:build` stays isolated from the build phase").

**Options:** Single viable path — no strawman alternative.

| Option | Description |
|--------|-------------|
| A | Correct 03-06 + task 0.3: rely on the existing `test: dependsOn ["build","^build"]`; declaring the workspace deps orders them first; **do not** add a no-op `build` script. Keep the clean-`dist` validation (task 0.4). |

**Recommendation:** Option **A** — factual correction; drop the no-op-build idea. (Considered and rejected: keeping the no-op build "just in case" — it is dead config and muddies C2.)

**User Decision:** ✅ Resolved — User accepted recommendation (fix applied to the plan docs).

---

## PF-005: `__JSVISION_VERSION__` needs an ambient declaration or `docs-site#typecheck` fails 🟡 MINOR

**Dimension:** 4 Completeness Gaps
**Location:** `03-02-demoshell.md` (site-meta.ts: `version: __JSVISION_VERSION__` via Vite `define`); `03-06` tsconfig `include`s `src/**`
**Codebase Evidence:** `packages/docs-site/.vitepress/config.ts` (a `vite.define` hook is where it would be injected); the plan's own new `tsconfig.json include: src/**` scope

**The Problem:** `site-meta.ts` references a build-time `define` global `__JSVISION_VERSION__`. The Vite `define` substitutes it at bundle time, but `tsc --noEmit` (the newly-added `docs-site#typecheck`, which includes `src/**`) sees an undeclared identifier and errors. The plan describes the `define` injection but not the required `declare const __JSVISION_VERSION__: string;` (an ambient `.d.ts` or an inline declaration).

**Options:** Single viable path.

| Option | Description |
|--------|-------------|
| A | Add an ambient declaration (`declare const __JSVISION_VERSION__: string;` in an `env.d.ts` included by the tsconfig, or read via `import.meta.env`-style typing) as part of task 2.2. |

**Recommendation:** Option **A** — add the ambient declaration alongside the `define`. Small omission, but it would break the typecheck gate this plan introduces.

**User Decision:** ✅ Resolved — User accepted recommendation (fix applied to the plan docs).

---

## PF-006: modal-subject examples' presentation through DemoShell is undefined 🟡 MINOR

**Dimension:** 4 Completeness Gaps · 6 Feasibility
**Location:** `03-02-demoshell.md` (normalization: "if `content` is a bare `View`, DemoShell … places the view"); `03-05` (`files/file-dialog`, `controls/form-dialog` — both modal `Dialog`s)
**Codebase Evidence:** `@jsvision/ui` Dialogs run modally via `loop.execView` (save/restore focus + the `valid()` close-gate + `endModal`); a bare-placed `Dialog` child has no modal stack — its `×`/Esc would `endModal` on an empty stack

**The Problem:** Two of the four **core** examples (`files/file-dialog`, `controls/form-dialog`) *are* modal Dialogs. DemoShell's normalization "places the view" as a static child, which renders but is **not** modal — no focus trap, no `valid()`-gate close, and the close box may act on an empty modal stack. The plan doesn't state how a demo whose subject is a modal Dialog is presented so it behaves correctly. (The contract *permits* `build()` to return an `Application` that opens the dialog via `execView` — so this is resolvable — but the convention is unstated, and it drives whether ST-7's live chrome and the AC-9 interaction actually work.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | State the convention: a modal-subject example's `build()` returns an `Application` that opens its Dialog via `execView` on start; DemoShell attaches menu/status around it. | Correct modal semantics; uses the existing seam; matches the `Application`-content branch. | Slightly more example boilerplate than returning a bare `View`. |
| B | Have DemoShell detect a `Dialog` view and `execView` it automatically. | Keeps example modules terse. | DemoShell special-cases a widget type; magic that's harder to follow than an explicit app. |

**Recommendation:** Option **A** — add a one-line authoring convention (modal subjects return an `Application` that `execView`s the dialog). Keeps DemoShell dumb and the seam explicit; make it a note in 03-02 + 03-05. B is viable but bakes widget-type magic into the shell.

**User Decision:** ✅ Resolved — User accepted recommendation (fix applied to the plan docs).

---

## PF-007: "check:deps 9/9" figure is stale/miscounted 🔵 OBSERVATION

**Dimension:** 13 Codebase Alignment (Stale figure)
**Location:** `99-execution-plan.md` task 6.3 ("`check:deps` still 9/9")
**Codebase Evidence:** Only **5** packages carry a `check:deps` script (`core`, `ui`, `web`, `files`, `theme-designer`); the "9/9" appears carried from the RD-02 roadmap note

**The Problem:** The "9/9" count doesn't correspond to the number of `check:deps` targets (5). The *substantive* claim — docs-site is private with only dev-deps, so it adds no `check:deps` target and the result is unaffected — is **correct**; only the number is off.

**Options:** Single trivial path.

| Option | Description |
|--------|-------------|
| A | Drop the specific count (or replace with "unchanged") in task 6.3; keep the substantive "docs-site dev-deps don't affect check:deps" claim. |

**Recommendation:** Option **A** — cosmetic; correct or drop the number.

**User Decision:** ✅ Resolved — User accepted recommendation (fix applied to the plan docs).

---

## Determination

**✅ PASSED — all 7 findings resolved.** The user accepted every recommendation and the fixes were
applied to the plan documents (PF-003 = Option A for RD-03 scope + Option D recorded as a follow-up
deferral in the register). No CRITICALs; the plan was otherwise strong (thorough register, accurate
seam citations, sound two-tier test strategy, good security coverage). Ready for
`exec-plan live-example-system`.

### Fixes applied (files touched)
- **PF-001** → `03-06` Tier-1 + `07` ST-2 / mechanism line + `02-current-state` + `00-index` + register AR-3: compose via `app.loop.renderRoot.buffer()`.
- **PF-002** → `03-03` `ColorDepth` (reuse `BrowserCapsOptions['colorDepth']`) + defaults + `03-02` `onDepthChange`: real caps union `'truecolor'|'256'|'16'|'mono'`.
- **PF-003** → `03-01` + `01` + `03-05` + `07` + `99` task 1.5: SSR/headless-safe rule; pure `createBrowserFileSystem` allow-listed; static scan scoped to `@xterm/*`+DOM; register deferral D added; `apps/desktop` re-author strips `buildBrowserCaps`.
- **PF-004** → `03-06` turbo ordering + `99` task 0.3: rely on existing `["build","^build"]`; no no-op build.
- **PF-005** → `03-02` site-meta + `99` task 2.2: ambient `declare const __JSVISION_VERSION__`.
- **PF-006** → `03-02` normalization + `03-05` authoring: modal subjects return an `Application` that `execView`s the dialog.
- **PF-007** → `99` task 6.3: dropped the stale "9/9".
