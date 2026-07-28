# Code Editor internationalization — ambiguity register

> **CodeOps Artifact Schema**: 1
> **Status**: ✅ GATE PASSED — all 15 items resolved
> **Last Updated**: 2026-07-26 11:30
> **Planning target**: `code-editor/PLAN-I18N`
> **Context artifacts**: GitHub issues #184 and #185, the completed Code Editor and i18n
> requirements/plans, current package source, locale/review tooling, docs, and canonical skill
> references
> **Modification set**: this plan set, the Code Editor roadmap/traceability nodes needed to execute
> it, and the #184 implementation surfaces named by the plan; #185 implementation remains outside
> this plan

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|---|---|---|---|---|
| AR-1 | Scope | Whether #184 waits for the broad layout work in #185 | Implement Code Editor i18n first, then sweep every translated surface in #185 / retain the original #185-first order | User: internationalize Code Editor first, then perform the complete sizing sweep | ✅ Resolved |
| AR-2 | UX & presentation | The search session has behavior and public state but no visible find/replace chrome | Add localized inline search/replace presentation / classify all search presentation as host-owned | #184 already requires localized search fields, actions, counts, and layout; add a bounded inline surface | ✅ Resolved |
| AR-3 | Technical unknowns · complex | Where translation occurs for diagnostic, degradation, invisible-warning, search, and status presentation | Locale-aware controller / structured locale-neutral state formatted by views / injected translation callbacks | Retain locale-neutral structured state and format it through pure `I18n`-backed presentation projectors at the view boundary | ✅ Resolved |
| AR-4 | Integration points | How `I18n` reaches Code Editor composition | Explicit optional service on both public view options / ambient application lookup / process-global service | Use explicit optional injection and forward the exact window service to the editor; omission creates an isolated English service | ✅ Resolved |
| AR-5 | Data & state | Which content may translate | Translate every string reaching the terminal / translate editor-owned wrappers only | Translate only editor-owned copy; preserve source, paths, IDs, key tokens, protocol and host content after existing safety normalization | ✅ Resolved |
| AR-6 | Behavioral gaps | Missing keys, invalid overrides, and absent configuration | Throw / blank output / safe English fallback with bounded diagnostics | Use `defaultMessage` from the canonical English catalog and existing i18n diagnostics; preserve historical English without configuration | ✅ Resolved |
| AR-7 | Compatibility | Whether public controller semantics, stable IDs, search matching, or numeric status APIs may change | Permit cleanup breakage / additive compatibility | Additive public API only; keep controller semantics locale-neutral, search deterministic, command IDs stable, and `status` numeric | ✅ Resolved |
| AR-8 | UX & presentation | How much geometry work belongs to #184 before the full #185 sweep | Defer every size fix / focused Code Editor safety now plus full cross-package sweep later | Fix Code Editor display-cell measurement and deterministic search/status constraints now; certify all translated surfaces and viewports in #185 | ✅ Resolved |
| AR-9 | Technical unknowns | Locale entry generation currently assumes four packages and forty entry points | Handwrite Code Editor exports / extend the shared config and make counts configuration-derived | Extend the shared generator/config and remove brittle four-package/count assumptions from affected checks | ✅ Resolved |
| AR-10 | Naming & terminology | Code Editor key namespace and accelerator topology | Reuse `ui.editor.*` / use `code-editor.*`; invent action accelerators / publish no scopes until real co-visible accelerator labels exist | Use stable `code-editor.*` keys and an empty public accelerator manifest unless the implemented search chrome creates a real accelerator scope | ✅ Resolved |
| AR-11 | Security & compliance | Translation and external content can contain terminal controls or hostile Unicode | Trust official catalogs and host strings / preserve validation, sanitization, clipping, and bounded diagnostics at every presentation boundary | Preserve strict catalog validation and existing external-content normalization; never translate or interpolate unsanitized external detail as a message template | ✅ Resolved |
| AR-12 | Non-functional gaps | Definition of completion when proficient speakers are unavailable | Remove review / misrepresent AI as human / disclose AI-assisted review | Keep digest-bound review, record `ai-assisted` explicitly, and never claim human proficiency | ✅ Resolved |
| AR-13 | Dependencies | #185 owns the `demo:i18n` registry that does not yet exist | Create a competing harness in #184 / keep the story and combined viewport matrix in #185 | Do not create a second harness; #185 will integrate the Code Editor story after #184 makes every state constructible | ✅ Resolved |
| AR-14 | Verification | Which command is authoritative | Package-local checks only / repository gate | Use project-declared `yarn verify`; package-local checks are focused iteration only | ✅ Resolved |
| AR-15 | Packaging | Whether locale or Node imports may leak into the browser-safe main entry | Eager locale registry / explicit locale subpaths and isolated `./node` | Keep the main entry browser-safe, publish one explicit subpath per locale, and retain Node-only imports behind `./node` | ✅ Resolved |

## Resolution notes

### AR-1 — Sequencing and plan boundary

- **Authority**: User decision in this conversation.
- **Decision**: Implement #184's independent Code Editor internationalization first. The later
  #185 plan owns the comprehensive translated-layout sweep, shared sizing primitives, QA harness,
  Code Editor story registration, and combined viewport certification.
- **Consequence**: #184 can become implementation-complete without pretending that #185-owned
  acceptance evidence already exists; the GitHub issue remains traceable to the later integration.

