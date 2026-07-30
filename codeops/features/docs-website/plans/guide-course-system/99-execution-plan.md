# Execution Plan: Guide Course System

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-30 12:50
> **Progress**: 136/246 tasks (55%)
> **CodeOps Artifact Schema**: 1

## Overview

Complete all 29 Guide routes in prerequisite order, validate the two specialist course boundaries,
and finish with curriculum-wide documentation and repository verification. Every route is an
independent specification-first phase (AR-10).

**🚨 Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Tasks |
|---:|---|---:|
| 1 | Introduction | 8 |
| 2 | Install & packages | 8 |
| 3 | Layout pilot re-audit | 8 |
| 4 | Reactive state pilot re-audit | 8 |
| 5 | Codex plugin | 8 |
| 6 | Views & focus | 8 |
| 7 | Events, commands & keymaps | 8 |
| 8 | Keyboard & clipboard | 8 |
| 9 | Text, Unicode & terminal cells | 8 |
| 10 | Scrolling, lists & large content | 8 |
| 11 | The application shell | 8 |
| 12 | Dialogs & modality | 8 |
| 13 | Async work, cancellation & progress | 8 |
| 14 | Forms | 8 |
| 15 | Files & the FileSystem seam | 8 |
| 16 | Internationalization | 8 |
| 17 | Screens & routing | 8 |
| 18 | Theming & colour depth | 8 |
| 19 | Running in the browser | 8 |
| 20 | Writing your own widget | 8 |
| 21 | Testing headlessly | 8 |
| 22 | Application architecture & best practices | 8 |
| 23 | Debugging | 8 |
| 24 | Crash safety & terminal restore | 8 |
| 25 | Displaying untrusted text safely | 8 |
| 26 | Accessibility & resilient interaction | 8 |
| 27 | Terminal capabilities & portability | 8 |
| 28 | In production | 8 |
| 29 | Build a complete application | 8 |
| 30 | Specialist-course boundary | 6 |
| 31 | Curriculum integration | 8 |

**Total: 246 tasks across 31 phases.**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once. The executing agent MUST:
>
> 1. On implementation, mark the task `[~]` with
>    `⏳ (implemented: YYYY-MM-DD HH:MM)`.
> 2. On verification pass, promote it to `[x]` with
>    `✅ (completed: YYYY-MM-DD HH:MM)`.
> 3. Update the Progress and Last Updated headers after every task. Only `[x]` counts complete.
> 4. Resume at the first `[~]` task, otherwise the first `[ ]` task.
>
> Obtain timestamps with `date '+%Y-%m-%d %H:%M'`. Never invent them.

## Phase 1: Introduction

**Reference**: ST-10 · `03-02` · `03-03` · AR-5

> **Phase baseline tree**: `ce341905ce1834bda4f43cbfaab9f903e2162924`
>
> **Expected modification set**: `packages/docs-site/guide/index.md`,
> `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/introduction/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/test/introduction-guide.spec.test.ts`,
> `packages/docs-site/test/introduction-guide.impl.test.ts`,
> `packages/docs-site/test/guide-catalog.spec.test.ts` (mechanical complete-stage allowlist), this
> execution plan, and the docs-website roadmap/traceability evidence required by the execution
> protocol.

### Step 1.1: Specification tests

- [x] 1.1.1 [spec-author] Write the Introduction course oracle — `packages/docs-site/test/introduction-guide.spec.test.ts` ✅ (completed: 2026-07-29 21:04)
- [x] 1.1.2 Run the Introduction specification and record the expected red result (or justify a pre-existing pass) ✅ (completed: 2026-07-29 21:04) — authoritative focused run: 5 failed, 1 pre-existing next-course link assertion passed; commit deferred to the green 1.2.4 checkpoint per runtime AR-13

### Step 1.2: Implementation

- [x] 1.2.1 Upgrade audience, runtime mental model, first result, failures, and next steps — `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-29 21:08)
- [x] 1.2.2 Implement or adapt the one objective-matched template1 lab — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/introduction/` ✅ (completed: 2026-07-29 21:11)
- [x] 1.2.3 Register the lab and synchronize catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-29 21:11)
- [x] 1.2.4 Run ST-10 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-29 21:16) — 6/6 focused specification tests, docs-site typecheck, and authoritative `yarn verify` passed

### Step 1.3: Hardening

- [x] 1.3.1 Add route/lab edge coverage — `packages/docs-site/test/introduction-guide.impl.test.ts` ✅ (completed: 2026-07-29 21:22) — 4/4 focused implementation tests and authoritative `yarn verify` passed
- [x] 1.3.2 Run focused checks, promote Introduction to Complete, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-29 21:28) — 17/17 focused course/catalog tests, docs-site typecheck, and authoritative `yarn verify` passed

**Verify**: Introduction spec/impl tests and `yarn workspace @jsvision/docs-site typecheck`

**Phase quality review**:

- Independent correctness review found two Major issues and one Minor issue: inaccurate visible
  status-chord teaching, incomplete completion-oracle coverage, and a misleading practice prompt.
- Auto-design AR-16 selected the required technical corrections; no finding was waived. Security
  and performance auditors were explicitly skipped because the phase changes only documentation,
  documentation examples, and their headless tests, with no privileged input or
  performance-critical path.
- The correction passes 19/19 focused course/catalog tests, docs-site typecheck, and authoritative
  `yarn verify`.
- The one permitted fix-scoped re-review cleared the chord, destination, content, restore, cleanup,
  and practice corrections but retained one Major because a terminal viewport resize does not
  resize a compact dialog. The final correction now drives the real window-manager SE-grip path to
  an intermediate size and verifies shared padding, frame, Classic surface, unclipped content,
  maximize, and restore evidence. A third review is prohibited; focused and authoritative gates are
  the closing evidence. The final state passes 19/19 focused tests, docs-site typecheck, and
  authoritative `yarn verify`; Phase 1 is complete.
- Techdocs was not invoked because the phase changed consumer teaching, docs examples, and test
  evidence without changing architecture, public APIs, integrations, data entities, or
  infrastructure.

## Phase 2: Install & packages

**Reference**: ST-11 · `03-02 §Authentic Substitutes` · AR-5

> **Phase baseline tree**: `b9ac50d2e48d19b539aaa753df9da6ff2226aaf7`
>
> **Expected modification set**: `packages/docs-site/guide/install-and-packages.md`,
> `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`,
> `packages/docs-site/test/install-and-packages-guide.spec.test.ts`,
> `packages/docs-site/test/install-and-packages-guide.impl.test.ts`,
> `packages/docs-site/test/guide-catalog.spec.test.ts` (mechanical complete-stage allowlist), this
> execution plan, `scripts/jsvision-doctor.d.mts` (type declaration for authentic doctor evidence),
> the ambiguity register, and docs-website roadmap/traceability evidence required by the execution
> protocol.

### Step 2.1: Specification tests

- [x] 2.1.1 [spec-author] Write the installation/package-selection oracle — `packages/docs-site/test/install-and-packages-guide.spec.test.ts` ✅ (completed: 2026-07-29 21:54)
- [x] 2.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-29 21:54) — authoritative focused run: 7 failed, 1 public-export validation case passed; commit deferred to the green 2.2.4 checkpoint per runtime AR-17

### Step 2.2: Implementation

- [x] 2.2.1 Upgrade package choice, Node 22+ ESM setup, public imports, and diagnosis — `packages/docs-site/guide/install-and-packages.md` ✅ (completed: 2026-07-29 21:57)
- [x] 2.2.2 Bind the zero-lab substitute to real manifests, exports, and doctor/module-resolution evidence — `packages/docs-site/guide/install-and-packages.md` ✅ (completed: 2026-07-29 21:57)
- [x] 2.2.3 Revalidate the catalog exception and evidence metadata without promoting the stage — `packages/docs-site/guides.json` ✅ (completed: 2026-07-29 21:57) — existing zero-lab exception remains accurate and the 8/8 green oracle verifies its evidence contract
- [x] 2.2.4 Run ST-11 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-29 22:01) — 8/8 focused specification tests, docs-site typecheck, and authoritative `yarn verify` passed

### Step 2.3: Hardening

- [x] 2.3.1 Add package-matrix, stale-version, and invalid-import coverage — `packages/docs-site/test/install-and-packages-guide.impl.test.ts` ✅ (completed: 2026-07-29 22:09) — 11/11 focused specification and implementation tests plus authoritative `yarn verify` passed
- [x] 2.3.2 Run focused checks, promote Install & packages, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-29 22:14) — promoted after 18/18 focused course/catalog tests, docs-site typecheck, and authoritative `yarn verify` passed

**Verify**: Install spec/impl tests and docs-site typecheck

**Phase quality review**:

- Independent correctness review found two Major issues and one Minor issue: the zero-lab
  substitute did not execute the compiler, the CommonJS failure name contradicted the import-only
  export map on Node 22, and the engine row overstated default package-manager rejection.
- Auto-design AR-18 selected every technical correction; no finding was waived. The course now
  compiles a bounded NodeNext consumer through the real TypeScript CLI, proves invalid-subpath and
  missing-extension failures, probes the actual CommonJS root failure, and distinguishes engine
  warnings from strict-policy rejection.
- The correction passes 18/18 focused course/catalog tests, docs-site typecheck, and authoritative
  `yarn verify`. The one permitted fix-scoped re-review cleared all three findings with no remaining
  Critical, Major, or Minor finding in scope.
- Security and performance auditors were explicitly skipped because the phase changes consumer
  documentation, read-only manifest/compiler validation, and declaration alignment without a
  privileged-input boundary or performance-critical runtime path.
- Techdocs was not invoked because the phase changes consumer setup teaching and validation
  evidence without changing architecture, public APIs, integrations, data entities, or
  infrastructure.

## Phase 3: Layout pilot re-audit

**Reference**: ST-12 · `03-02` · `03-03`

