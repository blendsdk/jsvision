# Requirements: translated layout and multilingual QA

> **Owning source**: GitHub issue #185 plus the user's complete-sweep and sequencing decisions
> **Status**: Approved for planning
> **CodeOps Artifact Schema**: 1

## Goal

Translated framework text must remain fully usable in terminal-cell layouts. Buttons in one logical
group must share the widest required face, translated dialogs and overlays must derive their
geometry from visible content, and a real multilingual application must make regressions easy to
inspect and automate across every supported locale.

## Functional requirements

### RQ-1 — Shared button geometry

1. `@jsvision/ui` shall expose a public pure metric for a logical group of `Button` instances.
2. The shared button width shall equal the maximum of the configured minimum width and every
   button's natural measured width.
3. Natural width shall use terminal display cells, exclude tilde accelerator markup, and include
   the same face padding/shadow columns used by `Button`.
4. The contract shall expose the minimum horizontal band width, button height, row count, and total
   arranged height needed by built-in components.
5. Public composition shall support equal-width horizontal groups, deterministic wrapped rows, and
   vertical action columns without changing activation or focus order.
6. Absolute callers shall retain an explicit placement escape hatch and receive documented
   deterministic clipping behavior when they impose an infeasible hard bound.

### RQ-2 — Framework migration

1. UI message, confirmation, input, find/replace, editor, and other catalog-backed dialogs shall
   derive action and visible-text geometry from display-cell measurements.
2. Forms dialogs shall use the shared action metrics. Caller-supplied dimensions remain supported
   as minima and expand within the available viewport when translated actions require it.
3. Files dialogs shall share one width across related vertical actions and derive dialog minimum
   width from action, field, label, and frame requirements.
4. Calendar shall measure translated month names and Today in display cells. The same localized
   metrics shall govern size, drawing, truncation, placement, hit testing, and DatePicker popup
   bounds.
5. Datagrid filter/value-list/personalization surfaces shall derive desired size from translated
   operators, captions, headers/status text, editor minima, and actions. Wrapped related actions
   shall retain one group-wide button width.
6. Dropdowns, switches, labels, and every other catalog-backed visible framework path shall be
   audited; already-correct paths shall receive regression evidence rather than gratuitous changes.
7. No built-in translated action may overflow, overlap, disappear, become unreachable, or expose a
   smaller hit zone than its rendered button.

### RQ-3 — Multilingual QA application

1. `@jsvision/examples` shall provide `demo:i18n`.
2. The application shall use a typed registry of stable story IDs and metadata.
3. The registry shall cover standard actions, UI dialogs, dropdowns/surfaces/Calendar, Forms, Files,
   Datagrid, formatting, application overrides, Unicode, and Code Editor.
4. It shall compose catalogs for UI, Forms, Files, Datagrid, and Code Editor in each official
   locale.
5. A locale transition shall close/dispose the current story and application, then construct fresh
   catalogs, `I18n`, `Application`, registry, and story state.
6. Only validated serializable locale and story identifiers may survive reconstruction. Views,
   signals, focus, modal state, form values, file selections, grid filters, handlers, diagnostics,
   and reactive roots shall not survive.
7. The ten official locales are `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv`.

### RQ-4 — Documentation and supported SDK surfaces

1. Public API documentation shall explain metrics, equal-width groups, stable wrapping, vertical
   actions, absolute placement, and viewport constraints with runnable examples.
2. Localized docs examples shall consume shared metrics instead of hard-coded translated button
   sizes.
3. Canonical JSVision skill recipes shall describe the public contract and multilingual QA command.
4. Every path reported by the plugin-impact mapping shall be reviewed; `yarn plugin:update` shall
   regenerate the distributed plugin copy.
5. Intentional fixed English fixtures that do not consume i18n shall not be mechanically rewritten.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-1 | Given any action group, its reported button width is `max(minimum, ...button.measure().width)` and every composed sibling uses that width. |
| AC-2 | Tilde accelerators do not consume width; wide and combining captions match renderer cell geometry. |
| AC-3 | Horizontal, wrapped, and vertical compositions report exact band width/height and preserve source, Tab, accelerator, and activation order. |
| AC-4 | Existing Datagrid button helpers remain compatible delegates during migration. |
| AC-5 | UI, Forms, and Files dialog specifications prove translated buttons fit, remain fully hittable, and are focus-reachable at preferred and constrained dimensions. |
| AC-6 | Calendar specifications prove all official month/Today captions and Unicode overrides use consistent measure/draw/hit geometry without broken cell boundaries. |
| AC-7 | Datagrid filter/value-list/personalization specifications prove localized content drives desired size, viewport clamping, and stable action reflow. |
| AC-8 | A source/catalog sweep accounts for every framework-owned localized visible string; each affected path is migrated or covered as already cell-correct. |
| AC-9 | `demo:i18n` starts the dedicated registry and exposes every required story category. |
| AC-10 | Each locale/story reconstruction creates different `I18n` and `Application` identities and leaves no old view/modal/focus/reactive story state reachable. |
| AC-11 | The layout matrix passes for all ten locales at 80×24, declared narrower boundaries, long overrides, and wide/combining Unicode. |
| AC-12 | The existing `packages/examples/test/i18n-layout.spec.test.ts` remains the requirements-derived oracle and is expanded rather than replaced. |
| AC-13 | Localized docs examples and canonical/generated plugin guidance use the shared contract and pass their validation suites. |
| AC-14 | `yarn plugin:check` and `yarn verify` pass; no new runtime dependency, mutable locale, caller-data translation, or fabricated human approval is introduced. |

## Non-functional requirements

- Geometry calculation is pure and deterministic.
- Built-in layout work remains linear in the number of buttons or translated labels.
- Public APIs are additive and fully documented with examples.
- Renderer-equivalent width logic is reused; no competing Unicode-width model is introduced.
- Terminal-safety normalization and clipping remain in force for untrusted caller/catalog content.
- English geometry and snapshots remain unchanged where text already fits the existing dimensions.

## Out of scope

- Right-to-left layout and bidi behavior tracked by #30.
- Runtime mutation of an existing application's locale.
- Translation of caller-owned records, paths, source text, values, or protocol details.
- Proficient-speaker review attestations not supplied by actual reviewers.
