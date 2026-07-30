## Ambiguity Register: Guide Course System

> **Status**: ✅ GATE PASSED — all 33 items resolved
> **Last Updated**: 2026-07-30 03:13

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
| 16 | Quality review (runtime) | How should the two Major Phase 1 review findings be resolved without weakening the approved course contract? | Correct the visible status-chord teaching and strengthen the immutable oracle across destinations, resize/maximize/restore, complete content, Classic surface, and reactive disposal / demote the course and defer correction / waive the findings | **Authority: AI — delegated by `--auto-design`.** Apply both technical corrections, rerun focused and authoritative gates, and use the one permitted re-review before Phase 2. | ✅ Resolved |
| 17 | Execution (runtime) | How should Phase 2 preserve its intentional red oracle under auto-commit? | Reuse the approved spec-to-green checkpoint and commit tasks 2.1.1–2.2.4 only after all gates turn green / commit the failing oracle / weaken or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Apply the independently challenged AR-13 policy to the Phase 2 task IDs and resume per-task commits after 2.2.4. | ✅ Resolved |
| 18 | Quality review (runtime) | How should the two Major and one Minor Phase 2 findings be resolved without weakening the completed orientation contract? | Compile a real bounded NodeNext consumer and probe real failure boundaries while correcting the course / demote and defer / waive the findings | **Authority: AI — delegated by `--auto-design`.** Apply every technical correction, rerun focused and authoritative gates, and use the one permitted fix-scoped re-review before Phase 3. | ✅ Resolved |
| 19 | Execution (runtime) | How should Phase 3 preserve its re-audit's intentional red oracle under auto-commit? | Reuse the approved spec-to-green checkpoint and commit tasks 3.1.1–3.2.4 only after all gates turn green / commit the failing oracle / weaken or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Apply the independently challenged AR-13 policy to the Phase 3 task IDs and resume per-task commits after 3.2.4. | ✅ Resolved |
| 20 | API accuracy (runtime) | Does a `topRight` stack layer have to re-anchor in the same render flush after resize or in its documented settled frame? | Verify the documented one-extra-frame settled state / change the correct lab to satisfy an unsupported same-flush assertion | **Authority: AI — delegated by `--auto-design`.** Preserve the public stack contract and flush the second settling frame before asserting the final anchor. | ✅ Resolved |
| 21 | Quality review (runtime) | How should the two Major Phase 3 findings be resolved without weakening the completed Layout contract? | Invalidate overlay layout immediately and correct the infeasible-minimum lesson with rendered and solver evidence / demote and defer / waive the findings | **Authority: AI — delegated by `--auto-design`.** Apply both technical corrections, rerun focused and authoritative gates, and use the one permitted fix-scoped re-review before Phase 4. | ✅ Resolved |
| 22 | Execution (runtime) | How should Phase 4 preserve its re-audit's intentional red oracle under auto-commit? | Reuse the approved spec-to-green checkpoint and commit tasks 4.1.1–4.2.4 only after all gates turn green / commit the failing oracle / weaken or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Apply the independently challenged AR-13 policy to the Phase 4 task IDs and resume per-task commits after 4.2.4. | ✅ Resolved |
| 23 | Quality review (runtime) | How should the two Major and one Minor Phase 4 findings be resolved without weakening the completed Reactive state contract? | Own both lab graphs through the host lifecycle, teach required layout invalidation, and make no-op batch feedback truthful / demote and defer / waive the findings | **Authority: AI — delegated by `--auto-design`.** Apply every technical correction, prove teardown through the authentic host lifecycle, rerun focused and authoritative gates, and use the one permitted fix-scoped re-review before Phase 5. | ✅ Resolved |
| 24 | Execution (runtime) | How should Phase 5 preserve its intentional red oracle under auto-commit? | Reuse the approved spec-to-green checkpoint and commit tasks 5.1.1–5.2.4 only after all gates turn green / commit the failing oracle / weaken or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Apply the independently challenged AR-13 policy to the Phase 5 task IDs and resume per-task commits after 5.2.4. | ✅ Resolved |
| 25 | Quality review (runtime) | How should the Phase 5 command-portability finding be resolved without weakening the completed Codex plugin contract? | Teach and verify package-manager-specific executable forwarding / retain a generic command that fails or misroutes flags / waive the finding | **Authority: AI — delegated by `--auto-design`.** Correct the Guide and canonical skill for npm, Yarn, pnpm, and Bun, rerun every applicable gate, and use the one permitted fix-scoped re-review before Phase 6. | ✅ Resolved |
| 26 | Execution (runtime) | How should Phase 6 preserve its intentional red oracle under auto-commit? | Reuse the approved spec-to-green checkpoint and commit tasks 6.1.1–6.2.4 only after all gates turn green / commit a failing repository / weaken or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Apply the independently challenged AR-13 policy to the Phase 6 task IDs and resume per-task commits after 6.2.4. | ✅ Resolved |
| 27 | Quality review (runtime) | How should the four Major and three Minor Phase 6 findings be resolved without weakening the Views & focus course contract? | Re-home newly ineligible focus synchronously, correct and assert the modal snippet, make pending modal teardown inert, restore 80×24 and ASCII evidence, clarify focus memory, and temporarily demote the course / defer or waive findings while retaining Complete status | **Authority: AI — delegated by `--auto-design`.** Apply every correction, keep the course at Upgrade until all gates and the one permitted fix-scoped re-review pass, then promote it in the same verified change. | ✅ Resolved |
| 28 | Naming (runtime) | Which stable IDs should distinguish the two Events, commands & keymaps laboratories? | `guides/event-routing` plus `guides/command-precedence` / implementation-shaped control names / reuse unrelated component examples | **Authority: AI — delegated by `--auto-design`.** Use the two outcome-shaped Guide IDs so one lab proves event routing and the other proves command/keymap precedence. | ✅ Resolved |
| 29 | Execution (runtime) | How should Phase 7 preserve its intentional red oracle under auto-commit? | Reuse the approved spec-to-green checkpoint and commit tasks 7.1.1–7.2.4 only after all gates turn green / commit a failing repository / weaken or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Apply the independently challenged AR-13 policy to the Phase 7 task IDs and resume per-task commits after 7.2.4. | ✅ Resolved |
| 30 | Quality review (runtime) | How should the four Major and two Minor Phase 7 findings be resolved without weakening the course contract? | Apply every routing, availability, diagram, and accessibility correction while temporarily demoting the course / defer or waive findings while retaining Complete | **Authority: AI — delegated by `--auto-design`.** Apply every correction, keep the course at Upgrade until all gates and the one permitted fix-scoped re-review pass, then promote it in the same verified change. | ✅ Resolved |
| 31 | Execution (runtime) | How should Phase 8 preserve its intentional red oracle under auto-commit? | Reuse the approved spec-to-green checkpoint and commit tasks 8.1.1–8.2.4 only after all gates turn green / commit a failing repository / weaken or quarantine the oracle | **Authority: AI — delegated by `--auto-design`.** Apply the independently challenged AR-13 policy to the Phase 8 task IDs and resume per-task commits after 8.2.4. | ✅ Resolved |
| 32 | Naming (runtime) | Which stable ID should identify the focused Keyboard & clipboard laboratory? | `guides/clipboard-boundary` / reuse `apps/editor` / choose an implementation-shaped widget name | **Authority: AI — delegated by `--auto-design`.** Use the outcome-shaped Guide ID so the laboratory remains owned by the cross-host clipboard lesson. | ✅ Resolved |
| 33 | Quality review (runtime) | How should the four Major and one Minor Phase 8 findings be resolved without weakening clipboard authorization, lifecycle, and authentic-laboratory evidence? | Correct every boundary and prove real event-loop reads while temporarily demoting the course / defer or waive findings while retaining Complete | **Authority: AI — delegated by `--auto-design`.** Apply all five technical corrections, keep the course at Upgrade until all gates and the one permitted fix-scoped re-review pass, then promote it in the same verified change. | ✅ Resolved |

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

