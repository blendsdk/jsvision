# RD-01: Bun Runtime Support & Self-Contained Executables

> **Document**: RD-01-bun-runtime-support.md
> **Status**: Draft
> **Created**: 2026-07-02
> **Project**: jsvision (`@jsvision/core` + `@jsvision/ui` + `@jsvision/examples`)
> **Feature-Set**: bun-runtime
> **Depends On**: the archived **foundation** feature-set (`@jsvision/core` RD-01…RD-10, notably
> RD-07 host & lifecycle and RD-09 testing/gate) and **jsvision-ui** RD-01…RD-07/RD-10/RD-11 (all
> shipped). No open RD blocks this one; it layers guarantees over already-shipped code.
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.1.0

---

## Feature Overview

Make **Bun a first-class, CI-guaranteed runtime** for jsvision, and make **shipping a TUI
application as a single self-contained executable** (via `bun build --compile`, the same mechanism
Claude Code uses) a documented, continuously verified capability.

This RD adds **no compatibility fixes — none are needed**. An empirical analysis on 2026-07-02
(Bun 1.3.14, Linux) established that the entire stack already runs on Bun unmodified:

| Verified on 2026-07-02 (Bun 1.3.14) | Result |
|---|---|
| All unit suites executed **on the Bun runtime** (`bun --bun vitest run --project unit`) | **1,105 / 1,105 pass** (core 538 · ui 500 · examples 67, incl. every kitchen-sink smoke) |
| All 6 headless demos + built `dist` import | rc 0, output identical to Node |
| Interactive `tvision-demo` under a real PTY | raw mode, alt-screen (`?1049h/l`), cursor (`?25l/h`), SGR mouse on/off, truecolor paint, Alt-X decoded, full restore, rc 0 |
| `bun build --compile` → self-contained Linux binary (95 modules, ~91 MB) driven under a PTY | behavior byte-equivalent to the interpreted run |
| Cross-compile `--target=bun-windows-x64` from Linux | builds (~95 MB `.exe`); **not executed** — no Windows hardware available |
| Real PTY resize (`TIOCSWINSZ` + SIGWINCH) | `stdout` `resize` event fires with new size — identical to Node |
| Self-`SIGSTOP` suspend + `SIGCONT` resume (the `signals.ts` suspend path) | child stops (state `T`), resumes, handler runs |
| `/dev/tty` `openSync` + `new tty.ReadStream/WriteStream(fd)` + `setRawMode` (`host/streams.ts:14-15`) | works |
| `fs.writeSync` inside `process.on('exit')` (the restore backstop, `host/platform.ts:146-156`) | works |
| Capability probe `--auto` (terminal-query round-trip + `timeoutMs` fallback) | rc 0, report written |
| `@xterm/headless` CJS interop (golden-screen test dependency) | clean |

The code audit explains why: the runtime surface is deliberately small — `node:tty`/`node:fs` in
exactly three core files (`host/streams.ts`, `host/platform.ts`, `safety/logger.ts`), everything
else behind the injectable `RuntimeAdapter` seam (`host/platform.ts:81-165`), zero native
dependencies (enforced by `check:deps`). Bun implements every touched API compatibly.

**The gap is that this compatibility is accidental, not guaranteed.** Nothing in CI runs Bun, so any
future change could silently break it; no version of Bun is officially supported; no consumer-facing
surface says Bun works; and the compile-to-binary story exists only as an experiment on one dev box.
This RD converts "happens to work" into "guaranteed to work": a merge-blocking Bun CI lane, a
supported-version policy, packaging/docs declarations, a dogfooded shipping recipe with an automated
PTY-driven acceptance gate, Bun-children e2e coverage, a Windows manual-verification protocol, and a
benchmarked (not speculative) decision on Bun-native fast paths.

---

## Functional Requirements

### Must Have

