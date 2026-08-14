# Testing Strategy: Kanban Phase D Productivity and Editing

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

Specification tests are immutable requirements-derived oracles written before implementation.
Implementation tests cover internals, resource limits, callback isolation, and error paths afterward.
Existing board, drag, scroll, source, host, and package-boundary suites remain regression gates.
No unenforced percentage is a completion claim; AC→ST traceability and focused behavior gates are the
Phase D coverage contract.

## 🚨 Specification test cases

### View state and projection

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-DV-01 | Type search `"alpha"` and advance fake clock 149 then 1 ms | Draft text is immediate, but state/query/capture/event stay committed before 150 ms; all commit once at 150 ms | RD-09 Search; AR-D18 |
| ST-DV-02 | Type `a`, `al`, `alp` within one debounce window | Prior generations cancel; exactly one query with `alp` opens | RD-09 AC1; AR-D12 |
| ST-DV-03 | Activate quick filters `mine` and `urgent` | One revision contains both registered filters and matching cards satisfy both | RD-09 AC2 |
| ST-DV-04 | Apply search/filter to a source with total 10, matching 0, WIP 7 | Filtered-empty is shown; total/WIP remain 10/7; Clear Filters is reachable | RD-09 AC1/3 |
| ST-DV-05 | Clear filtered-empty while search input is focused | Query filters/search clear; old card focus is not restored; input focus remains | RD-09 AC3; 03-01 §Counts |
| ST-DV-06 | Sort equal values for keys `2`, `10`, `"1"`, `"2"`, BMP/astral strings | Eager and remote fixtures resolve integers numerically before code-point-ordered strings with number/string distinction | RD-09 AC4 |
| ST-DV-07 | Attempt within-cell drag while sorted | Eligibility returns disabled with visible localized reason; no proposal dispatches | RD-09 AC4 |
| ST-DV-08 | Apply grouping `team`, then `project` | One atomic state has only `project`; two simultaneous group fields reject | RD-09 AC5 |
| ST-DV-09 | Hide a column containing WIP cards | Visibility changes only; source placement and authoritative WIP do not change | RD-09 AC1; 03-01 §Projection |
| ST-DV-10 | Registered filter callback throws | Prior query remains current; safe diagnostic contains no operand/card data | RD-09 Security; AR-D13 |
| ST-DV-11 | Existing board uses only `query: () => QUERY` | It mounts with no Phase D chrome and matches prior board inspection | 01 AC2; AR-D03 |
| ST-DV-12 | Resize standard view bar from wide to narrow and back | Search/active cues/actions remain keyboard reachable; no clipping; state persists | RD-09; AR-D07 |
| ST-DV-13 | Dispose with pending debounced search | Timer cancels; no query/event/repaint occurs afterward | 03-01 §Failure; AR-D12 |
| ST-DV-14 | Apply one view transition while a card is focused and becomes hidden | New view is observable before deterministic focus/selection reconciliation event | RD-09; RD-06 integration |
| ST-DV-15 | Select non-default comparator, omit comparator for default, then clear sort | Eager/remote receive identical resolved IDs/ties; omission is compatible; clear restores source-rank order | RD-09 AC4; AR-D17 |
| ST-DV-16 | Bound controller prepares candidate and open/first publication fails | No observer sees candidate state/query/revision; candidate disposes; prior controller/viewport/session remain active | RD-09 safety; AR-D17 |

