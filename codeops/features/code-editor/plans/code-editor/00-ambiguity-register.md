# Ambiguity Register: Code Editor Integrated Implementation Plan

> **Status**: ✅ GATE PASSED — all 29 items resolved
> **Last Updated**: 2026-07-24 12:50
> **Auto-design**: active
> **Root Invocation ID**: `AD-CODE-EDITOR-PLAN-20260723-01`
> **Policy Version**: 1
> **CodeOps Artifact Schema**: 1

## Scope Contract

| Field | Boundary |
|-------|----------|
| Target | The approved aggregate requirement set `code-editor/SET-REQUIREMENTS` (RD-01 through RD-06) |
| Context | Current editor, view, theme, event-loop, popup, examples, test, packaging, plugin, and documentation infrastructure; official public dependency contracts |
| Modification set | This integrated plan set, its traceability nodes, and the feature roadmap; implementation is explicitly outside this workflow |
| Verification | Traceability readiness, artifact validation, `git diff --check`, and the repository-authoritative `yarn verify` |

## Ambiguity Register

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|----------|-----------------|-------------------|----------|--------|
| AR-P01 | Scope | One plan per RD or one integrated plan? | Six independent plans / one dependency-ordered integrated plan | One integrated plan for RD-01 through RD-06, as explicitly directed in the approved requirements and by the user | ✅ Resolved |
| AR-P02 | Technical · complex | Which package owns the public editor? | A new `@jsvision/code-editor` package / a first-class `code-editor/` module in `@jsvision/ui` | New public `@jsvision/code-editor` package depending only on public JSVision APIs, with explicit feature subpaths | ✅ Resolved |
| AR-P03 | Technical · complex | Reuse the current `Editor`, subclass it, or implement a separate component? | Modify/subclass `Editor` / new `CodeEditor` sharing only suitable pure utilities | Implement a separate layered `CodeEditor`; reuse only small proven public UI/core primitives and extract a pure utility only when compatibility tests prove it safe | ✅ Resolved |
| AR-P04 | Data & state · complex | Which text-storage and change representation meets the edit, mapping, and size budgets? | Existing gap buffer / public CodeMirror state primitives / custom indexed piece tree | Use public headless `@codemirror/state` `Text`/`ChangeSet` behind an editor-owned document contract if mandatory probes pass; predeclared fallback is an internal indexed piece tree | ✅ Resolved |
| AR-P05 | Technical | How is syntax parsed without a DOM? | CodeMirror view internals / direct public headless parsers / bespoke grammars | Use direct public headless parser APIs; JavaScript and TypeScript use `@lezer/javascript`, PostgreSQL uses `pgsql-ast-parser`; never `@codemirror/view` or private internals | ✅ Resolved |
| AR-P06 | Integration | How are parser output and editor presentation decoupled? | CodeMirror extensions / parser-specific rendering / stable editor-owned semantic categories | Map public `@lezer/highlight` tags and adapter metadata into versioned editor-owned categories and validated ranges | ✅ Resolved |
| AR-P07 | Non-functional | How does parsing remain responsive and revision-safe? | Unbounded parse completion / worker-only architecture / bounded cooperative slices with cancellation | Use revision-tagged, cancellable cooperative parse slices with incremental fragments and an injected scheduling seam; add workers only if probes prove necessary | ✅ Resolved |
| AR-P08 | Integration | Which LSP client boundary avoids VS Code coupling? | `vscode-languageclient` / custom protocol types / transport-neutral editor session using official protocol types | Define an editor-owned `CodeEditorLspSession` and use official `vscode-languageserver-protocol` types; exclude `vscode-languageclient` | ✅ Resolved |
| AR-P09 | Integration | Where does optional process/JSON-RPC ownership live? | Inside `CodeEditor` / separate replaceable Node runtime adapter / leave entirely to each host | Provide a separate opt-in `@jsvision/code-editor/node` export behind the session contract; the root editor API never spawns or supervises processes | ✅ Resolved |
| AR-P10 | Data & state | How are asynchronous results prevented from crossing documents or revisions? | Cancellation only / revision only / lineage, revision, adapter, URI, and session-generation stamps | Require complete generation stamps plus best-effort cancellation; validate stamps again at the mutation/presentation boundary | ✅ Resolved |
| AR-P11 | Technical | How is rendering bounded? | Whole-document styled rows / viewport projection / retained virtual screen for the entire file | Maintain indexed document state and project only the viewport plus measured bounded overscan into validated draw spans | ✅ Resolved |
| AR-P12 | UX & presentation | How does the approved hybrid editor theme connect to the existing global Theme? | Expand the closed global Theme / independent unreactive palette / dedicated resolved layer | Add a versioned `CodeEditorTheme` resolver owned by the code-editor module, derived reactively from application Theme with validated overrides and independent palettes | ✅ Resolved |
| AR-P13 | Security | Where is hostile content sanitized? | Mutate stored text / sanitize only protocol data / preserve data and sanitize every presentation boundary | Preserve exact source/protocol values in bounded models and sanitize/visualize them at every terminal presentation boundary; fail closed on invalid geometry | ✅ Resolved |
| AR-P14 | Edge cases | How are size limits and degraded modes implemented consistently? | Scattered constants / one validated limits policy / unlimited host configuration | Use one public bounded configuration resolved against immutable hard ceilings and one explicit capability/degradation state machine | ✅ Resolved |
| AR-P15 | Behavioral | What is the edit/undo transaction boundary for completion, snippets, formatting, and save? | Individual edits / atomic validated transactions / host-managed undo | Normalize and validate the complete edit set before one atomic document transaction and undo entry; format-on-save failure preserves the current unformatted save path | ✅ Resolved |
| AR-P16 | Naming | What public terminology and source layout will the plan use? | Generic editor names / requirement-aligned `CodeEditor*` names | Use `CodeEditor`, `CodeEditorWindow`, `CodeEditorTheme`, `LanguageAdapter`, `CodeEditorLspSession`, and cohesive `code-editor/` source/test paths | ✅ Resolved |
| AR-P17 | Testing | What evidence gates library and architecture commitment? | Select dependencies from documentation alone / implementation-first / committed feasibility probes first | Begin with headless import, incremental parse/edit, mapping, license/dependency, package-size, and p50/p95/memory probes; preserve a documented fallback | ✅ Resolved |
| AR-P18 | Testing | Which verification command is authoritative? | Package-local tests / selected Turbo tasks / full repository verification | Use specification-first red/green phases and finish every implementation phase with `yarn verify`; run focused probes/tests as earlier feedback | ✅ Resolved |
| AR-P19 | UX & presentation | How is the dedicated showcase structured? | Only a global story / standalone app only / both | Mirror the DataGrid precedent: standalone `code-editor-demo`, `demo:code-editor`, E2E process test, plus a concise registered global kitchen-sink story | ✅ Resolved |
| AR-P20 | Integration | Which simulated service backs showcase and deterministic tests? | Production server / ad-hoc mocks / in-process contract-faithful session | Use a deterministic in-process `CodeEditorLspSession` fixture with controllable capabilities, latency, cancellation, malformed data, failures, and races | ✅ Resolved |
| AR-P21 | Integration | What repository collateral is part of implementation? | Source/tests only / include public docs and plugin sync / defer collateral | Update public barrels, JSDoc/examples, package metadata, technical docs/ADRs, plugin catalog/generated API, examples scripts, and applicable E2E/packaging gates in their owning phases | ✅ Resolved |
| AR-P22 | Non-functional | How is the branch's 349-commit divergence from `origin/develop` handled? | Ignore / redesign against remote / rebase during planning | Plan against the checked-out code, record integration drift as a pre-execution prerequisite, and require revalidation after the user-authorized branch synchronization; planning performs no rebase | ✅ Resolved |
| AR-P23 | Technical | How are dependencies selected and pinned? | Private internals / public packages with compatible ranges / vendored copies | Use only public MIT-compatible APIs, pin Yarn-resolved versions through the lockfile, validate Node 22/NodeNext/headless imports, and reject browser/IDE dependency closure | ✅ Resolved |
| AR-P24 | Stakeholder conflicts | Do host extensibility and safe defaults conflict? | Host has unrestricted hooks / editor owns all policy / bounded typed host seams | Preserve host ownership through typed, versioned, bounded seams while the editor retains validation, cancellation, sanitation, and hard-ceiling enforcement | ✅ Resolved |
| AR-P25 | Integration | How are optional built-in parsers exposed without making every root import initialize every language? | All adapters from the root / explicit language subpaths / separate package per language | Export built-in adapters from `@jsvision/code-editor/languages/javascript`, `/languages/typescript`, and `/languages/postgresql`; keep contracts and plain mode at the root | ✅ Resolved |
| AR-P26 | Technical (runtime) | What deterministic probe API can specification tests target before the package exists? | CLI-output assertions / editor-owned typed probe functions with a thin runner | Define typed, side-effect-free probe functions for headless compatibility, dependency closure, reference benchmarks, and scheduling stress; keep CLI formatting in a thin runner | ✅ Resolved |
| AR-P27 | Technical (runtime) | How is PostgreSQL parsed after the dependency probe proves CodeMirror language packages ship `@codemirror/view`? | Keep the browser dependency / build and maintain a new SQL grammar / use a public headless PostgreSQL parser behind the adapter contract | Replace CodeMirror language wrappers with `@lezer/javascript` for JavaScript/TypeScript and `pgsql-ast-parser` for PostgreSQL; keep parser-specific types internal and use cancellable revision-stamped background parses for PostgreSQL | ✅ Resolved |
| AR-P28 | Testing (runtime) | How are Phase 2 specification tests discovered when the approved path is under `src/document` but Vitest includes only `test/**`? | Move the oracle into `test/` / add a second Vitest project / extend unit discovery to `src/**/*.test.ts` | Extend the existing unit project to discover specification and implementation tests under both `test/` and `src/`; retain one unit environment and the approved cohesive document path | ✅ Resolved |
| AR-P29 | Performance (runtime) | How is PostgreSQL presentation bounded when a synchronous whole-document AST parse exceeds the interaction budget? | Parse every document synchronously / parse bounded statement regions between cancellation points and retain lexical presentation / require a worker | Parse at most 32 statement regions of at most 256 code units per generation, check cancellation between calls, and retain cooperatively bounded lexical presentation for the document; reopen the worker strategy if a bounded call breaches budget | ✅ Resolved |
| AR-P30 | Technical · security (runtime) | How should the LSP layer close the Phase 4 review gaps without changing approved behavior? | Patch each symptom independently / consolidate synchronization, deadlines, hostile-data normalization, generation stamps, capability state, and process bounds behind the existing session/coordinator layers | Consolidate the corrections behind transport-ready and document-synchronized gates, one ordered sync queue, injected bounded deadlines, allowlisted DTO normalization, generation-stamped publications, validated host effects, and finite framed Node transport lifecycle | ✅ Resolved |