- [ ] **FR-1 — Merge-blocking Bun CI lane.** `.github/workflows/ci.yml` gains a Bun lane:
      3 OS (`ubuntu-latest`, `macos-latest`, `windows-latest`) × **latest stable Bun** (installed
      via `oven-sh/setup-bun` pinned by SHA). Each job: `yarn install --frozen-lockfile` (yarn stays
      the package manager — Bun is a runtime only), then runs each package's **unit** suite on the
      Bun runtime (`bun --bun <vitest> run --project unit` per package, or an equivalent
      package-script wrapper). Lane failures block merge exactly like the Node lanes.
      *(AR-2, AR-3, AR-5)*
- [ ] **FR-2 — Compile-smoke per OS.** Each Bun CI job compiles a headless demo
      (`controls-demo` — no TTY required) with `bun build --compile` for the **host** platform and
      executes the resulting binary, asserting rc 0 and the demo's final "Done —" line on stdout.
      This proves compile + execute on every supported OS, including Windows (non-TTY). *(AR-3)*
- [ ] **FR-3 — Cross-compile build verification.** One Linux CI step builds **all five documented
      targets** (FR-9) of the same demo with `bun build --compile --target=<t>`, asserting each
      build exits 0 and produces a non-empty artifact. Non-host targets are build-verified only —
      they are not executed in CI. *(AR-8)*