**AR-16 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Correctness and test-hardening changes inside the already approved Introduction
  course contract; neither finding requires a product, scope, policy, or risk-acceptance decision.
- **Objective:** Resolve every blocking Phase 1 review finding before the next course begins.
- **Decision:** Display and bind **Alt+X** separately and accurately with
  `statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X')`. Extend the immutable oracle to prove Node
  terminal and browser-host destinations, render the visible quit chord, perform a real SE-grip
  resize of the dialog to an intermediate size, exercise maximize/restore from that geometry with
  complete content and shared template evidence, and prove the stage-panel binding stops after
  application disposal. Correct the related practice exercise.
- **Evidence:** The independent phase reviewer traced status rendering to the first `statusItem`
  argument and chord matching to its `key` field. The reviewer also showed that the previous
  maximize assertion could pass while meaningful content was clipped and that the catalog's runtime
  destinations and reactive cleanup were not explicit oracle requirements.
- **Rejected alternatives:** Demotion plus deferral would leave known defects in completed Phase 1
  work and block dependent courses. Waiving either Major finding is forbidden by the quality
  protocol and would weaken the confirmed completion contract.
- **Strongest counterargument:** The shared template harness already covers frame, padding, Classic
  surface, and clipping, so repeated calls add test cost. The new checks deliberately call that
  shared evidence collector only at the three geometry states whose behavior must remain distinct.
- **Confidence:** High — both fixes follow verified public source and reuse the real render/event
  loop rather than introducing mocks.
