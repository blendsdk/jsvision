# Native Clipboard Requirements Ambiguity Register

> **Status**: ✅ GATE PASSED — all 20 items resolved
> **Last Updated**: 2026-07-28 15:45
> **Auto-design**: Active
> **Root Invocation ID**: `AD-191-20260728T133457Z`
> **Policy Version**: 1
> **CodeOps Artifact Schema**: 1

## Register

| # | Category | Ambiguity / Gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-01 | Scope / naming | Artifact lane, feature target, and product boundary | Use the nested feature `clipboard-native`; specify and plan GitHub issue #191 as one cohesive plain-text native clipboard capability. | User confirmation, 2026-07-28 | ✅ Resolved |
| AR-02 | Stakeholders / behavior | Whose workflows define success | Serve local desktop TUI users, SDK application authors, framework maintainers, and users in degraded/headless/remote environments; preserve the issue's ordinary `Ctrl+C`/`Ctrl+V` behavior and fallback contract. | User-selected issue #191 | ✅ Resolved |
| AR-03 | Public API / integration | Where optional host adapters live | Add host-neutral raw-text writer and reader options at the application/run boundary and retain matching event-loop seams; `@jsvision/ui` remains independent of OS clipboard packages. | AI — delegated by `--auto-design` | ✅ Resolved |
| AR-04 | Compatibility | Behavior when no native adapter is configured | Preserve the merged PR #190 behavior exactly: canonical app-local copy/paste remains available and outbound native-terminal copy remains capability-gated OSC 52. | User-selected issue #191 | ✅ Resolved |
| AR-05 | Failure / state | Read success, empty success, read failure, and write failure semantics | A successful read adopts and delivers its bounded raw text once, including `""`; a failed read delivers the then-canonical app-local value once; a failed write never rolls back canonical state. | User-selected issue #191 | ✅ Resolved |
| AR-06 | Concurrency / focus | Exact identity and eligibility checks for delayed paste delivery | Capture scope, focus-route, lifecycle, modal/focus generation, and mount-incarnation tokens; deliver only if every token and eligibility predicate remains valid. Deliver through the ordinary `PasteEvent` route after the synchronous guard. | AI — delegated by `--auto-design`; challenger strengthened the guard | ✅ Resolved |
| AR-07 | Concurrency / ordering | Concurrent reads with ordered drain versus a serialized read queue | Use one asynchronous serialized read queue: it bounds clipboard helper concurrency to one, preserves gesture order, and reads canonical fallback state only when the failed request reaches delivery. Rendering and input remain non-blocking. | AI — delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-08 | Lifecycle | Pending request behavior during stop/dispose | A monotonic lifecycle generation invalidates queued and in-flight requests on `stop()`; late settlements perform no dispatch, adoption, warning containing host details, or repaint. Host adapter references are cleared by run teardown. | AI — delegated by `--auto-design` | ✅ Resolved |
| AR-09 | Encoding / bounds | How direct JavaScript strings receive the terminal paste safety boundary | Add a host-neutral core helper using bounded `TextEncoder.encodeInto`, decode only complete written bytes, and return `{ text, truncated }`; direct host reads and focused helper tests use it. | AI — delegated by `--auto-design`; challenger converged | ✅ Resolved |
| AR-10 | External dependency | `clipboardy` release and API selection | Use the current compatible `clipboardy` 5.3 line (`^5.3.2`, Node `>=20`) and only its asynchronous `read()`/`write()` text methods. Re-evaluate the selected version during execution before lockfile mutation. | AI — delegated by `--auto-design` within the issue-mandated `clipboardy` choice | ✅ Resolved |
| AR-11 | Dependency ownership | Which package owns native clipboard process integration | Published `@jsvision/ui` owns `clipboardy` as an optional runtime dependency and `Application.run()` installs it lazily by default; `systemClipboard: false` opts out and explicit callbacks override it. This supersedes the original examples-only decision after the user required system-wide zero-configuration behavior. | User amendment, 2026-07-28 | ✅ Resolved |
| AR-12 | Route separation | Relationship to bracketed paste and issue #188 | `Commands.paste` may invoke the native reader; decoded `PasteEvent` sources never do. Issue #188 remains independently responsible for the CodeEditor bracketed-paste defect. | User-selected issue #191 | ✅ Resolved |
| AR-13 | Security / diagnostics | Clipboard and host-error observability | Clipboard payloads, previews, derived content, host exceptions, stderr, and helper details are never logged. Failures emit only stable payload-free warnings where the existing contract calls for one. | User-selected issue #191 | ✅ Resolved |
| AR-14 | Scope exclusions | Comparable clipboard features that could expand the issue | Exclude rich text, images, files, history, monitoring, polling, retries, prompts, automatic system-package installation, OSC 52 reads, and remote-local SSH clipboard transport. | User-selected issue #191 | ✅ Resolved |
| AR-15 | Verification | Automated versus environmental acceptance evidence | Use injected adapters and real loop/application objects in automated tests; never touch the machine clipboard. Retain the issue's manual OS/terminal matrix and record unavailable cells honestly. | User-selected issue #191 | ✅ Resolved |
| AR-16 | Documentation / distribution | Consumer and Codex-plugin update boundary | Update public JSDoc, keyboard/clipboard and applicable code-editor guidance, review every source-impact reference, then regenerate and verify the distributed plugin artifacts. | User-selected issue #191 plus project `AGENTS.md` | ✅ Resolved |
| AR-17 | Non-functional | Performance, availability, and graceful degradation | Native calls stay asynchronous; no framework polling/retry/install path is added; one read may wait without blocking input/rendering; unsupported/headless hosts retain app-local and bracketed-paste operation. | User-selected issue #191; queue mechanism delegated under AR-07 | ✅ Resolved |
| AR-18 | Requirements structure | How to decompose a medium SDK capability without fragmenting execution | Use three RDs—host-neutral behavior, `tvedit` integration, and quality/compatibility—and one planning group/implementation plan spanning all three. | AI — delegated by `--auto-design` | ✅ Resolved |
| AR-19 | Empty state / widget parity | Existing `Input` paste handling can replace a selection even when text is empty | Make an empty `PasteEvent` an insertion no-op in every editable widget while still allowing a successful native empty read to clear the canonical clipboard. | AI — delegated by `--auto-design` within the issue's explicit empty-read contract | ✅ Resolved |
| AR-20 | Diagnostics | Whether native read failure emits a diagnostic | Emit one stable payload-free warning for each failed read attempt, then perform the ordered local fallback; never include the thrown value, stderr, or clipboard data. | AI — delegated by `--auto-design` | ✅ Resolved |