## Resolution Notes

### Imported authority

**AR-P01:** User authority. The user approved the archive-and-rebuild approach, the consolidated
six-RD scope, and the requirement-set instruction to produce one integrated plan.

### Delegated technical decisions

Unless a note says otherwise, the following provenance applies to AR-P02 through AR-P24:

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal architecture, algorithms, package organization, dependency selection,
  failure/recovery design, testing strategy, and implementation sequencing within the approved
  product behavior. No public compatibility break, scope change, security-policy change, external
  action, installation, commit, or deployment is authorized.
- **Objective:** Deliver the approved terminal-native editor safely, responsively, maintainably,
  and through stable public contracts while preserving the existing `Editor`.
- **Policy version:** 1.
- **Root invocation ID:** `AD-CODE-EDITOR-PLAN-20260723-01`.

**AR-P02:** Evidence: `CodeEditor` uses JSVision UI primitives, but parser, language, protocol, and
optional process dependencies are qualitatively different from `@jsvision/ui`, whose only runtime
dependency is currently `@jsvision/core`. Rejected alternative: an in-UI module avoids one release
surface but makes every UI consumer inherit the editor dependency closure. Strongest
counterargument: a separate package adds release/versioning and may expose missing UI seams.
Confidence: Medium-High. Hardening: challenger diverged toward a dedicated package; reconciliation
adopted that recommendation and limited it to public UI contracts plus explicit subpaths. Reopen if
the package cannot be implemented without importing UI internals or if measured dependency/import
isolation is cosmetic.

