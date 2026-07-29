## Ambiguity Register: Guide Course System

> **Status**: ✅ GATE PASSED — all 15 items resolved
> **Last Updated**: 2026-07-29 21:05

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| 1 | Scope | Which documentation surface owns framework concepts, component behavior, exhaustive signatures, and evidence-oriented trust material? | Guide owns framework thinking and workflows; Components own widgets; API owns signatures; Reference owns trust evidence / allow overlap between surfaces | User confirmed the strict ownership boundary and cross-linking model. | ✅ Resolved |
| 2 | Feature gaps | Should the seven missing cross-cutting subjects be added to the curriculum or left for later discovery? | Add all seven now / retain only the existing sidebar topics | User confirmed adding all seven courses to the catalog. | ✅ Resolved |
| 3 | Scope | Should Data Grid and Code Editor be duplicated as Guide pages? | Treat their existing multi-page component hubs as specialist courses / create duplicate Guide courses | User confirmed the specialist-hub model with Guide cross-links and no duplicate course content. | ✅ Resolved |
| 4 | Technical unknowns | What owns Guide navigation and course completion metadata? | A validated `guides.json` catalog projects navigation / continue maintaining a handwritten sidebar | User confirmed the machine-readable catalog and validated navigation projection. | ✅ Resolved |
| 5 | UX & presentation | Should every curriculum entry use one identical page depth? | Use course, integration, orientation, and specialist profiles / force every entry into one page shape | User confirmed profile-based depth while retaining one shared quality contract. | ✅ Resolved |
| 6 | Scope | May this work align RD-08 and the docs-website roadmap with the confirmed curriculum? | Update the governing requirement and roadmap / leave planning artifacts inconsistent | User explicitly authorized both updates. | ✅ Resolved |
| 7 | Behavioral gaps | How should unfinished curriculum entries appear before their real pages exist? | Show them as Planned in the learner-facing map but omit them from the sidebar and avoid placeholder routes / publish placeholder pages | User confirmed cataloged planned entries with no placeholder navigation. | ✅ Resolved |
| 8 | Scope | What belongs in the Guide implementation plan? | Plan all 29 Guide routes, re-audit the two pilots, validate the two specialist hubs by cross-link, and leave RD-08's separate trust pages to a later plan / combine every RD-08 trust page into this Guide plan | User asked for a plan covering all Guides and confirmed that specialist hubs are cross-link-only; separate non-Guide trust pages remain outside this Guide-specific request. | ✅ Resolved |
| 9 | Testing | What command is the authoritative completion gate? | `yarn verify` after focused course checks / docs-package checks only | User confirmed the directive that requires focused docs checks, a documentation build, and the repository-wide `yarn verify` gate. | ✅ Resolved |
| 10 | Technical unknowns | What execution granularity should the multi-course plan use? | One independently verified phase per Guide route, plus specialist-boundary and final-integration phases / group several courses into large cohort phases | User confirmed one independently verified phase per Guide route followed by specialist-boundary and final-integration phases. | ✅ Resolved |
| 11 | Technical (runtime) | How can execution start when the transition API requires execution snapshots on closure-member node types that the execution gate refuses as targets, while three unrelated malformed graphs also block portfolio-wide transitions? | Add only the ten inaccessible closure-member snapshots, then add both plan-owned snapshots through one plan-target CAS refresh while temporarily isolating and byte-verifying the three unrelated graphs / bypass CAS entirely / modify the installed plugin or repair unrelated features | **Authority: AI — delegated by `--auto-design`.** Use the bounded snapshot repair and plan-target CAS validation described in AR-11 below. | ✅ Resolved |
| 12 | Naming (runtime) | What stable registry ID should the required Introduction-owned laboratory use? | `guides/introduction-runtime` / retain the unrelated `apps/hello` ID / choose an implementation-shaped name | **Authority: AI — delegated by `--auto-design`.** Use `guides/introduction-runtime` for the single lab that makes the application/runtime boundary visible. | ✅ Resolved |
| 13 | Execution (runtime) | How should auto-commit behave while the mandatory specification oracle intentionally makes the authoritative gate red? | Record the red tasks immediately and defer their commit until the first green checkpoint / commit a failing repository / skip or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Treat tasks 1.1.1–1.2.4 as one spec-to-green commit checkpoint, then resume per-task commits. | ✅ Resolved |
| 14 | UX (runtime) | What single observable interaction proves the Introduction lab's application/runtime mental model? | Cycle a three-stage app → host runtime → terminal frame pipeline with visible keyboard-driven feedback / show a static greeting / expose host-specific controls | **Authority: AI — delegated by `--auto-design`.** Use a bounded three-stage runtime pipeline with an Alt-hotkey to advance and visible current-stage feedback. | ✅ Resolved |
| 15 | API accuracy (runtime) | Which constructor belongs in the Introduction teaching snippet after the red oracle exposed a docs-only helper assumption? | Teach public `createApplication` / teach docs-only `demoApp` as if it were exported | **Authority: AI — delegated by `--auto-design`.** Correct the oracle before implementation and require `createApplication` from `@jsvision/ui`; retain `demoApp` only inside the live-example module. | ✅ Resolved |