> **Phase baseline tree**: `ea4073e65404fe5663226a3000eb56adc1b7a69d`
>
> **Expected modification set**: `packages/docs-site/guide/layout.md`,
> `packages/docs-site/examples/guides/layout-flow.ts`,
> `packages/docs-site/examples/guides/layout-overlays.ts`,
> `packages/docs-site/src/example-fixtures/layout/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/test/layout-guide.spec.test.ts`,
> `packages/docs-site/test/layout-guide.impl.test.ts`, this execution plan, the ambiguity register,
> and docs-website roadmap/traceability evidence required by the execution protocol.

### Step 3.1: Specification tests

- [x] 3.1.1 [spec-author] Reconcile the existing Layout oracle with the final contract — `packages/docs-site/test/layout-guide.spec.test.ts` ✅ (completed: 2026-07-29 22:27)
- [x] 3.1.2 Run the specification and record red gaps or justify a complete pre-existing pass ✅ (completed: 2026-07-29 22:27) — expected red: 9 passed, 3 failed for prerequisite/backbone/diagnostic gaps and a corner-layer settle assertion; commit deferred to the green 3.2.4 checkpoint per runtime AR-19

### Step 3.2: Implementation

- [x] 3.2.1 Correct any content, snippet, failure, practice, or link gaps — `packages/docs-site/guide/layout.md` ✅ (completed: 2026-07-29 22:29) — added prerequisite/audience/outcomes, composition, evidence-oriented diagnosis, and practice while preserving concise public snippets
- [x] 3.2.2 Correct flow/overlay labs or fixtures only where the audit requires it — `packages/docs-site/examples/guides/layout-*.ts`, `packages/docs-site/src/example-fixtures/layout/` ✅ (completed: 2026-07-29 22:29) — source audit proved both labs correct; AR-20 aligned the oracle with the documented one-extra-frame corner settle
- [x] 3.2.3 Reconcile registry and catalog evidence without weakening the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-29 22:29) — unchanged complete-stage metadata, prerequisites, outcomes, IDs, app kinds, and source paths pass the reconciled oracle
- [x] 3.2.4 Run ST-12 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-29 22:32) — 12/12 reconciled specifications, docs-site typecheck, and authoritative `yarn verify` passed

### Step 3.3: Hardening

- [x] 3.3.1 Extend responsive, clipping, interaction, and restore edges — `packages/docs-site/test/layout-guide.impl.test.ts` ✅ (completed: 2026-07-29 22:37) — 15/15 focused spec/implementation tests and authoritative `yarn verify` passed across repeated geometry and hidden-state cycles
- [x] 3.3.2 Run the complete focused Layout suite and confirm the curriculum map remains synchronized ✅ (completed: 2026-07-29 22:39) — 22/22 focused Layout/catalog tests and docs-site typecheck passed; the exact source state retains its authoritative `yarn verify` pass and Complete map entry

**Verify**: Layout spec/impl tests and docs-site typecheck

**Phase quality review**:

- Independent correctness review found two Major issues: overlay visibility mutations did not
  invalidate layout and could leave hidden panels painted, while the minimum-sizing lesson
  incorrectly claimed collectively infeasible fractional minimums must clip.
- Auto-design AR-21 selected both technical corrections; no finding was waived. The laboratory now
  invalidates its shared stack after each visibility change, and the course teaches both explicit
  visibility invalidation and the solver's proportional compression fallback.
- The corrected oracle drives both Alt-hotkeys and visible mouse-button controls without an
  intervening resize, verifies immediate rendered disappearance, and proves through public
  `layout()` that minimums 16 and 30 compress to 7 and 13 cells in a 20-cell track.
- The correction passes 23/23 focused Layout/catalog tests, docs-site typecheck, and authoritative
  `yarn verify`. The one permitted fix-scoped re-review found no remaining Critical or Major issue.
- Security and performance auditors were explicitly skipped because the phase changes Guide prose,
  bounded documentation interactions, and test evidence without a privileged-input boundary or
  performance-critical runtime path.
- Techdocs was not invoked because the phase changes consumer teaching and documentation-example
  correctness without changing architecture, public APIs, integrations, data entities, or
  infrastructure.

## Phase 4: Reactive state pilot re-audit

**Reference**: ST-13 · `03-02` · `03-03`

> **Phase baseline tree**: `1aa11a740712999569c009d9ce8aa4d1d8d7b6cc`
>
> **Expected modification set**: `packages/docs-site/guide/reactive-state.md`,
> `packages/docs-site/examples/guides/reactive-*.ts`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/test/reactive-state-guide.spec.test.ts`,
> `packages/docs-site/test/reactive-state-guide.impl.test.ts`, this execution plan, the ambiguity
> register, and docs-website roadmap/traceability evidence required by the execution protocol.

### Step 4.1: Specification tests

- [x] 4.1.1 [spec-author] Reconcile the existing Reactive state oracle with the final contract — `packages/docs-site/test/reactive-state-guide.spec.test.ts` ✅ (completed: 2026-07-29 22:56)
- [x] 4.1.2 Run the specification and record red gaps or justify a complete pre-existing pass ✅ (completed: 2026-07-29 22:56) — expected red: 13 passed, 2 failed for prerequisite/backbone/outcomes/diagnostic/practice gaps; commit deferred to the green 4.2.4 checkpoint per runtime AR-22

### Step 4.2: Implementation

- [x] 4.2.1 Correct mental-model, lifecycle, failure, practice, or link gaps — `packages/docs-site/guide/reactive-state.md` ✅ (completed: 2026-07-29 22:58) — added prerequisite/audience/outcomes, first reactive result, composition, evidence-oriented diagnosis, and progressive practice
- [x] 4.2.2 Correct graph/lifetime labs or fixtures only where the audit requires it — `packages/docs-site/examples/guides/reactive-*.ts` ✅ (completed: 2026-07-29 22:58) — source audit and reconciled oracle proved both labs correct through keyboard, mouse, reactive, lifecycle, and geometry paths
- [x] 4.2.3 Reconcile registry and catalog evidence without weakening the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-29 22:58) — unchanged complete-stage metadata, prerequisite, outcomes, IDs, app kinds, and source paths pass the reconciled oracle
- [x] 4.2.4 Run ST-13 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-29 23:02) — 15/15 reconciled specifications, docs-site typecheck, and authoritative `yarn verify` passed

### Step 4.3: Hardening

- [x] 4.3.1 Extend dynamic-dependency, batching, disposal, and resize edges — `packages/docs-site/test/reactive-state-guide.impl.test.ts` ✅ (completed: 2026-07-29 23:08) — 20/20 focused spec/implementation tests and authoritative `yarn verify` passed across real intermediate resize, repeated batch/reset, alternating dependency, exact cleanup, and post-disposal edges
- [x] 4.3.2 Run the complete focused Reactive state suite and confirm curriculum synchronization ✅ (completed: 2026-07-29 23:11) — 27/27 focused Reactive state/catalog tests and docs-site typecheck passed; the exact source state retains its authoritative `yarn verify` pass and Complete map entry

**Verify**: Reactive state spec/impl tests and docs-site typecheck

### Phase 4 quality review

- The independent reviewer found two Major issues and one Minor issue: both live examples created
  build-time reactive work outside a host-owned lifetime, direct visibility guidance omitted
  required layout invalidation, and repeated equal batch/reset actions claimed work that did not
  rerun.
- Auto-design AR-23 applied every technical correction without waiver. Both labs now bind their
  complete reactive graphs to host cleanup with an idempotent dialog-unmount fallback. Authentic
  host-lifecycle tests prove there is no unowned-root warning and no reactive work after teardown.
- The guide now invalidates layout after direct mounted visibility changes and recommends one
  shared-container invalidation for grouped sibling mutations. Batch/reset feedback now
  distinguishes changed transactions from equal no-op writes.
- The final corrective state passes 29/29 focused Reactive state/catalog tests, docs-site
  typecheck, and authoritative `yarn verify`.
- The one permitted fix-scoped re-review resolved both Major findings and the Minor finding with no
  remaining Critical, Major, or Minor issue.
- Security and performance auditors were not invoked because this correction contains bounded
  documentation interactions and lifecycle ownership without a privileged-input boundary or
  performance-critical runtime path.
- Techdocs was not invoked because the phase changes consumer teaching and documentation-example
  lifecycle correctness without changing architecture, public APIs, integrations, data entities,
  or infrastructure.

## Phase 5: Codex plugin

**Reference**: ST-14 · `03-02 §Authentic Substitutes` · AR-5

### Step 5.1: Specification tests

- [x] 5.1.1 [spec-author] Write the Codex plugin workflow oracle — `packages/docs-site/test/codex-plugin-guide.spec.test.ts` ✅ (completed: 2026-07-29 23:31)
- [x] 5.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-29 23:31) — expected red: 2 passed, 6 failed for prerequisite, source-boundary, authentic-evidence, command-boundary, diagnosis, practice, and next-step gaps; commit deferred to the green 5.2.4 checkpoint per runtime AR-24

### Step 5.2: Implementation

- [x] 5.2.1 Upgrade supported installation, invocation, source ownership, failures, and next steps — `packages/docs-site/guide/codex-plugin.md` ✅ (completed: 2026-07-29 23:34)
- [x] 5.2.2 Bind the substitute to canonical skill/plugin update and validation behavior — `packages/docs-site/guide/codex-plugin.md` ✅ (completed: 2026-07-29 23:34)
- [x] 5.2.3 Revalidate the zero-lab catalog exception without promoting the stage — `packages/docs-site/guides.json` ✅ (completed: 2026-07-29 23:34) — unchanged integration profile, host-runtime exception, empty example list, and Upgrade stage pass the catalog oracle
- [x] 5.2.4 Run ST-14 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-29 23:37) — 8/8 Codex plugin specifications, 15/15 focused course/catalog tests, docs-site typecheck, plugin integrity, and authoritative `yarn verify` passed

### Step 5.3: Hardening

- [x] 5.3.1 Add canonical-versus-generated and stale-plugin diagnostics — `packages/docs-site/test/codex-plugin-guide.impl.test.ts` ✅ (completed: 2026-07-29 23:46) — 18/18 focused course/catalog tests and authoritative `yarn verify` pass across real tree equality, changed/missing/unexpected distribution fixtures, and independent stale plugin/tag diagnostics
- [x] 5.3.2 Run focused checks, promote Codex plugin, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 00:01) — 18/18 focused course/catalog tests, docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify` pass; the catalog, learner-facing map, and Complete-stage projection agree

