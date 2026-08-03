# Preflight Report: JSVision Kanban Requirements

> **Status**: ✅ PASS — all 20 Iteration 1 findings resolved; final ownership rescan found 0 open findings
> **Iteration**: 3 (Phase A ownership corrections and complete rescan)
> **Artifact**: Full requirements set at `codeops/features/kanban/requirements/`
> **Graph Target**: `kanban/SET-KANBAN`
> **Artifact SHA-256 Set Digest**: `7f8685ad4e6f173e9b2b7235a2eacb48f426e9b53145ed988e79e52366777514`
> **Codebase Grounded**: 38 source/test/configuration files examined; 31 architecture and integration references verified
> **Modes**: `--auto-design`, `--explore-scope`
> **Last Updated**: 2026-08-03

## Audit Contract

| Item | Frozen value |
|---|---|
| Audit target | The full Kanban requirements set only |
| Context documents | `traceability.json`, Kanban roadmap/techdocs, repository source/tests/manifests, official comparable-product documentation |
| Modification set | User-authorized technical corrections for PF-001–PF-020 plus synchronized traceability and roadmap metadata; no product-scope expansion |
| Product-scope baseline | `README.md` Confirmed Scope plus AR-01 through AR-43 |
| Scope exploration | No optional addition survived the usefulness/overlap test; no Scope Expansion Register was created |
| Deterministic readiness | `READY` for the audit gate |

