# Testing Strategy: Kanban Phase B Core Board

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Phase B uses requirements-derived immutable specification tests, separate implementation/property tests,
real UI event/render-loop E2E, deterministic scale/security fixtures, packed consumers, and integration
checks. Every in-scope RD-04–06 criterion and plan-local slice has an oracle. There is no invented line-
coverage percentage; criterion coverage is complete and implementation edge coverage is granular
(PAR-B24).

Tests prefer real sources, controllers, render roots, event loops, themes, and i18n services. Mocks are
limited to application callbacks, time, and deliberately windowed external source completion. Fixed
seeds are reported on property-test failure.

## 🚨 Specification Test Cases

> These expectations derive only from the owning RDs and 03 specifications. They are immutable oracles:
> implementation failures are fixed in production code, never by weakening the expectation.

### Presentation policy and cards

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-B-CARD-01 | Application record uses `ticketNumber`, `caption`, and `stateLabel`; generic adapters project it | Original record identity/shape is retained and descriptor shows sanitized caption/status without `StandardCard` conversion | RD04-AC01; 03-01 §Card presentation adapters |
| ST-B-CARD-02 | Standard card rendered at every width 18–32 in each preset | Non-empty title/status and one non-color focus cue remain inside width/row budget | RD04-AC02; 03-02 §Standard section composition |
| ST-B-CARD-03 | One visible card's reactive status/style revision changes | Only that descriptor/style fingerprint changes; application record and neighboring descriptor identities remain unchanged | RD04-AC03; 03-02 §Reactive styles |
| ST-B-CARD-04 | Custom renderer returns row/region outside width/height budget | Output is rejected, bounded fallback paints locally, neighbor cards remain actionable, and one safe observation is emitted | RD04-AC04; PAR-B16 |
| ST-B-CARD-05 | Default presentation receives three checklist items | No checklist section/row/region is emitted | RD04-AC05; 03-02 §Checklist rendering |
| ST-B-CARD-06 | Preview mode receives three source-ordered items | At most two items appear in order plus `+1` omitted evidence | RD04-AC05; 03-02 §Checklist rendering |
| ST-B-CARD-07 | Compact/narrow preview is reduced through decreasing row budgets | Preview becomes progress, then hidden; title/status/focus never clip | RD04-AC06; 03-02 §Degradation algorithm |
| ST-B-CARD-08 | Checklist text ends with a double-width glyph beyond available cells | Ellipsis fits display width and no half-wide glyph is emitted | RD04-AC07; 03-02 §Metadata… |
| ST-B-CARD-09 | Card contains zero groups and groups containing zero items | No blank checklist row/frame is allocated | RD04-AC08; 03-02 §Checklist rendering |
| ST-B-CARD-10 | Enter, double-click, or the explicit action region activates a checklist preview | One editor semantic intent is emitted; completion flags and application record remain unchanged; Space remains selection-only | RD04-AC09; RD06-AC07; SPEC-B-ACTION-HOOK |
| ST-B-CARD-11 | Publication reorders/edits items while retaining group/item IDs | Rerender preserves typed identities and source order from the new publication | RD04-AC10; 03-02 §Checklist rendering |
| ST-B-CARD-12 | Summary adapter exposes count `100` plus 100 child labels | Standard descriptor renders only bounded summary/count and never enumerates child rows | RD04-AC11; 03-02 §Metadata… |
| ST-B-CARD-13 | Mono/`NO_COLOR` fixtures cover status, focus, selection, pending, invalid | Each state has distinct non-color semantic evidence without foreground/background dependence | RD04-AC12; 03-02 §Reactive styles |
| ST-B-CARD-14 | ANSI/C0/C1/bidi text appears in every standard field/checklist/summary | Surrounding cells/geometry remain intact and unsafe controls are absent from output/observations | RD04-AC13; PAR-B16/PAR-B17 |
| ST-B-CARD-15 | Field/style/summary getter throws with secret-bearing error | One local fallback and payload-free observation occur; board remains mounted and secret/card content is absent | RD04-AC14; PAR-B16 |
| ST-B-CARD-16 | Date adapter returns one object/value and injected formatter records its input | Formatter receives the unchanged value once; card data is unchanged and no hidden timezone conversion occurs | RD04-AC15; 03-02 §Metadata… |
| ST-B-PRES-01 | Resolve all presets and a valid custom policy | Frozen budgets satisfy central limits; comfortable is default; repeated equal input has stable revision/fingerprint | 03-01 §Public presentation policy; PAR-B09 |
| ST-B-PRES-02 | Per-card selection reorders configured IDs, includes absent IDs, and exceeds field/summary cardinality maxima | Known IDs are intersected in requested order, field/summary results are capped, checklist groups remain independent of item-preview count, and the resolved numeric budget is unchanged | RD-04 should-have; 03-01 §Public presentation policy |
| ST-B-PRES-03 | Custom policy has negative/fractional/oversized values, duplicate mandatory degradation, or invalid revision | Validation rejects with payload-free package error and no partial policy publication | 03-01 §Validation; PAR-B09/PAR-B16 |