- **Hardening:** Independent phase review raised both findings. The one permitted fix-scoped
  re-review cleared the status, destination, content, restore, cleanup, and practice corrections but
  found that resizing only the terminal viewport did not exercise a compact dialog's resize seam.
  The final correction dispatches a real window-manager drag through the SE grip and must pass
  focused course tests, docs-site typecheck, and `yarn verify`; the protocol prohibits a third
  review.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The visible status API changes its label/key semantics, any geometry state
  loses content or shared template evidence, reactive writes reach a disposed stage panel, or the
  fix-scoped reviewer rejects the remediation.

**AR-17 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Commit sequencing for an expected-red specification phase under the already
  confirmed specification-first and auto-commit policies.
- **Objective:** Preserve the Phase 2 oracle's authoritative red evidence without committing a
  repository that fails `yarn verify`.
- **Decision:** Mark 2.1.1 and 2.1.2 complete with their factual focused-red evidence, defer their
  commit, and continue through 2.2.4. Commit and push tasks 2.1.1–2.2.4 as one spec-to-green slice
  only after the focused specification, docs-site typecheck, and `yarn verify` pass.
- **Evidence:** The independent spec author produced eight requirement-derived cases; the focused
  run failed seven and passed only the existing public-export validation. The identical policy
  conflict was independently challenged and resolved in AR-13.
- **Rejected alternatives:** Committing red violates the repository gate. Weakening or quarantining
  the oracle destroys the planned specification-first evidence.
- **Strongest counterargument:** Bundling four task IDs reduces commit granularity. It remains the
  smallest safe checkpoint because every earlier state intentionally fails the mandatory gate.
- **Confidence:** High — this is the previously approved and independently challenged policy applied
  to a new course's task IDs.
- **Hardening:** Reused AR-13's blind challenger ruling; a second challenge of the same unchanged
  policy was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The oracle unexpectedly turns green before implementation, an unrelated
  failure blocks the green checkpoint, or the repository gains an authoritative red-commit
  mechanism.

**AR-18 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Correctness and evidence hardening inside the confirmed Install & packages
  orientation contract; no scope, product, risk-acceptance, or policy choice is required.
- **Objective:** Resolve every blocking Phase 2 review finding before the Layout re-audit begins.
- **Decision:** Compile a bounded local consumer with the real TypeScript CLI, the documented
  NodeNext settings, all taught public symbols, and a valid relative `.js` import. Add negative
  compiler fixtures for an unsupported package subpath and an omitted relative extension. Probe
  `require('@jsvision/ui')` on the actual Node runtime and teach the observed import-condition
  failure separately from a guessed subpath. Describe `EBADENGINE` as a warning unless strict
  engine policy rejects it.
- **Evidence:** The independent reviewer showed that the previous test asserted compiler prose
  without invoking TypeScript, and verified that the import-only root export produces
  `ERR_PACKAGE_PATH_NOT_EXPORTED` with `No "exports" main defined`, not `ERR_REQUIRE_ESM`.
- **Rejected alternatives:** Demotion and deferral would leave known inaccuracies in a completed
  prerequisite course. Waiving either Major finding is prohibited by the quality protocol.
- **Strongest counterargument:** Real compiler subprocesses add several seconds to the focused
  suite. The zero-live-lab exception specifically promises authentic build-time evidence, so the
  bounded cost is necessary and proportionate.
- **Confidence:** High — the correction executes the shipped compiler and current Node runtime
  against the workspace packages without network access.
- **Hardening:** The single permitted fix-scoped re-review confirmed both Major findings and the
  Minor wording issue are resolved, with no remaining finding in scope.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The real consumer no longer compiles, a negative fixture stops failing, the
  root export gains a CommonJS condition, or package-manager engine behavior changes.

**AR-19 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Commit sequencing for an expected-red re-audit under the confirmed
  specification-first and auto-commit policies.
- **Objective:** Preserve the Phase 3 oracle's authoritative red evidence without committing a
  repository that fails `yarn verify`.
- **Decision:** Mark 3.1.1 and 3.1.2 complete with their factual focused-red evidence, defer their
  commit, and continue through 3.2.4. Commit tasks 3.1.1–3.2.4 as one spec-to-green slice only after
  focused specifications, docs-site typecheck, and `yarn verify` pass.
- **Evidence:** The independent spec author reconciled twelve final-contract cases; the focused run
  passed nine and exposed three content/evidence gaps.
- **Rejected alternatives:** Committing red violates the repository gate. Weakening or quarantining
  the oracle destroys the planned re-audit evidence.
- **Strongest counterargument:** Six task IDs in one checkpoint reduce commit granularity. They are
  the smallest safe unit because the intermediate oracle is intentionally red.
- **Confidence:** High — this is the previously approved and independently challenged policy applied
  to the Layout re-audit task IDs.
- **Hardening:** Reused AR-13's blind challenger ruling; a repeated challenge of the unchanged policy
  was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The oracle turns green before corrections, an unrelated failure blocks the
  green checkpoint, or the repository gains an authoritative red-commit mechanism.

**AR-20 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Test accuracy against an existing public layout behavior; no product or scope
  choice is involved.
