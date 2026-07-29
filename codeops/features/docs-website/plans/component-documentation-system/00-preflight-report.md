# Preflight Report: Component Documentation System

> **Status**: ✅ PASSED — all 15 findings resolved and verified
> **Iteration**: 3 (bounded verification after iteration-2 remediation)
> **Artifact**: Full implementation plan at
> `codeops/features/docs-website/plans/component-documentation-system/`
> **Audit target**: The 12 plan Markdown files, grounded against the authorized supporting artifacts
> **Artifact hash**: `sha256:4c5ceecbf81b36a6d1a85eb087cc105f1665a94034b5e8fb432f1b498f2846db`
> **Graph target**: `docs-website/PLAN-RD05`
> **Codebase grounded**: 38 source, test, configuration, and manifest files examined
> **Last updated**: 2026-07-29
> **Auto-design**: Active under policy version 1; eligible resolutions were delegated and recorded

The same agent authored the plan in an earlier turn. To reduce same-agent bias, the review used five
independent dimension-cluster auditors and one blind design challenger. Iteration 2 rescanned all
13 dimensions after the authorized remediation. A bounded iteration-3 verifier then confirmed that
the residual major findings were closed without introducing a direct adverse consequence.

## Scope and Context

| Role | Artifacts |
|---|---|
| Audit target | The 12 Markdown files in this plan, excluding this report and transient continuity notes |
| Grounding context | `AGENTS.md`, source, tests, manifests, installed VitePress behavior, and CodeOps lifecycle tooling |
| Authorized modification set | The plan, RD-05, requirements ambiguity register, traceability graph, docs-website roadmap, and this report |
| Selected domain lenses | Web application; data and migration because documented routes and backlinks are replaced |

## Deterministic Readiness

The target-scoped CodeOps audit and execution readiness gates resolve
`docs-website/PLAN-RD05` as approved and ready. Unrelated portfolio graph errors remain outside this
feature's authorized scope and do not affect the canonical target result.

## Codebase Context Summary

| Area | Verified state |
|---|---|
| Stack | Node 22+, ESM TypeScript, Yarn 1 workspaces, Turborepo, VitePress 1.6.4, Vitest 4.1.10 |
| Docs architecture | Markdown pages, hand-authored lazy example registry, Vue Play component, VitePress multi-sidebar config, generated TypeDoc with a checked-in API backlink map |
| Current coverage | 33 component Markdown files; 7 component-oriented live examples; 22 `PlayComingSoon` pages; Tabs has no Play block |
| Template baseline | Button, Input, and Text are real `kind: 'app'` examples with Classic shell, centered Dialog, and focused specs |
| Data Grid evidence | 67 shipped stories plus one roadmap placeholder |
| Code Editor evidence | 20 ordinary runtime scenarios plus 11 generated QA scenarios: 31 total |
| Sidebar behavior | VitePress sorts multi-sidebar prefixes by path depth before matching |
| Test environment | One Node-only Vitest project; no Vue DOM/component-mount test project |

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 2 | 🟠 Major |
| 2 | Implicit Assumptions | 3 | 🟠 Major |
| 3 | Logical Contradictions | 3 | 🟠 Major |
| 4 | Completeness Gaps | 5 | 🟠 Major |
| 5 | Dependency Issues | 3 | 🟠 Major |
| 6 | Feasibility Concerns | 2 | 🟠 Major |
| 7 | Testability | 8 | 🟠 Major |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 | 🟡 Minor |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 3 | 🟠 Major |
| 12 | Consistency | 3 | 🟠 Major |
| 13 | Codebase Alignment | 9 | 🟠 Major |

## Summary by Severity

| Severity | Count | Status |
|---|---:|---|
| 🔴 Critical | 0 | None |
| 🟠 Major | 10 | Resolved and verified |
| 🟡 Minor | 5 | Resolved and verified |
| 🔵 Observation | 0 | None |

---

## Remediation and Verification

| Pass | Result |
|---|---|
| Iteration 1 | Found 10 major and 5 minor issues; auto-design selected and hardened viable resolutions |
| Authorized remediation | Updated the catalog model, staged parity rules, specialist profiles, route/link parser, DOM harness, executable example contracts, registry architecture, fixtures, lifecycle artifacts, and bounded execution tasks |
| Iteration 2 | Rescanned all 13 dimensions; found residual precision gaps in staged parity, directory landing URLs, verification-gate inclusion, multi-case interactions, and registry/test sharding |
| Iteration 3 | Confirmed those residual gaps were closed; found 0 critical, 0 major, 0 minor, and no direct adverse consequence |