**Verify**: Codex guide spec/impl tests, docs-site typecheck, and `yarn plugin:check`

### Phase 5 quality review

- The independent reviewer found one Major issue and no Critical or Minor issues: the generic
  `<package-manager> exec` renderer command was invalid for Bun and did not protect renderer flags
  from npm's argument parser.
- Auto-design AR-25 replaced the placeholder with explicit `npm exec --`, `yarn exec`, `pnpm exec`,
  and `bunx` forms in both the Guide and shipped renderer skill.
- The course specification and shipped-skill implementation tests cover all four forms and reject
  the obsolete placeholder. The corrective state passes 19/19 focused course/catalog tests,
  docs-site typecheck, plugin integrity, and authoritative `yarn verify`.
- The one permitted fix-scoped re-review found no remaining Critical, Major, or Minor issue.
- Security and performance auditors were not invoked because the correction changes bounded
  command documentation and assertions without adding a privileged runtime boundary or
  performance-critical path.
- Techdocs was not invoked because the phase changes consumer integration teaching without changing
  architecture, public APIs, integrations, data entities, or infrastructure.

## Phase 6: Views & focus

**Reference**: ST-15 · `03-02` · `03-03`

### Step 6.1: Specification tests

- [x] 6.1.1 [spec-author] Write the Views & focus course oracle — `packages/docs-site/test/views-and-focus-guide.spec.test.ts` ✅ (completed: 2026-07-30 00:20) — independent specification author produced 19 final-contract cases covering course content, retained-tree/focus/modal public controls, two template1 labs, interactions, and responsive evidence
- [x] 6.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 00:24) — expected red: 3 public retained-tree/focus/modal controls passed and 16 course/catalog/laboratory contract cases failed; commit deferred to the green 6.2.4 checkpoint per runtime AR-26

### Step 6.2: Implementation

- [x] 6.2.1 Replace the placeholder with the complete retained-tree and focus course — `packages/docs-site/guide/views-and-focus.md` ✅ (completed: 2026-07-30 00:39) — delivered the beginner-to-production course backbone, verified public-API snippets, integration boundaries, failure diagnosis, best practices, and practice work
- [x] 6.2.2 Implement two objective-matched template1 labs and bounded fixtures — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/views-and-focus/` ✅ (completed: 2026-07-30 00:39) — added deterministic traversal/eligibility and modal containment/restoration laboratories with responsive Classic dialogs, keyboard paths, persistent non-color feedback, and owned cleanup
- [x] 6.2.3 Register both labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 00:39) — registered both `kind: 'app'` Guide IDs and synchronized catalog evidence while retaining the `upgrade` stage
- [x] 6.2.4 Run ST-15 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 00:39) — 19/19 focused course assertions, docs-site typecheck, registry integration, and authoritative `yarn verify` passed

### Step 6.3: Hardening

- [x] 6.3.1 Add tab-order, hidden/disabled, modal restoration, and resize edges — `packages/docs-site/test/views-and-focus-guide.impl.test.ts` ✅ (completed: 2026-07-30 00:45) — added seven implementation cases covering exact retained order, eligibility fallback, remembered focus, both modal restore targets, nested teardown, responsive geometry, and idempotent host cleanup; 26/26 focused tests, docs-site typecheck, and `yarn verify` pass
- [x] 6.3.2 Run focused checks, promote Views & focus, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 01:16) — promoted only after AR-27 corrections passed 35/35 focused tests, docs-site typecheck, production docs build, plugin integrity, authoritative `yarn verify`, and the permitted fix-scoped re-review with no remaining finding

**Verify**: Views/focus spec/impl tests and docs-site typecheck

### Phase 6 quality review

- The independent reviewer found four Major issues and three Minor issues: eligibility toggles
  could strand focus on hidden or disabled controls, the modal snippet referenced an undefined
  result, pending modal settlement performed stale post-disposal work, completion was promoted
  prematurely, focus-memory prose was ambiguous, default 80×24 evidence was implicit, and lab
  separators were not ASCII-safe.
- Auto-design AR-27 applied every correction without waiver and returned the course to Upgrade
  while remediation was pending.
- The corrected labs synchronously re-home newly ineligible focus, distinguish pending host
  teardown from modal commands, suppress stale continuation work after disposal, and use ASCII-safe
  visible instructions. The Guide captures and handles the optional modal result and distinguishes
  active focus chains from inactive restoration memory.
- Hardening now opens a real pending modal during host teardown and verifies inert settlement,
  exercises eligibility changes from the affected targets, and collects template1 evidence at the
  standard 80×24 viewport before resize, maximize, and restore.
- The one permitted fix-scoped re-review resolved all four Major and three Minor findings with no
  remaining Critical, Major, or Minor issue.
- The final corrective state passes 35/35 focused course/implementation/catalog tests, docs-site
  typecheck, production docs build, plugin integrity, and authoritative `yarn verify`.
- Security and performance auditors were not invoked because the phase changes bounded
  documentation interactions and lifecycle cleanup without a privileged-input boundary or
  performance-critical runtime path.
- Techdocs was not invoked because the phase changes consumer teaching and example correctness
  without changing architecture, public APIs, integrations, data entities, or infrastructure.

## Phase 7: Events, commands & keymaps

**Reference**: ST-16 · `03-02` · `03-03`
> **Phase baseline tree**: `da449549cb63556d32cf0604f8b64b17d694511e`
> **Expected modification set**: `packages/docs-site/guide/events-commands-and-keymaps.md`,
> `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/events-commands-and-keymaps/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, route-specific tests, and synchronized CodeOps lifecycle artifacts.

### Step 7.1: Specification tests

- [x] 7.1.1 [spec-author] Write the events/commands/keymaps oracle — `packages/docs-site/test/events-commands-and-keymaps-guide.spec.test.ts` ✅ (completed: 2026-07-30 01:31) — independent specification author produced 23 executed cases covering the full course, public routing controls, two template1 labs, interaction outcomes, responsive evidence, and cleanup
- [x] 7.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 01:31) — expected red: 5 public dispatch/keymap/command controls passed and 18 course, catalog, registry, and laboratory contract cases failed; commit deferred to the green 7.2.4 checkpoint per runtime AR-29

### Step 7.2: Implementation

- [x] 7.2.1 Replace the placeholder with event flow, command discovery, precedence, and diagnosis — `packages/docs-site/guide/events-commands-and-keymaps.md` ✅ (completed: 2026-07-30 01:45) — delivered the full beginner-to-production course with verified routing, pointer, command, keymap, precedence, lifecycle, diagnosis, and practice teaching
- [x] 7.2.2 Implement two objective-matched template1 labs and event fixtures — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/events-commands-and-keymaps/` ✅ (completed: 2026-07-30 01:45) — added deterministic routing and precedence laboratories with real keyboard/paste/command/mouse paths, Classic compact dialogs, responsive behavior, ASCII feedback, and owned cleanup
- [x] 7.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 01:45) — registered both `kind: 'app'` IDs and synchronized catalog evidence while retaining the Upgrade stage
- [x] 7.2.4 Run ST-16 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 01:45) — 23/23 specifications, docs-site typecheck, registry integration, and authoritative `yarn verify` passed

### Step 7.3: Hardening

- [x] 7.3.1 Add propagation, disabled-command, collision, paste, and mouse edges — `packages/docs-site/test/events-commands-and-keymaps-guide.impl.test.ts` ✅ (completed: 2026-07-30 01:51) — added six cases for deterministic routing, outside-target clicks, collision/disable/re-enable stability, raw-key suppression, and repeated host teardown; 29/29 focused tests, docs-site typecheck, and authoritative `yarn verify` pass
- [x] 7.3.2 Run focused checks, promote the course, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 02:23) — promoted after AR-30 corrections passed 38/38 focused tests, docs-site typecheck, production docs build, plugin integrity, authoritative `yarn verify`, and the permitted fix-scoped re-review with no remaining finding

**Verify**: Events/commands spec/impl tests and docs-site typecheck

### Phase 7 quality review

- The independent reviewer found four Major and two Minor issues: the live Paste and Command buttons
  moved focus away from the route probe, mouse-up polluted the mouse-down trace, the Save button did
  not reflect command disablement or leave focus, completion was premature, the opening diagram
  applied key-only preprocessing to every event kind, and custom focus targets relied on colour.
- Auto-design AR-30 applied every correction without waiver and kept the course at Upgrade until
  remediation gates and the one permitted fix-scoped re-review passed.
- The corrected routing controls preserve the intended focused route for mouse and keyboard
  activation, mouse evidence ends exactly after down bubbles to the parent, disabled Save leaves
  focus and the Tab order, and both custom targets expose ASCII `[FOCUSED]` cues. The Guide now
  separates key preprocessing and explains explicit Button availability binding.
- The one permitted fix-scoped re-review resolved all four Major and two Minor findings with no
  correction-introduced regression and no remaining Critical, Major, or Minor issue.
- The corrected demoted state and final promoted state each passed 38/38 focused tests, docs-site
  typecheck, production docs build, plugin integrity, and authoritative `yarn verify`.
- Security and performance auditors were not invoked because the phase uses bounded deterministic
  local events, no visitor or privileged host capability, small fixed view trees, and bounded
  traces.

## Phase 8: Keyboard & clipboard

**Reference**: ST-17 · `03-02` · `03-03`
> **Phase baseline tree**: `b0d7f6218190f9289407cc21a9dc30386ff8b1d4`
> **Expected modification set**: `packages/docs-site/guide/keyboard-and-clipboard.md`,
> `packages/docs-site/examples/guides/clipboard-boundary.ts`,
> `packages/docs-site/src/example-fixtures/keyboard-and-clipboard/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, route-specific tests,
> `packages/docs-site/test/guide-catalog.spec.test.ts` (mechanical Complete-stage allowlist), and
> synchronized CodeOps lifecycle artifacts.