- **Objective:** Verify the overlay laboratory's final responsive state without inventing a stronger
  timing guarantee than the public stack contract.
- **Decision:** Flush the second render frame before checking the top-right badge after maximize and
  restore. Keep every geometry, padding, clipping, and anchor assertion intact.
- **Evidence:** `packages/ui/src/view/dsl/stack.ts` documents that corner/edge layers self-correct
  during draw and settle one frame later. Existing implementation coverage already uses two flushes.
- **Rejected alternatives:** Changing the correct laboratory would encode an unsupported same-flush
  guarantee and duplicate layout-engine behavior in a docs example.
- **Strongest counterargument:** A test should prefer immediate results. Here immediacy contradicts
  the documented public behavior, while the reader-visible settled frame is the required outcome.
- **Confidence:** High — verified directly against stack source, public documentation, and existing
  implementation coverage.
- **Hardening:** The corrected oracle still drives a real SE-grip resize, maximize, restore, shared
  template evidence, and exact final anchors.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** Corner placement becomes same-frame, no longer settles after the second frame,
  or any final geometry assertion fails.

**AR-21 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Correctness and evidence hardening inside the confirmed Layout course contract;
  no product, scope, policy, or risk-acceptance choice is required.
- **Objective:** Resolve every blocking Phase 3 review finding before the Reactive state re-audit.
- **Decision:** Invalidate the shared overlay stack after every direct visibility mutation and teach
  that mounted visibility state requires layout invalidation. Verify immediate rendered removal
  through both documented Alt-hotkeys and visible mouse-button controls without an intervening
  resize. Correct the fractional-minimum lesson to explain that feasible floors bind but
  collectively infeasible floors proportionally compress, and prove the 16/30-to-7/13 result
  through the public layout solver.
- **Evidence:** The independent reviewer traced visibility to plain `ViewState` fields that require
  explicit invalidation and showed that the previous resize masked stale composition. The public
  apportionment solver proportionally redistributes an infeasible minimum set across the exact
  available track.
- **Rejected alternatives:** Demotion and deferral would leave known behavioral and conceptual
  defects in a completed prerequisite course. Waiving either Major finding is prohibited by the
  quality protocol.
- **Strongest counterargument:** The status signal already requests repaint and the UI solver owns
  its own unit tests. A repaint does not rebuild the stack's visible-child composition, and a
  full-course guide must independently prove the exact behavior it teaches through public APIs.
- **Confidence:** High — both corrections follow verified public source and are exercised through
  the real application render/event loop and public solver.
- **Hardening:** The one permitted fix-scoped re-review found no remaining Critical or Major issue.
  The final correction passes 23/23 focused Layout/catalog tests, docs-site typecheck, and
  authoritative `yarn verify`.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** A hidden layer remains painted after either activation path, visibility
  invalidation semantics change, infeasible fractional minimums stop filling the exact track, or
  the documented 7/13 result changes.

**AR-22 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Commit sequencing for an expected-red re-audit under the confirmed
  specification-first and auto-commit policies.
- **Objective:** Preserve the Phase 4 oracle's authoritative red evidence without committing a
  repository that fails `yarn verify`.
- **Decision:** Mark 4.1.1 and 4.1.2 complete with their factual focused-red evidence, defer their
  commit, and continue through 4.2.4. Commit tasks 4.1.1–4.2.4 as one spec-to-green slice only after
  focused specifications, docs-site typecheck, and `yarn verify` pass.
- **Evidence:** The independent spec author reconciled fifteen final-contract cases; the focused
  run passed thirteen and exposed two content-contract gaps.
- **Rejected alternatives:** Committing red violates the repository gate. Weakening or quarantining
  the oracle destroys the planned re-audit evidence.
- **Strongest counterargument:** Six task IDs in one checkpoint reduce commit granularity. They are
  the smallest safe unit because the intermediate oracle is intentionally red.
- **Confidence:** High — this is the previously approved and independently challenged policy applied
  to the Reactive state re-audit task IDs.
- **Hardening:** Reused AR-13's blind challenger ruling; a repeated challenge of the unchanged policy
  was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The oracle turns green before corrections, an unrelated failure blocks the
  green checkpoint, or the repository gains an authoritative red-commit mechanism.

**AR-23 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Correctness and evidence hardening inside the confirmed Reactive state course
  contract; no product, scope, policy, or risk-acceptance choice is required.
- **Objective:** Resolve every Phase 4 review finding before the Codex plugin course.
- **Decision:** Own each lab's complete build-time reactive graph in a root whose disposer is
  registered with the example host and, as an idempotent fallback, with dialog cleanup. Teach that
  direct mounted visibility mutations require layout invalidation, with one shared-container
  invalidation after grouped sibling changes. Report repeated equal batch and reset transactions as
  no-op writes instead of claiming an effect rerun.
