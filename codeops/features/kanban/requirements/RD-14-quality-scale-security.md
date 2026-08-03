# RD-14: Quality, Scale, Security, and Resilience

> **Document**: RD-14-quality-scale-security.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-01 through RD-13
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

This is the dedicated non-functional requirement document. A flagship Kanban component must remain
bounded at large logical scale, responsive during drag and async work, recoverable after application or
custom-extension failure, secure against hostile terminal text/state artifacts, accessible across
capabilities, and verifiable through immutable specification tests rather than demos alone.

---

## Functional Requirements

### Must Have — Complexity XL

- [ ] Meet architecture targets of 5,000 resident eager cards and 100,000 logical windowed cards without
  full-data work on steady-state render, scroll, pointer movement, navigation, or drag.
- [ ] Keep visible render, hit testing, damage, source reads, and mounted/retained UI proportional to
  visible content plus finite configured overscan/prefetch.
- [ ] Bound concurrent loads, validations, dispatches, retries, timers, retained operations, diagnostics,
  saved JSON, descriptor output, and package-controlled callback inputs, outputs, and invocation counts.
- [ ] Cancel/suppress stale async work on query/entity revision, close, supersession, source replacement,
  modal changes, or disposal as applicable.
- [ ] Isolate renderer, resolver, formatter, validator, capability, dispatcher, event-subscriber, migration,
  and source failures to the smallest truthful surface.
- [ ] Sanitize/bound all display and diagnostic input and prohibit implicit filesystem, network, clipboard,
  process, shell, dynamic code, or visitor-data access.
- [ ] Provide layered spec-first model, property/fuzz, headless interaction, semantic frame, deterministic
  drag trace, host E2E, scale/performance, migration, docs, and distribution evidence.
- [ ] Verify truecolor through ASCII/monochrome, all official locales, hostile text/translations, standard
  and narrow geometry, resize/maximize/restore, and all lifecycle/error states.
- [ ] Meet focused package/local verification gates and generated plugin parity in every phase.

### Should Have — Complexity L

- [ ] Record controlled performance evidence with environment/fixture metadata and trend comparisons.
- [ ] Provide application observation counters for loads, cache ranges, render descriptors, damage cells,
  drag frames, operation outcomes, resolver failures, and degradation without payloads.
- [ ] Offer conservative configurable limits whose defaults are documented and can be lowered by hosts.

### Won't Have (Out of Scope)

- Claims that 100,000 cards are resident, a universal FPS guarantee, shared-CI wall-clock enforcement,
  production monitoring/alerting, server security, encryption services, backup/DR, or app availability SLA.
- Continuing after invariant corruption by silently accepting invalid IDs/counts/geometry/revisions.

---

## Technical Requirements

### Complexity and resource budgets — Complexity XL

| Operation | Normative bound |
|---|---|
| Steady render/damage/hit map | O(visible descriptors + finite overscan + visible headers) |
| Scroll/navigation/pointer move | O(affected visible cell/region), no logical-dataset scan |
| Eager query change | O(resident cards) allowed for up to 5,000, then cached/indexed steady state |
| Windowed query | O(visible/prefetched cells/ranges), never O(100,000) card reads |
| Drag target change | O(affected visible source/target stacks), one ghost/gap |
| Selection membership | O(1) keyed operations; range proportional to selected visible range |
| Saved-view parse | O(input bytes/elements) within configured maximum |
| Async ownership | Finite configured loads/validators/operations; queued work bounded/cancellable |

The public limits manifest classifies every number. An **immutable** row has the same value in all three
columns. An ordinary option may choose up to the **standard ceiling**. Crossing that ceiling requires an
explicit advanced option and measured evidence, but no option can exceed the **absolute maximum**.