## Resolution notes

### AR-01 — Target and authority boundary

- **Decision:** The user explicitly confirmed `codeops/features/clipboard-native/` and activated
  `--auto-design`.
- **Reserved authority:** Product behavior, scope, acceptance criteria, dependency family, public
  compatibility promises, and external actions remain owned by the user-authored issue contract.
- **Planning boundary:** Requirements and plan artifacts may be created and committed. Implementation,
  dependency installation, push, publication, and issue mutation are not authorized.

### AR-02 — Stakeholders and comparable systems

The issue is comparable to mainstream desktop editors such as VS Code for shortcut semantics,
GNOME Terminal/VTE for key-delivery constraints, browser Clipboard API adapters for optional
permission-bound host seams, and `clipboardy` for cross-platform native process integration.
Features outside the issue's explicit plain-text, request-driven model are rejected under AR-14.

### AR-03 — Optional host-neutral adapters

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Internal architecture and interface placement within the confirmed optional
  raw-text adapter contract.
- **Objective:** Keep SDK packages portable while making application-owned native integration
  symmetric.
- **Decision:** Thread optional `writeClipboardText` and `readClipboardText` callbacks through
  `ApplicationOptions` and `RunContext`, and expose the reader beside the existing public event-loop
  writer seam.
- **Evidence:** `packages/ui/src/event/types.ts:328-351` already exposes raw-text writes;
  `packages/ui/src/app/run.ts:123-126` installs the native OSC 52 writer; and
  `packages/ui/src/app/application.ts:421-432` is the application-to-loop construction boundary.