### AR-2 — Visible search presentation

- **Authority**: Product behavior specified by GitHub issue #184 and accepted when the user
  authorized execution of the recommended scope.
- **Decision**: Add a terminal-native, bounded inline find/replace presentation driven by the
  existing `CodeEditorSearchSession`. It displays editor-owned labels, match state, case state, and
  keyboard action hints without changing literal matching or mutation semantics.
- **Rejected alternative**: Host-only presentation cannot satisfy #184's search layout,
  localization, and kitchen-sink acceptance criteria.

### AR-3 — Locale ownership boundary

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal architecture and additive compatibility mechanisms inside the
  user-approved localization behavior. No product scope, acceptance criterion, or compatibility
  break is introduced.
- **Objective**: Keep semantic editor/controller state reusable while localizing every
  editor-owned wrapper through the exact view-owned service.
- **Decision**: Preserve controller, search, degradation, and invisible-character records as
  locale-neutral semantic state. Add package-owned pure presentation projectors that accept the
  exact `I18n` instance owned by `CodeEditor` or `CodeEditorWindow`. Keep current exported flattened
  English fields for source and no-configuration compatibility, add structured metadata
  additively, and make in-package visible paths use the projectors. Diagnostic external detail is
  normalized first, then concatenated outside `i18n.t()` so translations cannot alter caller
  content.
- **Evidence**: Diagnostic severity is flattened before the view in
  `controller-overlay.ts`; degradation and invisible-character records already retain stable
  discriminants alongside their English fields; `CodeEditor.#syncAssistance()` is the existing
  final row-projection seam; search state is already semantic; window status remains numeric.
- **Rejected alternatives**: Locale-aware controllers couple reusable semantic state to one
  application lifecycle. Injected callbacks create hidden locale-bearing controller state and a
  second formatting abstraction. Removing legacy flattened fields would create an unnecessary
  public compatibility break.
- **Strongest counterargument**: Additive metadata temporarily duplicates legacy English
  presentation fields and structured state. That cost is bounded and permits a later normal
  deprecation cycle without compromising locale ownership now.
- **Confidence**: High — the current code has narrow semantic-to-row seams and the issue explicitly
  prefers view-boundary translation.
- **Hardening**: A blind challenger independently selected the same structured view-boundary
  design, strengthened it with pure exported projectors, additive compatibility, and the
  requirement to deduct localized prefix display width before clipping.
- **Challenger**: Converged.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-i18n-2026-07-26`.
- **Reopen triggers**: An existing consumer proves the additive metadata cannot coexist with
  flattened fields, or a required accessible surface has no route to the owning `I18n` service.

### AR-4 through AR-11 — Integration, compatibility, tooling, and safety

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal architecture, compatibility mechanisms, validation, packaging,
  generator design, and implementation sequencing inside the product behavior fixed by #184 and
  the user's #184-first decision.
- **Objective**: Deliver explicit, isolated, browser-safe Code Editor localization without global
  state, external-content translation, or duplicated locale tooling.
- **Decisions**: Use exact optional service injection with isolated English fallback; retain
  locale-neutral stable semantics; format through canonical `code-editor.*` messages; extend
  configuration-driven locale tooling; apply focused display-cell correctness now; keep strict
  terminal-safety boundaries.
- **Evidence**: `CodeEditorOptions` and `CodeEditorWindowOptions` have no i18n field; the window
  hard-codes its title and status labels; diagnostic, degradation, and invisible-warning wrappers
  are English; assistance measures `string.length`; the locale generator and validation suites
  enumerate four packages explicitly.
- **Rejected alternatives**: Ambient/global services break isolation; transitive dependency use
  weakens the SDK contract; handwritten locale exports duplicate generated structure; translating
  external content changes caller data; deferring all Code Editor geometry would knowingly ship
  broken Unicode measurement.
- **Strongest counterargument**: Extending repository-wide locale tooling makes #184 touch more
  than the Code Editor package. The shared generator and release checks already define the only
  supported public-locale contract, so bypassing them would create permanent drift.
- **Confidence**: High — existing UI, Forms, Files, and Datagrid implementations provide direct
  reference patterns and the issue fixes the behavioral boundary.
- **Hardening**: Forced reframing retained the existing shared infrastructure and rejected a new
  translator abstraction or package-local generator.
- **Policy version**: 1.
- **Root invocation ID**: `code-editor-i18n-2026-07-26`.
- **Reopen triggers**: The shared i18n API cannot express a required structured message, an existing
  public Code Editor contract requires locale-sensitive semantics, or browser-isolation tests show
  a locale/Node import leak.

### AR-12 — Translation review

- **Authority**: The user replaced the former human-only policy on 2026-07-28 because proficient
  speakers are no longer available.
- **Decision**: Permit digest-bound AI-assisted review when its method and reviewer are disclosed.
  Never describe AI-assisted evidence as proficient-human approval.

### AR-13 — QA harness ownership

- **Authority**: User sequencing decision and the ownership split stated by GitHub issues #184 and
  #185.
- **Decision**: Keep this plan independent of a nonexistent registry. The #185 plan consumes the
  public Code Editor state and catalogs produced here.

### AR-14 and AR-15 — Verification and package isolation

- **Authority**: Project `AGENTS.md` and the established package export contract.
- **Decision**: `yarn verify` is the authoritative gate; explicit locale and Node subpaths preserve
  main-entry isolation.