| Limit | Safe default | Standard ceiling | Absolute maximum |
|---|---:|---:|---:|
| Structural, registry, action, operation ID | 256 B | 256 B | 256 B |
| Placement or undo token | 2 KiB | 2 KiB | 2 KiB |
| Saved-view encoded size | 256 KiB | 1 MiB | 4 MiB |
| Saved-view depth | 16 | 32 | 64 |
| Saved-view array elements | 4,096 | 16,384 | 65,536 |
| Saved-view object keys | 256 | 1,024 | 4,096 |
| Saved-view string | 16 KiB | 64 KiB | 256 KiB |
| Source workflow columns | 64 | 256 | 1,024 |
| Source swimlane groups | 128 | 512 | 2,048 |
| Retained visible/prefetch cell cursors | 64 | 256 | 1,024 |
| One `ensureRange` span | 256 cards | 2,048 cards | 8,192 cards |
| Configured card fields | 64 | 128 | 256 |
| Summary sections | 16 | 32 | 64 |
| Checklist groups | 32 | 64 | 128 |
| Checklist items per group | 1,024 | 4,096 | 16,384 |
| Standard card rows compact/comfortable/spacious | 6 / 12 / 18 | 6 / 12 / 18 | 6 / 12 / 18 |
| Custom card descriptor rows | 32 | 32 | 32 |
| In-memory selected keys | 10,000 | 50,000 | 100,000 |
| Concurrent cell range loads | 8 | 16 | 64 |
| Concurrent async validators per form | 4 | 16 | 32 |
| Pending operations | 32 | 128 | 512 |
| Retained dedup operation IDs | 1,024 | 8,192 | 32,768 |
| Retained observations | 256 | 2,048 | 8,192 |
| Vertical overscan | 1 viewport | 4 viewports | 8 viewports |
| Horizontal overscan | 1 column/side | 4 columns/side | 8 columns/side |

Applications may lower every configurable value. Inputs reject non-integers, negative values, inverted
ranges, arithmetic overflow, and values above the selected class before allocation or callback invocation.
Server-wide selection remains an application token rather than growing the in-memory set.

### Controlled timing evidence — Complexity L

A deliberate local benchmark, skipped on shared CI unless a controlled runner is declared, warms the
fixture and measures median visible render/drag frames for an 80×24 board. Target median is ≤16 ms. p95
≤33 ms is recorded as diagnostic evidence until environment variance proves an enforceable gate. Timing
reports include CPU/runtime/terminal harness, card descriptor mix, visible counts, source mode, iterations,
and date. Deterministic request/read/damage/allocation bounds remain normative in ordinary CI.

### Async resilience — Complexity XL

All owned async activities receive abort/generation/lifecycle identity. Superseding updates abort best
effort and increment generation before new work. Continuations test active generation/mount before
publishing. Disposal is idempotent and releases source sessions/cursors, prefetch, autoscroll, pointer
capture, overlays, editors/forms, operation controllers, subscriptions, timers, and observers. Repeated
failure does not trigger unbounded automatic retry; Retry is explicit/application policy.

### Failure containment and degradation — Complexity L

- Invalid whole-source structural identity retains last valid board or renders board-level error.
- One cell/source load failure renders scoped error while other cells work.
- One card renderer/field/style failure renders a local fallback.
- One dialog field/provider failure marks the field/form and preserves draft.
- Dispatcher rejection restores authoritative state.
- Capability/subscriber/observation failure cannot authorize/mutate or stop routing.
- Unsupported terminal capabilities choose documented fallback; they never claim unavailable behavior
  succeeded.

### Security boundary — Complexity XL

Every application/source/schema/serialized/custom result is validated and sanitized at entry and again
at its specialized boundary. Allowlist discriminators/IDs/roles/operators. Never `eval`, dynamically
import saved paths, run shell commands, form SQL, access filesystem/network/clipboard, or log raw errors/
records/tokens. Diagnostics use safe codes, IDs, counts, bounded redacted messages, and explicit opt-in
redacted application labels. Terminal text removes/neutralizes control sequences before measurement.

Capabilities are UX only. Dispatcher and remote services enforce authorization, server validation,
parameterization, rate limits, TLS, encryption at rest, secrets, restrictive CORS/CSRF/session policy,
and hardened infrastructure as applicable. These are documented application obligations and N/A to the
component implementation itself rather than falsely claimed.