### Structure, workflow, and swimlanes

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-B-STRUCT-01 | Source has zero columns | Localized no-columns surface is focusable and emits no card/header/action targets | RD05-AC01 |
| ST-B-STRUCT-02 | Column label changes while ID, cards, and saved semantic reference remain | Header label changes; placement/focus/selection/reference retain unchanged ID | RD05-AC02; 03-03 §Structural model |
| ST-B-STRUCT-03 | Filter hides half the cards but source publishes unfiltered WIP `8` and matching `4` | WIP/violation uses `8`; matching count is separately qualified as `4` | RD05-AC03; 03-03 §WIP policy |
| ST-B-STRUCT-04 | Exact max violation is evaluated in informational/advisory/blocking modes | Results are respectively allowed-with-violation, warning, and blocked; no dispatch occurs | RD05-AC04; PAR-B12 |
| ST-B-STRUCT-05 | Blocking WIP count is unknown | Result is unavailable/retryable, never allowed, with non-color feedback | RD05-AC05; 03-03 §WIP policy |
| ST-B-STRUCT-06 | Application transition resolver allows then rejects a backward move | Evaluator mirrors allowed then blocked reason without assuming direction or dispatching | RD05-AC06; 03-03 §DoD and transitions |
| ST-B-STRUCT-07 | Query requests zero, one, then two group fields while policy attempts a mismatched field | Zero/one query grouping normalizes; two query fields and mismatched policy reject atomically without replacing current grouping | RD05-AC07; 03-03 §Grouping normalization |
| ST-B-STRUCT-08 | Derived resolver receives missing group value | Card appears in configured unassigned group with stable semantic address | RD05-AC08 |
| ST-B-STRUCT-09 | Card belongs to a hidden semantic group, then group is revealed | Hidden scene omits group/card without remapping; reveal restores original group/address | RD05-AC09; PAR-B27 |
| ST-B-STRUCT-10 | Two normalized-equal group labels lack, then provide, disambiguators | First configuration rejects; second renders visibly distinct headers | RD05-AC10 |
| ST-B-STRUCT-11 | Same scene rendered hybrid/separator/band/rail | Semantic groups/cards/counts/IDs are equal; only bounded chrome/geometry differs | RD05-AC11; PAR-B07/PAR-B10 |
| ST-B-STRUCT-12 | Rail would leave a column at 17 cells | Strategy degrades to hybrid and every card column remains at least 18 cells | RD05-AC11; 03-04 §Variant geometry |
| ST-B-STRUCT-13 | Capable swimlane header is clicked, then the application republishes collapsed policy | One scoped collapse intent is emitted without local mutation; after republication header/count/actions persist, card region disappears, and no drop target exists | RD05-AC12; PAR-B27 |
| ST-B-STRUCT-14 | Synthetic hover lease remains 499 ms, reaches 500 ms, then leaves | No expansion before threshold; temporary expansion at threshold; leave restores collapse and saved state never changes | RD05-AC13 slice; SPEC-B-HOVER-HOOK |
| ST-B-STRUCT-15 | Hidden group receives navigation/search/synthetic hover requests | It remains hidden and never auto-reveals | RD05-AC14 |
| ST-B-STRUCT-16 | Fixtures represent true-empty, filtered-empty, loading, partial, collapsed, and error | Every state has a distinct semantic code/non-color surface; only filtered-empty emits clear-filter intent and only error invokes its scoped cursor retry seam, never both routes | RD05-AC15; 03-03 §Structural states |
| ST-B-STRUCT-17 | Group/style/summary resolver throws with hostile error | Affected group uses safe local fallback/observation and other groups remain usable | RD05-AC16; PAR-B16 |
| ST-B-STRUCT-18 | Any hide/collapse/evaluator/header interaction executes | Application card collection is byte/identity unchanged and no structural mutation request is dispatched | RD05-AC17; PAR-B04 |
| ST-B-STRUCT-19 | Three populated columns publish a new column order only | Headers reorder; card identities/cells remain authoritative; mounted view count stays bounded | RD05-AC18; PAR-B05 |
| ST-B-STRUCT-20 | Collapse and hide are applied to the same populated swimlane in separate runs | Collapse retains chrome/count and suppresses card cursor region; hide removes semantic scene node | 03-03 §Structural model; PAR-B27 |
| ST-B-STRUCT-21 | Custom swimlane descriptor exceeds row/rail/role/text/region/action budget | Descriptor is rejected locally; standard safe header fallback is used once per visible revision | 03-03 §Swimlane contract; PAR-B28 |