### Saved views and migration

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-DS-01 | Capture default controller state | Envelope has discriminator/version 1/durable facets and no focus, selection, scroll, token, draft, cache, pending, or function | RD-09 AC6 |
| ST-DS-02 | Parse object with unknown top-level key | Reject before controller mutation | RD-09 AC7 |
| ST-DS-03 | Parse excessive depth/bytes/array/key count or invalid width | Reject with structured bounded diagnostic; live state unchanged | RD-09 AC7/16 |
| ST-DS-04 | Parse `version: 99` | Return unsupported-version with supported range; state unchanged | RD-09 AC8 |
| ST-DS-05 | Migrate known v0 fixture through v0→v1 adapter | Adapter executes once, input object/text remains unchanged, v1 validates and applies atomically | RD-09 AC9 |
| ST-DS-06 | Restore removed column `old` marked `drop` and missing active comparator marked `reject` | Column drops with diagnostic/new column appends; comparator causes atomic failure | RD-09 AC10; AR-D19 |
| ST-DS-07 | Parse extension objects with reordered BMP/astral/lone-surrogate keys and equivalent numbers | Shared code-point canonical outputs compare semantically equal; arrays/string code points remain exact | RD-09 AC11 |
| ST-DS-08 | Apply same envelope twice with same registries/data/caps | Resolved states are equal and second application is idempotent | RD-09 AC12 |
| ST-DS-09 | Change locale only and restore same envelope | Labels/measurement may change; IDs/filter/order semantics do not | RD-09 AC12 |
| ST-DS-10 | Restore saved width 40 with runtime maximum 32 | Runtime width is 32; retained raw/captured artifact stays 40 until explicit resave | RD-09 AC13 |
| ST-DS-11 | Remote source receives restored filter/sort | It receives typed registered IDs/values, never generated SQL/expression text | RD-09 AC14 |
| ST-DS-12 | Sensitive filter fails reconciliation | Diagnostic/event omits raw value | RD-09 AC15 |
| ST-DS-13 | Saved JSON contains function, accessor, unsafe key, path, or regex executable | Reject without invoking accessor or executable content | RD-09 Security; AR-D13 |
| ST-DS-14 | Capture/apply versus save/rename/delete | Capture/apply emits zero dispatcher requests; store operations emit exactly one matching proposal | RD-09 ownership; 03-02 §Store |
| ST-DS-15 | Migration callback throws raw secret error | Return `migration-failed` without raw error/secret; state unchanged | 03-02 §Failure |
| ST-DS-16 | Property-generated valid v1 envelopes parse→canonicalize→parse | Semantically equal bounded value; invalid generated values reject atomically | RD-09 AC16 |
| ST-DS-17 | Parse/capture a valid unknown optional namespaced extension | Exact semantic extension data survives round-trip and is never interpreted | RD-09 AC11 |
| ST-DS-18 | Restore mixed missing references with explicit `reject`/`drop` | Each follows its encoded policy; omitted policy uses its documented conservative category default | RD-09 AC10; AR-D19 |
| ST-DS-19 | Apply raw width 40→resolved 32, then edit an unrelated facet | Capture retains raw width 40 while preserving the unrelated edit | RD-09 AC13; AR-D19 |
| ST-DS-20 | Directly edit reconciled width, then explicitly resave | Pre-resave capture retains raw 40 by column identity; explicit resave alone writes resolved/current width | RD-09 AC13; AR-D19 |

