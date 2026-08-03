# RD-09: Search, Filters, Sorting, and Saved Views

> **Document**: RD-09-search-filters-saved-views.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-02, RD-05, RD-06, RD-08
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Users need to find and organize cards without changing authoritative workflow membership. Search,
jointly active quick filters, field filters, sorting, grouping, personalization, and durable saved views
form one explicit view-projection pipeline. The package defines and validates a versioned semantic JSON
artifact while the application owns naming, storage, sharing, and access.

View state has three explicit ownership classes: ephemeral interaction state is never persisted; durable
local semantic view state is captured/applied through pure transitions; shared application-store
operations such as save, rename, and delete use RD-08 requests. Applying a saved view therefore remains
available in read-only mode and emits no dispatcher request.

---

## Functional Requirements

### Must Have — Complexity XL

- [ ] Provide sanitized text search, registered field filters, named quick filters, field sorting, one
  optional grouping field, column personalization, density/card presentation, and saved-view capture/apply.
- [ ] Keep filters/search view-only; they never change card placement or WIP membership.
- [ ] Define a deterministic projection order and push supported operations into the active query session.
- [ ] Display total, matching, loaded, visible, selected, and WIP counts honestly.
- [ ] Reconcile focus/selection after query changes and provide Clear Filters for filtered-empty state.
- [ ] Disable ambiguous within-cell manual rank changes in sorted/unresolvable filtered projections.
- [ ] Define a bounded validated version-1 durable saved-view envelope and public pure capture, parse,
  migrate, reconcile, and apply helpers.
- [ ] Persist only durable semantic state and stable IDs; exclude runtime functions and transient session state.
- [ ] Support explicit sequential migrations and deterministic unknown/missing-ID handling.

### Should Have — Complexity L

- [ ] Permit application-owned named quick filters and saved-view stores/dialog integration.
- [ ] Preserve bounded namespaced application extension JSON losslessly when safe.
- [ ] Report skipped/missing registry or data IDs through structured sanitized diagnostics.

### Won't Have (Out of Scope)

- Component-owned saved-view persistence/sharing, server query language, full board-data export, separate
  slicing primitive, or exact transient workspace resume.
- Serializing functions, placement tokens, cache contents, pending operations, editors, selection, focus,
  hover, or scroll offsets in durable views.

---

## Technical Requirements

### Projection pipeline — Complexity L

The semantic order is:

1. authoritative structure/membership;
2. search and all active filters (logical AND unless a registered filter explicitly owns internal OR);
3. selected sort directives;
4. optional one-dimensional grouping;
5. column/swimlane visibility/collapse and presentation;
6. windowing/viewport clipping.

Search/filter/sort/group changes produce a new query revision and session (RD-02). Hidden/collapse are
view projection only. Sort stability uses stable card identity as final tie-breaker where the application
comparator permits; remote sources own equivalent deterministic ordering.

### Search and filters — Complexity L

- Search input is bounded and uses a configurable 150 ms default debounce without blocking input. The application defines
  searchable fields/format semantics; the component does not stringify entire records.
- Quick filters have stable IDs, localized labels, active state, optional parameter schema, and may be
  jointly active.
- Field filters use registered typed operator/value codecs and bounded values. Unknown operators/fields
  fail saved-view restoration or are skipped under explicit optional semantics.
- Clearing filters does not restore old focus automatically. Filtered-empty surface offers Clear Filters
  without stealing focus while typing.

### Sorting and manual order — Complexity M

Sort directives use stable registered field/comparator IDs and direction/order. In a sorted cell,
within-cell drag/reorder is disabled because rank is not the active display order. Cross-column moves may
be allowed and receive a source/application target placement policy. Removing sort reveals authoritative
rank order. The board never rewrites rank to match a temporary sort.

### Personalization — Complexity M

Durable view facets include ordered columns, visibility, collapse, bounded user width overrides,
grouping field/variant, swimlane order/visibility/collapse, filters/quick filters/search policy, sort,
density, ordered card fields/summary/checklist presentation, and package-defined display options.
Applications may choose whether raw search text is saved; default is not to persist transient user text,
while named filter parameters are durable.

### Version-1 saved-view envelope — Complexity XL

The plain JSON envelope contains package discriminator, integer `version: 1`, optional bounded name,
durable facets above, registry/data IDs, and bounded namespaced `extensions`. It is validated for byte
size, depth, array lengths, key counts, strings, numeric cell widths, discriminators, and allowed JSON
types before interpretation.

Unknown top-level fields reject. Known older versions migrate sequentially through package and optional
application adapters without mutating input. Unknown newer versions and unknown required semantics fail
with structured diagnostics. Missing current columns/fields/groups are ignored behaviorally and reported;
current new columns append deterministically with default visibility/state. Optional unknown namespaced
extensions and unavailable IDs are preserved in the bounded raw artifact where safe so a round-trip does
not destroy another application extension.