**AR-P03:** Evidence: the current `Editor` combines gap-buffer state, drawing, navigation, and
events around general text-editing assumptions, including a fixed line-length constraint; the
requirements explicitly freeze its API and behavior. Rejected alternative: subclassing appears to
reuse more code but couples code features to private state and increases regression risk.
Strongest counterargument: a new component may duplicate editing behavior. Confidence: High.
Hardening: challenger converged and proposed strict document/scheduler/language/LSP/view layers.
Reopen if an extraction probe identifies a small stable shared engine that preserves all existing
behavior without compatibility changes.

**AR-P04:** Evidence: the existing two-string gap buffer lacks the persistent line index and change
mapping needed by incremental parsing, diagnostics, folds, LSP edits, and 50,000-line random
navigation. Candidate public CodeMirror state primitives are DOM-independent and already model
immutable text and changes; a custom indexed piece tree offers control but substantially increases
correctness risk. The probe-gated decision includes that measured fallback. Strongest
counterargument: a third-party immutable model may miss the 16 ms p95 budget or retain too much
memory. Confidence: Medium-High. Hardening: challenger converged and sharpened the boundary:
CodeMirror primitives remain internal and never become the public JSVision contract. Reopen on
failed headless, edit-latency, mapping, memory, licensing, or dependency-closure probes.