- **Amendment:** The callback contracts remain host-neutral, but the user subsequently required
  native `Application.run()` to configure the system clipboard automatically. UI therefore owns a
  lazy optional dependency without exposing its types. A `clipboard` service object adds a new
  abstraction without improving the two-function contract. Widget-level readers duplicate host
  access and cannot enforce ordering or teardown.
- **Strongest counterargument:** Adding callbacks at both application and loop levels creates two
  public configuration surfaces.
- **Confidence:** High — reopen if current public API review finds an existing host-adapter object
  that can carry both functions without a compatibility break.
- **Hardening:** The smallest compatible extension preserves the existing event-loop seam and makes
  application ownership explicit.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** A repository-native symmetric host abstraction appears, or public API
  extraction shows the callbacks cannot be documented without exposing Node-only types.

### AR-06 — Focus and modal safety

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Concurrency and failure-safety mechanism within the issue's fixed invariant that
  delayed text must never move to another destination.
- **Objective:** Preserve target identity across asynchronous reads while reusing ordinary widget
  paste behavior.
- **Decision:** Capture the current `scopeRoot`, focused leaf, focused leaf-to-scope route, lifecycle
  generation, focus/modal destination generation, and mount-incarnation token for every captured
  view. At ordered delivery require every token and route identity to match, plus
  mounted/visible/enabled/focusable eligibility, then synchronously dispatch the bounded
  `PasteEvent`.
- **Evidence:** `packages/ui/src/event/event-loop.ts:523-529` defines modal scope identity,
  `packages/ui/src/event/event-loop.ts:537-542` resolves the focused leaf in that scope, and
  `packages/ui/src/event/dispatch.ts:215-227` already enforces mounted/disabled routing.
- **Rejected alternatives:** Awaiting and calling `dispatch` without captured identity can redirect
  text. Endpoint identity alone accepts focus-away-and-back, modal-open-and-close, and remount
  races. Directly invoking a widget bypasses pre-process observers, canonical adoption, ancestors,
  and one-tick painting. The challenger's event-scoped widget hook identifies the final handler more
  precisely, but requires every built-in and custom paste-command owner to adopt a new public seam;
  loop-level command interception after existing application handlers automatically covers every
  `Commands.paste` source that already consumes `PasteEvent`.
- **Strongest counterargument:** Generation and mount-incarnation tracking add lifecycle machinery
  for races that ordinary identity checks handle in the common case.
- **Confidence:** High — the issue explicitly names focus, modal, unmount, and teardown changes, so
  accepting leave-and-return or remount races would weaken its invariant.
- **Hardening:** Challenger diverged on a widget hook but exposed the generation-token gap; the
  reconciled design keeps global compatibility while adopting the stronger continuity proof.
- **Challenger:** Diverged — generation safeguards adopted; widget hook rejected to avoid requiring
  every paste-capable control to opt into a second command contract.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** Existing focus APIs cannot prove visibility/focusability without widening
  internals, or a widget legitimately changes focused descendants while retaining one paste
  destination.

### AR-07 — Ordered asynchronous reads

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Concurrency algorithm and backpressure mechanism within fixed gesture-order and
  non-blocking requirements.
- **Objective:** Deterministic delivery without spawning an unbounded set of platform clipboard
  helpers.
- **Decision:** Chain reads serially outside dispatch ticks. Each gesture records target
  identity immediately; its reader starts after preceding work settles; failure consults canonical
  state at ordered delivery so an earlier successful read can become the later fallback.
- **Evidence:** `clipboardy` asynchronous reads may launch platform helpers; the event loop already
  supports promise-driven out-of-tick repaint (`packages/ui/src/event/types.ts:88-107`) and has a
  stopped lifecycle flag (`packages/ui/src/event/event-loop.ts:160-166`).
- **Rejected alternatives:** Concurrent reads plus ordered result buffering improves read-start
  timing but may spawn many helpers under key repeat while still suffering head-of-line delivery.
  Last-request-wins or coalescing violates one-gesture/one-attempt semantics and deterministic order.
- **Strongest counterargument:** A queued read observes the desktop clipboard when its turn starts,
  not at the exact gesture time.