### Scene, sparse geometry, and scrolling

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-B-GEO-01 | 100,000 logical cards with bounded resident windows and mixed 2–18 row measurements | Height index storage/reads remain bounded by retained runs, not logical length | SPEC-B-HEIGHT-INDEX; PAR-B26 |
| ST-B-GEO-02 | Visible anchor card grows from estimate 3 to measured 12 rows | Reprojection preserves its key and relative viewport row with at most one correction pass | SPEC-B-HEIGHT-INDEX; 03-04 §Sparse height index |
| ST-B-GEO-03 | Measured card is deleted/reordered/unloaded | Delete/reorder invalidates incompatible runs and reconciles anchor; unload may drop measurement but not interaction identity | 03-04 §Sparse height index |
| ST-B-GEO-04 | Multi-swimlane scene jumps to a late hinted row, repeats without hints, then assigns geometry requiring `retainedDescriptors + 1` visible cards | Compatible hints open only visible/overscan cells; without hints distant exact projection reports unavailable; excess demand clips deterministically to a partial non-actionable state with no stale targets; no path allocates a Cartesian matrix | 03-04 §Canonical scene |
| ST-B-GEO-05 | Scroll both axes through sticky headers and swimlane variants | Headers/active swimlane chrome remain correctly pinned/clipped and cards never paint over them | RD-03 retained contract; 03-04 §Variant geometry |
| ST-B-GEO-06 | Resize narrow→wide→focused-column→restore with variable heights | Stable eligible card/header anchor, preferred row, and valid offsets survive; rail degrades/restores deterministically | 03-04 §Scroll/reveal/resize |
| ST-B-GEO-07 | Card action region overlaps whole-card target after clipping | Action wins z-order; clipped-zero regions vanish; gaps/separators remain non-actionable | 03-04 §Hit projection |
| ST-B-GEO-08 | Inspect Phase B hit map | It contains bounded card/header/swimlane/action/retry targets and zero insertion/drop/ghost/drag targets | PAR-B18; 03-04 §Hit projection |
| ST-B-GEO-09 | One card style changes, then structural revision changes 300 regions | First damage is card-local; excessive finite damage falls back to whole viewport | 03-04 §Drawing and damage; PAR-B15 |