**AR-P05–AR-P07:** Evidence: public Lezer APIs support incremental trees, fragments, recovery, and
stepped parsing, whereas CodeMirror view packages require a DOM and bespoke grammars multiply
maintenance. Rejected alternatives: browser view internals violate scope; mandatory workers add
serialization and lifecycle complexity before measurement. Strongest counterargument: direct
Lezer orchestration assumes scheduling responsibilities normally handled by an editor view.
Confidence: Medium until the architecture probe passes. Hardening: added an injected scheduler,
explicit slice metrics, and a worker reopen trigger. Reopen if direct parsing cannot yield within
the measured input-latency budget.

**AR-P08–AR-P10:** Evidence: LSP 3.18 and the official protocol/JSON-RPC packages are
tool-independent, while `vscode-languageclient` carries editor-runtime assumptions. Rejected
alternatives: hand-maintained protocol types invite drift; editor-owned processes violate the host
boundary. Strongest counterargument: an adapter/session split adds public interfaces.
Confidence: High. Hardening: the contract is intentionally smaller than a general client and is
validated through a shared-session race harness. Reopen if official protocol packages introduce a
disallowed runtime dependency or cannot represent negotiated position encodings.

**AR-P11–AR-P16:** Evidence: existing JSVision drawing, popup hosting, signals, and capability
resolution provide the correct terminal seams, while the approved RDs define presentation
precedence, atomic edits, names, degradation, and hybrid theming. Rejected alternatives either
duplicate framework primitives, mutate untrusted input, or scatter bounds. Strongest
counterargument: a centralized state/controller layer can become monolithic. Confidence: High.
Hardening: split document, projection, language, LSP, theme, and UI responsibilities behind typed
contracts. Reopen if a component exceeds the repository's module-size or dependency-boundary
standards.

**AR-P17–AR-P18:** Evidence: RD-04 requires reproducible p50/p95/memory evidence and the repository
declares `yarn verify` authoritative; current editor performance tests use a best-of-run metric and
skip gating in CI, so they cannot establish the new acceptance budget. Rejected alternative:
documentation-only dependency selection cannot prove headless/runtime/performance constraints.
Strongest counterargument: probes add an early phase that may be discarded. Confidence: High.
Hardening: make probe artifacts executable and reusable as regression benchmarks where practical.
Reopen if the repository adopts a different authoritative verification command.

**AR-P19–AR-P21:** Evidence: DataGrid already has a standalone example, script, E2E child-process
test, and global kitchen-sink story; public UI additions trigger plugin barrel/catalog drift
checks. Rejected alternative: either showcase alone misses an explicit approved acceptance path.
Strongest counterargument: exhaustive demonstrations can become costly snapshots. Confidence:
High. Hardening: use deterministic scenarios and contract-faithful fixtures rather than production
servers. Reopen if examples infrastructure changes before execution.

**AR-P22:** Evidence: `git rev-list --left-right --count HEAD...origin/develop` reports this branch
as 6 commits ahead and 349 behind. Rejected alternatives: planning-time rebasing is unauthorized
and destructive; ignoring drift risks invalid file targets. Strongest counterargument: a plan
written before synchronization may need material revision. Confidence: Medium. Hardening: make
post-sync current-state and probe revalidation an explicit execution prerequisite. Reopen
immediately after branch synchronization or if conflicts affect planned modules.

