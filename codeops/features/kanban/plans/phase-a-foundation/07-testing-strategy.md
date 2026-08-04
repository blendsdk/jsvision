# Testing strategy: Kanban Phase A Foundation

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Oracle policy

Every requirement-owned behavior is written first in `*.spec.test.ts`, run red for the intended
missing behavior, then made green by production code. Specification tests derive only from the linked
requirements and plan-local slice specifications; implementation tests may inspect algorithms,
invalid branches, cache/disposal details, and package plumbing. A failing specification means the
implementation is wrong unless the approved requirement/decision artifact changes first.

No numeric line-coverage threshold is invented. Completion instead requires every one of the 51 Phase
A acceptance criteria below to map to an immutable assertion, plus implementation/property/E2E and
distribution evidence.

## Planned test modules

| Module | Layer | Primary concern |
|---|---|---|
| `test/public-api.spec.test.ts` | Specification/type | Pure contracts, identity, terminology, request/capability seam |
| `test/package-boundary.spec.test.ts` | Specification | Export map, production/testing separation, distribution/security boundaries |
| `test/contracts.spec.test.ts` | Specification | IDs, limits, semantic JSON, errors, observations |
| `test/query-session.spec.test.ts` | Specification | Exact source values plus testing-harness session generation, state/counts, cancellation, stale suppression, atomic publication, redaction, and bounded location |
| `test/cursor.spec.test.ts` | Specification | Exact cursor values plus testing-harness range coalescing/validation, unloaded reads, placement completeness, stale-token rejection, scoped error, identity deletion, and disposal suppression |
| `test/eager-source.spec.test.ts` | Specification | 5,000-card eager semantics, ordering, validation, exact counts |
| `test/windowed-source.spec.test.ts` | Specification | Testing-only lazy 100,000-card fixture, visible/finite-overscan ranges, cursor/materialization bounds, cancellation, and safe metrics |
| `test/cards.spec.test.ts` | Specification | Generic adapter and standard Phase A renderer |
| `test/layout.spec.test.ts` | Specification | Width solver, density gaps, minimum geometry, monotonicity |
| `test/viewport.spec.test.ts` | Specification | Projection bounds, sticky headers, scrolling, cache, topology |
| `test/board.spec.test.ts` | Specification/type | Generic Board/Viewport construction, authority reconciliation, one-coordinator composition |
| `test/e2e/board-hosting.e2e.test.ts` | E2E specification | Surface/window parity, resize/maximize/restore, focus anchor |
| `test/*.impl.test.ts` | Implementation/property | Internal invalid edges, stable algorithms, lifecycle and caching |
| `test/package-consumer-contract.spec.test.ts` | Specification/integration | Phase 1 tarball main-entry contract runtime/types and no workspace leakage |
| `test/package-consumer.spec.test.ts` | Specification/integration | Phase 5 complete tarball runtime/types/exact locale exports/no workspace leakage |
| affected docs/i18n/plugin specs | Integration specification | Registries, API output, locale review, impact/generated parity |

## 🚨 Specification Test Cases

The following ST cases are the normative input → expected-output oracle. Each ID resolves to an
approved RD criterion, a named Phase A slice specification, or PAR-21's delegated layout invariant.

### RD-01 criterion map

| ST | Criterion | Input → expected output |
|---|---|---|
| ST-R01-01 | RD01-AC01 | Isolated NodeNext consumer imports and constructs generic `KanbanBoard`, imports a representative pure main-entry helper and testing helper, then runs consumer `tsc` → succeeds without private paths or unsafe casts |
| ST-R01-02 | RD01-AC02 | Resolve declared and private subpaths → exactly main/testing/ten locales succeed; private path fails |
| ST-R01-03 | RD01-AC03 | `DomainRecord` with custom names plus typed adapters → board constructs without cast/`StandardCard` |
| ST-R01-04 | RD01-AC04 | 100,000-logical-card source → mounted `View` topology stays bounded |
| ST-R01-05 | RD01-AC05 | Accepted raw request before source publication → authoritative card/column objects remain byte-for-byte unchanged |
| ST-R01-06 | RD01-AC06 | Contradictory authoritative publication → pending metadata clears and application value renders |
| ST-R01-07 | RD01-AC07 | Card keys `1` and `'1'` → distinct identity-map and reconciliation-observation entries |
| ST-R01-08 | RD01-AC08 | Empty/duplicate/over-bound/control/escape IDs → atomic rejection with sanitized error and no partial mount |
| ST-R01-09 | RD01-AC09 | Traverse production entry import graph → no testing fixture path is reachable |
| ST-R01-10 | RD01-AC10 | Dependency/native/packed consumer fixtures → declarations, no native runtime, and runtime/types/exports all pass |
| ST-R01-11 | RD01-AC11 | Run public JSDoc checker → every export is documented with practical examples where applicable |
| ST-R01-12 | RD01-AC12 | Inspect public declarations/names → no bare `lane` denotes a column or swimlane |
| ST-R01-13 | RD01-AC13 | Denied capability plus constructed raw request → dispatcher still receives and can reject it |
| ST-R01-14 | RD01-AC14 | ANSI/control card text → safe cells; observations contain only stable key/code |
| ST-R01-15 | RD01-AC15 | Evaluate security boundary suite/docs → package risks pass and server/storage/TLS/rate-limit items are explicit N/A |

