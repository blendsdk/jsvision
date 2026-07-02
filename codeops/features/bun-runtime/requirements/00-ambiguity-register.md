# Ambiguity Register: Bun Runtime Support Requirements

> **Status**: ✅ GATE PASSED — all 10 items resolved
> **Last Updated**: 2026-07-02
> **Feature-Set**: bun-runtime (`codeops/features/bun-runtime/`)
> **Scope**: the `add_requirement` session that produced RD-01 (Bun runtime support &
> self-contained executables). Decisions were made against a completed empirical analysis on this
> machine (Bun 1.3.14, Linux): all 1,105 unit tests green on the Bun runtime, interactive PTY
> verification of the full host lifecycle, and working `bun build --compile` binaries (Linux run +
> Windows cross-build).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|----------------|-------------------|---------------|--------|
| 1 | Scope / placement | Where does the Bun RD live? It spans `@jsvision/core`, examples, CI, and packaging — not a UI widget concern | New feature-set `bun-runtime` / append as jsvision-ui RD-14 | **New feature-set `codeops/features/bun-runtime/`, own RD-01** | ✅ Resolved |
| 2 | Scope / guarantee | Support tier — can a Bun regression block a merge? | First-class CI-gating / best-effort non-blocking lane / compile-target only | **First-class, CI-gating** — Bun lane failures block merge like the Node lanes | ✅ Resolved |
| 3 | Technical / CI | Bun CI matrix breadth (Node CI today: 3 OS × Node 20/22/24) | 3 OS × latest Bun / Linux-only / 3 OS + POSIX PTY e2e | **3 OS × latest Bun** — unit suites on Bun runtime + host-platform compile-smoke; Windows interactive-TTY verification stays a manual-matrix item | ✅ Resolved |
| 4 | Technical / testing | Automated acceptance gate for the compiled binary? | e2e + `yarn gate` criterion / e2e only / no automated gate | **Yes — PTY-driven compile e2e + a `yarn gate` criterion** (alt-screen enter/exit, cursor+mouse restore, rc 0) | ✅ Resolved |
| 5 | Technical / versioning | Supported Bun version policy (verified on 1.3.14) | Floor `>=1.3` + CI latest / pinned CI version / floor + pinned AND latest lanes | **Floor `>= 1.3`, CI always installs latest stable** | ✅ Resolved |
| 6 | Integration / packaging | Which surfaces declare Bun support? | engines.bun / README runtimes section / docs guide / CHANGELOG (multi-select) | **All four**: `engines.bun ">=1.3"` in the published packages, README "Supported runtimes" section, a `docs/guides/` shipping guide, CHANGELOG entry | ✅ Resolved |
| 7 | Feature / deliverable | Form of the "ship a self-contained executable" recipe | Docs recipe + dogfooded script / docs only / scaffold package | **Docs recipe + dogfooded script** — a real `compile:*` script target in examples that the compile e2e itself executes | ✅ Resolved |
| 8 | Scope / boundaries | Which residual items are IN scope? | Windows-on-Bun manual TTY verification / documented cross-compile target list / e2e suites on Bun runtime / Bun-native optimizations (multi-select) | **All four in scope** (Bun-native shaped by AR-9) | ✅ Resolved |
| 9 | Technical / architecture | Shape of "Bun-native optimizations" given the zero-native-deps guard + single-codebase philosophy | Benchmarked spike first / guarded fast paths now / full adoption incl. `bun:ffi` + Bun test runner | **Benchmarked spike first** — investigate `Bun.stdin`/`Bun.write`-class fast paths via the bench; adopt only pure-JS, runtime-detected, behavior-identical paths that clear the AR-10 bar; `bun:ffi` and the Bun test runner stay OUT | ✅ Resolved |
| 10 | Non-functional / target | Adoption bar for a Bun fast path (spike acceptance must be measurable) | ≥20% / ≥10% / ≥50% median bench improvement | **≥ 20% median improvement** on the relevant bench on Bun, with no Node regression; below the bar the numbers are recorded and the path is NOT adopted | ✅ Resolved |

## Resolution Notes

**AR-1:** RD ids are per-feature (`codeops/.codeops.yml` `rdIdScope=per-feature`), so this set starts
at `bun-runtime/RD-01`. Cross-feature references are feature-qualified.

**AR-2 / AR-3:** The Bun lane installs dependencies with **yarn** (frozen lockfile) exactly like the
Node lanes — Bun is adopted as a *runtime*, not as a package manager. "Latest stable Bun" via the
pinned-by-SHA `oven-sh/setup-bun` action.

**AR-4:** The PTY-driven e2e runs where a PTY can be allocated with OS tooling (POSIX); Windows
interactive verification is the AR-8 manual-matrix item. Empirical basis: the identical assertions
were executed and passed on this machine on 2026-07-02 (Bun 1.3.14) for both `bun <entry>` and the
compiled binary.

**AR-5:** Floor = the empirically verified line (1.3.14 → declared `>= 1.3`). A future Bun release
that breaks the lane is triaged: our defect → fix; Bun defect → report upstream + document the
temporary exclusion in the README runtimes section.

**AR-8:** "E2E suites on Bun runtime" = the existing child-process e2e harnesses (which spawn
`tsx`/Node children) gain a parameterized Bun-children variant. "Windows-on-Bun manual TTY
verification" = a checklist + recorded-result slot in the manual matrix (CI cannot drive ConPTY
interactively).

**AR-9/AR-10:** The spike extends the existing `bench/frame-bench.mjs` methodology (median/p95) run
under Bun, plus an input-throughput measure. Any adopted fast path must be pure JS, runtime-detected
(never a build fork), behaviorally identical (same bytes out), keep the Node path canonical, and
clear ≥20% median improvement with no Node regression.