- **Evidence:** Host-authentic tests build both examples without an ambient owner, observe no
  unowned-root warning, invoke the registered host cleanup, and prove subsequent actions cannot
  advance effect or cleanup counts. Rendered guide and interaction assertions cover the corrected
  invalidation and no-op feedback.
- **Rejected alternatives:** Demotion and deferral would leave lifecycle leaks and misleading
  beginner guidance in a completed prerequisite course. Waiving any finding is prohibited by the
  quality protocol.
- **Strongest counterargument:** Dialog cleanup alone could appear sufficient because the shared
  shell normally mounts the window. The example host owns the build contract, however, so its
  teardown must dispose the graph even when mounting never completes; the dialog hook is only the
  fallback for independent unmount.
- **Confidence:** High — the correction follows the public ownership API and is exercised through
  the real docs example host lifecycle.
- **Hardening:** The permitted fix-scoped re-review resolved both Major findings and the Minor
  finding with no remaining Critical, Major, or Minor issue. The final correction passes 29/29
  focused Reactive state/catalog tests, docs-site typecheck, and authoritative `yarn verify`.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** Either lab emits an unowned-root warning, a host teardown leaves reactive
  work live, direct visibility guidance omits invalidation, or equal transactions claim a rerun.

**AR-24 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Commit sequencing for an expected-red course upgrade under the confirmed
  specification-first and auto-commit policies.
- **Objective:** Preserve the Phase 5 oracle's authoritative red evidence without committing a
  repository that fails `yarn verify`.
- **Decision:** Mark 5.1.1 and 5.1.2 complete with their factual focused-red evidence, defer their
  commit, and continue through 5.2.4. Commit tasks 5.1.1–5.2.4 as one spec-to-green slice only after
  focused specifications, docs-site typecheck, plugin integrity, and `yarn verify` pass.
- **Evidence:** The independent spec author created eight final-contract cases; the focused run
  passed two and exposed six course-content and authentic-substitute gaps.
- **Rejected alternatives:** Committing red violates the repository gate. Weakening or quarantining
  the oracle destroys the planned upgrade evidence.
- **Strongest counterargument:** Six task IDs in one checkpoint reduce commit granularity. They are
  the smallest safe unit because the intermediate oracle is intentionally red.
- **Confidence:** High — this is the previously approved and independently challenged policy
  applied to the Codex plugin course task IDs.
- **Hardening:** Reused AR-13's blind challenger ruling; a repeated challenge of the unchanged
  policy was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The oracle turns green before corrections, an unrelated failure blocks the
  green checkpoint, or the repository gains an authoritative red-commit mechanism.

**AR-25 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Factual command portability and verification inside the confirmed Codex plugin
  course and shipped renderer skill; no product, scope, policy, or risk-acceptance choice is
  required.
- **Objective:** Resolve the Phase 5 review finding without teaching a package-manager command that
  fails or misroutes renderer flags.
- **Decision:** Replace the generic renderer invocation with explicit `npm exec --`, `yarn exec`,
  `pnpm exec`, and `bunx` forms. Require the Guide oracle to cover all four consumer command shapes
  and add implementation coverage that keeps the shipped renderer skill synchronized.
- **Evidence:** The generic `<package-manager> exec` form is invalid for Bun, while npm needs its
  option separator before renderer arguments to keep flags such as `--export` and `--keys` out of
  npm's parser.
- **Rejected alternatives:** Removing Bun contradicts the supported generator/package-manager
  surface. Keeping one abstract placeholder leaves users to discover incompatible syntax.
- **Strongest counterargument:** Four nearly identical commands add repetition. The repetition is
  bounded and makes the only meaningful package-manager differences explicit at the point of use.
- **Confidence:** High — the correction follows the package managers' documented executable
  invocation forms and is locked in both the course contract and shipped-skill hardening.
- **Hardening:** The correction passes 19/19 focused course/catalog tests, docs-site typecheck,
  plugin integrity, and authoritative `yarn verify`. The one permitted fix-scoped re-review found
  no remaining Critical, Major, or Minor issue.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** A supported manager changes its executable command contract, renderer flags
  stop forwarding unchanged, or the Guide and shipped skill diverge.

**AR-26 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Commit sequencing for an expected-red course upgrade under the confirmed
  specification-first and auto-commit policies.
- **Objective:** Preserve the Phase 6 oracle's authoritative red evidence without committing a
  repository that fails `yarn verify`.
- **Decision:** Mark 6.1.1 and 6.1.2 complete with their factual focused-red evidence, defer their
  commit, and continue through 6.2.4. Commit tasks 6.1.1–6.2.4 as one spec-to-green slice only after
  focused specifications, docs-site typecheck, and `yarn verify` pass.
- **Evidence:** The independent spec author created nineteen final-contract cases; three public
  retained-tree/focus/modal controls pass and sixteen course, catalog, and laboratory cases expose
  the placeholder implementation.