### Resolution Notes

**AR-1:** The boundary keeps concept teaching discoverable without reproducing component or generated
API documentation.

**AR-2:** The added courses are Text/Unicode/terminal cells; Scrolling/lists/large content; Async
work/cancellation/progress; Application architecture/best practices; Accessibility/resilient
interaction; Terminal capabilities/portability; and Build a complete application.

**AR-3:** `/components/data-grid/` and `/components/code-editor/` remain their authoritative
specialist-course homes.

**AR-4:** The catalog records route, group, profile, stage, prerequisites, learning outcomes, live
example expectations, and registry IDs.

**AR-5:** Orientation and integration entries may be shorter when their subject is inherently
setup- or host-oriented; reduced depth does not waive accuracy, code-snippet, failure-mode, or
verification requirements.

**AR-6:** RD-08 and the docs-website roadmap may be modified by this work.

**AR-7:** A planned course is visible in the curriculum map but cannot create a dead sidebar route.

**AR-8:** This plan is the Guide-course slice of RD-08. Architecture, FAQ, standalone Security and
Performance evidence pages, compatibility matrices, theming reference/gallery, versioning, and
contributing remain governed by RD-08 but require a separate plan.

**AR-9:** Focused checks accelerate iteration; `yarn verify` remains the completion authority.

**AR-10:** The route-per-phase structure contains scope and review failures within one course and
follows the prerequisite graph. Specialist-boundary and final-integration phases verify the
cross-course contracts after every authored route is complete.

**AR-11 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Reversible execution tooling and recovery mechanics within the confirmed Guide
  scope; no product behavior, acceptance criterion, risk policy, or external publication changes.
- **Objective:** Enter execution only after the selected Guide plan's complete execution closure is
  current and deterministically validated, without modifying unrelated feature state.
- **Decision:** Add the ten execution snapshots owned by the RD, four specifications, and
  criterion directly because the execution gate rejects those node types as transition targets.
  Then submit one same-status public CAS refresh on `PLAN-RD08-GUIDES` that adds its two owned
  snapshots and validates the complete projected closure atomically. During that transition only,
  move the three structurally invalid sibling graphs (`clipboard-native`, `code-editor`, and
  `i18n`) into a temporary directory with guaranteed restoration, and require their checksums to
  match after restoration. Treat `TASK-RD08-GUIDES` as the aggregate plan lifecycle: it becomes
  implemented when execution starts and is verified only when all 246 Markdown tasks are complete;
  the Markdown task marks remain the per-task progress authority.
- **Evidence:** Targeted readiness reports exactly twelve missing Guide execution snapshots. The
  transition engine accepts `execution` only for plan targets, rejects criterion/specification
  snapshot refreshes as incompatible, appends validation additions only to the target node, and
  validates every discovered graph before resolving the selected target. The execution plan and
  traceability graph deliberately define one aggregate task for the complete plan.
- **Rejected alternatives:** Bypassing CAS for all twelve snapshots provides weaker atomic
  evidence. Modifying the installed CodeOps plugin or repairing unrelated feature graphs expands
  scope. Creating 246 new traceability tasks would redesign an already approved plan and still
  lacks a stable per-line semantic selector.
- **Strongest counterargument:** Directly adding ten validations is not itself an atomic public
  transition and temporarily isolating sibling graphs means the CAS validates the selected closure
  plus healthy graphs rather than the malformed full portfolio.
- **Confidence:** High — the workaround is bounded, reversible, and every snapshot revision is
  checked again by targeted readiness.
- **Hardening:** A blind independent challenger reviewed the engine and required the ten-direct plus
  two-CAS split, exact blocker-set deltas, temporary sibling checksums, and immediate restoration.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** Any selected upstream revision or status changes; readiness reports anything
  other than the expected two plan-owned blockers after the direct additions; CAS refuses; sibling
  checksums differ after restoration; CodeOps gains closure-member execution refresh support; or
  the three sibling graphs become structurally valid.

**AR-12 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Stable internal documentation-example naming within the already approved
  Introduction laboratory scope.
- **Objective:** Give the course-owned lab a durable ID that states its learning subject and fits
  the existing `guides/<course>-<objective>` namespace.