### Card editor schema and lifecycle

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-DE-01 | Configure title/status only on standard editor | Only those controls render; submit produces bounded proposal with configured values | RD-10 R2 |
| ST-DE-02 | Exercise text, multiline, number, boolean, date, single, multiple, and custom field | Each uses registered parse/control/validation and round-trips typed draft value | RD-10 R3 |
| ST-DE-03 | Edit a card then cancel/Esc | Source and request log unchanged; detached draft is disposed | RD-10 dialogs |
| ST-DE-04 | Submit with sync and async field errors | Dialog stays open, fields touched/errors visible, zero requests | RD-10 lifecycle |
| ST-DE-05 | Submit valid draft with delayed dispatcher | Draft/focus remain, actions seal while pending, exactly one proposal dispatches | RD-10 pending |
| ST-DE-06 | Dispatcher rejects with mapped field/form error | Dialog stays open with all values, dirty/touched/focus and safe errors retained | RD-10 AC11 |
| ST-DE-07 | External card revision changes while dirty | Session becomes stale; ordinary Apply disables until Reload/Cancel/app merge policy | RD-10 stale |
| ST-DE-08 | External card is deleted while editing | Submit is blocked; safe deleted feedback and Close/Cancel remain reachable | RD-10 stale |
| ST-DE-09 | Open standard then custom editor for same card identity | Second open is rejected/focused according to coordinator; never simultaneous | RD-10 exclusivity |
| ST-DE-10 | Close dirty dialog | Package localized confirmation appears; decline retains draft/focus | RD-10 confirmations |
| ST-DE-11 | Resize/maximize/restore dense checklist editor | Fields/actions remain reachable by scroll; focus/draft persists; no clipping | RD-10; AR-D07 |
| ST-DE-12 | Use result-only dialog mode | Returns validated detached result and dispatches zero requests | RD-10 Should Have |
| ST-DE-13 | Use full custom editor replacement | Package session/exclusivity/stale contract remains, standard controls do not mount | RD-10 customization |
| ST-DE-14 | Modeless inspector and modal request same session | They share one identity-owned draft/session or second open rejects; no duplicate draft | RD-10 inspector |
| ST-DE-15 | View-mode editor | Values/sections visible; mutation controls and submit absent/disabled | RD-10 create/view/edit |
| ST-DE-16 | Late async validation settles after reload/cancel/dispose | Result is inert and cannot restore errors/submit/event state | RD-10 stale suppression |
| ST-DE-17 | Hostile field label/value/error contains controls/secret | Display is sanitized and events/observations omit raw data | RD-10 Security |
| ST-DE-18 | Accepted update waits for authoritative publication | Pending remains until matching source revision; only then close/commit event occurs | RD-10; RD-08 lifecycle |
| ST-DE-19 | Supply duplicate IDs, unknown kind/section, visibility cycle, and over-bound choices | Reject exact schema before any form/control mounts | RD-10 AC2 |
| ST-DE-20 | Change a field while its async validator is pending | Prior signal aborts; late result is inert; newest generation alone sets error state | RD-10 AC6 |
| ST-DE-21 | Submit multiple invalid fields in schema order | Zero requests; first invalid field is revealed and focused | RD-10 AC7 |
| ST-DE-22 | Submit a valid edited record | One request contains full detached draft, exact changed field IDs, and base revision; duplicate submit seals | RD-10 AC8 |
| ST-DE-23 | Reject, correct, and resubmit | Values persist and the second proposal has a fresh operation ID | RD-10 AC9 |
| ST-DE-24 | Receive contradictory publication while pending | Session marks stale/conflict and never closes or overwrites silently | RD-10 AC10 |
| ST-DE-25 | Confirm Reload on a dirty stale draft | Resolver reloads current record, advances base revision, clears dirty/touched state, and preserves valid focus identity | RD-10 AC12 |
| ST-DE-26 | Reorder/edit checklist through rejection and matching publication | Group/item IDs remain stable; text changes never replace identity | RD-10 AC14 |
| ST-DE-27 | Custom control or validator throws after acquiring resources | Sanitized field failure appears and all timers/subscriptions abort on disposal | RD-10 AC15 |

### Board configuration

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-DC-01 | Build add/edit/reorder/delete programmatically | Valid proposal returned; no UI, confirmation, source change, or dispatch | RD-11 AC1 |
| ST-DC-02 | Add-column dialog valid Apply versus Cancel | Apply makes one proposal; Cancel makes zero and preserves state | RD-11 AC2 |
| ST-DC-03 | Rename column `todo` | Proposal preserves `todo` identity across cards/focus/views/events | RD-11 AC3 |
| ST-DC-04 | Empty/whitespace or duplicate normalized name | Validation rejects; duplicate opt-in requires visible disambiguator | RD-11 AC4 |
| ST-DC-05 | Hide/show/collapse/expand | Only view state changes; no structural request/move/delete | RD-11 AC5 |
| ST-DC-06 | Delete empty structure through package UI | Destructive confirm required; exactly one request after Yes | RD-11 AC6 |
| ST-DC-07 | Delete non-empty with no policy or unknown count | Disabled with reason; zero dispatches | RD-11 AC7 |
| ST-DC-08 | Delete non-empty with reassign/archive/custom policy | One atomic proposal includes complete destination/scope; partial outcome rejects | RD-11 AC8 |
| ST-DC-09 | Inspect every standard delete builder | None constructs cascade card-delete | RD-11 AC9 |
| ST-DC-10 | Configure derived swimlane without mutation capability | UI absent/disabled and programmatic builder reports same ineligibility | RD-11 AC10 |
| ST-DC-11 | Async configuration rejection | Draft, focus, dirty state, safe mapped error retained | RD-11 AC11 |
| ST-DC-12 | Structure publishes new revision while dirty | Draft stale; ordinary Apply blocked until explicit policy | RD-11 AC12 |
| ST-DC-13 | Accepted deletion publication removes focused column | Focus moves next, previous, or board; never hidden/unmounted | RD-11 AC13 |
| ST-DC-14 | Narrow dialog geometry | All fields/actions keyboard/mouse reachable via DSL/scroll; no raw absolute content layout | RD-11 AC14 |
| ST-DC-15 | Header context action/command opens config | No permanent gear required; both routes invoke same dialog/result path | RD-11 AC15 |
| ST-DC-16 | Hostile name/DoD/error input | Screen is terminal-safe; diagnostics/events contain no raw content | RD-11 AC16 |
| ST-DC-17 | Reorder one structure by keyboard buttons and pointer drag | Both paths produce semantically identical neighbor-based proposal and focus outcome | RD-11 reorder requirement |