Auto-design resolution records below share this provenance:

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Technical correctness, feasibility, verification, dependency, or compatibility corrections inside the approved product behavior. No resolution expands product scope, accepts risk, changes priorities, or authorizes edits.
- **Objective:** Make the approved Kanban requirements internally consistent, implementable in the current JSVision architecture, and deterministically verifiable.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-preflight-20260803-01`.
- **Permission state:** The first scan was report-only; the user subsequently authorized all selected
  corrections. No implementation work was authorized or performed.
- **Hardening:** Five independent dimension-cluster reviews plus one blind challenger over the complete major-finding batch. The challenger converged on every selected resolution, strengthening PF-012 with a semantic primary-modifier abstraction.

## Codebase Context Summary

**Tech Stack:** Node 22+, ESM TypeScript, strict NodeNext, Yarn 1 workspaces, Turborepo, Vitest.

**Architecture:** Public packages live at `packages/*`. `@jsvision/ui` is a retained reactive view tree over
`@jsvision/core`; its public DSL constructs ordinary `Group`/`View` trees. Pointer capture is owned by one
event loop. Forms is Zod-backed. Core theme-role names are a closed `keyof Theme` union. Documentation uses
VitePress and hardcoded catalogs/registries. Runnable showcases are directories within the single
`@jsvision/examples` workspace.

**Key Files Examined:** `package.json`; sibling package manifests; Data Grid source/windowing/variants;
UI DSL, view, event-loop, pointer dispatch, and theme types; Core input/keymap/theme/contrast; Forms public
types/dialogs/tests; docs catalogs, registry, VitePress config, and `Template1Dialog`; examples workspace
and Vitest config; i18n review tooling; API/plugin/performance registries.

**Domain lenses:** Universal CodeOps lenses plus data-and-migration for saved-view schema evolution and
public compatibility. Compiler/language, financial, web-application, and distributed-system lenses do not
apply to this local terminal component.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 3 | 🟠 Major |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 2 | 🟠 Major |
| 4 | Completeness Gaps | 2 | 🟠 Major |
| 5 | Dependency Issues | 2 | 🟠 Major |
| 6 | Feasibility Concerns | 1 | 🟠 Major |
| 7 | Testability | 3 | 🟠 Major |
| 8 | Security Blind Spots | 1 | 🟠 Major |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 | 🟠 Major |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 5 | 🟠 Major |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 0 | None |
| 🟠 Major | 15 | Resolved and independently rescanned |
| 🟡 Minor | 5 | Resolved and independently rescanned |
| 🔵 Observation | 0 | None |

---

## Findings

The detailed entries below preserve the Iteration 1 audit record. Their selected resolutions were applied
after explicit user authorization and verified in the Iteration 2 table following PF-020.

### PF-001: View-only transitions conflict with the universal request dispatcher 🟠 MAJOR

**Dimension:** Logical Contradictions
**Location:** RD-01 mutation routing; RD-08 request scope; RD-09 restore behavior; RD-11 view configuration; RD-12 command routing
**Codebase Evidence:** `packages/datagrid/src/variant.ts` keeps capture/reconcile pure and application storage external.

**The Problem:** Saved-view apply, hide/collapse, and personalization are alternately specified as pure
local view transitions and `KanbanRequest` mutations. Read-only acceptance also requires saved-view apply
with zero dispatcher calls.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Classify local view transitions separately; only application-store save/rename/delete crosses the dispatcher/effect boundary | Preserves AR-33/36 and read-only behavior | Requires an explicit transition taxonomy |
| B | Dispatch every view change | One lifecycle | Contradicts pure restore and makes local UI state application mutation |

**Recommendation:** A. Classify state as ephemeral, durable local semantic view, or shared application-store mutation.
**Delegated Decision:** Selected A.
**Rejected alternatives:** B contradicts approved ownership and read-only acceptance.
**Strongest counterargument:** One dispatcher is simpler for telemetry and undo.
**Confidence:** High. **Challenger:** converged.
**Reopen trigger:** The application is made authoritative for every view transition, not merely persistence.

### PF-002: A placement token is incorrectly allowed to imply logical `end` 🟠 MAJOR

**Dimension:** Logical Contradictions
**Location:** RD-02 placement seam and AC-10; RD-08 semantic move; AR-32
**Codebase Evidence:** Data Grid windowing distinguishes loaded data from source completeness.

**The Problem:** One acceptance criterion allows a token to promote the last loaded edge to logical
`end`; AR-32 requires it to remain a token-bearing `window-edge`. A token makes an unknown edge
actionable, not complete.

**Recommendation:** Logical `start`/`end` require declared completeness. A valid token keeps the proposal
typed `window-edge` until an authoritative response proves the logical edge. This is the only viable
resolution; token-based promotion was rejected as stale-window guessing.
**Delegated Decision:** Selected.
**Strongest counterargument:** A token may resolve to no continuation, but that fact is known only after resolution.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** The source contract makes a token itself an authoritative completeness proof.

### PF-003: The limits manifest conflates defaults and ceilings and omits structural bounds 🟠 MAJOR

**Dimension:** Ambiguities
**Location:** RD-14 resource-budget table; AR-43
**Codebase Evidence:** Current JSVision APIs validate bounded ranges locally; no repository-wide absolute Kanban limits exist.

**The Problem:** One number is labeled “Default / hard ceiling,” while later text allows hard ceilings to
be raised against unspecified absolute limits. Exact maximum source columns, swimlanes, visible cursors,
and one `ensureRange` span are also absent despite source-result and allocation bounding claims.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Give every limit default, configurable maximum, and absolute maximum semantics; add missing structural/range limits | Deterministic and safe | Larger manifest |
| B | Make every listed value immutable | Simple | Unnecessarily restricts legitimate hosts and contradicts advanced overrides |

**Recommendation:** A, retaining explicitly immutable limits such as the 32-row custom descriptor cap.
**Delegated Decision:** Selected A.
**Strongest counterargument:** Three limit classes increase configuration complexity.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** All limits become intentionally non-configurable hard caps.

### PF-004: Phase A claims card and column behavior owned by Phase B 🟠 MAJOR

**Dimension:** Ordering & Sequencing
**Location:** README dependency rule and Suggested Implementation Order
**Codebase Evidence:** No existing Kanban implementation supplies the promised Phase-A read-only board.

**The Problem:** Phase A promises basic column/card rendering while mapping only RD-01 through RD-03;
RD-04 and RD-05 own those behaviors. This silently borrows later acceptance contracts.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add explicitly bounded foundational RD-04/05 slices and tests to Phase A | Authentic viewport vertical slice | Requires slice-level traceability |
| B | Defer authentic board rendering to Phase B | Clean RD boundaries | Phase A cannot validate representative geometry/windowing |

**Recommendation:** A, labeled foundation versus later completion.
**Delegated Decision:** Selected A.
**Strongest counterargument:** Partial RD ownership can blur completion claims.
**Confidence:** High. **Challenger:** converged.
**Reopen trigger:** Phase A is intentionally reduced to headless contracts with no authentic viewport claim.

### PF-005: Dependency metadata omits real RD edges and the diagram is not a complete DAG 🟠 MAJOR

**Dimension:** Dependency Issues
**Location:** RD-11/RD-12 headers, README index/graph, `traceability.json`
**Codebase Evidence:** Data Grid personalization depends directly on its variant capture/resolve contracts.

**The Problem:** RD-11 and RD-12 consume RD-09 view/search/personalization contracts without declaring
the dependency. The README graph also omits several dependencies present in its own table, allowing an RD
to appear ready before its inputs exist.

**Recommendation:** Add direct RD-09 edges to RD-11/RD-12, synchronize traceability and roadmap data, and
replace the diagram with the complete DAG. Removing the downstream behavior was rejected because it is
approved scope.
**Delegated Decision:** Selected.
**Strongest counterargument:** A complete graph is visually denser.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** The view integrations move into a separate later RD.

### PF-006: Kanban theme-role ownership and readable fallback are undefined 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** RD-04 descriptor roles; RD-13 semantic theme contract and AC-13
**Codebase Evidence:** `packages/core/src/engine/color/theme.ts` defines a closed complete `Theme`;
`packages/ui/src/view/types.ts` restricts role names to `keyof Theme`; Code Editor uses a package-local
palette/resolver; Core and Code Editor expose deterministic contrast calculation.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Define package-local `KanbanTheme` tokens derived from core roles, exact fallback order, effective-depth contrast threshold, and non-color cues | Matches specialist precedent; contains compatibility | Another component palette |
| B | Extend Core `Theme`, every preset/builder/serializer/theme-designer surface | Global uniformity | Broad compatibility and migration impact; omitted roles are impossible in the current type |

**Recommendation:** A, using a deterministic 4.5 text/background threshold at effective color depth
without claiming WCAG conformance.
**Delegated Decision:** Selected A.
**Strongest counterargument:** Package-local palettes may drift across components.
**Confidence:** High. **Challenger:** converged.
**Reopen trigger:** JSVision adopts extensible global theme-role registration as a separate framework change.

### PF-007: The Forms-backed standard schema omits the Zod dependency contract 🟠 MAJOR

**Dimension:** Dependency Issues
**Location:** RD-01 package boundary; RD-10 schema and Forms lifecycle
**Codebase Evidence:** `packages/forms/src/types.ts` requires Zod object schemas; Forms does not re-export
Zod and declares `zod: ^4` as a peer dependency.

**Recommendation:** Declare `zod: ^4` as Kanban peer and development dependency, keep it behind a narrow
Kanban schema adapter, and test packed-consumer peer behavior. A new non-Zod Forms bridge was rejected as
larger framework scope.
**Delegated Decision:** Selected.
**Strongest counterargument:** A public peer adds consumer/version coupling.
**Confidence:** High. **Challenger:** converged.
**Reopen trigger:** Forms publishes a stable non-Zod schema bridge before Kanban implementation.

### PF-008: The showcase path is not a separate workspace and its local tests are undiscovered 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** RD-15 showcase requirements and acceptance
**Codebase Evidence:** Root workspaces match only `packages/*`; `packages/examples` is the actual workspace;
its Vitest config includes selected directories and not a future `kanban-showcase/**` tree.

**Recommendation:** Keep `packages/examples/kanban-showcase/`, describe it as an independently runnable
application within `@jsvision/examples`, add `demo:kanban`, dependency wiring, and explicit unit/E2E test
includes. A top-level workspace is viable only if the approved path changes; overlapping nested workspaces
were rejected.
**Delegated Decision:** Selected.
**Strongest counterargument:** A separate workspace gives cleaner isolation.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** The user explicitly moves the showcase to `packages/kanban-showcase/`.

### PF-009: Central docs, locale, API, plugin, and performance registries can silently omit Kanban 🟠 MAJOR

**Dimension:** Completeness Gaps
**Location:** RD-13/RD-15 integration and release gates
**Codebase Evidence:** `tools/i18n-locale-exports.json`, docs component/API/example registries, VitePress
configuration, plugin API/impact maps, and performance scripts use explicit allowlists.

**Recommendation:** Enumerate every current central registration point in RD-13/RD-15 and add omission-
detecting assertions, including docs-site dependency/catalog/sidebar/example family, i18n exports,
generated API, plugin impact/update, and performance inventory. Registry auto-discovery is worthwhile but
separate infrastructure scope.
**Delegated Decision:** Selected.
**Strongest counterargument:** Manifest-driven discovery would solve this globally.
**Confidence:** High. **Challenger:** converged.
**Reopen trigger:** Those registries become manifest-discovered before Kanban lands.

### PF-010: Same-frame capture-loss cleanup has no public UI notification seam 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** RD-07 capture-loss recovery; RD-14 teardown
**Codebase Evidence:** `packages/ui/src/event/event-loop.ts` silently clears `captureTarget` on modal
transitions; dispatch exposes `setCapture`, `releaseCapture`, and `hasCapture`, but no loss callback. The
board is outside modal dispatch after the loss.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add a UI capture lease with synchronous loss notification for replacement, modal, unmount, host loss, and disposal | Makes approved cleanup implementable; reusable | Cross-package UI API change |
| B | Weaken recovery to package-controlled modal openings that pre-cancel | Smaller | Arbitrary modal/capture takeover still violates the requirement |

**Recommendation:** A.
**Delegated Decision:** Selected A.
**Strongest counterargument:** It expands UI for one component, although the lifecycle gap affects every drag control.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** The same-frame arbitrary capture-loss guarantee is explicitly removed.

### PF-011: `check:deps` cannot prove the acceptance criterion attributed to it 🟠 MAJOR

**Dimension:** Testability
**Location:** RD-01 AC-10
**Codebase Evidence:** `scripts/check-no-native-deps.mjs` checks already-declared dependencies for native
signals; it does not scan source imports against the package manifest.

**Recommendation:** Extend or split the gate to validate external imports against manifest entries,
retain native dependency scanning, and add packed-consumer runtime/type/export-map smoke coverage. Merely
renaming the AC to native-only was rejected because the minimal publishable dependency boundary still
needs evidence.
**Delegated Decision:** Selected.
**Strongest counterargument:** Static ESM import validation has edge cases; packed-consumer smoke closes them.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** Another authoritative repository gate begins proving undeclared imports.

### PF-012: `Cmd` interaction is not representable through the normalized input model 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** RD-06 modifier interactions; RD-12 keymap defaults
**Codebase Evidence:** Core key/mouse events and keymap expose only Ctrl/Alt/Shift. Browser DOM observes
`metaKey`, but the normalized event/keymap cannot carry it; terminal SGR has no distinct Command bit.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Use portable Ctrl defaults and optional application alias | Small | Does not truly satisfy a required web Command route |
| B | Add semantic primary-modifier binding: Cmd on capable macOS browser hosts, Ctrl elsewhere; preserve raw meta only where observable | Honest host parity and modern web UX | Cross-package core/web input work |

**Recommendation:** B, with terminal documentation explicitly stating the Ctrl fallback.
**Delegated Decision:** Selected B after challenger strengthened the initial candidate.
**Strongest counterargument:** Core event/keymap expansion carries compatibility cost.
**Confidence:** High. **Hardening:** recommendation changed. **Challenger:** converged on B.
**Reopen trigger:** Product scope standardizes Ctrl on every host and removes Command acceptance.

### PF-013: “Official” locale correctness has no review-evidence acceptance 🟠 MAJOR

**Dimension:** Testability
**Location:** RD-13 catalog acceptance; RD-14/RD-15 release gates
**Codebase Evidence:** `scripts/check-i18n-reviews.mjs` already validates digest-bound, method-disclosed
`ai-assisted` or `proficient-human` review records; normal catalog parity tests cannot prove translation
correctness.

**Recommendation:** Require current digest-bound review evidence for every non-English Kanban catalog and
run `yarn i18n:reviews:check` at release. Never describe AI-assisted evidence as proficient-human. Calling
unreviewed catalogs official was rejected.
**Delegated Decision:** Selected.
**Strongest counterargument:** Formal review evidence slows localization.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** The user chooses to ship affected locales explicitly labeled unverified.

### PF-014: Required native PTY E2E has no real PTY harness 🟠 MAJOR

**Dimension:** Feasibility Concerns
**Location:** AR-38; RD-07 AC-15; RD-14 verification and AC-16
**Codebase Evidence:** Current host E2E deliberately uses advertised pipe streams; tests explicitly say
“No pseudo-terminal” and defer real SIGWINCH/TTY behavior.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add dev/test-only real PTY on Unix and platform-scoped ConPTY evidence on Windows | Satisfies approved AR-38 honestly | Cost and CI complexity |
| B | Redefine as pipe-backed host tests plus manual native review | Cheaper | Reopens the approved automated host-evidence contract |

**Recommendation:** A; keep pipe-backed tests as a lower layer and scope OS assertions honestly.
**Delegated Decision:** Selected A.
**Strongest counterargument:** ConPTY CI can be expensive and flaky.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** The user explicitly weakens AR-38's native automated evidence requirement.

### PF-015: Trusted same-thread JavaScript callbacks cannot be sandboxed or pre-empted 🟠 MAJOR

**Dimension:** Security Blind Spots
**Location:** RD-01 renderer boundary; RD-04 purity/host-access claims; RD-14 bounded custom work and security boundary
**Codebase Evidence:** Renderers/resolvers are direct application callbacks in the same JavaScript realm;
the component can validate their arguments/results but cannot prevent closure/import side effects or stop
an infinite synchronous callback.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Declare callbacks trusted; bound package inputs, outputs, calls, cancellation, and failure handling; make callback runtime/side effects application-owned | Truthful and feasible | Weaker-sounding safety boundary |
| B | Serialize work into a restricted external execution service with termination/capability quotas | Stronger isolation | Different architecture; ordinary workers alone are not a security sandbox |

**Recommendation:** A.
**Delegated Decision:** Selected A.
**Strongest counterargument:** It cannot protect the UI from malicious or non-terminating application code.
**Confidence:** Very high. **Challenger:** converged.
**Reopen trigger:** A separately approved restricted execution runtime becomes part of JSVision.

### PF-016: Hidden swimlane cards can be misread as `unassigned` 🟡 MINOR

**Dimension:** Ambiguities
**Location:** RD-05 swimlane grouping
**The Problem:** “Exactly one visible group or unassigned” conflicts with hidden-group omission and can
remap a valid hidden membership into the visible unassigned band.

**Recommendation:** Resolve every card to one semantic group, visible or hidden; use `unassigned` only
for missing/unmapped values, then omit hidden groups in the view projection.
**Delegated Decision:** Selected; remapping was rejected because it contradicts AR-37.
**Confidence:** High.
**Reopen trigger:** Hidden-group membership is intentionally exposed through unassigned.

### PF-017: Drag input assumes an unavailable pointer ID and leaves threshold math undefined 🟡 MINOR

**Dimension:** Codebase Alignment
**Location:** RD-07 pointer state machine, threshold, validation, and AC-1
**Codebase Evidence:** Core `MouseEvent` has button/coordinates/modifiers and one global capture target;
there is no pointer ID.

**Recommendation:** Use the single terminal pointer, button, and a gesture-generation token. Define
Manhattan distance and start dragging when `abs(dx) + abs(dy) >= threshold`; default one therefore starts
on the first cell transition. Adding a synthetic pointer ID was rejected because touch/native GUI drag is
out of scope.
**Delegated Decision:** Selected.
**Confidence:** High.
**Reopen trigger:** Core adds real multi-pointer identity and Kanban expands to touch/multi-pointer input.

### PF-018: Saved-extension preservation mixes byte identity with normalized JSON 🟡 MINOR

**Dimension:** Ambiguities
**Location:** RD-09 saved-view compatibility and AC-11
**The Problem:** “Byte-semantically within normalized JSON” combines incompatible contracts: canonical
normalization may change whitespace, key order, and number spelling.

**Recommendation:** Require JSON-value equality after documented canonical normalization. Exact raw bytes
would require a second raw-envelope channel and was rejected as unnecessary.
**Delegated Decision:** Selected.
**Confidence:** High.
**Reopen trigger:** Exact third-party signature/byte preservation becomes an explicit requirement.

### PF-019: Spec-test immutability is not defined as an auditable change-control rule 🟡 MINOR

**Dimension:** Testability
**Location:** README test workflow; AR-38; RD-14 verification architecture
**Codebase Evidence:** Naming and comments call specification tests immutable, but no hash gate exists.

**Recommendation:** Define immutable as normative: a spec test changes only with an accepted requirements/
AR update and traceability/review evidence; creation order is evidenced by git history. Permanent hashes
were rejected as high-maintenance and hostile to legitimate requirement changes.
**Delegated Decision:** Selected.
**Confidence:** High.
**Reopen trigger:** The repository adopts an authoritative spec-test baseline/hash system.

### PF-020: The requested comparable-product research has no durable evidence matrix 🟡 MINOR

**Dimension:** Completeness Gaps
**Location:** `_draft/discovery-notes.md`, Comparable-system evidence
**The Problem:** The artifact says current official Azure DevOps, Jira, GitHub Projects, and Trello
documentation was researched, but records no URLs, retrieval date, capability-to-source mapping, or
accepted/adapted/rejected rationale. The user's explicit “best of” research objective is therefore not
independently auditable or refreshable.

**Current official evidence verified:** Azure documents WIP, columns, swimlanes, card customization, and
filtering; Jira documents field-driven swimlanes, quick filters, card fields, and density; GitHub documents
custom board columns, horizontal field sections, multi-item drag, limits, summaries, sort/group/filter;
Trello documents labels with non-color mode, filters, dates, checklists, and card creation between cards.

**Recommendation:** Add a dated durable research appendix/matrix linking official sources to each adopted,
adapted, rejected, or application-owned capability. This records evidence only; it adds no product scope.
**Delegated Decision:** Selected.
**Evidence sources:**

- <https://learn.microsoft.com/en-us/azure/devops/boards/?view=azure-devops>
- <https://support.atlassian.com/jira-software-cloud/docs/configure-swimlanes/>
- <https://support.atlassian.com/jira-software-cloud/docs/customize-your-view-of-the-board-and-backlog/>
- <https://docs.github.com/en/enterprise-cloud@latest/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout>
- <https://support.atlassian.com/trello/docs/adding-checklists-to-cards/>
- <https://support.atlassian.com/trello/docs/adding-cards/>

**Confidence:** High.
**Reopen trigger:** The complete sourced comparison already exists elsewhere and is linked from this set.

## Iteration 2 Resolution Evidence

| Finding | Result | Corrected evidence |
|---|---|---|
| PF-001 | ✅ Resolved | RD-01/RD-08/RD-09/RD-12 classify ephemeral, durable-local, and application-store transitions |
| PF-002 | ✅ Resolved | RD-02 AC-10 and RD-08 require authoritative completeness for logical `end` |
| PF-003 | ✅ Resolved | RD-14 defines safe defaults, standard ceilings, absolute maxima, and missing structural/range bounds |
| PF-004 | ✅ Resolved | README Phase A names RD-04 AC 1–2 and RD-05 AC 1/18; RD-05 AC-18 proves populated ordered rendering |
| PF-005 | ✅ Resolved | RD-11/RD-12, README DAG, roadmap, and `traceability.json` include RD-09 dependencies |
| PF-006 | ✅ Resolved | RD-13 owns `KanbanTheme` and defines Core-helper quantization, 4.5 oracle, `NaN`, tie, and emergency fallback |
| PF-007 | ✅ Resolved | RD-01/RD-10 require `zod: ^4` peer+development dependency behind the standard-schema adapter |
| PF-008 | ✅ Resolved | RD-15 keeps the showcase inside `@jsvision/examples` with explicit launch and Vitest discovery |
| PF-009 | ✅ Resolved | RD-13/RD-15 enumerate and omission-test docs, locale, API, plugin, performance, and examples registries |
| PF-010 | ✅ Resolved | RD-07 requires a synchronous UI capture-loss lease and same-frame generation invalidation |
| PF-011 | ✅ Resolved | RD-01 separates import-manifest/native checks and requires packed-consumer evidence |
| PF-012 | ✅ Resolved | RD-12 defines semantic Primary plus the pre-xterm DOM pointer/meta/cell/dedup adapter and fixtures |
| PF-013 | ✅ Resolved | RD-13–RD-15 require digest-bound locale review evidence and `yarn i18n:reviews:check` |
| PF-014 | ✅ Resolved | RD-07/RD-14 require real Unix PTY and platform-scoped ConPTY-equivalent evidence; pipes stay lower-layer |
| PF-015 | ✅ Resolved | RD-04/RD-14 classify callbacks as trusted and bound only package-controlled inputs/results/invocations |
| PF-016 | ✅ Resolved | RD-05 resolves semantic membership before hidden-group projection and reserves `unassigned` for missing values |
| PF-017 | ✅ Resolved | RD-07 uses one pointer, button, gesture generation, and exact Manhattan `>=` threshold |
| PF-018 | ✅ Resolved | RD-09 defines semantic JSON equality and canonical serialization precisely |
| PF-019 | ✅ Resolved | README/RD-14 define normative spec-test change control and git-history ordering evidence |
| PF-020 | ✅ Resolved | Discovery notes contain a dated official-source capability/disposition matrix |

Two independent Iteration 2 reviewers checked PF-001–PF-020 against the corrected artifacts and current
repository. Their four initially residual concerns (PF-004, PF-006, PF-012, PF-018) were corrected and
rechecked to PASS. No new critical or major finding was identified.

## Iteration 3 Phase A Ownership Evidence

The Phase A plan preflight exposed requirement wording that prematurely activated later-owned behavior.
The authorized correction retained every approved product capability while clarifying its owning RD:

| Correction | Final ownership |
|---|---|
| Runtime schema validation, Zod, and Forms | RD-10; Phase A publishes TypeScript card shapes only |
| Focus/selection event identity and focus/help disclosure | RD-06/RD-12/RD-13; Phase A retains identity and semantic inspection metadata |
| Active compact insertion gaps | RD-07; Phase A defines passive bounded geometry |
| Windowed identity reveal | RD-02 supplies optional bounded/cancellable `locateCard`; RD-03 consumes it without scanning |
| Conditional layout reflow | RD-03 proves the real focused-column navigator row; later bands reuse the seam |
| Standalone viewport lifecycle | RD-01 requires exported read options and exactly one coordinator per viewport |

Three independent final cluster reviews found zero open critical, major, or minor requirement findings.
The corrected set preserves its original scope and passes the deterministic `kanban/SET-KANBAN` audit
gate with 0 blockers and 0 problems.

## Verification Evidence

| Check | Result |
|---|---|
| CodeOps audit readiness for `kanban/SET-KANBAN` | `READY` |
| Finding IDs | PF-001–PF-020 present exactly once |
| Acceptance criteria | 246 criteria; every RD sequence contiguous |
| Local Markdown links | Pass |
| `git diff --check` | Pass |
| `yarn verify:local` | Pass for 43 changed files using the existing adjacent workspace dependency tree; no dependency installation or lockfile change |

## Scope Exploration Result

No `SE-*` proposal was retained. Quick creation, checklist metadata, aging indicators, dependencies,
and other comparable-product ideas are already expressible through the approved create-dialog,
presentation, field, summary, action, or application-owned extension seams. Promoting them to new mandatory
component behavior would duplicate existing contracts rather than add a distinct capability.

## Verdict

**✅ PREFLIGHT PASS — zero critical, major, or minor findings remain open.**

All 20 selected technical corrections were explicitly authorized, applied, synchronized to traceability,
and rescanned against the unchanged `kanban/SET-KANBAN` requirement-set target. Deterministic graph
readiness is `READY`; acceptance-criteria numbering and local Markdown links pass. The requirements may
advance to RD Preflighted and planning may begin from the dependency-ordered Phase A boundary.

The requirements are architecturally foundational. Independent clustered review and a blind challenger
were used, but a human specialist review remains worthwhile before the first public API is stabilized.