Extension equality is semantic JSON equality after parsing: object member order and insignificant source
whitespace are ignored; array order and string code points are significant; booleans and null compare by
JSON value; and number spellings compare by their finite parsed numeric value. Canonical serialization
recursively emits object keys in Unicode code-point order, preserves array order, and uses the package's
single documented JSON number/string encoder. Exact input bytes are not retained.

### Restore behavior — Complexity L

Restore is pure validation/reconciliation first, then one atomic board view application. It never applies
half a view. Widths remain terminal-cell values; runtime clamps them to current min/max without rewriting
the saved artifact. Locale and terminal capabilities are restoration inputs, not persisted assumptions.
Same envelope plus same registry/data/capability inputs yields the same semantic resolved view.

---

## Integration Points

- **RD-02** executes the query and reports honest count/completeness.
- **RD-05/RD-06** reconcile structure, collapse, focus, and selection.
- **RD-11** may offer saved-view/personality configuration surfaces.
- **RD-12** supplies commands/events for search/filter/view actions.
- **RD-13/RD-14** validate translated geometry, hostile JSON, migrations, and scale.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| View features | Minimal / mainstream set | Search+filters+sort+group+saved | Strong productivity | AR #17 |
| Persistence | Component / app | App stores package schema | Reusable SDK | AR #30 |
| Saved content | All state / durable semantic | Durable semantic | Avoid stale/capability-specific state | AR #36 |
| Compatibility | Reject / best effort / migrations | Validate+migrate+reconcile | Explicit evolution | AR #36 |
| Rank under sort | Rewrite / disable | Disable within-cell | Preserve authority | AR #19, #32 |
| Search timing | Deferred / configurable default | 150 ms | Responsive typing with bounded query churn | AR #43 |

---

## Security Considerations

- Treat saved views and filter values as untrusted input: validate and bound before allocating,
  registering, formatting, or applying.
- Registry IDs select pre-registered behavior only; saved JSON cannot carry source code, module paths,
  regular-expression executables, callbacks, or host-resource references.
- Search/filter text is sanitized for display; application/server adapters must parameterize remote
  queries and enforce authorization/rate limits.
- Extensions are inert JSON, namespaced, depth/size bounded, and never executed by the package.
- Diagnostics redact filter values when configured sensitive and never include card bodies or tokens.

---

## Acceptance Criteria

1. [ ] Search/filter changes matching/visible counts and cards but leaves total/WIP/source placement
   unchanged.
2. [ ] Two active quick filters apply jointly and produce one new query revision/session rather than
   mutating application cards.
3. [ ] Filtered-empty state is distinct from true empty and its Clear Filters action clears the query
   without restoring prior card focus.
4. [ ] Sorting by one registered field is deterministic for ties and disables within-cell rank drag with
   a visible reason; clearing sort returns source rank order.
5. [ ] Applying grouping while another grouping field is active replaces it atomically; a view containing
   two active grouping fields rejects.
6. [ ] Capturing a default view emits discriminator, version `1`, and durable facets but contains no focus,
   selection, scroll offset, placement token, pending operation, editor draft, cache page, or function.
7. [ ] Parsing malformed JSON shapes, unknown top-level fields, excessive depth/size/array length,
   invalid widths, and executable-like values rejects before changing the board.
8. [ ] Unknown newer schema version fails with a structured unsupported-version result and leaves the
   current view untouched.
9. [ ] A known older fixture runs each sequential migration exactly once, preserves original input bytes,
   validates the result, and applies atomically.
10. [ ] A saved view referencing a removed column drops it with a diagnostic and appends a new current
    column in deterministic current order/default state.
11. [ ] Unknown optional namespaced extension data survives parse/capture round-trip under the exact
    semantic JSON equality and canonical serialization rules above while never being executed; object
    key order, insignificant whitespace, and equivalent finite number spelling are not promised
    byte-identical, while array order and string code points remain exact.
12. [ ] Applying the same view with the same registry/data/capability inputs twice produces equal resolved
    semantic state; changing locale affects labels/measurement only, not IDs/filters/order.
13. [ ] A saved 40-cell width clamps to current runtime maximum 32 while the stored/captured raw artifact
    remains 40 unless the user explicitly resaves the reconciled view.
14. [ ] A remote query adapter receives typed registered filter/sort IDs and values, never a generated raw
    SQL/string expression from the component.
15. [ ] Sensitive filter configuration prevents its raw value from appearing in errors/observations.
16. [ ] Saved-view codecs and migrations have property/fuzz tests for round-trip, invalid bounds, unknown
    versions/IDs, idempotent current-version parse, and atomic failure.