- **Confidence:** High — reopen if adapter measurements show unacceptable queue latency or hangs.
- **Hardening:** Challenger converged on full serialization and independently rejected concurrent
  ordered reads. Its gesture-time fallback snapshot was rejected because issue #191 explicitly
  requires a later fallback to repeat text adopted by an earlier successful read.
- **Challenger:** Converged on serialization; diverged on fallback snapshot timing.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** The selected adapter proves reads are in-process and cancellation-aware, or
  user testing shows serialized read-start timing violates expected clipboard snapshots.

### AR-08 — Teardown invalidation

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Lifecycle and cancellation design inside the explicit no-late-dispatch
  requirement.
- **Objective:** Make shutdown final even though arbitrary promises cannot be forcibly cancelled.
- **Decision:** Increment a lifecycle generation and mark the loop stopped before clearing adapter
  seams. Every queued/in-flight continuation carries its generation and becomes inert on mismatch.
- **Evidence:** `packages/ui/src/app/run.ts:157-163` already stops the loop before detaching sinks,
  while `packages/ui/src/event/event-loop.ts:270-279` disposes views and clears routing state.
- **Rejected alternatives:** Relying only on `target.mounted` misses remount/late-paint cases.
  Requiring `AbortSignal` would break the issue's callback signature and cannot cancel every host
  adapter.
- **Strongest counterargument:** A generation is additional state beside the existing `stopped`
  boolean.
- **Confidence:** High — both values serve distinct proof obligations: permanent stop and request
  epoch invalidation.
- **Hardening:** Forced reframing found no callback-compatible cancellation mechanism that is both
  simpler and equally safe.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** The API contract gains required cancellation or restart-after-stop semantics.

### AR-09 — UTF-8-safe bounded text

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Internal/public utility placement and encoding algorithm within the fixed 1 MiB
  acceptance boundary.
- **Objective:** Give direct strings the same byte limit and accurate `truncated` flag without
  splitting a Unicode code point.
- **Decision:** Export one host-neutral core helper that writes into a fixed-size byte array with
  `TextEncoder.encodeInto`; the encoder stops before an incomplete scalar. If truncated, decode only
  the completed written prefix and return it with `truncated: true`; otherwise return the original
  string unchanged.
- **Evidence:** `packages/core/src/engine/input/decoder.ts:171-209` bounds terminal bytes before
  decoding; `packages/core/src/engine/input/events.ts:156-157` owns the shared cap.
- **Rejected alternatives:** A UI-local implementation duplicates a core safety invariant.
  Character-count truncation does not enforce a byte cap. Leniently decoding an arbitrary byte
  slice can append U+FFFD instead of returning an exact prefix.
- **Strongest counterargument:** Exporting a helper adds public SDK surface for one host path.
- **Confidence:** High — the same primitive directly expresses the core-owned paste byte invariant
  and avoids full-payload UTF-8 allocation.
- **Hardening:** Challenger converged on core ownership and improved the algorithm from
  encode-all/backtrack to bounded `encodeInto`.
- **Challenger:** Converged.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** Core maintainers identify an existing public bounded-text primitive, or the
  decoder can reuse a non-exported helper without violating package boundaries.

### AR-10 — `clipboardy` release

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Reversible dependency version selection inside the issue-mandated dependency
  family; no install is performed during planning.
- **Objective:** Use the maintained asynchronous cross-platform text API on the repository's Node
  22+ baseline.
- **Decision:** Use `clipboardy: ^5.3.2` as an optional `@jsvision/ui` runtime dependency and call
  only `read()` and `write()` after the first clipboard operation. This supersedes the original
  examples-only location.
- **Evidence:** The npm registry reports `clipboardy` 5.3.2 as latest, with Node `>=20`; the UI
  package declares Node `>=22`.
- **Rejected alternatives:** Pinning an older major loses current platform fixes. An exact patch pin
  unnecessarily prevents compatible fixes in the supported runtime package. Sync methods violate
  the issue's latency constraint.
- **Strongest counterargument:** A caret range can admit a future behavior change before the next
  lockfile refresh.
