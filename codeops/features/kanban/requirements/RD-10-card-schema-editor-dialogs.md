# RD-10: Card Schema and Editor Dialogs

> **Document**: RD-10-card-schema-editor-dialogs.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-04, RD-08
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

The package supplies useful mainstream create/view/edit dialogs while allowing applications to replace
every field, control, section, dialog, or the entire editor. Standard and generic cards share one typed
schema/adapter protocol and JSVision Forms lifecycle. Editing occurs in dialogs or an optional
application-controlled inspector, never inline on the card.

The standard schema adapter is the only Kanban surface coupled to Zod. It accepts a `zod: ^4` schema
compatible with `@jsvision/forms`; generic card adapters and custom editor replacement remain independent
of Zod types.

---

## Functional Requirements

### Must Have — Complexity XL

- [ ] Define one typed card editor schema with stable field/section IDs, typed get/set/format/parse,
  visibility/read-only rules, sync/async validation, and custom control factories.
- [ ] Supply standard fields for title, status, description, type, priority, assignees, labels, dates,
  estimate, checklist groups/items, and application-defined fields; only configured fields appear.
- [ ] Support text, multiline text, number, boolean, date, single choice, multiple choice, and custom
  control field kinds.
- [ ] Provide localized themed create, view, and edit modal dialogs using responsive layout DSL and
  scrollable progressive sections.
- [ ] Use isolated drafts, base revision, dirty/touched/submitting state, sync/async validation,
  cancellation, stale-result suppression, and application dispatch.
- [ ] Keep the dialog open and draft intact during async submission and after rejection.
- [ ] Detect external revision change/deletion; prevent silent overwrite and offer Reload/Cancel or
  application-supplied merge/overwrite policy.
- [ ] Confirm dirty close and destructive actions through package localized confirmations.
- [ ] Permit full custom editor replacement and optional application-controlled modeless inspector,
  while preventing simultaneous editors for the same card identity.
- [ ] Keep card checklist previews read-only; all item/group editing happens through this schema.

### Should Have — Complexity L

- [ ] Support schema sections/tabs and collapsible dense groups with at most one secondary dense group
  expanded initially.
- [ ] Expose typed dialog result builders so applications can collect a validated draft without
  immediately dispatching it.
- [ ] Preserve draft values and field focus across responsive reflow where the field still exists.

### Won't Have (Out of Scope)

- Inline card editing, untyped arbitrary form mutation, simultaneous standard+custom editors for one
  card, component-owned conflict merges, or persistence.
- Rich-text/HTML editor, attachment upload, comment activity editor, or implicit clipboard/filesystem use.

---

## Technical Requirements

### Schema protocol — Complexity XL

Every field descriptor includes stable bounded ID, kind, localized label/help message IDs, typed value
adapter, optional parser/formatter, initial/default semantics for create, sync validators, optional async
validators receiving `AbortSignal`, visibility/read-only predicates, section/order, and optional custom
control factory. Choice providers expose bounded states/results and cancellation.

Schemas reject duplicate IDs, unknown kinds, invalid section references, dependency cycles in derived
visibility, unbounded option lists, and custom controls without measurement/disposal contracts.
Predicates/formatters/validators are failure-isolated and cannot mutate the authoritative record.

### Standard schema — Complexity L

The package declares `zod: ^4` as peer and development dependency and exports Kanban-owned schema
builders/adapters rather than re-exporting Zod. Packed-consumer tests verify missing-peer diagnostics and
successful Forms integration with a compatible consumer-provided Zod instance.

The default order is title/status, workflow placement, type/priority, assignees/labels, dates/estimate,
description, checklist groups, then registered custom sections. Title and status are required standard
semantic fields; placement/order adapters are required for create/move semantics but need not be object
properties named `columnId`/`rank`. All other fields are optional and absent controls add no blank rows.

Checklist editing supports add/rename/reorder/delete group and add/edit/toggle/reorder/delete item drafts,
stable IDs, source order, and validation. Applications own ID generation or provide a draft ID factory;
the package never derives durable IDs from item text.

### Dialog composition — Complexity L

Dialogs use `col`/`row`/`stack`, measured labels/actions, `grow` for the principal scrollable form, and
responsive button groups. At normal geometry common fields are visible together. Secondary sections are
collapsible; checklist/custom sections scroll rather than grow beyond the host. At minimum geometry,
field labels/controls reflow according to schema presentation and all active validation, submit, Cancel,
and help routes remain reachable. No ordinary control uses hand-authored absolute rectangles.

### Draft and validation lifecycle — Complexity XL