- **Rejected alternatives:** Committing red violates the repository gate. Weakening or quarantining
  the oracle destroys the planned course evidence.
- **Strongest counterargument:** Six task IDs in one checkpoint reduce commit granularity. They are
  the smallest safe unit because the intermediate oracle is intentionally red.
- **Confidence:** High — this is the previously approved and independently challenged policy
  applied to the Views & focus course task IDs.
- **Hardening:** Reused AR-13's blind challenger ruling; a repeated challenge of the unchanged policy
  was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The oracle turns green before corrections, an unrelated failure blocks the
  green checkpoint, or the repository gains an authoritative red-commit mechanism.

**AR-27 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Correctness, teardown safety, documentation accuracy, accessibility fallback,
  and verification mechanics inside the confirmed Views & focus learning outcomes; no product
  scope, acceptance criteria, security policy, or public compatibility decision changes.
- **Objective:** Resolve every Phase 6 quality finding and make the course's Complete stage mean
  that focused eligibility, modal disposal, snippets, compact geometry, and resilient text are
  independently verified.
- **Decision:** When hiding Beta or disabling Gamma while it owns focus, synchronously focus the
  next eligible retained-tree target in the same command. Correct the modal snippet to capture
  `execView<string>()` and distinguish its `undefined` host-teardown result. Give the modal lab an
  idempotent active lifetime and return from pending modal continuations after host disposal.
  Clarify that `Group.current` is active-chain state plus inactive restoration memory, replace
  decorative laboratory separators with ASCII-safe text, and assert the default 80×24 state before
  larger resize/maximize/restore evidence. Revert the catalog/map/task to Upgrade/pending
  verification until the one permitted re-review and all authoritative gates pass.
- **Evidence:** Independent review of `98f0a18ab..dde771c37` found focus left on newly hidden or
  disabled controls, an undefined `result` identifier in the teaching snippet, post-disposal modal
  continuation work, ambiguous `Group.current` prose, missing explicit default-viewport evidence,
  and decorative non-ASCII lab copy.
- **Rejected alternatives:** Deferral while retaining Complete would make the stage contradict the
  completion gate. Waiving findings is forbidden. Relying on later Tab traversal leaves focus
  observably invalid between actions. Removing modal teardown coverage would hide rather than fix
  stale continuation work.
- **Strongest counterargument:** Re-homing to a named next sibling couples the lesson to its small
  fixture order, and an active-lifetime flag adds state solely for teardown. The fixture is
  intentionally deterministic and teaches exact retained order; the flag is the smallest mechanism
  that prevents disposed owners from mutating UI while leaving normal modal restoration unchanged.
- **Confidence:** High — each correction follows the existing public focus, modal, lifecycle, and
  template1 contracts and has a direct observable assertion.
- **Hardening:** The mandatory independent reviewer supplied the findings. After 35/35 focused
  tests, docs-site typecheck, production docs build, plugin integrity, and authoritative
  `yarn verify` passed, the single allowed fix-scoped re-review resolved all four Major and three
  Minor findings with no remaining Critical, Major, or Minor issue.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** A newly ineligible focused target remains focused, pending modal settlement
  mutates a disposed application, the snippet no longer compiles against the public API, default
  80×24 evidence clips, ASCII fallback regresses, or the re-review retains a Critical or Major
  finding.

**AR-28 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Stable documentation-example naming within the confirmed two-laboratory Events,
  commands & keymaps scope; no product behavior, acceptance criterion, or external publication
  boundary changes.
- **Objective:** Give each laboratory one durable ID that states the distinct catalog outcome it
  proves and remains meaningful if its concrete controls evolve.
- **Decision:** Register the event-flow laboratory as `guides/event-routing` and the
  command/keymap laboratory as `guides/command-precedence`.
- **Evidence:** The catalog requires two examples and separately names event-tree tracing and
  command/keymap precedence. Existing Guide IDs use the `guides/<objective>` namespace and do not
  couple public registry identity to a widget implementation.
- **Rejected alternatives:** Control-shaped names would become stale as the teaching UI evolves.
  Reusing component examples would not prove the complete routing and precedence outcomes or
  establish Guide ownership.
- **Strongest counterargument:** The IDs omit the full course slug and could be read broadly.
  Their concise objective names remain unique, match the two learner outcomes exactly, and fit the
  existing registry namespace.
- **Confidence:** High — the choice is reversible before publication and grounded in the catalog's
  explicit two-part learning contract.
- **Hardening:** Low-risk naming choice checked against the catalog, registry namespace, and planned
  lab objectives; independent challenge was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** Either laboratory objective changes, an ID collision appears, or an existing
  published example proves the exact same outcome and framing before stage promotion.

**AR-29 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Commit sequencing for an expected-red course upgrade under the confirmed
  specification-first and auto-commit policies.
- **Objective:** Preserve the Phase 7 oracle's authoritative red evidence without committing a
  repository that fails `yarn verify`.