### Step 8.1: Specification tests

- [x] 8.1.1 [spec-author] Write the Keyboard & clipboard oracle — `packages/docs-site/test/keyboard-and-clipboard-guide.spec.test.ts` ✅ (completed: 2026-07-30 02:33) — independent specification author produced 26 executed cases covering the full course, seven public keyboard/clipboard controls, one template1 virtual-boundary lab, interaction outcomes, responsive evidence, authorization, staleness, and cleanup
- [x] 8.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 02:33) — expected red: nine cases pass, including all seven public controls and two existing course details; seventeen final-contract cases fail across eleven course/catalog gaps and six missing registry/laboratory contracts; commit deferred to the green 8.2.4 checkpoint per AR-31

### Step 8.2: Implementation

- [x] 8.2.1 Upgrade chords, selection, adapter choice, authorization, and failures — `packages/docs-site/guide/keyboard-and-clipboard.md` ✅ (completed: 2026-07-30 02:44)
- [x] 8.2.2 Implement or adapt one focused template1 clipboard lab — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/keyboard-and-clipboard/` ✅ (completed: 2026-07-30 02:44)
- [x] 8.2.3 Register the lab and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 02:44)
- [x] 8.2.4 Run ST-17 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 02:44) — 26/26 independent specifications, docs-site typecheck, JSON validation, documentation self-check, and authoritative `yarn verify` pass; expected-red work is committed only at this first green checkpoint per AR-31

### Step 8.3: Hardening

- [x] 8.3.1 Add browser-denial, unavailable-adapter, selection, and key-conflict edges — `packages/docs-site/test/keyboard-and-clipboard-guide.impl.test.ts` ✅ (completed: 2026-07-30 02:53) — 33/33 focused course and hardening checks plus authoritative `yarn verify` pass
- [x] 8.3.2 Run focused checks, promote Keyboard & clipboard, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 03:34) — promoted after AR-33 corrections passed 44/44 focused checks, docs-site typecheck, production docs build, plugin integrity, authoritative `yarn verify`, and the one permitted fix-scoped re-review cleared every Critical and Major finding

**Verify**: Keyboard/clipboard spec/impl tests and docs-site typecheck

### Phase 8 quality review

- The independent reviewer found four Major and one Minor issue: native opt-out prose overclaimed
  isolation despite OSC 52 fallback, the lab simulated native read failure and stale delivery,
  custom-session cleanup left the event loop alive, unavailable browser capability was treated as
  a rejected write and seeded on mount, and the learner instructions described the wrong state
  order.
- Auto-design AR-33 applies every correction without waiver and keeps the course at Upgrade until
  remediation gates and the one permitted fix-scoped re-review pass.
- The single permitted fix-scoped re-review resolved all four Major findings and the original
  Minor finding. Its one correction-introduced Minor was fixed by rejecting Alt+R when no read is
  pending and proving that an early resolve cannot arm the next read. A third review is prohibited.
- The corrected demoted state passed 43/43 focused checks and every authoritative gate. The final
  promoted state passed 44/44 focused checks, docs-site typecheck, production docs build, plugin
  integrity, and authoritative `yarn verify`.
- Security and performance auditors were not separately invoked because this is a docs-only phase
  with a bounded virtual host and small fixed view tree; the correctness reviewer explicitly
  audited the clipboard authorization and data-boundary claims.

## Phase 9: Text, Unicode & terminal cells

**Reference**: ST-18 · `03-02` · `03-03`
> **Phase baseline tree**: `24c1b7c7fa73d352d651752915a25e611c54a3ca`
> **Expected modification set**: `packages/docs-site/guide/text-unicode-and-cells.md`,
> `packages/docs-site/examples/guides/`,
> `packages/docs-site/src/example-fixtures/text-unicode-and-cells/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, route-specific tests, and synchronized CodeOps lifecycle
> artifacts.

### Step 9.1: Specification tests

- [x] 9.1.1 [spec-author] Write the text/Unicode/cells oracle — `packages/docs-site/test/text-unicode-and-cells-guide.spec.test.ts` ✅ (completed: 2026-07-30 03:49)
- [x] 9.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 03:49) — authoritative focused run: 5 public width/buffer/wrapping/fallback controls passed and 15 final course, catalog, registry, and laboratory assertions failed as expected; commit deferred to the first green checkpoint per runtime AR-35

### Step 9.2: Implementation

- [x] 9.2.1 Create the complete grapheme, cell-width, wrapping, clipping, and fallback course — `packages/docs-site/guide/text-unicode-and-cells.md` ✅ (completed: 2026-07-30 03:57)
- [x] 9.2.2 Implement two focused template1 labs with deterministic text fixtures — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/text-unicode-and-cells/` ✅ (completed: 2026-07-30 03:57)
- [x] 9.2.3 Register labs and add catalog evidence while the route remains Planned — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 03:57)
- [x] 9.2.4 Run the ST-18 implementation-contract slice plus docs-site typecheck while the final Complete-stage assertion remains withheld; fix implementation only ✅ (completed: 2026-07-30 03:57) — 19/20 immutable assertions passed with only the final Complete-stage assertion intentionally withheld; docs-site typecheck passed; sequencing corrected by runtime AR-36 and the full oracle turns green at 9.3.2

### Step 9.3: Hardening

- [x] 9.3.1 Add combining, wide-cell boundary, ASCII, monochrome, and clipping edges — `packages/docs-site/test/text-unicode-and-cells-guide.impl.test.ts` ✅ (completed: 2026-07-30 04:05) — 12/12 route hardening checks passed across repeated widths, combining and orphan edges, fallback footprints, monochrome capability, geometry, and teardown
- [x] 9.3.2 Run focused checks, promote the route to Complete, and publish it in the map/sidebar — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 04:30) — runtime AR-37 corrections passed 47/47 focused checks, docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify`; the one permitted fix-scoped re-review resolved RV-009-001 through RV-009-005 with zero remaining or introduced findings

**Verify**: Text/Unicode spec/impl tests and docs-site typecheck

### Phase 9 quality review

- The independent correctness review reported four Major findings and one Minor finding:
  UTF-8-off fallback overstatement, clipped one-row laboratory copy, incorrect mouse action-source
  reporting, two links to planned pages, and a malformed Markdown fallback-table row.
- Runtime AR-37 accepted every correction without waiver. The corrected implementation exposes
  the decomposed-cell serialization limit, preserves complete copy through compact/resize/maximize/
  restore geometry, distinguishes keyboard and mouse activation for every action, keeps planned
  courses as non-links, and validates the table shape.
- The one permitted fix-scoped re-review marked RV-009-001 through RV-009-005 resolved and found
  zero correction-introduced Critical, Major, or Minor findings.
- Security and performance auditors were not separately invoked because this phase changes
  documentation and bounded deterministic teaching views only; the correctness review covered the
  Unicode output boundary and browser-laboratory claims.

## Phase 10: Scrolling, lists & large content

**Reference**: ST-19 · `03-02` · `03-03`
> **Phase baseline tree**: `8d798f931d5d9fc95acb1e4d233faf2b1994523c`
> **Expected modification set**: `packages/docs-site/guide/scrolling-lists-and-large-content.md`,
> `packages/docs-site/examples/guides/`,
> `packages/docs-site/src/example-fixtures/scrolling-lists-and-large-content/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, route-specific tests, and synchronized CodeOps lifecycle
> artifacts.

### Step 10.1: Specification tests

- [x] 10.1.1 [spec-author] Write the scrolling/list course oracle — `packages/docs-site/test/scrolling-lists-and-large-content-guide.spec.test.ts` ✅ (completed: 2026-07-30 04:44)
- [x] 10.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 04:45) — authoritative focused run: 15 final course/catalog/laboratory assertions failed as expected, while all 5 public viewport and collection controls passed; commit deferred to the final green 10.3.2 checkpoint per runtime AR-39

### Step 10.2: Implementation

- [x] 10.2.1 Create the surface-selection, viewport, selection, and bounded-rendering course — `packages/docs-site/guide/scrolling-lists-and-large-content.md` ✅ (completed: 2026-07-30 04:51) — all six page-content contract assertions pass; only the deliberately deferred final catalog-stage assertion remains red
- [x] 10.2.2 Implement two focused template1 labs with bounded large-data fixtures — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/scrolling-lists-and-large-content/` ✅ (completed: 2026-07-30 04:54)
- [x] 10.2.3 Register labs and add catalog evidence while the route remains Planned — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 04:56) — 19/20 immutable assertions pass; the only withheld assertion is final Complete-stage promotion
- [x] 10.2.4 Run ST-19 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 04:57) — implementation checkpoint: 19/20 immutable assertions pass, the sole deferred final-stage assertion remains red by design, and docs-site typecheck passes

### Step 10.3: Hardening