**AR-P23–AR-P25:** Evidence: the repository is MIT, Node 22+, ESM/NodeNext, publicly distributed,
and requires small replaceable dependency surfaces; approved requirements reserve host ownership
but impose immutable editor safety ceilings. Explicit adapter subpaths keep optional parser and
Node initialization out of the root entry point. Rejected alternatives: private internals,
vendoring, unrestricted hooks, or one package per grammar add maintenance or weaken the approved
policy. Strongest counterargument: package-level dependencies are still installed even when
subpaths are not imported. Confidence: High. Hardening: challenger added explicit language
subpaths; lockfile, package-boundary, clean-process import, tree-shaking, license, and dependency
closure gates are planned. Reopen on a license change, unsupported module target, security
advisory, contract-major change, or failed subpath isolation probe.

**AR-P26:** Authority: AI — delegated by `--auto-design`. Eligibility: reversible internal testing
and probe-interface design within the approved Phase 1 evidence requirements. Objective: let
immutable tests assert structured evidence without parsing unstable console text. Decision: expose
side-effect-free typed functions `runHeadlessCompatibilityProbe`,
`inspectShippedDependencyClosure`, `runReferenceBenchmark`, and `runSchedulingStressProbe`; a thin
runner owns human-readable output and exit status. Evidence: repository tests use Vitest and strict
NodeNext, while Phase 1 must confirm a red state before package implementation. Rejected
alternative: testing CLI text couples correctness to formatting and makes deterministic fixtures
harder. Strongest counterargument: probe types become internal maintenance surface. Confidence:
High. Hardening: keep them package-internal and validate behavior through one specification suite.
Policy version: 1. Root invocation ID: `AD-CODE-EDITOR-EXEC-20260724-01`. Reopen if the benchmark
must execute out-of-process to measure the reference environment faithfully.

**AR-P27:** Authority: AI — delegated by `--auto-design`. Eligibility: dependency selection and
internal parser architecture within the approved language and no-browser boundaries. Objective:
preserve JavaScript, TypeScript, and PostgreSQL support without shipping a DOM runtime. Evidence:
the installed dependency-closure probe found `@codemirror/view` through both CodeMirror language
wrappers; `@lezer/javascript` 1.5.4 and `pgsql-ast-parser` 12.0.2 are public MIT packages with
headless dependency closures. Rejected alternative: accepting `@codemirror/view` directly violates
the approved dependency policy; maintaining a new SQL grammar creates substantial correctness and
security burden before feature work begins. Strongest counterargument: PostgreSQL loses Lezer
incremental fragments, so its adapter must use revision-stamped cancellable background parses and
bounded lexical presentation while a parse is pending. Confidence: Medium-High. Hardening: the
dependency probe discovered the violation, and the immutable architecture specifications retain
the no-DOM closure gate. Policy version: 1. Root invocation ID:
`AD-CODE-EDITOR-EXEC-20260724-01`. Reopen if PostgreSQL parse latency breaches the approved
interaction budget or the replacement dependency changes license or runtime characteristics.

**AR-P28:** Authority: AI — delegated by `--auto-design`. Eligibility: reversible internal test
discovery configuration within the approved specification-first workflow; product behavior,
acceptance criteria, and public compatibility are unchanged. Objective: ensure the immutable
document specification and implementation suites execute through the package's existing unit
test command. Evidence: `packages/code-editor/vitest.config.ts` currently includes only
`test/**/*.{spec,impl}.test.ts`, while Phase 2 and later approved suites live under `src/`.
Rejected alternatives: moving the oracle contradicts the approved cohesive source path; a second
project duplicates the same Node/Vitest environment and risks running shared tests twice.
Decision: extend the existing unit include list to cover both trees, exclude colocated test files
from the production build, and retain them in the no-emit typecheck. Strongest counterargument:
tests placed beside source require separate compiler discovery rules, but those rules keep the
published output clean while typechecking the oracle. Confidence: High. Hardening: the change is
narrowly verified by listing and running the Phase 2 suite through the normal package command and
inspecting build output. Policy version: 1. Root invocation ID:
`AD-CODE-EDITOR-EXEC-20260724-02`. Reopen if source-adjacent tests are emitted into the published
package or the repository standardizes on a single test tree.