PF-007 adopted the challenger's stronger multi-case contract: one coherent example may contain
multiple independently resettable cases, but each case must have exact capability coverage, typed
executable probes, and no more than six structured key/mouse actions.

---

## Major Findings

### PF-001: The catalog cannot represent specialist topic pages 🟠 MAJOR

**Dimension:** Ambiguities, Logical Contradictions, Codebase Alignment
**Location:** `03-01-catalog-and-navigation.md`, Catalog Schema and Validation Rules;
`03-04-data-grid-hub.md` and `03-05-code-editor-hub.md`, Information Architecture

**Problem:** Every specialist topic is a primary catalog row, every row requires non-empty
`symbols`, and every `(package, symbol)` pair must be unique. Most hub topics and both API pages
reuse the same few visual symbols or organize non-visual supporting APIs. The schema therefore
cannot encode the required 23 hub pages without inventing ownership or violating uniqueness.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Use a discriminated catalog union: component entries own symbols/examples; topic/API entries own routes, profiles, examples, and relationships | One catalog and deterministic joins; adds an explicit row discriminator |
| B | Put hub topics in a second navigation collection | Simpler individual schemas; creates another collection and join surface |

**Recommendation:** Option A. It preserves one catalog while making component ownership and topic
navigation different, explicit contracts.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Internal schema and validation architecture within confirmed coverage and routes
- Evidence: Hub API pages require no examples and organize supporting APIs; only two primary visual
  editor symbols exist
- Rejected alternative: Separate collections add drift-prone joins and duplicate navigation logic
- Strongest counterargument: Separate collections prevent topic semantics from entering component
  validation
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: A hub page is redefined as owning a distinct public visual symbol

### PF-002: Contract applicability makes intermediate phases impossible to verify 🟠 MAJOR

**Dimension:** Dependency Issues, Ordering & Sequencing, Testability
**Location:** `03-02-page-and-example-contract.md`, Page and Runtime Contracts;
`07-testing-strategy.md`, ST-9–ST-17; `99-execution-plan.md`, Phases 1–11

**Codebase evidence:** `packages/docs-site/examples/index.ts:41-90` currently has only seven
component-oriented entries; the catalog and shared contract specs do not yet exist.

**Problem:** Phase 1 creates the complete future catalog. Phase 2 then requires universal page and
template tests to be green while most catalog pages and examples intentionally remain absent until
Phases 3–10. The word “applicable” also fails to say whether the 45 specialist examples are in the
shared `template1` population. Either intermediate `yarn verify` remains red, or the tests silently
enforce less than ST-9–ST-17 claim.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Phase 2 validates canonical references and reusable assertion helpers; each family/hub supplies immutable cumulative IDs; Phase 11 adds global catalog parity | Keeps every phase green and retains a final universal oracle |
| B | Add a test-only delivery manifest | Explicit staging; introduces a second progress authority |
| C | Grow the catalog incrementally | Simple applicability; conflicts with Phase 1's complete inventory requirement |

**Recommendation:** Option A. It avoids a second manifest and makes the final global parity check
the proof that no catalog row escaped a family contract.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Test architecture and execution sequencing
- Objective: Preserve immutable oracles and a green verified boundary after every phase
- Evidence: The complete catalog precedes nine migration phases; all hub examples are expressly
  required to use `template1`
- Rejected alternatives: A delivery manifest can drift; incremental catalog weakens early coverage
- Strongest counterargument: Cumulative fixtures require careful final parity to prevent omission
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: Execution is changed to one atomic migration without intermediate verification

### PF-003: Specialist hub pages have no enforceable teaching-page contract 🟠 MAJOR

**Dimension:** Completeness Gaps, Testability
**Location:** `03-04-data-grid-hub.md` and `03-05-code-editor-hub.md`, Information Architecture;
`07-testing-strategy.md`, ST-23–ST-28

**Codebase evidence:** `AGENTS.md:59-163` requires rich component teaching, focused snippets, related
links, and source-backed content. The hub tests only freeze topology and example objectives.

**Problem:** Landing pages, capability pages, and API pages have materially different purposes, but
the plan defines no required backbone for any of them. Thin pages can pass while omitting
frontmatter, introductory use guidance, focused snippets, page-local practices, related links, or
justified omissions.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Define catalog-selected `landing`, `capability`, and `api` page profiles with distinct required sections and example rules | Precise and reusable without forcing irrelevant headings |
| B | Apply the standard page template everywhere with explicit exceptions | Familiar; produces repeated exceptions and boilerplate |