### RD-02 criterion map

| ST | Criterion | Input → expected output |
|---|---|---|
| ST-R02-01 | RD02-AC01 | Eager 5,000 fixture → stable references and exact total/matching/loaded counts synchronously |
| ST-R02-02 | RD02-AC02 | 100,000 logical cards at 80×24 → only visible plus configured overscan ranges are read |
| ST-R02-03 | RD02-AC03 | Offscreen/collapsed/hidden/unprefetched addresses → zero cursor creations |
| ST-R02-04 | RD02-AC04 | Concurrent `0..20` and `10..30` acquisition → bounded/coalesced calls, never per-card requests |
| ST-R02-05 | RD02-AC05 | Replace query then resolve old work → old signal aborts and no active observable/frame changes |
| ST-R02-06 | RD02-AC06 | Read unloaded in-range slot → `undefined` and partial/loading state, no empty card/count decrement |
| ST-R02-07 | RD02-AC07 | One cursor errors while another is ready → scoped retry/error and ready cell remains usable |
| ST-R02-08 | RD02-AC08 | Apply local filter → matching/visible change; authoritative total/WIP do not |
| ST-R02-09 | RD02-AC09 | Unknown authoritative count → explicit unknown/partial qualifier, never `0` |
| ST-R02-10 | RD02-AC10 | Last loaded slot with incomplete source → `window-edge`; only declared completeness yields logical end |
| ST-R02-11 | RD02-AC11 | Placement token after cursor revision change → reject before dispatcher invocation |
| ST-R02-12 | RD02-AC12 | Dispose cursor twice then settle work → one abort/disposal and no late publication |
| ST-R02-13 | RD02-AC13 | Unload/reload then authoritative delete selected key → retain through unload, prune on delete only |
| ST-R02-14 | RD02-AC14 | Publish duplicate key or unknown column → reject atomically and retain last valid session snapshot |
| ST-R02-15 | RD02-AC15 | Negative/fractional/reversed/over-limit range → typed rejection and zero source callbacks |
| ST-R02-16 | RD02-AC16 | Source failure containing card/token data → safe source/cell IDs/codes only in errors/observations |
| ST-R02-17 | RD02-AC17 | Locate unloaded key in 100,000-card session → one cancellable revision-bound lookup or explicit unsupported result, never a scan |

### RD-03 criterion map

| ST | Criterion | Input → expected output |
|---|---|---|
| ST-R03-01 | RD03-AC01 | 80-cell width with three default columns → 74-cell preferred fit; extra cells used without exceeding 32 |
| ST-R03-02 | RD03-AC02 | Width below two minima plus separator → one focused column/navigator and no clipped target |
| ST-R03-03 | RD03-AC03 | Resize multi-column → narrow → multi-column → focused key/containing column restored visibly |
| ST-R03-04 | RD03-AC04 | Equal surface/window content rectangles → equal board content, metrics, and hit behavior |
| ST-R03-05 | RD03-AC05 | Vertically scroll cards → workflow headers stay visible and never become card targets |
| ST-R03-06 | RD03-AC06 | Pure geometry projects swimlane header plus first gutter → distinct region kinds; header is never insertion |
| ST-R03-07 | RD03-AC07 | Adjacent cards in three densities → exactly one comfortable/spacious gap and no compact resting gap |
| ST-R03-08 | RD03-AC08 | Wheel/imperative scroll then remove cards/columns → both offsets clamp within live extents |
| ST-R03-09 | RD03-AC09 | Longest locale with wide glyph → cell-safe clipping and complete sanitized semantic inspection label |
| ST-R03-10 | RD03-AC10 | Leave focused-column mode and hide its navigator row → one DSL reflow and reclaimed non-overlapping viewport cells |
| ST-R03-11 | RD03-AC11 | Negative/non-finite/over-bound renderer hint → reject/fallback with no oversized allocation |
| ST-R03-12 | RD03-AC12 | Impossible geometry → bounded minimum-size message and zero partial interactive targets |
| ST-R03-13 | RD03-AC13 | Resize/maximize/restore and locale/density/hint changes → all solved children remain clipped to parent |
| ST-R03-14 | RD03-AC14 | Instrument one frame → reads only visible descriptors plus finite overscan |
| ST-R03-15 | RD03-AC15 | Scan ordinary Kanban and any present dialog source → raw absolute placement rejected outside sanctioned module |