- **Decision:** Mark 7.1.1 and 7.1.2 complete with their factual focused-red evidence, defer their
  commit, and continue through 7.2.4. Commit tasks 7.1.1–7.2.4 as one spec-to-green slice only after
  focused specifications, docs-site typecheck, registry integration, and `yarn verify` pass.
- **Evidence:** The independent spec author created twenty-three executed final-contract cases; five
  public dispatch/keymap/command controls pass and eighteen course, catalog, registry, and laboratory
  cases expose the placeholder implementation.
- **Rejected alternatives:** Committing red violates the repository gate. Weakening or quarantining
  the oracle destroys the planned course evidence.
- **Strongest counterargument:** Six task IDs in one checkpoint reduce commit granularity. They are
  the smallest safe unit because the intermediate oracle is intentionally red.
- **Confidence:** High — this is the previously approved and independently challenged policy
  applied to the Events, commands & keymaps course task IDs.
- **Hardening:** Reused AR-13's blind challenger ruling; a repeated challenge of the unchanged policy
  was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The oracle turns green before implementation, an unrelated failure blocks the
  green checkpoint, or the repository gains an authoritative red-commit mechanism.

**AR-30 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Correctness, focus eligibility, documentation accuracy, accessible feedback, and
  verification mechanics inside the confirmed Events, commands & keymaps outcomes; no product
  behavior, public compatibility policy, security boundary, or acceptance criterion changes.
- **Objective:** Resolve every Phase 7 quality finding and make Complete mean that the real
  laboratory controls prove the routing, mouse, command-availability, and non-colour claims.
- **Decision:** Refocus the route probe before the Paste and Command buttons dispatch their teaching
  events, and cover both buttons through real mouse and keyboard activation. Record only mouse-down
  for the target-to-parent lesson and require an exact bounded trace. Bind the Save button's
  reactive `disabled` state to command availability, synchronously re-home focus before disabling
  it, and explain that plain command buttons need this explicit binding. Add `[FOCUSED]` ASCII cues
  to both custom targets and split the opening diagram so only key input enters keymap and Tab
  preprocessing. Return the catalog, curriculum map, completion allowlist, and task to Upgrade /
  in-progress until all gates and the single permitted fix-scoped re-review pass.
- **Evidence:** Independent review of `da449549c..b9ba9a93c` reproduced incomplete traces from the
  real Paste and Command buttons, a `target > parent > target` click trace, an enabled-looking
  focusable Save button after command disablement, over-broad routing prose, and colour-only custom
  focus state.
- **Rejected alternatives:** Keeping Complete while correcting contradicts the Guide completion
  gate. Waiving Major findings is forbidden. Testing direct loop dispatch again would not cover the
  learner-visible controls. Hiding the Save button would remove the state comparison instead of
  teaching correct availability.
- **Strongest counterargument:** Refocusing inside button callbacks changes focus immediately after
  activation. That transition is intentional and visible: the lab's objective is to demonstrate
  the focused route probe, and the persistent `[FOCUSED]` cue explains the active destination.
- **Confidence:** High — each correction follows public focus, Button, dispatch, and reactive
  contracts and has an observable implementation assertion.
- **Hardening:** The mandatory independent reviewer supplied the findings. The corrected demoted
  state passed 38/38 focused tests, docs-site typecheck, production docs build, plugin integrity,
  and authoritative `yarn verify`. The single allowed fix-scoped re-review resolved all four Major
  and two Minor findings with no correction-introduced regression and no remaining Critical,
  Major, or Minor issue. The final promoted state repeated the same focused and authoritative
  gates successfully.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** Either real routing button omits a phase, mouse-up re-enters the trace, the
  disabled Save button remains focusable or visually enabled, focus feedback again relies on
  colour, the diagram routes non-key events through keymaps, or the re-review retains a Critical or
  Major finding.

**AR-31 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Commit sequencing for an expected-red course upgrade under the confirmed
  specification-first and auto-commit policies.
- **Objective:** Preserve the Phase 8 oracle's authoritative red evidence without committing a
  repository that fails `yarn verify`.
- **Decision:** Mark 8.1.1 and 8.1.2 complete with their factual focused-red evidence, defer their
  commit, and continue through 8.2.4. Commit tasks 8.1.1–8.2.4 as one spec-to-green slice only after
  focused specifications, docs-site typecheck, registry integration, and `yarn verify` pass.
- **Evidence:** Phase 8 upgrades an existing thin course and reuses public clipboard behavior, so
  the independent final-contract oracle is expected to pass public controls while exposing course,
  catalog, registry, and focused-laboratory gaps.
- **Rejected alternatives:** Committing red violates the repository gate. Weakening, skipping, or
  quarantining the oracle destroys specification-first evidence.
- **Strongest counterargument:** Six task IDs in one checkpoint reduce commit granularity. They are
  the smallest safe unit because the intermediate oracle is intentionally red.