**Recommendation:** Option A. Specialist pages need a rich contract, but an API map should not
pretend to be a full component page.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Documentation information architecture within accepted hub scope
- Evidence: Current specifications name routes and examples but no page-local structural oracle
- Rejected alternative: One universal profile forces irrelevant Props/Theming sections
- Strongest counterargument: Three profiles add schema and test complexity
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: The hubs return to one standard component page

### PF-004: Deleting the Code Editor guide breaks an existing specification test 🟠 MAJOR

**Dimension:** Dependency Issues, Ordering & Sequencing, Codebase Alignment
**Location:** `03-05-code-editor-hub.md`, Removal and Link Migration;
`99-execution-plan.md`, Phase 10

**Codebase evidence:** `packages/docs-site/test/i18n-docs.spec.test.ts:139-145` directly reads
`packages/docs-site/guide/code-editor.md` and requires it to contain `i18n`.

**Problem:** Phase 10 deletes the guide without moving its i18n teaching obligation or retargeting
the dependent test. The mandatory Phase-10 `yarn verify` will fail even when the new hub tests pass.

**Recommendation:** Move the i18n guidance into the canonical hub target, make the existing test
resolve that target through the catalog with a non-empty guard, retarget it, and delete the guide in
one verified task.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Dependency migration and test maintenance
- Evidence: The hard-coded read is present in the current immutable spec
- Rejected alternatives: Temporary retention contradicts the accepted direct-removal decision;
  another hard-coded replacement path preserves drift
- Strongest counterargument: Catalog lookup adds indirection to a simple test
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: The existing i18n test no longer owns this documentation obligation

### PF-005: The API-map migration omits required package and anchor support 🟠 MAJOR

**Dimension:** Completeness Gaps, Dependency Issues, Codebase Alignment
**Location:** `03-01-catalog-and-navigation.md`, Files and API validation;
`03-06-overview-links-and-quality.md`, API-Link Consolidation; `99-execution-plan.md`, Phases 9–11

**Codebase evidence:**

- `packages/docs-site/src/api/validate-api-map.mjs:5-31` and
  `validate-api-map.d.mts:7-18` reject `code-editor`.
- `packages/docs-site/scripts/check-docs-build.mjs:571-594` appends `.html` to the entire
  `componentPage`, so a fragment becomes an invalid filesystem path.
- `packages/docs-site/src/api/api-map.mjs:130-145` includes a fragment in `pageLabel()`.
- `packages/docs-site/src/api/packages.mjs:15-26` already knows about `code-editor`.

**Problem:** The plan names `api-map.mjs` but not its duplicate validators/declarations, and defers
generic build-check changes until after anchored hub rows can land. It also leaves generation versus
checked-in parity unresolved despite a passed ambiguity gate.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Keep the checked-in map, derive its package allowlist from `PACKAGES`, add one fragment-aware component-target parser, and update validators/labels/backlinks/build checks before hub rows | Reuses the current pipeline and removes duplicate authorities |
| B | Split route and anchor into separate fields throughout | Explicit representation; larger migration surface |
| C | Generate the API map from the catalog | Strong authority; changes the established generation pipeline |

**Recommendation:** Option A. It is the smallest coherent extension of the working backlink system.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Internal API-link representation and validation
- Evidence: `PACKAGES` already has the needed package; current consumers mishandle fragments
- Rejected alternatives: Separate fields touch more consumers; generation adds unnecessary build
  ownership
- Strongest counterargument: A dedicated route/anchor model is more explicit for unusual targets
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: Catalog generation becomes the authoritative API-map pipeline

### PF-006: ST-30 cannot run in the configured test environment 🟠 MAJOR

**Dimension:** Feasibility Concerns, Testability, Codebase Alignment
**Location:** `07-testing-strategy.md`, ST-30 and Concrete Inputs; `99-execution-plan.md`, Phase 11

**Codebase evidence:** `packages/docs-site/vitest.config.ts:21-40` defines only a Node project;
`packages/docs-site/package.json` has no DOM/Vue mounting test dependencies; and
`PlayExample.vue:114-205` opens xterm, uses browser globals, and installs `ResizeObserver`.