### Focus, navigation, and selection

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-B-INT-01 | Mount populated, empty-column, and zero-column boards | Initial focus is first visible card, then first visible header, then board state respectively | RD06-AC01 |
| ST-B-INT-02 | Move horizontally between unequal-height stacks | Destination visual center is nearest preserved preferred center row | RD06-AC02; 03-05 §Spatial navigation |
| ST-B-INT-03 | Filter removes focus, then filter clears | Documented next/previous/neighbor/header fallback runs once; clearing does not steal focus back | RD06-AC03 |
| ST-B-INT-04 | Focused card is deleted versus merely unloaded | Delete applies fallback once; unload retains identity and starts bounded reveal/acquisition | RD06-AC04; PAR-B13 |
| ST-B-INT-05 | Down/up single click, deliverable Ctrl-click, double-click, and Enter on cards | Down focuses; matching up replaces; Ctrl-click toggles where Ctrl is Primary; double-click and Enter emit the same open intent once; Meta/Command criterion remains open for RD-12 | RD06-AC05 partial; SPEC-B-ACTION-HOOK |
| ST-B-INT-06 | Right-click a card different from prior focus | Target card is focused first and context intent names its eligible selection, never prior focus | RD06-AC06 |
| ST-B-INT-07 | Space and Shift navigation operate inside then across a cell boundary | Space toggles; same-cell range is contiguous loaded/visible; crossing ends extension and performs ordinary move | RD06-AC07 |
| ST-B-INT-08 | Programmatic select-all and deliverable Ctrl+A operate on partial cursors, first below then above the selected-key ceiling | Below the ceiling exactly loaded visible matching keys are selected in deterministic order without claiming logical total; overflow leaves selection unchanged with bounded localized feedback; Meta/Command criterion remains open | RD06-AC08 partial |
| ST-B-INT-09 | Filter/hide removes three selected cards; unload/reload removes none | Prune feedback reports `3`; unload reports `0` and retains keys | RD06-AC09 |
| ST-B-INT-10 | Previous/next column in focused-column mode | Destination column/card is revealed at preferred row with no hidden focused target | RD06-AC10 |
| ST-B-INT-11 | Navigation acquisition fails, then a cancelled earlier acquisition succeeds late | Failure retains focus with retry feedback; late success produces no focus movement | RD06-AC11; PAR-B13 |
| ST-B-INT-12 | Synthetic transient owner plus multi-selection receives two Esc presses | First invokes transient cancel once; second clears multi-selection; focus remains | RD06-AC12 slice; SPEC-B-TRANSIENT-CANCEL |
| ST-B-INT-13 | Mono/ASCII frames cover focused, selected, combined, anchor, pending, invalid and fixture grab cues | Documented precedence yields distinct non-color evidence without extra permanent state columns | RD06-AC13; 03-02 §Cue precedence |
| ST-B-INT-14 | Select numeric `1` and string `'1'` | Both remain independently present through toggle, snapshot, prune, and intent serialization | RD06-AC14; PAR-B14 |
| ST-B-INT-15 | Capture eligible bulk selection, then change live selection | Frozen ordered entries preserve each typed ID, address, and entity revision plus session/query generation; later selection cannot mutate them | RD06-AC15; 03-05 §Ordered selection |
| ST-B-INT-16 | Inject a controller factory versus use the default; attempt reuse/mixed identity; make factory, first snapshot, subscribe, and transition fail | One facade owns serialization/intents and one returned controller owns state/disposal; invalid setup rolls back all acquired resources and leaves input/facade unavailable; reuse/mixed seed reject; transition failure is contained; source deletion remains authoritative | 03-01 §Single-owner contract; PAR-B06/PAR-B29 |