- **Confidence:** High — this is the independently challenged AR-13 policy applied to the Phase 8
  task IDs.
- **Hardening:** Reused AR-13's blind challenger ruling; a repeated challenge of the unchanged
  policy was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The oracle turns green before implementation, an unrelated failure blocks
  the green checkpoint, or the repository gains an authoritative red-commit mechanism.

**AR-32 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Stable documentation-example naming within the confirmed one-laboratory
  Keyboard & clipboard scope; no product behavior or external compatibility decision changes.
- **Objective:** Give the focused laboratory a durable ID that expresses its cross-host clipboard
  authorization lesson rather than a particular editor implementation.
- **Decision:** Register the laboratory as `guides/clipboard-boundary`.
- **Evidence:** The catalog requires one lab and names both consistent editing chords and
  native/browser/custom authorization choices. The lab must use deterministic virtual host seams,
  so the boundary is its durable learning objective.
- **Rejected alternatives:** Reusing `apps/editor` does not expose denial or adapter choice and is
  owned by a component/application example. A widget-shaped ID would become stale if the editing
  control changes.
- **Strongest counterargument:** The name does not mention keyboard chords. Chords are one visible
  input path within the broader canonical-versus-host boundary, while the course title and lab
  framing provide the keyboard context.
- **Confidence:** High — the name matches the catalog outcome and the existing
  `guides/<objective>` namespace.
- **Hardening:** Low-risk naming choice checked against the registry, catalog, and one-lab
  constraint; independent challenge was not proportionate.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** The laboratory objective changes away from clipboard authorization, an ID
  collision appears, or an existing published example proves the exact same outcome and framing.

**AR-33 (runtime):**

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Documentation accuracy, authentic public-seam examples, lifecycle cleanup,
  capability-state diagnosis, and verification mechanics within the confirmed Keyboard &
  clipboard outcomes; no product behavior, public compatibility, security policy, or acceptance
  criterion changes.
- **Objective:** Resolve every Phase 8 quality finding so Complete teaches the exact native,
  browser, OSC 52, custom-adapter, and lifecycle boundaries and proves real asynchronous read
  behavior.
- **Decision:** Explain that `systemClipboard: false` disables only the automatic OS adapter and
  retains capability-gated OSC 52, while strict app-local operation supplies an explicit no-op
  raw-text writer or a profile without OSC 52. Replace simulated failure and staleness with a
  deterministic `readClipboardText` adapter, real paste commands, real PasteEvent delivery, and
  focused accepted/discarded assertions. Make the custom-session teardown idempotently dispose the
  event loop and reactive owner. Treat unavailable as no adapter/no warning, denied as an attempted
  rejected write with a payload-free warning, seed canonical state through a direct deterministic
  paste rather than a host write, and correct the lab instructions to the actual
  unavailable → denied → authorized order. Return the catalog, curriculum map, completion
  allowlist, and task to Upgrade / in-progress until all gates and the one permitted fix-scoped
  re-review pass.
- **Evidence:** Independent review of the complete Phase 8 snapshot found that native opt-out prose
  contradicted the retained OSC 52 fallback, the flagship lab never invoked a native reader,
  lifecycle cleanup left the event loop alive, unavailable browser capability was presented as a
  rejected write, initial seeding attempted a host write, and the learner instructions described
  the wrong state order.
- **Rejected alternatives:** Keeping Complete while correcting contradicts the Guide completion
  gate. Waiving Major findings is forbidden. Label-only simulation cannot prove async ordering or
  stale-route guards. Treating unavailable as denial contradicts the public browser bridge, while
  removing unavailable from the lesson would weaken the confirmed authorization outcome.
- **Strongest counterargument:** The lab still needs immediate learner feedback even though the
  real read settles on a microtask. It may display that a deterministic outcome is pending, but
  final accepted/fallback delivery counts and focused tests must come from the actual PasteEvent
  route rather than labels alone.
- **Confidence:** High — every correction follows the current public event-loop, browser bridge,
  native run, OSC 52, and disposal implementations and has a direct observable assertion.
- **Hardening:** The mandatory independent reviewer supplied four Major and one Minor finding. The
  corrected demoted state passed 43/43 focused checks and every authoritative gate. The single
  allowed fix-scoped re-review resolved all original findings and reported one
  correction-introduced Minor: early Resolve armed the next pending read. That edge was corrected
  and the final promoted state passed 44/44 focused checks, docs-site typecheck, production docs
  build, plugin integrity, and authoritative `yarn verify`. No third review was requested.
- **Policy version:** 1.
- **Root invocation ID:** `exec-guides-20260729T185023Z`.
- **Reopen triggers:** Native opt-out is again called strict isolation, the lab no longer invokes
  the real reader/delivery route, teardown retains a live loop, unavailable emits a fabricated
  failure, canonical seeding touches a host, state-order instructions drift, or the re-review
  retains a Critical or Major finding.