**Problem:** ST-30 requires real keyboard activation, dynamic-import spies, and mount counts against
the Vue Play component. Static source checks cannot prove those behaviors, while the configured
harness cannot mount the component.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Add a small Vue-capable DOM Vitest project with terminal/resize seams injected or mocked | Proves actual component lifecycle and keyboard wiring; adds focused dependencies |
| B | Use build/SSR assertions plus Node controller tests only | Lower cost; does not prove the Vue event/lifecycle bridge |
| C | Add browser E2E coverage | Highest fidelity; highest operational cost |

**Recommendation:** Option A, combined with existing production-build checks. It directly proves
the behavior ST-30 claims without introducing a full browser E2E stack.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Test-harness mechanism
- Evidence: Current Vitest and manifest cannot execute the SFC interaction path
- Rejected alternatives: Node-only evidence leaves the Vue bridge unverified; full E2E is
  disproportionate
- Strongest counterargument: DOM emulation and mocked xterm may still differ from a real browser
- Confidence: Medium-high
- Hardening: Independent challenger selected the stronger DOM path over the lead's initial
  lower-cost split-harness preference
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: A supported browser test project already exists before Phase 11

### PF-007: Example interaction oracles are not concrete enough to remain immutable 🟠 MAJOR

**Dimension:** Completeness Gaps, Testability
**Location:** `03-03-standard-component-migration.md`, Example Quality Checklist;
`03-04-data-grid-hub.md` and `03-05-code-editor-hub.md`, Example Design;
`07-testing-strategy.md`, ST-17 and ST-19–ST-28

**Problem:** The plan says exact transitions are named, but objectives such as
“resize/reorder/freeze/show-hide” and “completion/signature/hover” provide no initial state, exact
input, or concrete observable expected result. Spec authors must invent the oracle while reading the
implementation.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Add checked-in typed behavior contracts keyed by example ID before implementation: initial state, one exact action, observable result, and atomic assertions | Strong immutable oracle; substantial authoring work |
| B | Put the same tables only in plan prose | Less implementation machinery; harder to enforce parity |

**Recommendation:** Option A. The examples are numerous enough that an enforceable schema is safer
than prose claims of exactness.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Specification-test data design
- Evidence: Current objective tables bundle capabilities without executable transitions
- Rejected alternative: Prose-only oracles can drift and are difficult to enumerate
- Strongest counterargument: Detailed contracts can overconstrain exploratory visual examples
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: Every objective table gains concrete input/state/result evidence directly

### PF-008: Runnable source and teaching-snippet contracts contradict each other 🟠 MAJOR

**Dimension:** Logical Contradictions, Consistency, Codebase Alignment
**Location:** `01-requirements.md`, RD-05 authority statement;
`02-current-state.md`, Existing Test and Build Seams; `03-02-page-and-example-contract.md`,
Focused Snippet Rules; `07-testing-strategy.md`, Existing Integration Gates

**Context evidence:** RD-05 says source snippets are extracted from compiled example modules.
`AGENTS.md:126-140` and the plan require separately authored essence-only snippets and prohibit
pasting full live modules. The current Play component exposes no source panel, while
`packages/docs-site/test/snippet-drift.spec.test.ts:49-84` rejects pasted `defineExample` modules
rather than extracting them.

**Problem:** RD-05 is declared authoritative, yet its source-extraction requirement conflicts with
the accepted page template, the plan, and the current runtime. An implementer cannot satisfy both.

**Options:**

| Option | Description | Trade-off |
|---|---|---|
| A | Amend RD-05 and the plan together: `sourcePath` identifies runnable source; page snippets are separate essence-only teaching artifacts; prohibit full-module extraction into pages | Matches the user-approved template and current architecture |
| B | Add full runnable-source extraction alongside separate teaching snippets | Preserves RD text; duplicates large shell-heavy source on pages |

**Recommendation:** Option A. It preserves concise teaching and keeps runnable source identity in the
registry without conflating the two artifacts.

**Resolution:** Applied and verified in iteration 3. Applying it requires explicit expansion of the
modification set to `requirements/RD-05-component-docs.md`.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Technical documentation-source mechanism; product intent is already decided
- Evidence: The governing directive and current tests oppose full-module page extraction
- Rejected alternative: Automatic extraction exposes unrelated shell plumbing and contradicts the
  user's snippet rule
- Strongest counterargument: Extracted code cannot drift from the runnable implementation
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: The user explicitly requests full runnable source on every page

### PF-009: The plan is not lifecycle-ready for audit or execution 🟠 MAJOR

**Dimension:** Dependency Issues
**Location:** `00-index.md`, status; `99-execution-plan.md`, status

