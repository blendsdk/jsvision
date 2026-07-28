# Execution Plan: Native Clipboard

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-28 19:18 UTC
> **Progress**: 15/26 tasks (58%)
> **CodeOps Artifact Schema**: 1

## Execution rule

Mark the active task `[~]` with a timestamp, then `[x]` only after its stated verification. Resume
the first `[~]`, otherwise the first `[ ]`. Every phase follows specification red → production green
→ implementation tests → full verification. Do not stage or overwrite the pre-existing user-owned
`yarn.lock` change; reconcile the planned dependency edit explicitly when Phase 3 begins.

## Phase summary

| Phase | Outcome | Tasks |
|---|---|---:|
| 1 | Core UTF-8 bounding and empty-event widget parity | 6 |
| 2 | Host-neutral API and ordered focus-safe read pipeline | 9 |
| 3 | Private `tvedit` `clipboardy` adapter | 5 |
| 4 | Documentation, plugin, and release evidence | 6 |
|  | **Total** | **26** |

## Phase 1: Core bounding and widget parity

> **Phase baseline tree**: `3daf0dbf2d9f2ee4148966a6955cc941e2afe6cc`
> **Expected modification set**: core input utility/exports/tests; UI editable widget
> specifications/handlers/implementation tests; generated API/plugin artifacts required by the
> repository's same-commit SDK drift policy

**Reference**: 03-01 · ST-01, ST-02, ST-09, ST-15

- [x] 1.1.1 `[spec-author]` Add immutable core specifications for exact-fit/overflow ASCII,
  multibyte boundaries, combining/wide Unicode, empty input, default cap, valid-prefix and
  truncation semantics. ✅ (completed: 2026-07-28 17:38)
- [x] 1.1.2 `[spec-author]` Add UI specifications proving an empty `PasteEvent` updates canonical
  state but does not mutate selection, value, undo history, validation, or paint state in Input,
  Editor, and CodeEditor. ✅ (completed: 2026-07-28 17:38)
- [x] 1.1.3 Run the focused core/UI specifications and record expected failures before production
  changes. ✅ (completed: 2026-07-28 17:38; 8 core, 2 UI, and 1 CodeEditor expected failures;
  canonical adoption-before-routing remained green)
- [x] 1.2.1 Implement and export the documented bounded-paste result/helper using
  `TextEncoder.encodeInto`; reuse `PASTE_CAP_BYTES`. ✅ (completed: 2026-07-28 17:57)
- [x] 1.2.2 Add explicit empty-event no-op guards at editable insertion boundaries; preserve every
  non-empty path. ✅ (completed: 2026-07-28 17:57)
- [x] 1.3.1 Turn Phase 1 specs green; add invalid-cap/allocation/lifecycle implementation cases;
  run core/UI package checks and `yarn verify`; complete required reviewer/auditor quality loop.
  ✅ (completed: 2026-07-28 18:18; all major findings fixed and independently re-reviewed)

**Deliverable**: One reusable UTF-8-safe cap and non-destructive empty paste across widgets.

**Verify**: `yarn verify`

## Phase 2: Host API and ordered focus-safe read pipeline

> **Phase baseline tree**: `caba9e20033c1e40234b4a04b7c5bdac099c0be0`
> **Expected modification set**: UI callback types/exports, application/run/event-loop routing and
> lifecycle internals, focused specifications/implementation tests

**Reference**: 03-02, 03-03 · ST-03 through ST-15

- [x] 2.1.1 `[spec-author]` Add public adapter/configuration and canonical-first write
  specifications for Application, direct EventLoop, sync/async callbacks, no-adapter compatibility,
  OSC fallback, and payload-free failure. ✅ (completed: 2026-07-28 18:39)
- [x] 2.1.2 `[spec-author]` Add command specifications for application-handler precedence,
  reader-aware paste availability with empty local state, modal authority, and direct `PasteEvent`
  separation. ✅ (completed: 2026-07-28 18:39)
- [x] 2.1.3 `[spec-author]` Add deferred-reader specifications for serialized start/delivery,
  successful/empty/failure state transitions, later-failure fallback timing, and queue recovery.
  ✅ (completed: 2026-07-28 18:39)
- [x] 2.1.4 `[spec-author]` Add focus/modal/mount/lifecycle specifications covering continuous
  stable delivery and every stale-destination discard named in ST-12 through ST-14.
  ✅ (completed: 2026-07-28 18:39)
- [x] 2.1.5 Run focused Phase 2 specifications and record expected failures before production
  changes. ✅ (completed: 2026-07-28 18:39; UI 37 expected failures / 6 baseline passes; CodeEditor
  1 expected failure)