### Security, integration, and distribution

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-B-X-01 | Hostile IDs/text plus throwing card/structure/interaction factory/controller/custom chrome callbacks | Inputs are bounded/sanitized, failures are payload-free and fail locally or transactionally as specified, neighboring behavior survives, and no host handle is exposed | PAR-B16/PAR-B17 |
| ST-B-X-02 | Surface and window hosts run identical semantic action sequence | Scene, focus, selection, scroll, and intent outcomes match; component creates no host/window/shadow/dialog | PAR-B19; 03-06 §Responsive composition |
| ST-B-X-03 | Replace locale/theme/presentation/structure reactively | One bounded reflow/repaint occurs with stable eligible identities and no source remount | PAR-B15/PAR-B22 |
| ST-B-X-04 | Dispose with active work, then fail injected-controller setup after source/scene acquisition | Input rejects, work cancels, resources release in specified/rollback order, retained cursor/subscription counts reach zero, late work is inert, and repeated dispose is safe | 03-06 §Lifecycle |
| ST-B-X-05 | Pack package and consume main/testing/ten locales offline under NodeNext | Runtime/types resolve from public exports; private Phase B modules remain unreachable; Phase A construction still typechecks | PAR-B20/PAR-B21 |
| ST-B-X-06 | Run locale generation/literal/review and plugin/API parity checks | All Phase B vocabulary is present in ten catalogs with current review digests; generated API/skill/plugin output is deterministic/current | PAR-B22/PAR-B24 |
| ST-B-X-07 | Scan docs/examples registries after Phase B | README/technical/generated API are current; no placeholder component page/live lab/kitchen sink/showcase is registered | PAR-B23 |

### Producer-phase ownership

Every immutable assertion slice is authored in its owning phase before that slice's first production
change. A phase turns green only after all assertions authored so far pass; later mounted assertions are
not prematurely added as failing/skipped tests:

| Green checkpoint | Assertions completed there |
|---|---|
| Phase 1 | ST-B-PRES-01..03; pure/cache slices of ST-B-CARD-01..09 and 11..16 |
| Phase 2 | Model/evaluator ST-B-STRUCT-02..10, 14..15, 17..18, 20..21 |
| Phase 3 | Mounted descriptor slices of ST-B-CARD-03..09 and 11..16; scene/geometry ST-B-STRUCT-01, 11..12, 19; ST-B-GEO-01..09 |
| Phase 4 | Controller/programmatic ST-B-INT-01..04, 07..12, 14..16; setup/rollback slice of ST-B-X-04 |
| Phase 5 | Mounted action/state ST-B-CARD-10; ST-B-STRUCT-13, 16; ST-B-INT-05..06 and 13; ST-B-X-01..03 plus active-input/pending-pointer slice of ST-B-X-04 |
| Phase 6 | ST-B-X-05..07 and repository/distribution closure |

Overlapping card ranges mean separate assertions: Phase 1 proves pure descriptor behavior and Phase 3
proves mounted projection of the same immutable rule. Complete macOS Command-based Primary criteria
remain traceably open for RD-12 and are not represented as green Phase B evidence.

## Test Categories

### Specification tests

| Test file | ST cases |
|---|---|
| `presentation-policy.spec.test.ts` | ST-B-PRES-01..03 |
| `cards-rich.spec.test.ts` | ST-B-CARD-01..16 |
| `structure-workflow.spec.test.ts` | ST-B-STRUCT-01..21 |
| `scene-geometry.spec.test.ts` | ST-B-GEO-01..09 |
| `interaction.spec.test.ts` | ST-B-INT-01..16 |
| `phase-b-boundary.spec.test.ts` | ST-B-X-01..07 and explicit deferred-target absence |
| `cards-security.spec.test.ts` | Phase B hostile callback/text/descriptor acceptance before production |

Existing Phase A `*.spec.test.ts` files remain immutable regressions. New specification files state
the behavioral rule in plain language and contain no planning IDs/paths in code comments.

### Implementation tests

| Test file | Description |
|---|---|
| `presentation-policy.impl.test.ts` | Snapshot normalization, fingerprints, limits, and immutable structures |
| `standard-card-rich.impl.test.ts` | Section composition/degradation and callback isolation internals |
| `workflow-model.impl.test.ts` | Group indexes, normalized names, evaluator boundaries, and hover timer |
| `sparse-height-index.impl.test.ts` | Run splitting/merging/correction/saturation/property tests |
| `scene-projector.impl.test.ts` | Retention refinement, variant strategies, hit/damage caps |
| `interaction-controller.impl.test.ts` | Transition serialization, revisions, cancellation, subscriptions, disposal |
| `interaction-selection.impl.test.ts` | Ordered membership/range/prune/snapshot property tests |
| `input-router.impl.test.ts` | Event normalization, handled propagation, click counts, capability gates |
| `phase-b-lifecycle.impl.test.ts` | Mount/dispose ordering, leaks, late work, reactive replacements |