**Codebase evidence:** `codeops/features/docs-website/traceability.json:534-548` records
`PLAN-RD05` as `draft`; `codeops/features/docs-website/00-roadmap.md:30` remains at Plan Created.

**Problem:** The deterministic audit gate expects an approved plan. The index attributes the state
to unrelated portfolio graphs, but the canonical scoped readiness result is simply not ready.

**Recommendation:** Keep the plan draft while blocking findings remain. After fixes and a clean
rescan, perform one lifecycle transition that synchronizes the graph, index, and roadmap. Do not
start `exec-plan` before that transition succeeds.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Technical lifecycle sequencing; no risk is waived
- Evidence: Canonical readiness reports `status-not-ready`
- Rejected alternative: Approving with known blockers weakens the readiness gate
- Strongest counterargument: Early approval could unblock scheduling while findings remain tracked
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: The graph tool supports an audited status distinct from approved

### PF-010: The plan lacks a scalable registry and test-file architecture 🟠 MAJOR

**Dimension:** Feasibility Concerns, Completeness Gaps, Testability, Codebase Alignment
**Location:** `03-04-data-grid-hub.md`, Source Reuse Boundary; `07-testing-strategy.md`, Test Layers;
`99-execution-plan.md`, registry and specialist-test tasks

**Codebase evidence:**

- `packages/docs-site/examples/index.ts:41-162` already uses multi-line rows for 17 entries.
- `packages/docs-site/test/registry.spec.test.ts:29-46` treats every recursive example `.ts` file as
  a runnable example.
- `packages/docs-site/test/paint-smoke.spec.test.ts:27-46` loads and paints the entire registry in one
  test with a 60-second timeout from `vitest.config.ts:32-36`.

**Problem:** The plan grows the registry toward 100 examples, assigns each specialist hub one
specification and one implementation test file, permits helper modules inside an examples-oriented
area, and retains one aggregate paint test. This conflicts with project file-size/testing guidance,
creates scanner collisions, and makes one slow example obscure the failing ID.

**Recommendation:** Before bulk migration, split the registry into family modules behind one
aggregate export, place shared fixtures outside recursively scanned example directories, shard hub
tests by concern, and convert paint smoke to registry-driven per-example cases with small global
parity checks.

**Resolution:** Applied and verified in iteration 3.

- Authority: AI — delegated by `--auto-design`
- Eligibility: Internal modularity, test isolation, and implementation sequencing
- Evidence: Existing registry/scanner/test shapes scale linearly into oversized, coupled files
- Rejected alternative: Compacting the central registry does not solve helper scanning or aggregate
  test blast radius
- Strongest counterargument: Refactoring before growth adds work before user-visible pages
- Confidence: High
- Hardening: Independent challenger converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: Final example count drops enough to stay within project file/test limits

---

## Minor Findings

### PF-011: Source-backed inventory counts are stale 🟡 MINOR

**Dimension:** Consistency, Codebase Alignment
**Location:** `00-ambiguity-register.md`, Inventory Evidence; `00-index.md`, Scope;
`02-current-state.md`, Current Coverage and Specialist Evidence

**Codebase evidence:** Repository scans show 22 `PlayComingSoon` pages plus Tabs with no Play block.
`scenario-catalog.ts` creates 20 ordinary scenarios and spreads 11 QA scenarios.

**Problem:** The plan reports 21 Coming Soon pages and 21 Code Editor scenarios, obscuring a distinct
Tabs gap and ten QA scenarios. The independently chosen 21 docs examples can remain unchanged.

**Recommendation:** Record “22 Coming Soon + Tabs without Play” and “20 ordinary + 11 QA scenarios”;
justify the 21 docs examples by capability coverage, not source-count equality.

**Resolution:** Applied and verified in iteration 3.

- Authority/eligibility: AI via `--auto-design`; factual inventory correction
- Rejected alternative: A narrower unnamed subset would preserve ambiguous counting
- Counterargument: Aggregate counts do not change the route/example matrix
- Confidence: High · Hardening: multiple independent auditors converged
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: Runtime registries change before implementation

### PF-012: Sidebar correctness is tied to an irrelevant insertion order 🟡 MINOR

**Dimension:** Codebase Alignment, Consistency
**Location:** `03-01-catalog-and-navigation.md`, Navigation Projection

**Codebase evidence:** `node_modules/vitepress/dist/client/theme-default/support/sidebar.js:9-26`
sorts keys by path depth before matching.

**Problem:** Requiring specialist prefixes to appear before `/components/` can produce a brittle
test without affecting runtime selection.

