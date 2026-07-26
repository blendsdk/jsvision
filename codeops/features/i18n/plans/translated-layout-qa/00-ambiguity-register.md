# Translated layout and multilingual QA — ambiguity register

> **CodeOps Artifact Schema**: 1
> **Status**: ✅ GATE PASSED — all 21 items resolved
> **Last Updated**: 2026-07-26 15:13 UTC
> **Planning target**: `i18n/PLAN-LAYOUT-QA`
> **Context artifacts**: GitHub issues #184 and #185, completed i18n and Code Editor plans,
> current UI/Forms/Files/Datagrid/Code Editor/examples/docs/plugin source, and the existing
> multilingual layout specification
> **Modification set**: this plan set, the i18n traceability nodes needed to execute it, shared UI
> button geometry, every translated framework surface identified by the sweep, the multilingual QA
> application/tests, consumer documentation, and canonical/generated plugin guidance

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|---|---|---|---|---|
| AR-1 | Scope | Whether #185 remains a button-only fix or covers every surface affected by translated geometry | Button-only migration / complete translated-surface sweep | User: complete the sweep across buttons, dialogs, dropdowns, surfaces, Calendar, Datagrid, and every i18n-touched framework path | ✅ Resolved |
| AR-2 | Dependencies | Whether Code Editor should be localized before the combined QA work | Build harness first / finish #184 first | User: finish Code Editor internationalization first, then integrate it into #185; #184 is now complete | ✅ Resolved |
| AR-3 | Technical unknowns · complex | Where the canonical equal-button sizing API belongs | New UI metrics/composer / promote Datagrid names unchanged / generalized layout engine | Add a Button-specific pure metrics and composition API to `@jsvision/ui`; retain Datagrid forwarding wrappers during migration | ✅ Resolved |
| AR-4 | API contract | Exact width rule and accelerator treatment | Caption code-unit length / natural `Button.measure()` / catalog-specific estimator | `max(configured minimum, widest Button.measure().width)`; accelerator markup is already excluded and display-cell padding is included by `Button.measure()` | ✅ Resolved |
| AR-5 | API contract | Which geometry the shared contract exposes | Per-button width only / complete horizontal and vertical metrics | Expose shared button width, horizontal band minimum, height/row count, horizontal composition, vertical composition, and explicit placement support | ✅ Resolved |
| AR-6 | UX & presentation · complex | What happens when the intrinsic group exceeds a component or viewport | Expand only / component-level stable wrapping / silent clipping | Expand to the declared maximum, then wrap whole buttons in stable order where the component owns reflow; clipping is only the documented absolute-layout/infeasible-viewport fallback | ✅ Resolved |
| AR-7 | Compatibility | Whether the core flex engine gains automatic wrapping | Add generic wrap / keep wrapping at the translated component boundary | Do not alter general flex semantics; use a Button-specific composer and explicit component policies | ✅ Resolved |
| AR-8 | UI dialogs | How dialog text, labels, and action bands size | Retain `.length` and fixed caps / derive intrinsic cell geometry | Use `stringWidth`, shared action metrics, frame/padding, stable button wrapping, and viewport caps; preserve existing modal behavior | ✅ Resolved |
| AR-9 | Forms | Meaning of caller-provided form dialog width/height after translated actions grow | Hard clipping bounds / minimum requested dimensions | Preserve the options but treat them as caller-requested minima; expand for the shared action group within the viewport and account for wrapped rows in height | ✅ Resolved |
| AR-10 | Files | How vertically stacked actions participate | Keep local width calculations / consume shared vertical metrics | Use one shared width across each related action set and expand the dialog minimum for labels, fields, and the action column | ✅ Resolved |
| AR-11 | Calendar · complex | How localized month names and Today affect geometry and hit zones | Fixed grid width with code-unit clipping / localized display-cell metrics | Resolve localized labels first; derive header/footer requirements with renderer-equivalent display-cell width and use the same metrics for drawing, placement, and hit testing | ✅ Resolved |
| AR-12 | Datagrid · complex | How filter and personalization surfaces size and wrap | Fixed popup/dialog widths / child measurement only / pure localized content metrics | Compute desired width from operators, captions, input minima, headers/status, and shared actions; cap to viewport and select a stable component-owned arrangement | ✅ Resolved |
| AR-13 | Data & state · complex | What survives a locale switch in the QA application | Mutate one app / retain current view state / reconstruct from serializable shell selection | A supervisor preserves only validated locale and story IDs, disposes the current application, then constructs fresh catalogs, `I18n`, `Application`, registry, and story state | ✅ Resolved |
| AR-14 | Behavioral gaps | Required multilingual QA stories | Representative dialogs only / issue-wide registry | Register standard actions, UI dialogs/dropdowns/surfaces/Calendar, Forms, Files, Datagrid, formatting, overrides, Unicode, and Code Editor | ✅ Resolved |
| AR-15 | Verification | Required layout matrix | 80×24 smoke only / standard plus declared boundaries and stress strings | Test all ten locales at 80×24, each component's declared narrower boundary, long overrides, wide/combining Unicode, registry smoke, focus reachability, and reconstruction | ✅ Resolved |
| AR-16 | Packaging | How the interactive harness is launched | Extend the generic kitchen sink / dedicated command | Add `yarn workspace @jsvision/examples demo:i18n` backed by a dedicated registry-driven application | ✅ Resolved |
| AR-17 | Security & compliance | How hostile translated/caller text affects terminal output | Trust strings after width calculation / preserve normalization and clipping | Preserve catalog validation, renderer terminal-safety rules, bounded geometry, and caller-data ownership; width measurement never substitutes for sanitization | ✅ Resolved |
| AR-18 | Compatibility | Whether public Datagrid helpers and fixed-layout consumers break | Remove existing helpers / additive delegation and escape hatch | Keep existing Datagrid APIs as delegates, preserve absolute placement as an explicit hard-bound escape hatch, and make framework migrations behavior-additive | ✅ Resolved |
| AR-19 | Documentation & plugin | Which examples and generated guidance migrate | Every fixed demo / localized consumer guidance and mapped plugin references | Update localized docs examples and canonical recipes, review all plugin-impact reports, regenerate the distributed skill, and leave intentional non-localized fixture geometry alone | ✅ Resolved |
| AR-20 | Exclusions | Adjacent i18n work that could expand this plan | Include RTL, mutable locale, and caller-data translation / retain issue exclusions | Exclude RTL (#30), mutable global locale, caller-owned data translation, and proficient-speaker attestations | ✅ Resolved |
| AR-21 | Verification · runtime | How the harness proves actual Button activation and z-ordered hit geometry without firing destructive modal callbacks during inspection | Dispatch every activation and tolerate story mutation / expose read-only Button activation metadata plus side-effect-free EventLoop hit inspection | Add documented, read-only Button activation metadata and a side-effect-free EventLoop topmost-view query; derive action identity from actual Buttons, retain existing behavioral activation tests, and verify every claimed hit cell through the production hit-test traversal | ✅ Resolved |

## Resolution notes

### AR-1 and AR-2 — Scope and sequencing

- **Authority**: User decisions in this conversation.
- **Decision**: #184's Code Editor catalog, injection, localized presentation, and tooling are the
  completed foundation. #185 now owns the shared geometry contract, the complete translated-surface
  sweep, and one QA registry that includes the Code Editor alongside UI, Forms, Files, and Datagrid.
- **Consequence**: The implementation must not stop after migrating button rows. Every catalog-backed
  visible framework path is audited for cell measurement, intrinsic size, placement, wrapping,
  clipping, hit zones, and focus reachability.

### AR-3 through AR-7 — Shared geometry and constraint policy

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal additive API design and layout mechanics inside the user-approved
  translated-surface behavior. They do not alter product scope, locale support, or issue exclusions.
- **Objective**: Establish one Unicode-correct source of truth without changing the general layout
  engine or breaking existing Datagrid consumers.
- **Decision**: Add a pure Button-specific metrics API in `@jsvision/ui` which accepts buttons,
  configured minimum width, gap, and arrangement constraints. It returns the shared button width,
  horizontal minimum, row count, width, and height. Add horizontal and vertical composers that use
  those metrics and retain explicit absolute placement as a documented escape hatch. The width rule
  delegates caption/chrome measurement to `Button.measure()`. Existing Datagrid helpers delegate to
  the new API during migration. Components expand within their declared viewport maximum, then wrap
  complete buttons in stable source/tab order; only an infeasible viewport or caller-owned absolute
  bound may clip deterministically.
- **Evidence**: `Button.measure()` already removes accelerator markup and uses `stringWidth`
  (`packages/ui/src/controls/button.ts:95-115`). UI dialogs duplicate a 10-cell minimum and 2-cell
  gap (`packages/ui/src/dialog/message-box.ts:57-86`); Forms duplicates that policy and absolute
  placement (`packages/forms/src/form-dialog.ts:54-60,224-238`); Datagrid has the strongest existing
  widest-face algorithm but fixes a one-cell gap and row-only model
  (`packages/datagrid/src/button-row.ts:18-91`). The core layout engine intentionally does not own
  wrapping, while Personalize already performs a component-specific 3/2 split
  (`packages/datagrid/src/personalize-dialog.ts:403-406`).
- **Rejected alternatives**: Promoting the Datagrid names unchanged cannot represent UI's gap,
  Files' vertical actions, or wrapped height. A generalized wrap engine broadens core layout
  semantics beyond this issue. Expansion alone fails long overrides and narrow viewports; clipping
  alone violates the acceptance contract.
- **Strongest counterargument**: Component-level wrapping adds height negotiation and can starve
  dialog content. The plan therefore requires metrics to expose row count/height, builders to include
  that in intrinsic dimensions, and explicit behavior for an actually infeasible viewport.
- **Confidence**: High — the existing mature Datagrid algorithm and `Button.measure()` provide the
  correct primitives, and no core layout change is required.
- **Hardening**: A blind independent challenger converged on pure UI metrics plus composition,
  Datagrid delegates, component-owned stable wrapping, and a documented absolute-layout fallback.
  The challenge strengthened the design by requiring wrapped height and single-parent composition
  ownership to be explicit.
- **Challenger**: Converged.
- **Policy version**: 1.
- **Root invocation ID**: `i18n-layout-qa-2026-07-26`.
- **Reopen triggers**: The public UI composition primitives cannot preserve existing parent/layout
  ownership, a migrated built-in cannot negotiate height before mounting, or compatibility tests
  prove a Datagrid delegate changes exported behavior.

### AR-8 through AR-12 — Translated surface geometry

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Internal sizing, wrapping, and placement policy within the explicitly requested
  complete translated-surface sweep.
- **Objective**: Make visible framework text and interactive hit zones use the same terminal-cell
  geometry at normal, narrow, long-override, and Unicode boundaries.
- **Decision**: Replace code-unit measurements with renderer-equivalent cell measurements. Built-in
  UI dialogs derive width and height from body/action/frame requirements. Forms retain requested
  width/height as minima. Files consume shared vertical action metrics. Calendar resolves localized
  month/Today labels before deriving one geometry object used by draw and hit testing. Datagrid
  derives filter/personalization widths from every translated section and keeps one action width
  across wrapped rows.
- **Evidence**: Message boxes and prompts use `.length` plus fixed caps
  (`packages/ui/src/dialog/message-box.ts:132-145,173-186,217-222`). Calendar positions Today and
  centers/truncates month headings with code-unit length
  (`packages/ui/src/date/calendar-metrics.ts:139-147,212-230`). Personalize computes each wrapped
  row independently (`packages/datagrid/src/personalize-dialog.ts:403-406`), and the filter overlay
  measures its buttons but is mounted at a fixed width. Files independently repeat vertical button
  measurement.
- **Rejected alternatives**: Child `measure()` alone is insufficient for anchored overlays that
  need their extent before mount and for fixed captions. A second Unicode-width implementation
  risks disagreement with the renderer.
- **Strongest counterargument**: Growing Calendar or popups for every official translation changes
  long-standing compact dimensions. Intrinsic growth is limited to actual localized requirements,
  density and viewport contracts remain explicit, and standard English snapshots stay compatibility
  oracles where their content still fits.
- **Confidence**: High — each failure has a pure geometry seam and existing renderer width utility.
- **Hardening**: The challenger required one Calendar metrics result for draw and hit zones, and a
  Datagrid desired-size function that runs before anchored placement.
- **Challenger**: Converged.
- **Policy version**: 1.
- **Root invocation ID**: `i18n-layout-qa-2026-07-26`.
- **Reopen triggers**: A translated surface has no pre-mount geometry seam, English compatibility
  cannot coexist with cell-correct sizing, or viewport ownership is unavailable to a builder.

### AR-13 through AR-17 — QA lifecycle, registry, and safety

- **Authority**: AI — delegated by `--auto-design` for architecture; GitHub issue #185 fixes the
  ten-locale matrix, fresh-application requirement, story categories, and launch command.
- **Eligibility**: Internal harness state ownership, teardown sequencing, registry structure, and
  verification mechanics within fixed acceptance criteria.
- **Objective**: Prove locale isolation and translated geometry with real objects while preventing
  view, signal, modal, handler, or focus state from leaking across locale changes.
- **Decision**: A supervisor owns only validated serializable `{ locale, storyId }`. It closes the
  active story through supported lifecycle paths, disposes the old event loop/application, composes
  all five framework catalogs, constructs a new `I18n` and `Application`, validates the saved story
  ID, and builds fresh story state. The registry covers all issue-named packages and surface types,
  including Code Editor. Automated specifications exercise the ten official locales at 80×24 and
  declared narrower boundaries plus long overrides and wide/combining strings.
- **Evidence**: `Application.i18n` is readonly (`packages/ui/src/app/application.ts:114-126`);
  event-loop disposal stops and unmounts application state
  (`packages/ui/src/event/event-loop.ts:253-264`). The existing layout specification composes only
  four package catalogs and tests one 80×24 representative path
  (`packages/examples/test/i18n-layout.spec.test.ts:26-39,97-157`).
- **Rejected alternatives**: Mutating one application contradicts the public lifecycle and can
  retain app-owned translation, handlers, modal state, focus, and reactive owners. Rebuilding only
  the content tree does not test the required isolation boundary.
- **Strongest counterargument**: Full reconstruction can flicker interactively and an active modal
  may veto ordinary quit. Locale changes are therefore controlled supervisor transitions which
  close the story/modal first and rebuild after disposal; tests assert old state is unreachable.
- **Confidence**: High — the lifecycle already exposes deterministic disposal and the issue
  explicitly disallows a mutable locale.
- **Hardening**: The blind challenger identified the exact state allowlist and required modal
  teardown before event-loop disposal.
- **Challenger**: Converged.
- **Policy version**: 1.
- **Root invocation ID**: `i18n-layout-qa-2026-07-26`.
- **Reopen triggers**: A story cannot close through supported APIs, disposal leaves registered
  handlers/reactive roots live, or the interactive terminal host cannot survive supervisor rebuild.

### AR-18 through AR-20 — Compatibility, release surfaces, and exclusions

- **Authority**: GitHub issue #185, project `AGENTS.md`, the user's broad-sweep decision, and existing
  package compatibility contracts.
- **Decision**: Keep public behavior additive, update localized consumer examples and every impacted
  canonical skill reference, regenerate the plugin, and verify with `yarn plugin:check` and
  `yarn verify`. Preserve caller-owned content and leave RTL, mutable locale, and external human
  translation attestations outside this implementation.

### AR-21 — Non-mutating activation and hit-test evidence

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: Additive inspection API and test mechanics within the already approved
  multilingual QA acceptance contract. The decision changes no user-visible action behavior,
  compatibility policy, or product scope.
- **Objective**: Make the headless oracle report actual Button configuration and production
  z-order while leaving modal state untouched so every action can be inspected in one fresh story.
- **Decision**: Expose an immutable Button activation descriptor containing its parsed visible
  label, configured command, and whether a callback is bound. Add an EventLoop query which returns
  the topmost enabled, visible view at a zero-based terminal cell using the same scope, clipping,
  visibility, and z-order traversal as pointer dispatch. The harness derives action IDs and labels
  from those descriptors, publishes command-or-callback evidence without placeholders, and checks
  every cell in the claimed face against the production query. Existing Button behavioral tests
  remain the executable proof that keyboard and pointer activation emit the described command and
  invoke the described callback.
- **Evidence**: Button commands and callbacks are protected implementation fields, so the harness
  currently substitutes unrelated command names and calls handlers directly. Pointer dispatch
  shares one internal topmost-view traversal, but repeated activation can close dialogs, launch
  nested work, or mutate Files and Datagrid state before later actions are inspected.
- **Rejected alternatives**: Dispatching every action in one mounted story is not deterministic
  because the first callback may close or mutate the surface. Reimplementing z-order inside the
  examples package would duplicate production hit-testing and could pass while actual routing is
  broken. Returning mutable callback functions would unnecessarily expose invocation authority.
- **Strongest counterargument**: Two small public inspection seams increase the SDK surface. Both
  are read-only, behavior-additive, independently useful for headless UI testing, and avoid a
  harness-only backdoor into protected fields.
- **Confidence**: High — the required data already exists on Button and the production hit-test
  traversal is already pure before delivery.
- **Hardening**: The independent Phase 3 reviewer and auditor both rejected synthetic commands and
  local one-point probes. This design directly addresses both findings while preventing the
  callback mutation they also identified.
- **Policy version**: 1.
- **Root invocation ID**: `i18n-layout-qa-2026-07-26`.
- **Reopen triggers**: The read-only metadata cannot describe a shipped action, the hit query
  diverges from pointer routing, or public API review finds a compatibility break.

## Category scan

| Required category | Resolution |
|---|---|
| Scope | AR-1, AR-2, AR-20 |
| Users and actors | AR-13, AR-14 |
| Inputs and outputs | AR-4, AR-5, AR-15 |
| Behavior and workflows | AR-6, AR-8 through AR-14 |
| Data and state | AR-13 |
| Integration points | AR-3, AR-10 through AR-14, AR-19 |
| Security and compliance | AR-17, AR-20 |
| Error handling and edge cases | AR-6, AR-11, AR-12, AR-15, AR-17 |
| Non-functional requirements | AR-4, AR-6, AR-15 |
| Compatibility and migration | AR-7, AR-9, AR-18, AR-19 |
| Verification and acceptance | AR-15, AR-16, AR-19, AR-21 |
| Naming and terminology | AR-3 through AR-5, AR-13 |