Renderers, resolvers, formatters, validators, capability providers, event subscribers, migrations, and
source/dispatcher functions are trusted same-thread application callbacks. Kanban bounds the arguments it
supplies, validates and bounds results, limits invocation/reentrancy, isolates thrown failures, and stops
owned async publication after cancellation. It cannot sandbox closure/import side effects or pre-empt a
non-terminating synchronous callback. Callback runtime, termination, authorization, and side effects are
application responsibilities; stronger isolation requires a separately approved restricted execution
service rather than an ordinary worker claim.

### Verification architecture — Complexity XL

1. Requirements-derived `*.spec.test.ts` are written before implementation and remain normative
   behavioral oracles. A specification test changes only with an accepted requirement or ambiguity-register
   change, synchronized traceability, and review evidence explaining the semantic delta; git history
   records creation order rather than a permanent hash that would block legitimate requirement changes.
2. `*.impl.test.ts` covers internal branches/performance mechanisms without redefining requirements.
3. Pure property/fuzz tests cover ordering, selection, placement, query, saved views/migrations, geometry,
   sanitization, ID/revision invalidity, and state machines.
4. Headless tests route real keyboard/pointer/commands, fake clocks, controlled promises, resize, focus,
   overlays, and disposal.
5. Curated semantic frames assert named regions/cells/styles/state, not every incidental ANSI sequence.
6. Browser/xterm, a real Unix PTY, and platform-scoped Windows ConPTY-equivalent E2E cover pointer capture,
   key routes, color/Unicode capability, and damage-free drag; pipe-backed host tests remain a lower layer
   and are never labeled PTY evidence. Raw bytes may differ while semantic outcomes match.
7. Scale fixtures assert source reads, descriptors, subscriptions, allocations/counters, request count,
   cancellation, and no full scans at both targets.
8. Docs examples and showcase have focused tests for their teaching/interaction claims.

### Phase/release gates — Complexity M

For every implemented phase: run relevant package build/typecheck/spec+impl tests/check:docs/check:deps,
focused docs tests/typecheck/build when affected, `yarn verify:local`, inspect source-impact references,
run `yarn plugin:update` when mapped, and `yarn plugin:check`. Generated outputs are inspected and included
with source changes. Locale releases also run `yarn i18n:reviews:check`; performance integration asserts
Kanban is present in `scripts/check-performance.mjs`. CI owns authoritative full `yarn verify`; local full
verify is not routine unless requested. No phase claims behavior lacking its normative evidence.

---

## Integration Points

- Applies to every preceding RD and provides the verification/security closure for RD-15 release/docs.
- Uses repository core performance conventions and package/docs/plugin gates.
- Applications consume documented security/authorization/persistence/host obligations.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Scale | Resident only / windowed / both | 5k resident + 100k logical | Long-term component | AR #10 |
| Tests | Snapshot / manual / layered | Layered spec-first | Semantic and visual confidence | AR #38 |
| Timing | CI wall clock / controlled local | Controlled local median | Repeatability | AR #38 |
| Security | Trust all / bounded boundary | Validate/sanitize/isolate | Generic app data and TUI injection risk | AR #22 |
| Accessibility | Color/Unicode only / full fallbacks | Color-depth+ASCII+non-color | Terminal reachability | AR #23 |
| Limits/defaults | Deferred / centralized | Exact manifest | Concrete safety and spec evidence | AR #43 |

---

## Security Considerations

- This RD's Security Boundary is normative for every RD.
- **Data sensitivity**: Arbitrary cards may contain PII/confidential data; persistence/retention is app
  owned and payload-free diagnostics are mandatory.
- **Input/injection**: Allowlist, bound, sanitize, escape/neutralize terminal output; no dynamic code,
  SQL, shell, paths, HTML, or host capability from data.
- **Authentication/authorization**: Application dispatcher/services enforce; component capabilities are
  not security.
- **Encryption/secrets/infrastructure/rate limiting**: N/A to local package; mandatory for applicable app
  services and explicitly documented.