### End-to-end and host evidence

Extend `test/e2e/board-hosting.e2e.test.ts` and split focused Phase B E2E files before 300 lines. The
bounded base/pairwise matrix contains exactly these 12 rows: (1) 80×24 surface comfortable/hybrid,
(2) 80×24 window compact/separator, (3) narrow focused dense/band, (4) minimum window/custom fallback,
(5) wide surface comfortable/rail, (6) resize→maximize→restore with variable heights, (7) long locale
plus Unicode, (8) ASCII plus monochrome/`NO_COLOR`, (9) keyboard selection/activation, (10) pointer
down/up/double/right action, (11) loading/partial/filtered/error state actions, and (12) active-work
disposal. Focused one-axis tests cover each remaining density, variant, locale, capability, and hostile-
text boundary once; no Cartesian product is implied. Semantic cell/role/hit snapshots are primary;
curated full frames are limited to states where complete composition is acceptance evidence.

## Scale and security fixtures

- 5,000-card eager fixture with grouping/index updates and address allocation equal to occupied cells
  plus axis metadata, never `columns × swimlanes`.
- 100,000-logical-card windowed fixture with retained cursors/cells at or below the resolved
  `retainedCursors` limit, retained descriptors and per-card reactive computations at or below the
  resolved `retainedDescriptors` limit, and sparse height anchors/runs at or below their resolved central
  limits. Instrument exact cursor opens, `ensureRange` calls, layout-hint rows, descriptor callbacks,
  reactive rebuilds, damage regions, and internal address/run allocations; assertions use limit-derived
  integer ceilings, never wall-clock or heap thresholds.
- Adversarial fixtures for ANSI/C0/C1/bidi/wide/combining text, duplicate/oversized IDs, malicious
  descriptors/roles/regions, throwing getters/resolvers/handlers, secret-bearing errors, unknown counts,
  stale revisions, and late async publication.

## Verification commands

Per-task checks select the smallest relevant subset, then use the project-local changed-file gate:

```sh
yarn workspace @jsvision/kanban build
yarn workspace @jsvision/kanban typecheck
yarn workspace @jsvision/kanban test
yarn workspace @jsvision/kanban test:e2e
yarn workspace @jsvision/kanban check:deps
yarn workspace @jsvision/kanban check:docs
yarn verify:local
```

Package/API/i18n/plugin/documentation closure additionally runs the authentic packed-consumer and
focused repository commands: `yarn i18n:locales:check`, `yarn check:i18n-literals`,
`yarn i18n:reviews:check`, `yarn docs:api`, `yarn workspace @jsvision/docs-site typecheck`, the focused
specification commands `yarn workspace @jsvision/kanban vitest run --project unit
test/package-consumer.spec.test.ts`, `yarn workspace @jsvision/examples vitest run --project unit
test/api-reference.spec.test.ts`, and `yarn workspace @jsvision/i18n vitest run --project unit
test/i18n-package-registration.spec.test.ts`, then `yarn docs:build`, `yarn techdocs:build`,
`yarn plugin:update` with diff inspection, and `yarn plugin:check`. CI owns full `yarn verify`
(PAR-B24).

## Completion checklist

- [ ] Every ST case has a specification assertion written before its production implementation.
- [ ] Each new spec suite demonstrates expected red behavior, with already-green Phase A substrate
  assertions individually justified.
- [ ] Production changes make the immutable oracles green.
- [ ] Implementation/property/security/E2E tests cover internal boundaries and failures.
- [ ] Scale work remains bounded by retained visible/overscan/explicit owners.
- [ ] Package, packed consumer, docs, i18n, plugin, and changed-file gates pass.
- [ ] Deferred drag/dialog/command/mutation behavior remains absent and roadmap/traceability stays honest.