Plan-level **ST-A-VIEWPORT-LIFECYCLE-01**: standalone `KanbanViewport` and Board-wrapped viewport each
construct from the exported typed option surface, create exactly one read coordinator/session, and
dispose that coordinator/session exactly once.

Plan-level **ST-A-LAYOUT-01** (PAR-21): for every width across tested ranges, width `n` → width
`n + 1` never reduces an assigned column width, and equal tier fulfillment → source-order tie.

### Partial-RD slice map

| ST | Criterion | Input → expected output |
|---|---|---|
| ST-A-CARD-01 | RD04-AC01 / SPEC-A-CARD-01 | Domain-specific property names plus generic adapter → render without conversion |
| ST-A-CARD-02 | RD04-AC02 / SPEC-A-CARD-02 | Standard card at every width 18–32 → non-empty safe title/status/non-color focus marker |
| ST-A-COLUMN-01 | RD05-AC01 / SPEC-A-COLUMN-01 | Zero-column source → localized no-columns state, zero card/header hits, focusable board |
| ST-A-COLUMN-02 | RD05-AC18 / SPEC-A-COLUMN-02 | Three populated columns then reordered publication → source order changes, card identity/topology remain stable |

### Plan-level foundational oracles

| ST | Input → expected output | Green phase |
|---|---|---:|
| ST-A-PACKAGE-METADATA-01 | Static package/export/dependency declarations → exact declared boundary and private-path rejection without resolving deferred locale targets | 1 |
| ST-A-PACKAGE-CONSUMER-01 | Packed contract-only main entry → runtime/types pass without workspace leakage or mounted/testing/locale imports | 1 |
| ST-A-CONTRACT-SECURITY-01 | Hostile IDs/text/errors at pure contract boundaries → sanitized typed rejection/observation without payload disclosure | 1 |
| ST-A-SOURCE-SCALE-01 | 100,000-logical-card windowed fixture and bounded scheduler → visible-range acquisition only, without mounting a board | 2 |
| ST-A-SOURCE-LIFECYCLE-01 | Pure session/cursor retention, scoped error, identity-change, and atomic publication fixtures → bounded isolated transitions before viewport integration | 2 |
| ST-A-DESCRIPTOR-SAFETY-01 | Hostile descriptor/role/renderer values → bounded validated fallback without neighboring descriptor loss | 3 |

## Implementation and property coverage

Implementation suites add deterministic checks for semantic-tree deep freeze/key ordering/cycles/
accessors, progressive waterfill integer ties, generation and disposal ordering, descriptor cache key
dimensions and eviction, reactive-scope cleanup, stable eager sorting, observation ring eviction,
overflow-safe arithmetic, draw clipping, damage minimization, and idempotent unmount. Property tests use
fixed seeds and report the seed on failure.

Security cases include hostile ANSI/C0/C1 text in every Phase A field, prototype/getter semantic JSON,
unsafe IDs, oversized descriptors/ranges/counts, throwing callbacks, raw exceptions containing secrets,
and malicious theme role/color inputs. Tests assert both safe output and absence of forbidden callback,
partial publication, log payload, or out-of-clip damage.

## E2E and visual evidence

Headless E2E runs the real board in the normal UI event/render loop at bounded geometries. It compares
semantic cell/role/hit snapshots rather than brittle whole-frame art alone. Required frames include
standard 80×24, focused-column boundary, impossible geometry, horizontal/vertical scroll, zero/
populated/error/partial states, surface/window hosts, three densities, long translations, Unicode wide
glyphs, monochrome, resize, maximize, and restore.

## Verification commands

Use package-local commands once the package exists:

```sh
yarn workspace @jsvision/kanban build
yarn workspace @jsvision/kanban typecheck
yarn workspace @jsvision/kanban test
yarn workspace @jsvision/kanban test:e2e
yarn workspace @jsvision/kanban check:deps
yarn workspace @jsvision/kanban check:docs
```

Kanban's `test:e2e` script must not use `--passWithNoTests`; the package has a mandatory hosting E2E
suite, so an empty discovery result is a failure.

Run the focused packed-consumer, docs API/typecheck/tests/build, i18n generation/literal/review, and
canonical skill/impact specifications named by their owning tasks. Finish with `yarn verify:local`,
`yarn plugin:update`, inspection of generated changes, `yarn plugin:check`, and a focused rerun. Do not
routinely run full `yarn verify`; CI owns that gate.

## Completion evidence

The execution plan records for each phase: the exact red failures before production changes, green
focused results, typecheck/build results, and reviewer/auditor findings. No task is marked complete on
the basis of a later aggregate run alone.

### Recorded red gates

| Phase | Command scope | Expected pre-implementation result |
|---|---|---|
| 2 | `query-session`, `cursor`, `eager-source`, and `windowed-source` specification modules | 4 files and 15 tests fail only at the approved absent Phase 2 exports and testing helpers; typecheck reports only those same absent symbols |