Opening clones normalized values into a form-owned draft and captures card/source revision. Changes never
mutate the source record. Sync validation gates field/form submission. Async validators cancel on value
change, superseding run, close, or disposal; generations suppress stale settlement. Submit sets pending,
retains values/focus, and builds one typed full-draft request plus changed field IDs and base revision.

While pending, editable controls and duplicate submit are disabled; Cancel behavior follows application
request cancellability and never silently discards accepted work. Rejection maps bounded field errors and
form error into the existing draft. Acceptance awaits authoritative publication per RD-08 before close
unless the application explicitly configures accepted-close with visible pending ownership.

### Stale/deleted records — Complexity L

When the source revision changes, compare the editor's base identity/revision with current data. Unrelated
updates refresh non-draft presentation only. A changed edited card marks the draft stale and disables
ordinary submit. Standard choices are Reload (replace draft after dirty confirmation) or Cancel; an
application may provide a typed merge/overwrite decision and dispatcher policy. External deletion makes
the editor non-submittable and offers Close; it never recreates unless an explicit Create request is chosen.

### Editor ownership — Complexity M

The package maintains an editor registry keyed by `CardKey`. Modal create may use a provisional unique
session identity. Opening the same card focuses/reveals the existing modeless inspector or rejects a
second modal. Registry cleanup is idempotent on close/dispose/error. Applications own inspector docking/
window placement; its interior uses the same schema and responsive form component.

---

## Integration Points

- **RD-04** shares standard fields/checklist identity and display adapters.
- **RD-08** receives validated create/update/delete requests and publication.
- **RD-11** reuses staged forms, confirmations, and responsive dialogs.
- **RD-13** supplies messages, formats, accelerators, theme roles, and translated measurement.
- **RD-14** verifies async races, hostile fields, bounds, and disposal.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Location | Inline / dialogs / both | Dialogs | Card scanability | AR #5, #16 |
| Model | Fixed / generic / shared hybrid | Shared hybrid | Strong defaults and custom storage | AR #20, #35 |
| Modality | Modal / modeless / both | Modal standard + optional inspector | Mainstream and advanced workflow | AR #20 |
| Draft | Live mutate / isolated | Isolated | Cancel/reject safety | AR #20, #31 |
| Stale | Overwrite / detect | Detect and require policy | No lost updates | AR #21, #31 |

---

## Security Considerations

- Treat all schema definitions, field values, labels/help/errors, choice data, and custom controls as
  bounded input; sanitize display text and validate typed values before dispatch.
- Async validation is advisory UI only. Applications repeat server-side/domain validation and
  authorization against current data/revision.
- Custom controls receive form-field context, not host filesystem/network/clipboard authority, and must
  dispose all resources.
- Drafts/errors/observations do not log descriptions, assignees, checklist text, custom data, or tokens.
- No HTML/eval/module path/schema-provided executable strings are accepted.

---

## Acceptance Criteria

1. [ ] A schema containing each standard field kind constructs typed controls and round-trips valid
   values without mutating the original record before authoritative publication.
2. [ ] Duplicate field/section IDs, unknown kinds/sections, cyclic visibility, and over-bound choice data
   reject before mounting a partial form.
3. [ ] Standard create/edit at 80×24 shows common fields, a growing scroll region, and reachable measured
   actions; narrow resize reflows/scrolls without clipping validation or Cancel.
4. [ ] Omitted optional standard fields contribute zero controls/blank rows.
5. [ ] Dirty Cancel/Esc requires confirmation; declining keeps the same draft/focus, accepting disposes it
   without a request.
6. [ ] Async validator receives a live signal; a newer value aborts it, and an older late settlement cannot
   replace the newer result.
7. [ ] Submit with invalid sync/async fields dispatches zero requests and focuses/reveals the first error.
8. [ ] Valid submit dispatches one full-draft request with changed field IDs/base revision, keeps the dialog
   open/pending, and blocks duplicate submit.
9. [ ] Rejection preserves every draft value and maps field/form errors; correction can resubmit with a new
   operation ID.
10. [ ] Matching authoritative publication closes/configurably settles; contradictory publication marks
    stale/conflict and never silently overwrites.
11. [ ] External deletion makes the draft non-submittable and Close emits no accidental recreate request.
12. [ ] Reload of a dirty stale draft requires confirmation and then resets base revision/dirty state to
    the current application record.
13. [ ] Two attempts to edit the same `CardKey` produce one owned editor; the second focuses/reveals it or
    returns typed already-open outcome.
14. [ ] Multiple checklist groups/items keep stable generated/application IDs through reorder, rejection,
    and later publication; text changes never change IDs.
15. [ ] A throwing custom control/validator is isolated to its field with sanitized error and all acquired
    timers/subscriptions are released on disposal.
16. [ ] Hostile field/error text cannot emit ANSI control sequences or appear unredacted in diagnostics.