- [ ] **FR-4 — PTY-driven compiled-binary acceptance e2e.** A new e2e test in
      `packages/examples/test/` (vitest `e2e` project) that: runs the FR-7 compile script to build
      the **interactive** `tvision-demo` binary; allocates a real PTY using OS-provided tooling
      only (no new npm dependencies — ADR-004's no-`node-pty` rule stands); drives the binary
      (boot → paint → Alt-X quit); and asserts, on the captured byte stream: alt-screen enter
      (`\x1b[?1049h`) and leave (`\x1b[?1049l`), cursor hide (`\x1b[?25l`) and show (`\x1b[?25h`),
      SGR mouse enable and disable (`\x1b[?1006h` / `l`), at least one SGR color sequence (proof of
      paint), and exit code 0. Runs on POSIX (Linux/macOS); on Windows it is skipped (covered by
      FR-2 non-TTY smoke + FR-10 manual verification). *(AR-4)*
- [ ] **FR-5 — `yarn gate` criterion.** `scripts/gate.mjs` gains a "Bun self-contained executable"
      criterion that executes the FR-4 e2e (PASS/FAIL; SKIPPED with reason when `bun` is not on
      PATH), and `docs/acceptance-gate.md` gains the corresponding criterion→evidence row. *(AR-4)*
- [ ] **FR-6 — E2E suites on the Bun runtime.** The existing child-process e2e harnesses (core
      `host-signals.e2e` / `host-tier3.e2e` / `install.e2e`; examples `probe.e2e` + demo e2es),
      which today spawn `tsx`/Node children, are parameterized over a child runtime so the same
      scenarios also run with **Bun-spawned children** (`bun <entry>` replacing `tsx <entry>`).
      The Bun variant runs in the Bun CI lane on POSIX; scenario oracles (restore-on-every-exit-path,
      signal exit codes 130/143/129, suspend/resume) are unchanged — only the child runtime varies.
      *(AR-8)*
- [ ] **FR-7 — Dogfooded compile script.** `packages/examples` gains a script target (e.g.
      `compile:tvision`) that runs `bun build --compile` on `tvision-demo/main.ts` with the exact
      documented flags and emits the binary to a gitignored output path. This script is the single
      source of truth for the recipe: FR-4's e2e invokes it, and the FR-8 guide quotes it. *(AR-7)*
- [ ] **FR-8 — Packaging & docs declarations.** *(AR-5, AR-6)*
      - `engines` of the **published** packages (`@jsvision/core`; `@jsvision/ui` when it goes
        public) gains `"bun": ">= 1.3"` alongside `"node": ">= 20"`.
      - The root README "Versioning & stability" area gains a **"Supported runtimes"** section:
        Node 20/22/24 (LTS) and Bun ≥ 1.3; what is guaranteed on each (full engine + UI + compile
        target on Bun); how Bun-breakage triage works (our defect → fix; Bun defect → upstream
        report + documented temporary exclusion).
      - A new `docs/guides/` page (VitePress-compatible, linked from `docs/index.md`): running
        jsvision apps on Bun + the full self-contained-executable shipping recipe — the FR-7
        command, the FR-9 target list, artifact size expectations (~90–100 MB: the Bun runtime is
        embedded), and caveats (unsigned binaries; source is embedded — see Security).
      - A `CHANGELOG.md` entry recording the support declaration, per the API-governance policy.
- [ ] **FR-9 — Documented cross-compile target list.** The FR-8 guide documents the officially
      supported `--target` list: `bun-linux-x64`, `bun-linux-arm64`, `bun-darwin-x64`,
      `bun-darwin-arm64`, `bun-windows-x64`. Support level per target: host platforms are
      execute-verified in CI (FR-2/FR-4); the rest are build-verified (FR-3). *(AR-8)*
- [ ] **FR-10 — Windows-on-Bun manual TTY verification.** A manual-verification checklist (same
      protocol family as the foundation's terminal matrix): on real Windows hardware, run the FR-7
      compiled `.exe` in Windows Terminal and verify raw-mode input, alt-screen enter/leave, mouse,
      resize, Ctrl-C exit code, and terminal restore. The checklist ships with this RD and carries a
      recorded-result slot (terminal, Windows version, Bun version, date, per-item PASS/FAIL);
      executing it requires Windows hardware and is the release-note precondition for advertising
      Windows binaries as verified. *(AR-3, AR-8)*

### Should Have

- [ ] **FR-11 — Benchmarked Bun-native spike.** *(AR-9, AR-10)*
      - Extend the bench methodology (`bench/frame-bench.mjs` median/p95) to run under Bun and add
        an input-throughput measure (bytes → decoded events/sec through `decode`).
      - Record Node-vs-Bun baseline numbers, then prototype candidate pure-JS fast paths (e.g.
        `Bun.stdin` / `Bun.write`-class I/O in the host adapter seam) and measure.
      - **Adoption bar**: a fast path ships only if it improves the relevant bench median by
        **≥ 20% on Bun** with **no regression on Node**, is pure JS, **runtime-detected** (never a
        build fork), and behaviorally identical (same bytes out, verified by the golden tests).
        Below the bar: the numbers are recorded in the plan/ADR and the path is **not** adopted.
      - `bun:ffi` and the Bun test runner are excluded outright (see Won't Have).
- [ ] **FR-12 — Bench-on-Bun visibility.** `yarn bench` is runnable under Bun and the FR-8 guide
      states the observed compose+diff numbers per runtime (informational, never gating — consistent
      with ADR-006).

### Won't Have (Out of Scope)

- **`bun:ffi` / native code paths** — violates the zero-native-deps guard (`check:deps`) and its
  philosophy; excluded by AR-9.
- **Bun test runner adoption** — vitest remains the single test story on both runtimes; a second
  runner forks the test infrastructure for no demonstrated gain (AR-9).
- **Bun as package manager / `bun.lock`** — yarn 1.x + `yarn.lock` remain canonical; the CI lane
  installs with yarn (AR-2/AR-3 resolution note).
- **Binary code-signing / notarization** — shipped binaries are unsigned; signing is a distribution
  concern for app authors, documented as a caveat in the FR-8 guide, not solved here.
- **Automated Windows interactive-TTY CI** — ConPTY cannot be driven by the no-new-deps constraint
  in CI; covered by FR-2 (non-TTY smoke) + FR-10 (manual protocol).
- **Bun canary/nightly support** — only stable releases; a canary regression is not a lane failure.
- **Deno or other runtimes** — out of scope for this RD entirely.

---

## Technical Requirements

### T-1 CI lane shape (FR-1…FR-3)

- New matrix job family in `.github/workflows/ci.yml`, e.g. `bun (ubuntu-latest)`, `bun
  (macos-latest)`, `bun (windows-latest)`:
  1. checkout → Node setup (yarn needs it) → `oven-sh/setup-bun@<pinned-SHA>` with
     `bun-version: latest`.
  2. `yarn install --frozen-lockfile` → `yarn build` (tsc; the suites and demos import built
     workspace deps by name).
  3. Per package `core`, `ui`, `examples`: run the unit project on the Bun runtime. The verified
     invocation shape is `bun --bun node_modules/.bin/vitest run --project unit` from the package
     dir; wrap it as a package script (e.g. `test:bun`) so CI and local runs share one entry point.
  4. Compile-smoke (FR-2): `bun build --compile packages/examples/controls-demo/main.ts --outfile
     <tmp>/controls-demo` → execute → assert rc 0 + final stdout line.
  5. ubuntu only (FR-3): loop the five FR-9 targets with `--target=<t>`, assert build rc 0 +
     artifact exists and is non-empty.
- The lane is listed in the repo's required status checks (merge-blocking, AR-2).

### T-2 PTY e2e mechanism (FR-4)

- Constraint: **no new npm dependencies** (ADR-004 stands — no `node-pty`). The PTY is allocated
  with OS-provided tooling; the plan chooses the mechanism per OS (viable, verified options:
  util-linux `script -qec` on Linux, BSD `script -q /dev/null` on macOS, or `python3`'s stdlib
  `pty`+`fcntl` module as used in the 2026-07-02 verification). The e2e skips itself with a clear
  reason if the chosen tool is absent.
- Test flow: FR-7 script builds the binary → spawn under the PTY at a fixed size (e.g. 100×30,
  `TERM=xterm-256color`) → drain ≥ 2 s of output → write `\x1bx` (Alt-X) → drain → assert the FR-4
  byte-stream oracles + rc 0 within a generous timeout (compile ~1 s + boot; budget ≥ 60 s in CI).
- Lives in the vitest `e2e` project (`*.e2e.test.ts`, single-fork), consistent with the existing
  demo e2es.

### T-3 Bun-children e2e parameterization (FR-6)

- The e2e helpers that today build a `tsx <entry>` spawn command gain a runtime dimension:
  `{ node: ['<tsx>', entry], bun: ['bun', entry] }`. Scenario bodies and oracles are shared;
  `describe.each`-style expansion or an env switch (`TUI_E2E_RUNTIME=bun`) selects the variant —
  plan-time choice. The Bun variant is skipped when `bun` is not on PATH, so plain `yarn test:e2e`
  on a Bun-less box stays green.

### T-4 Version policy mechanics (FR-8, AR-5)

- Declared floor `>= 1.3` (empirically verified line: 1.3.14). CI tracks latest stable, so a
  breaking Bun release surfaces within days; triage per the README policy (our defect → fix;
  Bun defect → upstream issue + documented temporary exclusion + optional temporary CI pin, removed
  when fixed upstream).
- `engines` is advisory (informative for consumers); no `engine-strict` enforcement.

### T-5 Spike methodology (FR-11)

- Baselines first: `frame-bench.mjs` (200×50 compose+diff median/p95) on Node and on Bun, plus the
  new input-throughput measure, all on the same box, recorded in the plan.
- Candidate fast paths are prototyped **behind the existing `RuntimeAdapter`/stream seams**
  (`host/platform.ts`, `host/streams.ts`) — runtime-detected via feature detection (e.g.
  `typeof Bun !== 'undefined'`), never a separate build artifact.
- Behavioral equivalence is proven by the existing golden-screen suite running against the fast
  path (same bytes out at all four color depths).

### T-6 Empirical anchors (what the 2026-07-02 analysis pins down)

For plan-time reference, the verified facts this RD's guarantees rest on:

- Runtime API surface (audit): `node:tty` `ReadStream`/`WriteStream` + `setRawMode`; `node:fs`
  `openSync`/`closeSync`/`writeSync` (incl. `/dev/tty` and the `process.on('exit')` restore
  backstop); signals `SIGWINCH`/`SIGTSTP`/`SIGCONT`/`SIGINT`/`SIGTERM`/`SIGHUP` +
  `process.kill(pid,'SIGSTOP')`; `process.on('exit'|'uncaughtException'|'unhandledRejection')`;
  `setImmediate`/`setTimeout`; `Buffer`/`TextEncoder`/`TextDecoder`; `queueMicrotask`. All verified
  working on Bun 1.3.14.
- Known benign divergence: on **non-TTY pipe** stdio under Bun, `process.stdin.ref/unref` are
  `undefined` (present on real TTYs and in Node). The host does not call them; no action needed —
  recorded so a future host change doesn't reintroduce a dependency on them unguarded.
- `bun build --compile` bundles the TS sources directly (no tsc step needed for the binary) and
  resolves yarn-workspace deps by name; ~91 MB (Linux) / ~95 MB (Windows) per binary.

---

## Integration Points

### With the foundation feature-set (`@jsvision/core`, archived)

- FR-4/FR-6 reuse the RD-07 host restore oracles (restore-on-every-exit-path, signal exit codes)
  and the RD-09 gate machinery (`scripts/gate.mjs`, `docs/acceptance-gate.md`).
- FR-11 prototypes strictly behind the RD-07 `RuntimeAdapter` seam — no public API change.
- FR-2's smoke reuses the RD-09-style demo-run assertion pattern (final stdout line + rc 0).

### With jsvision-ui (RD-01…RD-11)

- The compile target (`tvision-demo`) exercises the full UI stack (app shell, desktop, menus,
  status line, controls) — no UI code changes; the UI set is a consumer of this guarantee.

### With the kitchen-sink showcase

- No new visual component ships in this RD, so no new story is required (per the kitchen-sink
  gate's scope rule). The FR-8 guide links `demo:kitchen` as the thing readers can compile.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| RD placement | new feature-set / jsvision-ui RD-14 | new feature-set `bun-runtime` | cross-package concern (core+examples+CI+packaging), not a widget | AR #1 |
| Support tier | first-class gating / best-effort / compile-only | first-class, merge-blocking | user ships binaries; a silent Bun regression defeats the point | AR #2 |
| CI matrix | 3 OS latest / linux-only / 3 OS + POSIX PTY e2e | 3 OS × latest Bun (+ PTY e2e via AR #4 on POSIX) | Windows gets automated non-TTY coverage; interactive Windows is manual | AR #3 |
| Binary gate | e2e + gate criterion / e2e only / none | e2e + `yarn gate` criterion | shipping story continuously proven | AR #4 |
| Version policy | floor + CI latest / pinned / both lanes | floor `>=1.3`, CI latest | catches Bun drift within days, no pin chore | AR #5 |
| Packaging surface | engines / README / docs / CHANGELOG | all four | consumer-visible, versioned, governed | AR #6 |
| Recipe form | docs + dogfooded script / docs only / scaffold pkg | docs + dogfooded script | executable docs can't rot; scaffold premature pre-publish | AR #7 |
| Residual scope | Windows manual / target list / Bun-children e2e / Bun-native | all four in scope | user chose maximal strictness | AR #8 |
| Bun-native shape | spike first / fast paths now / full incl. ffi+test runner | benchmarked spike first | evidence before a permanent second codepath; ffi/test-runner excluded | AR #9 |
| Spike adoption bar | ≥10% / ≥20% / ≥50% | ≥20% median, no Node regression | a second I/O path must pay real rent | AR #10 |

---

## Security Considerations

- **Supply chain (CI)**: `oven-sh/setup-bun` is pinned by commit SHA (not a floating tag), same as
  the repo's other actions; `bun-version: latest` fetches only official release artifacts. No new
  npm dependencies are introduced anywhere in this RD (FR-4's PTY uses OS tooling), so the
  `check:deps` guard and audit surface are unchanged.
- **Compiled-binary contents**: `bun build --compile` **embeds the bundled JS source** in the
  executable — it is extractable and must be treated as distributed source. The FR-8 guide states
  this explicitly and warns app authors never to embed secrets/credentials in compiled apps (env
  vars / OS keychains at runtime instead). jsvision itself embeds none.
- **Unsigned artifacts**: produced binaries carry no code signature; the guide documents that
  SmartScreen/Gatekeeper warnings are expected and signing is the distributor's responsibility
  (Won't Have).
- **Input validation / injection**: no new input surface — the RD reuses the engine's existing
  canonical `sanitize` boundary (RD-08 foundation); the FR-4 e2e asserts the *restore* sequences,
  which is itself the safety property (no stuck raw-mode terminal). FR-6 extends the existing
  security-relevant restore/signal oracles to the Bun runtime — a net security-coverage gain.
- **Data sensitivity / auth / rate limiting / encryption**: N/A — no network endpoints, no stored
  data, no credentials anywhere in this RD.

---

## Acceptance Criteria

1. [ ] CI on `master` shows three **required** Bun jobs (ubuntu, macos, windows); each installs
   latest stable Bun via SHA-pinned `oven-sh/setup-bun`, installs with
   `yarn install --frozen-lockfile`, and passes the `core`, `ui`, and `examples` unit projects on
   the Bun runtime (1,105+ tests at time of writing). A deliberately introduced Bun-only failure
   (e.g. a `typeof Bun !== 'undefined'` throw) turns the lane red and blocks merge.
2. [ ] Each Bun CI job compiles `controls-demo` with `bun build --compile` for its host platform
   and executes the binary: exit code 0 and stdout containing the demo's final `Done —` line —
   on all three OSes, including Windows.
3. [ ] The ubuntu job builds all five targets `bun-linux-x64`, `bun-linux-arm64`,
   `bun-darwin-x64`, `bun-darwin-arm64`, `bun-windows-x64`; each build exits 0 and produces an
   artifact > 50 MB (runtime-embedded sanity floor).
4. [ ] `yarn workspace @jsvision/examples compile:tvision` (final name per plan) produces a
   self-contained binary from `tvision-demo/main.ts` with no tsc pre-step and no arguments needed.
5. [ ] The PTY e2e passes on Linux and macOS: it builds via the criterion-4 script, drives the
   binary under a real PTY (fixed size, `TERM=xterm-256color`), sends Alt-X, and asserts ALL of:
   `\x1b[?1049h` and `\x1b[?1049l` present, `\x1b[?25l` and `\x1b[?25h` present, `\x1b[?1006h` and
   (`\x1b[?1006l` or `\x1b[?1002l`) present, ≥ 1 SGR color sequence present, exit code 0. On a box
   without the PTY tool or without `bun`, it reports SKIPPED with a reason — never a false PASS.
6. [ ] `yarn gate` output contains a "Bun self-contained executable" criterion whose PASS is backed
   by criterion 5's e2e, and `docs/acceptance-gate.md` maps the criterion to its evidence.
7. [ ] Every existing child-process e2e scenario (core restore/signals/install, examples demos +
   probe) has a Bun-children variant that passes on POSIX with unchanged oracles (exit codes
   130/143/129, restore-on-every-exit-path bytes, suspend/resume) — and the Bun variants
   self-skip (not fail) when `bun` is absent.
8. [ ] `packages/core/package.json` `engines` contains both `"node": ">= 20"` and
   `"bun": ">= 1.3"` (and `@jsvision/ui`'s does when it is published); `yarn verify` and the
   packaging spec tests stay green.
9. [ ] The README has a "Supported runtimes" section naming Node 20/22/24 and Bun ≥ 1.3 with the
   per-runtime guarantee and the breakage-triage policy; `docs/guides/` has the shipping guide
   (recipe = criterion-4 command, the five targets, size expectation, embedded-source + unsigned
   caveats); `CHANGELOG.md` records the declaration.
10. [ ] The Windows manual-verification checklist exists with the specified items (raw mode,
    alt-screen, mouse, resize, Ctrl-C exit code, restore) and a recorded-result slot (terminal,
    Windows version, Bun version, date, per-item PASS/FAIL); the FR-8 guide states Windows binaries
    are "build- and smoke-verified; interactive verification per checklist" until a recorded PASS
    exists.
11. [ ] (Should) The spike report exists with Node-vs-Bun bench baselines (compose+diff median/p95
    + input throughput); any adopted fast path demonstrably clears ≥ 20% median improvement on Bun
    with no Node regression, is pure JS + runtime-detected, and passes the golden-screen suite
    unchanged; if nothing clears the bar, the report says so and no fast path ships.
12. [ ] Security requirements verified: SHA-pinned setup action, zero new dependencies
    (`check:deps` green), guide contains the embedded-source and unsigned-binary warnings, and the
    Bun-children restore/signal e2es (criterion 7) pass — the terminal-restore safety property
    holds on Bun.