- **Confidence:** High — execution must re-check the selected release and lockfile diff.
- **Hardening:** Optional dependency ownership preserves install/runtime degradation, while the
  browser production build verifies the lazy import boundary.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** Latest `clipboardy` changes its Node baseline, subprocess behavior, license,
  text API, or platform support before execution.

### AR-18 — RD and plan structure

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Artifact decomposition and implementation sequencing within confirmed scope.
- **Objective:** Keep ownership clear without turning a medium SDK capability into unrelated plans.
- **Decision:** RD-01 owns host-neutral behavior and invariants; RD-02 owns native demo integration;
  RD-03 owns non-functional, compatibility, documentation, and verification requirements. One
  planning group and plan implement all three in dependency order.
- **Evidence:** The change crosses core/UI/examples/docs/plugin boundaries, while issue #191 defines
  one end-to-end acceptance outcome. The make-requirements workflow requires a dedicated
  non-functional RD.
- **Rejected alternatives:** One RD cannot satisfy the dedicated non-functional-document rule.
  Separate plans would fragment focus/order and demo acceptance and repeat the same final gate.
- **Strongest counterargument:** Three RDs add ceremony for an effort-M issue.
- **Confidence:** High — the documents are small, independently owned, and share one execution plan.
- **Hardening:** A planning group is already used by the repository's `i18n` feature for one
  cross-component outcome.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** Discovery reveals an independently releasable capability or the final plan
  cannot preserve one-owner-per-fact across the three documents.

### AR-19 — Successful empty reads

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Widget insertion mechanism needed to satisfy the explicit product rule that an
  empty successful read clears canonical state without deleting or inserting text.
- **Objective:** Prevent stale fallback without turning an empty clipboard into a destructive edit.
- **Decision:** Dispatch a successful bounded empty read through the ordinary `PasteEvent` route so
  the loop adopts `""`; make every editable widget treat empty paste text as an insertion no-op.
- **Evidence:** `packages/ui/src/event/event-loop.ts:285-304` adopts every `PasteEvent` before
  routing, while `packages/ui/src/controls/input.ts:243-245` currently calls `pasteText("")`, whose
  selection-replacement path is not a no-op. Editor and CodeEditor already have empty-edit guards or
  require parity coverage.
- **Rejected alternatives:** Skipping the event requires a second canonical-adoption API and no
  longer proves widget-path parity. Falling back to stale local text directly violates issue #191.
- **Strongest counterargument:** This corrects pre-existing empty bracketed-paste behavior in
  `Input`, slightly widening the implementation beyond the new adapter.
- **Confidence:** High — the adjustment is necessary for the issue's observable acceptance
  criterion and is backward-compatible for meaningful text.
- **Hardening:** The direct path exposed a real current-state edge rather than an optional feature.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** A widget contract intentionally defines empty paste as selection deletion.

### AR-20 — Read-failure diagnostics

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Failure observability mechanism within the issue's fixed payload-redaction and
  fallback policy.
- **Objective:** Make adapter degradation diagnosable without leaking host-controlled content.
- **Decision:** Warn with the stable pair `clipboard` / `host clipboard read failed` once per failed
  read attempt, then use local fallback. Do not log the error object.
- **Evidence:** `packages/ui/src/event/event-loop.ts:592-608` establishes the symmetric writer
  policy and existing tests assert its exact payload-free warning.
- **Rejected alternatives:** Silent failure hides broken native integration. Logging caught errors
  or helper stderr risks clipboard disclosure. Global warning deduplication would conceal repeated
  independently triggered failures and adds unrelated state.
- **Strongest counterargument:** A persistently unavailable host may produce one warning per paste
  gesture.
- **Confidence:** High — warnings remain request-driven, not polled, and carry no payload.
- **Hardening:** Symmetry with the existing write seam is simpler and more supportable than a new
  diagnostic channel.
- **Policy version:** 1
- **Root invocation ID:** `AD-191-20260728T133457Z`
- **Reopen triggers:** The project adopts a structured bounded clipboard diagnostic policy or user
  testing shows request-scoped warnings are too noisy.