- [x] 10.3.1 Add empty, huge, offset, resize, focus, and selection edges — `packages/docs-site/test/scrolling-lists-and-large-content-guide.impl.test.ts` ✅ (completed: 2026-07-30 04:59)
- [x] 10.3.2 Run focused checks, promote the route, and publish it in map/sidebar — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 05:35) — runtime AR-40 corrections passed 39/39 focused checks, docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify`; the one permitted fix-scoped re-review cleared five findings and retained RV-010-002, whose final no-third-review correction now counts from a real subtree draw boundary and proves that over-budget formatting remains visible

**Verify**: Scrolling/list spec/impl tests and docs-site typecheck

### Phase 10 quality review

- The independent correctness review reported five Major findings and one Minor finding: stale
  Scroller-delta teaching, a capped formatter-work display, the wrong default Tree marker,
  overbroad bounded-work claims, clipped compact copy, and an incomplete ScrollBar range lesson.
- Runtime AR-40 accepted every correction without waiver and held the course at Upgrade through
  remediation.
- The one permitted fix-scoped re-review resolved RV-010-001 and RV-010-003 through RV-010-006,
  found no distinct correction-introduced issues, and retained RV-010-002 because a
  capacity-triggered reset could still hide resident-scale work. A third review is prohibited.
- The final RV-010-002 correction resets at the real parent-subtree draw boundary, increments
  without a cap, publishes after both row children paint, and includes a falsification test that
  forces work above viewport capacity. The promoted state passes 39/39 focused checks, docs-site
  typecheck, production docs build, plugin integrity, and authoritative `yarn verify`.
- Security and performance auditors were not separately invoked because this phase changes
  documentation and bounded deterministic teaching views only; the correctness reviewer explicitly
  audited the source-backed performance and browser-safety claims.

## Phase 11: The application shell

**Reference**: ST-20 · `03-02` · `03-03`
> **Phase baseline tree**: `87c9a9f2618560b8b389ce2711d99d99c6687d9a`
> **Expected modification set**: `packages/docs-site/guide/application-shell.md`,
> `packages/docs-site/examples/guides/`,
> `packages/docs-site/src/example-fixtures/application-shell/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, route-specific tests,
> `packages/ui/src/app/application.ts`, `packages/ui/test/app-shell.status.impl.test.ts`,
> `tools/jsvision-plugin-impact.json`, and synchronized CodeOps lifecycle artifacts. The UI and
> plugin-impact additions are the user-approved runtime AR-44 scope correction.

### Step 11.1: Specification tests

- [x] 11.1.1 [spec-author] Write the application-shell oracle — `packages/docs-site/test/application-shell-guide.spec.test.ts` ✅ (completed: 2026-07-30 05:50)
- [x] 11.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 05:50) — authoritative focused run: 4 public application controls passed and 15 final course, catalog, registry, laboratory, interaction, geometry, and cleanup assertions failed as expected; commit deferred to the final green 11.3.2 checkpoint per runtime AR-42

### Step 11.2: Implementation

- [x] 11.2.1 Replace the placeholder with complete shell, body, command, window, and lifecycle teaching — `packages/docs-site/guide/application-shell.md` ✅ (completed: 2026-07-30 05:55)
- [x] 11.2.2 Implement two focused template1 shell labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/application-shell/` ✅ (completed: 2026-07-30 05:55)
- [x] 11.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 05:55)
- [x] 11.2.4 Run ST-20 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 05:55) — implementation checkpoint: 18/19 immutable assertions pass with only final Complete-stage promotion withheld, and docs-site typecheck passes

### Step 11.3: Hardening

- [x] 11.3.1 Add quit, window command, body choice, and lifecycle edges — `packages/docs-site/test/application-shell-guide.impl.test.ts` ✅ (completed: 2026-07-30 05:56) — 5/5 focused hardening checks pass across repeated quit requests, body switching, Desktop-only commands, and teardown
- [x] 11.3.2 Run focused checks, promote Application shell, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 07:47) — runtime AR-43/AR-44 corrections, the no-third-review chrome-route correction, and runtime AR-45 drift repair pass 34/34 Guide checks, 15/15 focused UI checks, 7/7 native-clipboard documentation checks, docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify`

**Verify**: Application-shell spec/impl tests and docs-site typecheck

### Phase 11 quality review summary

- The independent review reported five Major findings and one Minor finding across Play quit
  semantics, authentic menu/status interaction, Desktop/custom-body command outcomes,
  `run()`/dispose lifecycle evidence, nested cleanup, and `statusBase()` composition.
- Runtime AR-43 accepted every correction without waiver and held the course at Upgrade during
  remediation. User-approved AR-44 aligned `statusBase()` with its existing command-item-only
  contract and added focused UI/plugin evidence.
- The single permitted fix-scoped re-review cleared RV-011-001 and RV-011-003 through RV-011-006,
  found no distinct correction-introduced issue, and retained RV-011-002 because chrome mouse
  actions still bypassed or mislabeled the shared command route. A third review is prohibited.
- The final RV-011-002 correction routes keymap, real MenuBar/StatusLine, and content-button
  activation through explicit command routes and drives the actual chrome pointer paths in the
  immutable oracle.
- Authoritative verification also exposed plan-owned Keyboard & clipboard drift. Runtime AR-45
  synchronized that earlier course with the canonical native-clipboard contract; its existing
  consumer oracle now passes 7/7.
- The promoted Phase 11 state passes 34/34 Guide checks, 15/15 focused UI checks, docs-site
  typecheck, production docs build, plugin integrity, and authoritative `yarn verify`.

## Phase 12: Dialogs & modality

**Reference**: ST-21 · `03-02` · `03-03`
> **Phase baseline tree**: `adfc3f07c353b72e6bb01d2335b7c92f7ac4c001`
> **Expected modification set**: `packages/docs-site/guide/dialogs-and-modality.md`,
> `packages/docs-site/examples/guides/`,
> `packages/docs-site/src/example-fixtures/dialogs-and-modality/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, `packages/docs-site/components/containers/dialog.md`,
> route-specific tests, the synchronized curriculum catalog assertion, and synchronized CodeOps
> lifecycle artifacts. The Dialog component-page addition is the user-approved runtime AR-48
> accuracy correction.

### Step 12.1: Specification tests

- [x] 12.1.1 [spec-author] Write the dialogs/modality oracle — `packages/docs-site/test/dialogs-and-modality-guide.spec.test.ts` ✅ (completed: 2026-07-30 08:10)
- [x] 12.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 08:10) — authoritative focused run: 4 public modal, validation, disposal, and helper controls passed; 15 final course, catalog, registry, laboratory, interaction, geometry, and cleanup assertions failed as expected; commit deferred to the final green 12.3.2 checkpoint per runtime AR-47

### Step 12.2: Implementation

- [x] 12.2.1 Replace the placeholder with results, validation, nesting, cancellation, and focus teaching — `packages/docs-site/guide/dialogs-and-modality.md` ✅ (completed: 2026-07-30 08:29)
- [x] 12.2.2 Implement two focused template1 modal-workflow labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/dialogs-and-modality/` ✅ (completed: 2026-07-30 08:29)
- [x] 12.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 08:29)
- [x] 12.2.4 Run ST-21 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 08:29) — focused oracle reached its planned implementation checkpoint at 18/19, with only the final catalog-stage promotion assertion intentionally red; docs-site typecheck passed

### Step 12.3: Hardening

- [x] 12.3.1 Add cancel, invalid, nested, focus-restore, and cleanup edges — `packages/docs-site/test/dialogs-and-modality-guide.impl.test.ts` ✅ (completed: 2026-07-30 08:32)
- [x] 12.3.2 Run focused checks, promote Dialogs & modality, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 08:59) — runtime AR-49 corrected RV-012-001 without waiver; 24/24 focused Dialog checks, synchronized curriculum coverage, docs-site typecheck, production docs build, performance checks, plugin integrity, authoritative `yarn verify`, and the single permitted fix-scoped re-review passed

**Verify**: Dialog spec/impl tests and docs-site typecheck

### Phase 12 quality review summary

- The independent review reported one Major finding: RV-012-001 showed that manually assigned
  success labels could remain green without independently proving settled modal results, LIFO
  promise order, exact focus identities, and real cleanup.
- Runtime AR-49 accepted the full correction without waiver. The laboratories now distinguish the
  synchronous modal-host boundary from asynchronous promise settlement, compare restored focus by
  identity, count mounted-view cleanup callbacks, and publish disposal success only after both
  promises resolve `undefined`.
- The single permitted fix-scoped re-review cleared RV-012-001 and found no
  correction-introduced Critical, Major, or Minor issue.
- The promoted course passes 24/24 focused Dialog checks, curriculum synchronization, docs-site
  typecheck, production docs build, performance checks, plugin integrity, and authoritative
  `yarn verify`.

## Phase 13: Async work, cancellation & progress

**Reference**: ST-22 · `03-02` · `03-03`
> **Phase baseline tree**: `c9492058a69c3aa5fb54521f9577e5685e7e6a8b`
> **Expected modification set**: `packages/docs-site/guide/async-work.md`,
> `packages/docs-site/examples/guides/`,
> `packages/docs-site/src/example-fixtures/async-work/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, route-specific tests, the synchronized curriculum catalog
> assertion, and synchronized CodeOps lifecycle artifacts.

### Step 13.1: Specification tests

- [x] 13.1.1 [spec-author] Write the async-work oracle — `packages/docs-site/test/async-work-guide.spec.test.ts` ✅ (completed: 2026-07-30 09:12)
- [x] 13.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 09:12) — authoritative focused run: 4 public progress, timer, cancellation, generation, and diagnostics controls passed; 15 final course, catalog, registry, laboratory, interaction, geometry, and cleanup assertions failed as expected

### Step 13.2: Implementation

- [x] 13.2.1 Create the responsive async, progress, cancellation, errors, cleanup, and stale-result course — `packages/docs-site/guide/async-work.md` ✅ (completed: 2026-07-30 09:22)
- [x] 13.2.2 Implement two deterministic template1 async labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/async-work/` ✅ (completed: 2026-07-30 09:22)
- [x] 13.2.3 Register labs and add catalog evidence while the route remains Planned — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 09:22)
- [x] 13.2.4 Run ST-22 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 09:22) — 18/19 final assertions passed while the route remained Planned; the sole expected failure was the final catalog-stage promotion gate

### Step 13.3: Hardening