**Recommendation:** Test that representative specialist URLs resolve the intended sidebar. Keep
source order only as a readability convention.

**Resolution:** Applied and verified in iteration 3.

- Authority/eligibility: AI via `--auto-design`; framework-aligned test mechanism
- Rejected alternative: Enforcing both runtime behavior and object order adds no correctness
- Counterargument: Canonical source order improves human review
- Confidence: High · Hardening: no recommendation change
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: VitePress changes its multi-sidebar matching algorithm

### PF-013: The denied/error virtual-filesystem fixture has no seam 🟡 MINOR

**Dimension:** Edge Cases, Testability, Codebase Alignment
**Location:** `07-testing-strategy.md`, ST-22 Concrete Input; `99-execution-plan.md`, Phase 8

**Codebase evidence:** `packages/web/src/virtual-fs.ts:17-28,201-228` accepts file strings and nested
directories but cannot seed permission-denied or injected I/O failures.

**Problem:** The required denied/error entries cannot be constructed from the named browser virtual
filesystem.

**Recommendation:** Add a docs-test-local `FileSystem` fault adapter for deterministic denied and
I/O failures; keep SDK behavior out of scope.

**Resolution:** Applied and verified in iteration 3.

- Authority/eligibility: AI via `--auto-design`; reversible test seam
- Rejected alternatives: Extending `@jsvision/web` expands SDK scope; narrowing the oracle loses the
  accepted error-state lesson
- Counterargument: A test double differs from the browser filesystem implementation
- Confidence: High · Hardening: no recommendation change
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: The browser virtual filesystem gains native fault fixtures

### PF-014: Randomized catalog ordering is not reproducible 🟡 MINOR

**Dimension:** Testability
**Location:** `07-testing-strategy.md`, ST-8 Concrete Input

**Problem:** “Randomized filesystem enumeration orders” names neither a seed nor a fixed set, so
failures can vary between runs.

**Recommendation:** Use fixed adversarial permutations—forward, reverse, rotations, and one
checked-in shuffle. If a PRNG is retained, pin and print its seed.

**Resolution:** Applied and verified in iteration 3.

- Authority/eligibility: AI via `--auto-design`; deterministic test-data choice
- Rejected alternative: Unseeded randomness adds nondeterminism without meaningful extra coverage
- Counterargument: Fresh random orders can discover unexpected cases
- Confidence: High · Hardening: no recommendation change
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: Property-based testing with replayable seeds is adopted

### PF-015: The duplicate-page-title oracle contradicts the planned hubs 🟡 MINOR

**Dimension:** Logical Contradictions, Testability
**Location:** `03-04-data-grid-hub.md` and `03-05-code-editor-hub.md`, API page rows;
`07-testing-strategy.md`, ST-32

**Problem:** Both hubs deliberately contain a page labelled `API`, while ST-32 requires no duplicate
page title without scoping that rule.

**Recommendation:** Require unique routes, one H1 per page, and unique sidebar labels within each
hub. Allow the same human title in different hubs.

**Resolution:** Applied and verified in iteration 3.

- Authority/eligibility: AI via `--auto-design`; test-oracle clarification
- Rejected alternative: Globally unique titles force awkward labels with no navigation benefit
- Counterargument: Globally unique browser titles can improve search-result disambiguation
- Confidence: High · Hardening: no recommendation change
- Policy/root: version 1 · `preflight-component-documentation-system-20260729`
- Reopen trigger: SEO requirements explicitly require globally unique rendered titles

---

## Adversarial Close-out

| Question | Result |
|---|---|
| Which creation assumption was most likely being reconfirmed? | That one catalog row shape could model both component ownership and specialist learning topics; PF-001 disproves it. |
| Which external convention was easy to misremember? | VitePress sidebar matching; PF-012 grounds it in the installed implementation. |
| What would a disagreeing domain expert flag? | The staged test population, non-executable interaction oracles, and missing Vue component harness. |
| Security outcome | No additional security finding; virtual-file, in-process LSP, host-authorization, export-escaping, sanitization, bounded-data, lazy-loading, and disposal boundaries are present. |
| Scope outcome | No scope-creep finding; the planned coverage traces to RD-05 and AR-1–AR-19. |

## Verdict

**✅ PREFLIGHT PASSED — 15 of 15 findings resolved.**

The iteration-3 bounded verification found no remaining critical, major, or minor issue. RD-05 and
the plan are approved, the roadmap is at `Plan Preflighted`, and the target-scoped traceability
graph is ready for execution.