### Actions, capabilities, and read-only

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-DA-01 | Inspect package action inventory | Every action has stable ID, messages, applicability, capability, handler, and binding/unbound marker | RD-12 AC1 |
| ST-DA-02 | Invoke Move Card by keyboard/menu/context/status/pointer/programmatic routes | Same eligibility and one dispatcher seam receive equivalent proposal semantics | RD-12 AC2 |
| ST-DA-03 | Register two actions on exact chord | Reject with both IDs/chord; targeted override replaces only named binding | RD-12 AC3 |
| ST-DA-04 | Replace a binding at runtime | Routing and help/menu labels update atomically without board reconstruction | RD-12 AC4 |
| ST-DA-05 | Capability returns disabled, hidden, then throws | Disabled shows reason/no request; hidden removes affordance; throw becomes safe disabled while others work | RD-12 AC5 |
| ST-DA-06 | Apply read-only preset | Navigation/selection/search/view/open/help work; zero mutation hits/drags/submits/config requests | RD-12 AC6 |
| ST-DA-07 | Construct raw request while read-only | It still reaches application authorization, proving UX policy is not security | RD-12 AC7 |
| ST-DA-08 | Render defaults at 80×24/narrow | Esc/help/grab/drop and every mutation remain keyboard reachable; no mouse-only action | RD-12 AC14 |
| ST-DA-09 | Namespaced custom action/request before event integration | Runs through capability/router/dispatcher; unnamespaced collision rejects; event lifecycle is completed by ST-DH-01/02 in Phase 7 | RD-12 AC16 |
| ST-DA-10 | macOS browser Primary+F/Primary-click fixture | Command/meta routes exactly once; duplicate SGR event suppressed | RD-12 AC17 |
| ST-DA-11 | Linux/native terminal Primary+F fixture | Ctrl route works and visible help names Ctrl fallback | RD-12 AC17 |
| ST-DA-12 | Reenter same action, then nest distinct actions at depth 16/17 and configured 64/65 | Same action rejects; at-bound succeeds; next returns `action-depth-exceeded`; zero duplicate request | RD-12 Security; AR-D23 |
| ST-DA-13 | Dispose board then invoke retained route | Returns unavailable; no callback/request/event | RD-12 AC15 |

### Events and history

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-DH-01 | Committed mutation | Event order is command→proposed→pending→accepted→authoritative committed with one operation ID and monotonic sequence | RD-12 AC8 |
| ST-DH-02 | Rejection/cancel/supersession | Matching terminal event occurs; committed never occurs without publication | RD-12 AC9 |
| ST-DH-03 | Focus/selection/view subscriber reads board during event | New public state is already observable | RD-12 AC10 |
| ST-DH-04 | Focus numeric key `1` then string key `'1'` | Events retain distinct identities | RD-12 AC10 |
| ST-DH-05 | First subscriber throws | Later subscriber/state changes continue; one sanitized observation reports failure | RD-12 AC11 |
| ST-DH-06 | Inspect every event snapshot | IDs/revisions/state/codes/counts present as applicable; no record/draft/filter secret/tokens/raw error | RD-12 AC12 |
| ST-DH-07 | Undo availability toggles then undo rejects stale | Menu/status react; fresh request made; authoritative data unchanged; safe feedback event | RD-12 AC13 |
| ST-DH-08 | Dispose with late async settlement | Subscriptions removed and no event emits afterward | RD-12 AC15 |
| ST-DH-09 | Observation sink and event subscriber active | Events carry ordered semantics; observations remain coarse diagnostic and never drive state | AR-D10; 03-06 §Observations |
| ST-DH-10 | Publish nested events at capacities 256/257 and configured 4096/4097 | FIFO/dequeue sequence exact; at-bound drains; next returns overflow with one observation; disposal clears queue | RD-12 Security; AR-D23 |