- **Decision:** Register the laboratory as `guides/introduction-runtime`.
- **Evidence:** The catalog requires one Introduction lab; the execution phase requires that lab
  under the Guide example family and an Introduction fixture; existing Guide IDs are stable,
  course-prefixed, objective-oriented names.
- **Rejected alternatives:** Keeping `apps/hello` would not identify Guide ownership or satisfy the
  planned Guide-family implementation path. An implementation-shaped name would couple the public
  registry ID to controls or layout that may evolve.
- **Strongest counterargument:** `runtime` is broader than a first-run hello example, so the lab
  must visibly teach the application/host relationship rather than merely render greeting text.
- **Confidence:** High — the name is reversible before publication and follows the established
  registry convention.
- **Hardening:** Low-risk naming choice; checked against the catalog, phase paths, and existing
  Guide IDs. Independent challenge was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The lab objective changes away from application/runtime orientation, or a
  conflicting published registry ID appears before stage promotion.

**AR-13 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Verification and commit sequencing inside the confirmed specification-first
  execution workflow.
- **Objective:** Preserve an authoritative red oracle without ever committing a repository whose
  required `yarn verify` gate fails.
- **Decision:** Mark 1.1.1 implemented when the oracle lands. After 1.1.2 captures the expected red
  evidence, promote both red tasks to complete but explicitly defer their commit. Continue through
  1.2.4 and commit/push tasks 1.1.1–1.2.4 as one indivisible spec-to-green slice only after the
  focused specification, docs-site typecheck, and `yarn verify` all pass. Resume per-task
  auto-commit after that checkpoint.
- **Evidence:** The plan requires an auto-discovered oracle and a red run before implementation.
  Project and git-commit policy prohibit staging or committing while the authoritative gate fails.
- **Rejected alternatives:** Committing red violates the hard commit gate. Skipping, renaming, or
  quarantining the oracle makes red evidence non-authoritative. Keeping completed red tasks marked
  partial until green makes the execution plan historically inaccurate.
- **Strongest counterargument:** A crash before green leaves completed red work uncommitted and the
  first commit spans several task IDs.
- **Confidence:** High — immediate two-stage marks preserve crash-safe progress, and the bounded
  commit is the smallest state that satisfies both specification-first and commit safety.
- **Hardening:** Blind independent challenge accepted the approach and required the explicit
  1.1.1–1.2.4 commit boundary and factual red evidence.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The new specification is not discovered by `yarn verify`, unexpectedly
  passes before implementation, an unrelated failure prevents the green checkpoint, or the
  repository adds a documented authoritative-red mechanism that keeps the full gate green.

**AR-14 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Reversible laboratory interaction design within the confirmed Introduction
  outcome and one-lab limit.
- **Objective:** Let a beginner see that application construction, host runtime, and rendered
  terminal output are distinct stages of one running JSVision program.
- **Decision:** Present all three stages together, highlight the current stage, and provide a
  keyboard-reachable Alt action that advances the highlight with visible explanatory feedback.
- **Evidence:** ST-10 requires the application/runtime model and a live first-run result; the lab
  contract requires one objective, keyboard access, meaningful states, and visible feedback.
- **Rejected alternatives:** A static greeting does not prove the runtime model. Host-specific
  controls introduce detail owned by later Node/browser courses.
- **Strongest counterargument:** A staged diagram is conceptual, so the example must also be a real
  mounted application rather than a decorative mock.
- **Confidence:** High — it directly operationalizes the stated outcome without adding scope.
- **Hardening:** Low-risk interaction choice checked against ST-10 and the shared laboratory
  contract; independent challenge was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** Source audit disproves the three-stage model or the compact 80×24 design
  cannot expose every stage and its instructions without clipping.

**AR-15 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Public API accuracy inside the confirmed first-application lesson.
- **Objective:** Ensure the beginner snippet can be copied into a consumer project using only
  supported package exports.
- **Decision:** Require `createApplication` imported from `@jsvision/ui` in the teaching snippet.
  The docs-only `demoApp` helper may implement the embedded laboratory shell but is never presented
  as consumer API.
- **Evidence:** `createApplication` is the documented public application entry point and exposes
  `run()`. `demoApp` lives in `packages/docs-site/src/demo-shell.ts` and is not exported by
  `@jsvision/ui`.
- **Rejected alternatives:** Teaching `demoApp` would create an invalid consumer import and violate
  the snippet contract.
- **Strongest counterargument:** The embedded lab necessarily uses `demoApp`; the page must explain
  that the browser demo host is documentation infrastructure, not part of the copyable snippet.
- **Confidence:** High — verified directly against public exports and application source.
- **Hardening:** Corrected before implementation and before any green run; independent challenge was
  not proportionate to an explicit export mismatch.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** `demoApp` becomes supported public API or `createApplication` ceases to be the
  public application constructor.