**AR-P29:** Authority: AI — delegated by `--auto-design`. Eligibility: internal performance,
concurrency, and failure-recovery design within the approved PostgreSQL parser and degradation
policy. Objective: prevent synchronous parser work from monopolizing input while preserving
useful parser-backed structure and full-document lexical presentation. Evidence: whole-document
`pgsql-ast-parser` calls exceeded the interaction budget by orders of magnitude; a 50,000-line
fixture completes within its two-second gate when AST work is limited to small statement regions,
and the parser contract explicitly permits cancellation between synchronous calls without
claiming in-call preemption. Decision: expose syntax, folds, and brackets as independently
optional asynchronous capabilities; parse at most 32 statement regions of at most 256 code units
per generation; check cancellation between calls; and cooperatively yield during bounded lexical
work. Rejected alternatives: unconditional whole-document parsing violates the measured budget;
merely lowering one whole-document threshold still cannot cancel work already running; a worker
adds a Node-only lifecycle and packaging boundary before bounded regional calls have failed.
Strongest counterargument: statements beyond the regional budget lose AST-quality folds and an
individual synchronous parser call still cannot be preempted. Confidence: Medium-High; the hard
regional ceiling makes worst-case work explicit, but pathological inputs still require ongoing
measurement. Hardening: the independent re-review rejected the earlier whole-call threshold and
directly drove the capability split, cooperative Lezer slices, regional PostgreSQL calls, bounded
production, and cancellation tests. Policy version: 1. Root invocation ID:
`AD-CODE-EDITOR-EXEC-20260724-03`. Reopen if one bounded parser call has p95 above 16 ms, the
50,000-line lexical benchmark exceeds two seconds, regional AST coverage proves insufficient, or
the package gains a portable worker-host contract.

**AR-P30:** Authority: AI — delegated by `--auto-design`. Eligibility: reversible internal
concurrency, validation, timeout, and process-lifecycle architecture within the already-approved
LSP behavior and security ceilings. Objective: close every Phase 4 Major finding without weakening
an oracle or widening editor authority. Evidence: independent correctness, security, and
performance reviewers converged on missing resynchronization gates and deadlines, unsafe deferred
requests, post-allocation bounds, unstamped diagnostics, raw host effects, and unbounded Node
lifecycle/framing. Decision: keep the approved public session/coordinator split and consolidate
corrections into distinct transport-ready and document-synchronized state, one ordered/coalescing
sync queue, injected request deadlines with a five-second default, generation-stamped
notifications, allowlisted bounded DTO copies, typed host effects, and finite framed process
lifecycle. The reconnect oracle is corrected from the approved synchronization requirement before
implementation changes. Rejected alternatives: isolated symptom patches leave inconsistent
generation and bound enforcement; waiving findings is forbidden; replacing the session boundary
would expand scope and invalidate approved architecture. Strongest counterargument: consolidating
the state machine increases this correction's size and risks new races. Confidence: High on the
architecture, Medium-High until the single independent re-review passes. Hardening: three
independent lenses converged; corrections require deterministic race, timeout, proxy, flood,
frame, and process tests plus full repository verification. Policy version: 1. Root invocation ID:
`AD-CODE-EDITOR-EXEC-20260724-04`. Reopen if a supported transport cannot distinguish readiness
from synchronization, if hard ceilings cannot be enforced before JSON parsing, or if the fix
requires changing host/product authority.

## Twelve-Category Closure

| Category | Covered By |
|----------|------------|
| Feature gaps | AR-P01, AR-P19, AR-P21 |
| Behavioral gaps | AR-P10, AR-P14, AR-P15 |
| Scope ambiguities | AR-P01, AR-P22 |
| Technical unknowns | AR-P02–AR-P09, AR-P11, AR-P26–AR-P27 |
| Edge cases | AR-P10, AR-P13–AR-P15 |
| Integration points | AR-P06, AR-P08–AR-P10, AR-P20–AR-P21, AR-P25 |
| Data & state | AR-P04, AR-P10, AR-P15 |
| Security & compliance | AR-P13, AR-P23–AR-P24 |
| Non-functional gaps | AR-P07, AR-P11, AR-P14, AR-P17–AR-P18, AR-P22, AR-P28 |
| UX & presentation | AR-P12, AR-P16, AR-P19 |
| Stakeholder conflicts | AR-P24 |
| Naming & terminology | AR-P16 |