### Integration, performance, and examples

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-DI-01 | Mount each Phase D kitchen-sink story at 80×24 | No clipping; all intended actions reachable; visible feedback updates | 03-07 §Examples |
| ST-DI-02 | Resize/maximize/restore board/dialogs repeatedly | State/focus/drafts persist, one responsive reflow per semantic change, no bleed/freeze | AR-D07/D12 |
| ST-DI-03 | On 2,000 cards/8 columns/4 swimlanes/10 filters, run 20 warmups + 200 iterations after exact fake-clock 150 ms debounce | Per commit: 1 candidate open, 1 activation, ≤1 reflow, ≤2 render invalidations, 1 delivery/subscriber, 0 full-scene invalidations; median work ≤16 ms; no jump/freeze | User responsiveness gate; AR-D24 |
| ST-DI-04 | GitHub showcase loads Node.js project and changes theme/view | Colorful movable cards remain interactive; filters/views are local; remote project is not mutated | 03-07 §Examples |
| ST-DI-05 | Pack after build into generic-only, missing-peer, and Zod-4 consumer fixtures | Generic types are Zod-free; exact runtime deps include Forms; missing peer diagnoses cleanly; standard adapter typechecks with consumer Zod 4 | AR-D05 |
| ST-DI-06 | Build Kanban; typecheck/test/smoke-import examples; run dependency/docs/plugin checks | Supported exports/docs/generated references agree and no undeclared runtime dependency exists | AR-D14–D16 |

## Exact acceptance traceability

| Requirement | Acceptance criteria → specification cases | Owning specification files |
|---|---|---|
| RD-09 | AC1→DV-03/04/09; AC2→DV-03; AC3→DV-04/05; AC4→DV-06/07/15; AC5→DV-08; AC6→DS-01; AC7→DS-02/03/13; AC8→DS-04; AC9→DS-05; AC10→DS-06/18; AC11→DS-07/17; AC12→DS-08/09; AC13→DS-10/19/20; AC14→DS-11; AC15→DS-12/15; AC16→DS-03/16 | `view-state.spec.test.ts`, `security/view-input.spec.test.ts`, `saved-view.spec.test.ts`, `saved-view-migration.spec.test.ts`, `security/saved-view-input.spec.test.ts` |
| RD-10 | AC1→DE-01/02; AC2→DE-19; AC3→DE-11; AC4→DE-01; AC5→DE-03/10; AC6→DE-16/20; AC7→DE-04/21; AC8→DE-05/22; AC9→DE-06/23; AC10→DE-18/24; AC11→DE-08; AC12→DE-07/25; AC13→DE-09/14; AC14→DE-26; AC15→DE-27; AC16→DE-17 | `editor-schema.spec.test.ts`, `editor-session.spec.test.ts`, `editor-dialog.spec.test.ts`, `editor-integration.spec.test.ts`, `security/editor-boundary.spec.test.ts`, `e2e/editor-dialog.e2e.test.ts` |
| RD-11 | AC1→DC-01; AC2→DC-02; AC3→DC-03; AC4→DC-04; AC5→DC-05; AC6→DC-06; AC7→DC-07; AC8→DC-08; AC9→DC-09; AC10→DC-10; AC11→DC-11; AC12→DC-12; AC13→DC-13; AC14→DC-14; AC15→DC-15; AC16→DC-16 | Configuration files below; DC-15 command route completes in `phase-d-integration.spec.test.ts` |
| RD-12 | AC1→DA-01; AC2→DA-02; AC3→DA-03; AC4→DA-04; AC5→DA-05; AC6→DA-06; AC7→DA-07; AC8→DH-01; AC9→DH-02; AC10→DH-03/04; AC11→DH-05; AC12→DH-06; AC13→DH-07; AC14→DA-08; AC15→DA-13/DH-08; AC16→DA-09/DH-01/02; AC17→DA-10/11 | Kanban action/event files below plus `packages/core/test/input-primary.spec.test.ts` and `packages/web/test/dom-pointer-input.spec.test.ts` |