- [x] 13.3.1 Add cancellation races, stale completion, error, disposal, and resize edges — `packages/docs-site/test/async-work-guide.impl.test.ts` ✅ (completed: 2026-07-30 09:23) — 7/7 focused hardening checks passed
- [x] 13.3.2 Run focused checks, promote Async work, and publish it in map/sidebar — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 09:24) — runtime AR-51 corrections passed 27/27 focused checks, synchronized curriculum coverage, docs-site typecheck, production docs build, plugin integrity, authoritative `yarn verify`, and the single permitted fix-scoped re-review

**Verify**: Async-work spec/impl tests and docs-site typecheck

### Phase 13 quality review summary

- The independent review reported one Major and two Minor findings. RV-013-001 showed that the
  stale-result laboratory claimed cancellation after both request controllers had already been
  released. RV-013-002 found an unmarked request accelerator, and RV-013-003 found an unused
  beginner-snippet signal.
- Runtime AR-51 accepted every correction without waiver. Cancellation now requires genuinely
  pending work, counts real controller aborts and exact releases, and is independently separated
  from the fresh pair used to prove newest publication and stale rejection. The request accelerator
  is visibly marked, and the snippet contains only its used state.
- The single permitted fix-scoped re-review cleared RV-013-001 through RV-013-003 with no
  correction-introduced Critical, Major, or Minor finding. The corrected course passes 27/27
  focused checks, synchronized curriculum coverage, docs-site typecheck, production docs build,
  plugin integrity, and authoritative `yarn verify`.

## Phase 14: Forms

**Reference**: ST-23 · `03-02` · `03-03`
> **Phase baseline tree**: `e9aad443fc56279950f9ccc7e82bb6144644ad7c`
> **Expected modification set**: `packages/docs-site/guide/forms.md`,
> `packages/docs-site/examples/guides/`,
> `packages/docs-site/src/example-fixtures/forms-guide/`,
> `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`,
> `packages/docs-site/guide/index.md`, route-specific tests, the synchronized curriculum catalog
> assertion, and synchronized CodeOps lifecycle artifacts.

### Step 14.1: Specification tests

- [x] 14.1.1 [spec-author] Write the Forms course oracle — `packages/docs-site/test/forms-guide.spec.test.ts` ✅ (completed: 2026-07-30 09:56)
- [x] 14.1.2 Run the specification and record the expected red result ✅ (completed: 2026-07-30 09:56) — authoritative focused run: 5 public store, binding, validation, submission, loading, and disposal controls passed; 17 final course, catalog, registry, laboratory, interaction, geometry, and cleanup assertions failed as expected

### Step 14.2: Implementation

- [x] 14.2.1 Replace the placeholder with typed state, binding, validation, submission, and reset teaching — `packages/docs-site/guide/forms.md` ✅ (completed: 2026-07-30 10:12)
- [x] 14.2.2 Implement two focused template1 form labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/forms-guide/` ✅ (completed: 2026-07-30 10:12)
- [x] 14.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` ✅ (completed: 2026-07-30 10:12)
- [x] 14.2.4 Run ST-23 green plus docs-site typecheck; fix implementation only ✅ (completed: 2026-07-30 10:12) — 21/22 final-contract assertions pass with only the intentionally withheld Complete-stage promotion; docs-site typecheck passes

### Step 14.3: Hardening

- [x] 14.3.1 Add empty, invalid, async, reset, submit-race, and focus edges — `packages/docs-site/test/forms-guide.impl.test.ts` ✅ (completed: 2026-07-30 10:14) — 7/7 hardening checks pass
- [x] 14.3.2 Run focused checks, promote Forms, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` ✅ (completed: 2026-07-30 10:19) — runtime AR-55 and AR-56 corrected RV-014-001 through RV-014-005 without waiver; 39/39 focused checks, docs-site typecheck, production docs build, plugin integrity, authoritative `yarn verify`, and the permitted fix-scoped re-review pass

**Phase 14 evidence**

- The complete Forms course teaches raw and coerced state, direct and choice bindings, Zod issue
  identity, submit/reset/load workflows, async generation ownership, retry, Form Dialog
  composition, diagnosis, security boundaries, accessibility, and lifecycle cleanup.
- `guides/form-state-validation` and `guides/form-async-submit` are compact Classic template1
  applications with real inputs or real form-store gates, keyboard and mouse paths, deterministic
  bounded fixtures, responsive geometry, and teardown evidence.
- The final promoted state passes 36/36 focused course, laboratory, hardening, and catalog checks,
  docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify`.
- Independent review found two Major and two Minor issues. Runtime AR-55 accepts every correction
  without waiver: controlled Promise settlements now prove stale and accepted generations, real
  `onValid` entry owns persistence, phase actions expose reactive availability, Alt+O is visibly
  marked, and the submit snippet uses the public Button constructor contract.
- The corrected course and laboratories pass 37/37 focused checks, docs-site typecheck, production
  docs build, plugin integrity, and authoritative `yarn verify`. The permitted fix-scoped
  re-review is the remaining phase gate.
- The single permitted re-review cleared RV-014-001 through RV-014-004 and identified
  correction-introduced Major RV-014-005: controlled Promises could remain retained or publish
  after unmount. Runtime AR-56 resolves it without waiver or a prohibited third review by marking
  the fixture inactive before cleanup, aborting and settling every incomplete operation, clearing
  ownership, guarding all Promise and submit continuations, and testing pending-disposal,
  resolve-then-dispose, and persistence-teardown races. The correction passes 39/39 focused checks,
  docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify`.
  A third review is prohibited; source and lifecycle evidence close RV-014-005.

**Verify**: Forms guide spec/impl tests and docs-site typecheck

## Phase 15: Files & the FileSystem seam

**Reference**: ST-24 · `03-02` · `03-03`

### Step 15.1: Specification tests

- [x] 15.1.1 [spec-author] Write the FileSystem course oracle — `packages/docs-site/test/files-and-filesystem-guide.spec.test.ts` — done 2026-07-30 (646-line immutable oracle; docs-site typecheck and formatting pass)
- [x] 15.1.2 Run the specification and record the expected red result — done 2026-07-30 (expected RED: 19 total, 5 public-control passes, 14 course/laboratory contract failures)

### Step 15.2: Implementation

- [x] 15.2.1 Replace the placeholder with host-neutral file workflows and authorization teaching — `packages/docs-site/guide/files-and-filesystem.md` — done 2026-07-30
- [x] 15.2.2 Implement one focused template1 virtual/custom filesystem lab — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/files-and-filesystem/` — done 2026-07-30
- [x] 15.2.3 Register the lab and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` — done 2026-07-30
- [x] 15.2.4 Run ST-24 green plus docs-site typecheck; fix implementation only — done 2026-07-30 (18/19 course/lab assertions pass; only deliberately withheld Complete-stage assertion remains; typecheck passes)

### Step 15.3: Hardening

- [x] 15.3.1 Add denied, cancelled, missing, traversal, virtual, and cleanup edges — `packages/docs-site/test/files-and-filesystem-guide.impl.test.ts` — done 2026-07-30 (6 hardening checks)
- [x] 15.3.2 Run focused checks, promote Files, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` — done 2026-07-30 (32/32 focused checks and docs-site typecheck pass; production build corrected one private-package dead link; independent review found three Major and one Minor issue, AR-58 fixed all without waiver, the permitted re-review cleared every finding with no introduced Critical or Major issue, and the corrected production docs build plus authoritative `yarn verify` pass)

**Verify**: Filesystem guide spec/impl tests and docs-site typecheck

## Phase 16: Internationalization

**Reference**: ST-25 · `03-02` · `03-03`

### Step 16.1: Specification tests

- [x] 16.1.1 [spec-author] Write the i18n course oracle — `packages/docs-site/test/i18n-guide.spec.test.ts` — ✅ (completed: 2026-07-30 11:36)
- [x] 16.1.2 Run the specification and record the expected red result — ✅ (completed: 2026-07-30 11:36; expected red: 10 failed, 2 passed because the course, catalog promotion, and two registered labs are not implemented)

### Step 16.2: Implementation

- [x] 16.2.1 Upgrade locale definition, validation, switching, layout, and test teaching — `packages/docs-site/guide/i18n.md` — ✅ (completed: 2026-07-30 11:41)
- [x] 16.2.2 Implement two focused template1 locale/layout labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/i18n-guide/` — ✅ (completed: 2026-07-30 11:41)
- [x] 16.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` — ✅ (completed: 2026-07-30 11:41)
- [x] 16.2.4 Run ST-25 green plus docs-site typecheck; fix implementation only — ✅ (completed: 2026-07-30 11:41; 11/12 course/lab assertions pass with only the deliberately withheld Complete-stage assertion, and docs-site typecheck passes)

### Step 16.3: Hardening

- [x] 16.3.1 Add missing-key, long-label, locale-switch, Unicode, and clipping edges — `packages/docs-site/test/i18n-guide.impl.test.ts` — ✅ (completed: 2026-07-30 11:42; 7 hardening checks pass)
- [x] 16.3.2 Run focused checks, promote Internationalization, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` — ✅ (completed: 2026-07-30 12:05; 35/35 focused Guide, catalog, and locale checks, docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify` pass; the independent review found five Major and two Minor issues, AR-59 corrected all without waiver, the permitted re-review cleared six findings and identified correction-introduced Major RV-16-R1, and AR-60 corrected the locale handoff rollback boundary with success, replacement-failure, and old-cleanup-failure evidence; a third review is prohibited)

**Verify**: i18n guide spec/impl tests, locale checks, and docs-site typecheck

## Phase 17: Screens & routing

**Reference**: ST-26 · `03-02` · `03-03`

### Step 17.1: Specification tests

- [x] 17.1.1 [spec-author] Write the screens/routing oracle — `packages/docs-site/test/screens-and-routing-guide.spec.test.ts` — ✅ (completed: 2026-07-30 12:15; 17-case immutable oracle covers course structure, typed stacks, chrome, retention, focus, host boundaries, public behavior, codec validation, and two template1 laboratories; docs-site typecheck passes)
- [x] 17.1.2 Run the specification and record the expected red result — ✅ (completed: 2026-07-30 12:15; expected red: 12 failed and 4 public Router behavior checks passed because the placeholder course, Complete promotion, registry entries, and two laboratories are not implemented)