- **Security tests**: Hostile text/schema/JSON/IDs/geometry/callback errors/tokens/diagnostics/resources and
  authorization-bypass assumptions receive specification coverage.

---

## Acceptance Criteria

1. [ ] A 5,000-card eager fixture completes query derivation and then renders/scrolls/navigates/drags
   without another full-card scan on each frame/input.
2. [ ] A 100,000-logical windowed fixture's visible 80×24 frame reads only visible+finite overscan ranges,
   creates only visible/prefetched cursors, and never enumerates logical cards.
3. [ ] Instrumented steady render, scroll, pointer move, and target change satisfy the complexity table;
   an injected accidental whole-array operation makes the spec fail.
4. [ ] Concurrent loads/validators/dispatches, retained observations, saved JSON, descriptor rows, and
   operation IDs stop at their selected limit class, reject values above the absolute maxima before
   allocation/callback invocation, and return bounded unavailable/error outcomes.
5. [ ] Query/source/editor/drag/disposal supersession aborts owned signals and all deliberately late
   controlled settlements produce zero state/frame/event publication.
6. [ ] Repeated dispose is idempotent and leaves zero owned cursors, timers, pointer capture, overlays,
   editor registrations, subscriptions, and active controllers.
7. [ ] A renderer, field resolver, grouping resolver, formatter, validator, capability, dispatcher,
   event subscriber, and migration are each forced to throw; every failure stays within the documented
   smallest surface and the rest remains operable.
8. [ ] Callback tests prove bounded package inputs, results, invocation/reentrancy, and cancelled async
   publication while documentation explicitly avoids claiming sandboxing or synchronous pre-emption.
9. [ ] Hostile ANSI/C0/C1/bidi/wide/combining/newline/tab/overlong card, translation, error, and saved-view
   fixtures cannot alter cells outside their assigned regions or leak raw payloads.
10. [ ] Diagnostics/events contain allowlisted codes/IDs/counts/bounded redacted strings and no full cards,
   drafts, filters marked sensitive, placement/undo tokens, stack traces, or raw thrown objects.
11. [ ] Saved artifacts cannot select executable code/module paths or cause filesystem/network/clipboard/
    shell/eval access in a host-spy fixture.
12. [ ] A raw request constructed despite denied capability still requires and can fail application
    authorization; no test labels capabilities as authorization.
13. [ ] Controlled local timing uses warmed iterations and records fixture/environment; median ≤16 ms is
    asserted only in deliberate local mode and p95 ≤33 ms is reported diagnostically.
14. [ ] Shared CI skips machine-dependent wall-clock assertions but enforces deterministic read/request/
    damage/allocation/cancellation bounds.
15. [ ] Curated frames cover Classic/alternate theme, truecolor/256/16/mono/`NO_COLOR`, Unicode/ASCII,
    80×24/narrow/resize/maximize/restore, longest locales, all state surfaces, and drag outcomes.
16. [ ] Frame tests assert semantic regions/cells/state and selected reviewed goldens; changing incidental
    ANSI ordering without semantic change does not force broad snapshot regeneration.
17. [ ] Real Unix PTY, platform-scoped Windows ConPTY-equivalent, and browser/xterm E2E prove equivalent
    commands, pointer proposals, cancellation, settled damage, and fallback semantics for declared host
    profiles; pipe-backed tests are reported separately.
18. [ ] Every acceptance criterion in RD-01–RD-15 maps to at least one requirements-derived spec assertion
    or an explicitly scoped manual host evidence item that cannot be automated.
19. [ ] Package checks, focused docs checks/build, `yarn i18n:reviews:check`, `yarn verify:local`, mapped plugin update review, and
    `yarn plugin:check` pass for each completed phase; CI full verify remains authoritative.
20. [ ] Security documentation marks server validation, auth, rate limiting, TLS/encryption, secrets,
    CSRF/CORS/session policy, backup, and hardened infrastructure as application responsibilities, not
    package guarantees.
21. [ ] No implemented behavior is promoted in docs/showcase/release notes before its normative phase
    evidence passes.