- [x] 2.2.1 Export documented reader/writer callback contracts; thread optional configuration
  through Application and EventLoop; preserve application-writer precedence and OSC fallback.
  ✅ (completed: 2026-07-28 18:47)
- [x] 2.2.2 Implement app-handler-first paste interception, reader-aware command availability, and
  the rejection-safe serialized queue without awaiting input dispatch.
  ✅ (completed: 2026-07-28 18:47)
- [x] 2.2.3 Implement capture/validation generations, route mount incarnations, bounded
  success/fallback dispatch, stable warnings, and stop/teardown invalidation.
  ✅ (completed: 2026-07-28 18:47)
- [x] 2.3.1 Turn all Phase 2 specs green; add scheduler/token/error mechanics tests; run UI API,
  typecheck, tests, `yarn plugin:check`, and `yarn verify`; complete reviewer/auditor quality loop.
  ✅ (completed: 2026-07-28 19:18; 51 UI and 1 CodeEditor tests pass; all major findings fixed and
  independently re-reviewed)

**Deliverable**: Optional symmetric host-neutral clipboard behavior with deterministic focus-safe
native paste.

**Verify**: `yarn verify`

## Phase 3: `tvedit` native adapter

> **Expected modification set**: private examples source/tests/package manifest and carefully
> reconciled lockfile

**Reference**: 03-04 · ST-16, ST-17

- [ ] 3.1.1 Recheck current `clipboardy` release, Node engine, license, async API, platform helpers,
  and transitive dependency diff; record any plan-changing result before installation.
- [ ] 3.1.2 `[spec-author]` Add examples specifications with injected functions for exact raw
  read/write, Unicode, empty, rejection, order, non-blocking behavior, and sentinel-safe
  diagnostics.
- [ ] 3.1.3 Run focused Phase 3 specifications and record expected failures before adapter or
  dependency changes.
- [ ] 3.2.1 Implement the examples-owned adapter factory; inject async `clipboardy.read`/`write`
  into `tvedit`; add only the private examples dependency and reconcile/review `yarn.lock`.
- [ ] 3.3.1 Turn Phase 3 specs green; add missing-helper/headless mechanics cases; run examples/UI
  checks and `yarn verify`; perform available manual smoke cells; complete reviewer/auditor loop.

**Deliverable**: Cross-platform native desktop clipboard behavior demonstrated by `tvedit`.

**Verify**: `yarn verify`

## Phase 4: Documentation, plugin, and release closure

> **Expected modification set**: public JSDoc/API pages, docs site, canonical skill/impact mapping,
> generated plugin, manual evidence, plan/traceability status

**Reference**: 03-05 · ST-18

- [ ] 4.1.1 `[spec-author]` Add documentation/canonical-skill specifications for configuration,
  raw-text semantics, shortcuts, ordering/focus safety, bounds, empty/failure behavior,
  platform/headless limitations, and no-install policy.
- [ ] 4.1.2 Run focused Phase 4 specifications and record expected failures before documentation
  changes.
- [ ] 4.2.1 Complete public JSDoc and consumer docs/examples; regenerate API documentation and run
  docs checks.
- [ ] 4.2.2 Run source-impact analysis, update every reported canonical skill reference/recipe and
  mapping when necessary, run `yarn plugin:update`, and inspect all generated output.
- [ ] 4.3.1 Turn docs/plugin specifications green; run `yarn plugin:check`; finish and truthfully
  record the available OS/terminal/headless manual matrix.
- [ ] 4.3.2 Run final focused suites and `yarn verify`; synchronize traceability/execution evidence;
  complete reviewer/auditor quality loop and report issue #191 acceptance without mutating GitHub.

**Deliverable**: Documented, plugin-synchronized, verified implementation with honest environmental
evidence.

**Verify**: `yarn verify`

## Dependencies

```text
Phase 1 bound/no-op primitive
    ↓
Phase 2 framework API and scheduler
    ↓
Phase 3 native example integration
    ↓
Phase 4 docs/plugin/release closure
```

## Completion criteria

1. All 26 tasks are verified in specification-first order.
2. RD-01, RD-02, and RD-03 acceptance criteria pass without weakening immutable specifications.
3. No unresolved critical or major reviewer/auditor finding remains.
4. `yarn plugin:check` and authoritative `yarn verify` pass.
5. Dependency and manual-environment evidence is truthful and reproducible.
6. User-owned unrelated changes remain unstaged unless the user separately authorizes them.