### Step 17.2: Implementation

- [x] 17.2.1 Replace the placeholder with state, history, focus, ownership, and cleanup teaching — `packages/docs-site/guide/screens-and-routing.md` — ✅ (completed: 2026-07-30 12:21)
- [x] 17.2.2 Implement two focused template1 routing labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/screens-and-routing/` — ✅ (completed: 2026-07-30 12:21; typed stack/chrome and screen lifecycle/focus laboratories)
- [x] 17.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json` — ✅ (completed: 2026-07-30 12:21)
- [x] 17.2.4 Run ST-26 green plus docs-site typecheck; fix implementation only — ✅ (completed: 2026-07-30 12:21; 15/16 final-contract assertions pass with only deliberately withheld Complete-stage promotion, and docs-site typecheck passes)

### Step 17.3: Hardening

- [x] 17.3.1 Add unknown-route, back/forward, focus-restore, and disposal edges — `packages/docs-site/test/screens-and-routing-guide.impl.test.ts` — ✅ (completed: 2026-07-30 12:23; 6 runtime-unknown, repeated-history, rebuilt-focus-attempt, keep-alive, reset, and disposal hardening checks pass)
- [x] 17.3.2 Run focused checks, promote Screens & routing, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md` — ✅ (completed: 2026-07-30 12:50; 30/30 focused course, laboratory, hardening, and catalog checks, docs-site typecheck, production docs build, plugin integrity, and authoritative `yarn verify` pass; the independent review found five Major and one Minor issue, AR-63 corrected all without waiver, the permitted re-review cleared the originals and found correction-introduced Major RV-17-R1 through RV-17-R3, and AR-64 resolved button clipping, unreachable menu cues, and the stale API-link oracle without a prohibited third review)

**Verify**: Routing guide spec/impl tests and docs-site typecheck

## Phase 18: Theming & colour depth

**Reference**: ST-27 · `03-02` · `03-03`

### Step 18.1: Specification tests

- [ ] 18.1.1 [spec-author] Write the theming/colour-depth oracle — `packages/docs-site/test/theming-and-colour-depth-guide.spec.test.ts`
- [ ] 18.1.2 Run the specification and record the expected red result

### Step 18.2: Implementation

- [ ] 18.2.1 Replace the placeholder with theme roles, selection, contrast, and fallback teaching — `packages/docs-site/guide/theming-and-colour-depth.md`
- [ ] 18.2.2 Implement two focused template1 theme/capability labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/theming-and-colour-depth/`
- [ ] 18.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 18.2.4 Run ST-27 green plus docs-site typecheck; fix implementation only

### Step 18.3: Hardening

- [ ] 18.3.1 Add monochrome, low-contrast, missing-role, ASCII, and resize edges — `packages/docs-site/test/theming-and-colour-depth-guide.impl.test.ts`
- [ ] 18.3.2 Run focused checks, promote Theming, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Theming guide spec/impl tests and docs-site typecheck

## Phase 19: Running in the browser

**Reference**: ST-28 · `03-02` · `03-03`

### Step 19.1: Specification tests

- [ ] 19.1.1 [spec-author] Write the browser-host course oracle — `packages/docs-site/test/running-in-the-browser-guide.spec.test.ts`
- [ ] 19.1.2 Run the specification and record the expected red result

### Step 19.2: Implementation

- [ ] 19.2.1 Replace the placeholder with mounting, resize, key, clipboard, and virtual-file boundaries — `packages/docs-site/guide/running-in-the-browser.md`
- [ ] 19.2.2 Implement two focused browser-host template1 labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/running-in-the-browser/`
- [ ] 19.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 19.2.4 Run ST-28 green plus docs-site typecheck; fix implementation only

### Step 19.3: Hardening

- [ ] 19.3.1 Add denied capability, resize, reclaimed key, virtual-file, and cleanup edges — `packages/docs-site/test/running-in-the-browser-guide.impl.test.ts`
- [ ] 19.3.2 Run focused checks, promote Browser, and update the curriculum map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Browser guide spec/impl tests and docs-site typecheck

## Phase 20: Writing your own widget

**Reference**: ST-29 · `03-02` · `03-03`

### Step 20.1: Specification tests

- [ ] 20.1.1 [spec-author] Write the custom-widget course oracle — `packages/docs-site/test/writing-your-own-widget-guide.spec.test.ts`
- [ ] 20.1.2 Run the specification and record the expected red result

### Step 20.2: Implementation

- [ ] 20.2.1 Replace the placeholder with measure/layout/render/input/reactivity/focus/theme teaching — `packages/docs-site/guide/writing-your-own-widget.md`
- [ ] 20.2.2 Implement two focused template1 custom-widget labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/writing-your-own-widget/`
- [ ] 20.2.3 Register labs and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 20.2.4 Run ST-29 green plus docs-site typecheck; fix implementation only

### Step 20.3: Hardening

- [ ] 20.3.1 Add zero-measure, invalidation, focus, Unicode, theme, and disposal edges — `packages/docs-site/test/writing-your-own-widget-guide.impl.test.ts`
- [ ] 20.3.2 Run focused checks, promote Custom widget, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Custom-widget guide spec/impl tests and docs-site typecheck

## Phase 21: Testing headlessly

**Reference**: ST-30 · `03-02 §Authentic Substitutes`

### Step 21.1: Specification tests

- [ ] 21.1.1 [spec-author] Write the headless-testing course oracle — `packages/docs-site/test/testing-headlessly-guide.spec.test.ts`
- [ ] 21.1.2 Run the specification and record the expected red result

### Step 21.2: Implementation

- [ ] 21.2.1 Replace the placeholder with deterministic host/frame/input and test-layer teaching — `packages/docs-site/guide/testing-headlessly.md`
- [ ] 21.2.2 Implement the authentic headless test artifact and rendered-frame fixture — `packages/docs-site/src/example-fixtures/testing-headlessly/`, `packages/docs-site/test/testing-headlessly-example.spec.test.ts`
- [ ] 21.2.3 Revalidate the zero-lab catalog exception and artifact evidence — `packages/docs-site/guides.json`
- [ ] 21.2.4 Run ST-30 green plus docs-site typecheck; fix implementation only

### Step 21.3: Hardening

- [ ] 21.3.1 Add deterministic input, viewport, frame, teardown, and false-positive edges — `packages/docs-site/test/testing-headlessly-guide.impl.test.ts`
- [ ] 21.3.2 Run focused checks, promote Testing headlessly, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Headless guide/artifact tests and docs-site typecheck

## Phase 22: Application architecture & best practices

**Reference**: ST-31 · `03-02` · `03-03`

### Step 22.1: Specification tests

- [ ] 22.1.1 [spec-author] Write the application-architecture oracle — `packages/docs-site/test/application-architecture-guide.spec.test.ts`
- [ ] 22.1.2 Run the specification and record the expected red result

### Step 22.2: Implementation

- [ ] 22.2.1 Create the state/command/service/screen/ownership/error/package-boundary course — `packages/docs-site/guide/application-architecture.md`
- [ ] 22.2.2 Implement two focused template1 architecture-comparison labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/application-architecture/`
- [ ] 22.2.3 Register labs and add catalog evidence while the route remains Planned — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 22.2.4 Run ST-31 green plus docs-site typecheck; fix implementation only

### Step 22.3: Hardening

- [ ] 22.3.1 Add ownership, circular-dependency, stale-state, error-boundary, and cleanup edges — `packages/docs-site/test/application-architecture-guide.impl.test.ts`
- [ ] 22.3.2 Run focused checks, promote Architecture, and publish it in map/sidebar — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Architecture guide spec/impl tests and docs-site typecheck

## Phase 23: Debugging

**Reference**: ST-32 · `03-02` · `03-03`

### Step 23.1: Specification tests

- [ ] 23.1.1 [spec-author] Write the Debugging course oracle — `packages/docs-site/test/debugging-guide.spec.test.ts`
- [ ] 23.1.2 Run the specification and record the expected red result

### Step 23.2: Implementation

- [ ] 23.2.1 Replace the placeholder with bounded evidence and failure-isolation teaching — `packages/docs-site/guide/debugging.md`
- [ ] 23.2.2 Implement one focused template1 diagnostic lab — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/debugging/`
- [ ] 23.2.3 Register the lab and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 23.2.4 Run ST-32 green plus docs-site typecheck; fix implementation only

### Step 23.3: Hardening

- [ ] 23.3.1 Add layout/focus/event/reactive/host distinction and redaction edges — `packages/docs-site/test/debugging-guide.impl.test.ts`
- [ ] 23.3.2 Run focused checks, promote Debugging, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Debugging guide spec/impl tests and docs-site typecheck

## Phase 24: Crash safety & terminal restore

**Reference**: ST-33 · `03-02 §Authentic Substitutes`

### Step 24.1: Specification tests

- [ ] 24.1.1 [spec-author] Write the crash-safety course oracle — `packages/docs-site/test/crash-safety-guide.spec.test.ts`
- [ ] 24.1.2 Run the specification and record the expected red result

### Step 24.2: Implementation

- [ ] 24.2.1 Replace the placeholder with terminal ownership, restoration, and failure teaching — `packages/docs-site/guide/crash-safety.md`
- [ ] 24.2.2 Implement the authentic lifecycle/restore test and annotated trace fixture — `packages/docs-site/src/example-fixtures/crash-safety/`, `packages/docs-site/test/crash-safety-example.spec.test.ts`
- [ ] 24.2.3 Revalidate the zero-lab exception and artifact evidence — `packages/docs-site/guides.json`
- [ ] 24.2.4 Run ST-33 green plus docs-site typecheck; fix implementation only

### Step 24.3: Hardening