DC-15's package command assertion remains red until board integration, and DA-09's event assertions
remain red until the event hub exists. Earlier phase green gates run only the phase-local portions;
Phase 7/8 own the complete cross-surface assertions.

## Test files

| File | ST cases |
|---|---|
| `test/view-state.spec.test.ts`, `test/view-chrome.spec.test.ts`, `test/security/view-input.spec.test.ts` | ST-DV-01…DV-16 |
| `test/saved-view.spec.test.ts`, `test/saved-view-migration.spec.test.ts`, `test/saved-view-store.spec.test.ts`, `test/security/saved-view-input.spec.test.ts` | ST-DS-01…DS-20 |
| `test/editor-schema.spec.test.ts`, `test/editor-session.spec.test.ts`, `test/editor-dialog.spec.test.ts`, `test/editor-integration.spec.test.ts`, `test/security/editor-boundary.spec.test.ts`, `test/e2e/editor-dialog.e2e.test.ts` | ST-DE-01…DE-27 |
| `test/configuration.spec.test.ts`, `test/configuration-delete.spec.test.ts`, `test/security/configuration-input.spec.test.ts`, `test/e2e/configuration-dialog.e2e.test.ts` | ST-DC-01…DC-17 |
| `test/actions-capabilities.spec.test.ts` | ST-DA-01, DA-02, DA-06, DA-08, DA-09 phase-local, DA-13 |
| `test/action-keymap.spec.test.ts` | ST-DA-03, DA-04 |
| `test/security/action-capability.spec.test.ts` | ST-DA-05, DA-07, DA-12 |
| `test/e2e/phase-d-hosts.e2e.test.ts`, Core `test/input-primary.spec.test.ts`, Web `test/dom-pointer-input.spec.test.ts` | ST-DA-10/11 host layers; Web also owns DA-10 pointer dedupe |
| `test/events-history.spec.test.ts` | ST-DH-01…DH-04, DH-09 |
| `test/security/event-boundary.spec.test.ts` | ST-DH-05, DH-06, DH-10 |
| `test/history.spec.test.ts` | ST-DH-07 |
| `test/event-lifecycle.spec.test.ts` | ST-DH-08 and deferred ST-DA-09 event lifecycle |
| `test/e2e/phase-d-productivity.e2e.test.ts` | ST-DI-02 |
| `test/phase-d-performance.spec.test.ts` | ST-DI-03; existing `perf-kanban-bench.spec.test.ts` remains a regression gate |
| `packages/examples/test/kanban-phase-d.spec.test.ts` | ST-DI-01 |
| `packages/examples/test/github-project-kanban-app.spec.test.ts` | ST-DI-04 |
| `test/package-consumer-contract.spec.test.ts` | ST-DI-05 |
| package/build/plugin checks | ST-DI-06 |

Implementation tests are split by concern as `view-state.impl.test.ts`, `saved-view-codec.impl.test.ts`,
`saved-view-migration.impl.test.ts`, `editor-session.impl.test.ts`, `configuration-builders.impl.test.ts`,
`action-registry.impl.test.ts`, `event-hub.impl.test.ts`, and `history.impl.test.ts`. Fuzz/property tests
use deterministic bounded seeds. Real objects are preferred; fake clocks/hosts isolate true external time
and terminal boundaries.

## Verification checklist

- [ ] Every ST case is written before its implementation and confirmed red for the missing behavior.
- [ ] Spec expectations are never weakened to match implementation.
- [ ] All focused green and implementation tests pass.
- [ ] Existing Kanban interaction, stabilization, source, host, package, and performance suites pass.
- [ ] Phase closure matrix in 03-07 passes, including examples and plugin parity.
- [ ] Native manual matrix accepts responsiveness, dialogs, themes, resize, repeated drag/drop, and cleanup.