- [ ] 24.3.1 Add normal/error/signal/idempotent restore and partial-start edges — `packages/docs-site/test/crash-safety-guide.impl.test.ts`
- [ ] 24.3.2 Run focused checks, promote Crash safety, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Crash-safety guide/artifact tests and docs-site typecheck

## Phase 25: Displaying untrusted text safely

**Reference**: ST-34 · `03-02` · `03-03`

### Step 25.1: Specification tests

- [ ] 25.1.1 [spec-author] Write the untrusted-text course oracle — `packages/docs-site/test/untrusted-text-guide.spec.test.ts`
- [ ] 25.1.2 Run the specification and record the expected red result

### Step 25.2: Implementation

- [ ] 25.2.1 Replace the placeholder with injection boundary, sanitization, redaction, and diagnosis — `packages/docs-site/guide/untrusted-text.md`
- [ ] 25.2.2 Implement one deterministic template1 unsafe/sanitized comparison lab — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/untrusted-text/`
- [ ] 25.2.3 Register the lab and add catalog evidence without promoting the stage — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 25.2.4 Run ST-34 green plus docs-site typecheck; fix implementation only

### Step 25.3: Hardening

- [ ] 25.3.1 Add escape, control, multiline, redaction, and display-boundary edges — `packages/docs-site/test/untrusted-text-guide.impl.test.ts`
- [ ] 25.3.2 Run focused checks, promote Untrusted text, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Untrusted-text guide spec/impl tests and docs-site typecheck

## Phase 26: Accessibility & resilient interaction

**Reference**: ST-35 · `03-02` · `03-03`

### Step 26.1: Specification tests

- [ ] 26.1.1 [spec-author] Write the accessibility course oracle — `packages/docs-site/test/accessibility-guide.spec.test.ts`
- [ ] 26.1.2 Run the specification and record the expected red result

### Step 26.2: Implementation

- [ ] 26.2.1 Create the keyboard/focus/non-color/geometry/mono/ASCII course — `packages/docs-site/guide/accessibility.md`
- [ ] 26.2.2 Implement two focused template1 resilient-interaction labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/accessibility/`
- [ ] 26.2.3 Register labs and add catalog evidence while the route remains Planned — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 26.2.4 Run ST-35 green plus docs-site typecheck; fix implementation only

### Step 26.3: Hardening

- [ ] 26.3.1 Add keyboard-only, focus-visible, non-color, reduced-size, mono, and ASCII edges — `packages/docs-site/test/accessibility-guide.impl.test.ts`
- [ ] 26.3.2 Run focused checks, promote Accessibility, and publish it in map/sidebar — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Accessibility guide spec/impl tests and docs-site typecheck

## Phase 27: Terminal capabilities & portability

**Reference**: ST-36 · `03-02` · `03-03`

### Step 27.1: Specification tests

- [ ] 27.1.1 [spec-author] Write the terminal-capabilities oracle — `packages/docs-site/test/terminal-capabilities-guide.spec.test.ts`
- [ ] 27.1.2 Run the specification and record the expected red result

### Step 27.2: Implementation

- [ ] 27.2.1 Create the capability-detection, fallback, and evidence-scope course — `packages/docs-site/guide/terminal-capabilities.md`
- [ ] 27.2.2 Implement two focused template1 capability/fallback labs — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/terminal-capabilities/`
- [ ] 27.2.3 Register labs and add catalog evidence while the route remains Planned — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 27.2.4 Run ST-36 green plus docs-site typecheck; fix implementation only

### Step 27.3: Hardening

- [ ] 27.3.1 Add unknown, mono, no-mouse, ASCII, reduced-geometry, and unsupported-claim edges — `packages/docs-site/test/terminal-capabilities-guide.impl.test.ts`
- [ ] 27.3.2 Run focused checks, promote Terminal capabilities, and publish it in map/sidebar — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Capability guide spec/impl tests and docs-site typecheck

## Phase 28: In production

**Reference**: ST-37 · `03-02 §Authentic Substitutes`

### Step 28.1: Specification tests

- [ ] 28.1.1 [spec-author] Write the production course oracle — `packages/docs-site/test/in-production-guide.spec.test.ts`
- [ ] 28.1.2 Run the specification and record the expected red result

### Step 28.2: Implementation

- [ ] 28.2.1 Replace the placeholder with supervision, restoration, logs, capabilities, evidence, and readiness — `packages/docs-site/guide/in-production.md`
- [ ] 28.2.2 Bind authentic operational configuration/checklist and bounded diagnostics — `packages/docs-site/guide/in-production.md`, `packages/docs-site/src/example-fixtures/in-production/`
- [ ] 28.2.3 Revalidate the zero-lab exception and artifact evidence — `packages/docs-site/guides.json`
- [ ] 28.2.4 Run ST-37 green plus docs-site typecheck; fix implementation only

### Step 28.3: Hardening

- [ ] 28.3.1 Add failed startup, crash loop, restore, redaction, capability, and stale-evidence edges — `packages/docs-site/test/in-production-guide.impl.test.ts`
- [ ] 28.3.2 Run focused checks, promote In production, and update the map — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Production guide spec/impl tests and docs-site typecheck

## Phase 29: Build a complete application

**Reference**: ST-38 · `03-02` · `03-03`

### Step 29.1: Specification tests

- [ ] 29.1.1 [spec-author] Write the complete-application oracle — `packages/docs-site/test/complete-application-guide.spec.test.ts`
- [ ] 29.1.2 Run the specification and record the expected red result

### Step 29.2: Implementation

- [ ] 29.2.1 Create the coherent build/test/diagnose/production-capstone course — `packages/docs-site/guide/complete-application.md`
- [ ] 29.2.2 Implement two capstone template1 labs with deterministic application fixtures — `packages/docs-site/examples/guides/`, `packages/docs-site/src/example-fixtures/complete-application/`
- [ ] 29.2.3 Register labs and add catalog evidence while the route remains Planned — `packages/docs-site/src/example-registry/guides.ts`, `packages/docs-site/guides.json`
- [ ] 29.2.4 Run ST-38 green plus docs-site typecheck; fix implementation only

### Step 29.3: Hardening

- [ ] 29.3.1 Add end-to-end state, cancellation, navigation, failure, cleanup, and reduced-geometry edges — `packages/docs-site/test/complete-application-guide.impl.test.ts`
- [ ] 29.3.2 Run focused checks, promote Complete application, and publish it in map/sidebar — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`

**Verify**: Capstone guide spec/impl tests and docs-site typecheck

## Phase 30: Specialist-course boundary

**Reference**: ST-39–ST-40 · `03-01 §Ownership Boundaries` · AR-3

### Step 30.1: Specification tests

- [ ] 30.1.1 [spec-author] Extend specialist-boundary specifications — `packages/docs-site/test/guide-catalog.spec.test.ts`
- [ ] 30.1.2 Run ST-39–ST-40 and record red link/ownership gaps

### Step 30.2: Implementation

- [ ] 30.2.1 Correct Guide curriculum and related-course links to both specialist hubs — `packages/docs-site/guide/index.md`, `packages/docs-site/guide/*.md`
- [ ] 30.2.2 Run specialist specifications green and confirm no duplicate Guide routes exist

### Step 30.3: Hardening

- [ ] 30.3.1 Add bidirectional-link and duplicate-topic heuristics — `packages/docs-site/test/guide-integration.impl.test.ts`
- [ ] 30.3.2 Run focused Guide plus Data Grid/Code Editor navigation checks

**Verify**: ST-39–ST-40 and focused specialist navigation tests

## Phase 31: Curriculum integration

**Reference**: ST-41–ST-47 · `03-01`–`03-04` · AR-9

### Step 31.1: Specification tests

- [ ] 31.1.1 [spec-author] Write curriculum-wide route/link/snippet/lab integration oracles — `packages/docs-site/test/guide-integration.spec.test.ts`
- [ ] 31.1.2 Run ST-41–ST-47 and record red integration gaps or justified pre-existing passes

### Step 31.2: Implementation

- [ ] 31.2.1 Harden catalog cycle/completion validation and navigation projection — `packages/docs-site/src/guides/guide-catalog.mjs`, `packages/docs-site/src/guides/guide-catalog.d.mts`
- [ ] 31.2.2 Reconcile all stages, routes, map rows, registry IDs, prerequisites, and next-step links — `packages/docs-site/guides.json`, `packages/docs-site/guide/index.md`, `packages/docs-site/src/example-registry/guides.ts`
- [ ] 31.2.3 Run the complete Guide specification suite green; fix implementation only

### Step 31.3: Hardening and final gates

- [ ] 31.3.1 Complete catalog/parser and batch-diagnostic hardening — `packages/docs-site/test/guide-catalog.impl.test.ts`, `packages/docs-site/test/guide-integration.impl.test.ts`
- [ ] 31.3.2 Run docs-site typecheck, all Guide tests, and focused docs checks
- [ ] 31.3.3 Run `yarn docs:build`, then authoritative `yarn verify`; record final evidence

**Verify**: `yarn docs:build && yarn verify`

## Dependencies

```text
Phases 1–2
    ↓
Phases 3–10 (core concepts)
    ↓
Phases 11–22 (application building and integration)
    ↓
Phases 23–29 (operating and capstone)
    ↓
Phase 30 (specialist boundary)
    ↓
Phase 31 (curriculum integration)
```

Within those bands, execute strictly in numeric order because later catalog prerequisites depend
on earlier course evidence (AR-10).

## Success Criteria

The Guide course system is complete when:

1. All 246 tasks are verified.
2. All 29 Guide routes and both specialists are cataloged Complete.
3. Every learning outcome has immutable specification evidence.
4. Required labs/substitutes and implementation hardening pass.
5. No Guide duplicates component, specialist, API, or Reference ownership.
6. Navigation, links, snippets, examples, accessibility, security, and cleanup checks pass.
7. `yarn docs:build` and `yarn verify` pass.
8. Traceability, execution progress, and roadmap state are synchronized.
