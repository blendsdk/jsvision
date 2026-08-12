# Requirements: Kanban Phase C Modern Interaction

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Sources**:
> [RD-07](../../requirements/RD-07-pointer-drag-drop.md) and
> [RD-08](../../requirements/RD-08-requests-placement-lifecycle.md) — the OWNING requirement documents

## Scope of this plan (delta view)

### In this plan

- RD-07: every must-have and should-have behavior—threshold/capture, card and structural drag, ghost,
  placeholder, density-aware drop map, hysteresis, live reflow, collapsed-swimlane hover, prefetch,
  four-edge autoscroll, exact release semantics, cleanup, deterministic evidence, and native/browser host
  parity (AR-C01/C03/C07–C09/C14/C17).
- RD-08: the complete standard request/placement/eligibility/dispatcher/operation/publication/undo core,
  including all standard request variants. Actual Phase C card/column/swimlane move producers are wired;
  bounded contract fixtures prove that future saved-view/editor/configuration/context-menu producers submit
  final-shaped proposals through the same coordinator, but their user interfaces are not implemented early
  (AR-C01/C02/C10–C15).
- Keyboard-reachable and programmatic move operations through the existing interaction/facade/input
  architecture. RD-12 retains the complete configurable command registry, menus, normalized event family,
  and application history UX (AR-C02/C15).
- Phase-owned theme roles, locale feedback, testing helpers, public JSDoc/examples, package and architecture
  docs, generated API/plugin synchronization, and an incremental kitchen-sink drag/lifecycle scenario
  required to demonstrate shipped behavior honestly (AR-C19/C20).
- A backward-compatible `@jsvision/ui` pointer-capture lease prerequisite and its specification coverage
  (AR-C03).

### Deferred / out of this plan

- RD-09 search/filter/sort UI, saved-view schemas/migrations, personalization, and saved-view producers.
- RD-10 card editor dialogs, generic form schemas, modeless inspector, and draft/conflict UX.
- RD-11 board-configuration dialogs, confirmations, and reassignment UI; the structural request variants
  and pointer/programmatic reorder paths exist, but later UI remains later.
- RD-12 complete commands/events/capabilities/history surface. Phase C provides durable move operations,
  request states, feedback, and undo tokens/inverse hooks only.
- RD-13/14 final cross-component accessibility/performance/security matrices and RD-15’s complete component
  course, all labs, and Reddit-ready showcase. Phase-owned quality and incremental kitchen-sink evidence
  remain required.
- Component-owned persistence, retries, timeout policy, distributed conflict merging, rank generation,
  partial atomic results, native GUI drag data, touch, drag outside the host, or cross-board transfer.

## Plan-local specifications

### SPEC-C-CAPTURE — reusable synchronous capture-loss ownership

The UI loop issues a generation-bound capture lease whose loss callback runs once, synchronously, and in
an exception-isolated transition for replacement, explicit release, modal boundary change, unmount,
host-reported loss/blur, stop/disposal, or stale-target discovery. A stale lease cannot release a newer
capture. Existing `setCapture`, `releaseCapture`, and `hasCapture` behavior remains source-compatible
(AR-C03).

### SPEC-C-HANDOFF — drag-to-operation atomicity

Pointer release freezes one current semantic proposal and invokes the board operation coordinator exactly
once. The coordinator admits or rejects the proposal and publishes a pending semantic overlay before the
viewport clears ephemeral drag state, so no settled frame shows neither origin nor pending intent. Invalid,
outside, stale, unavailable, unchanged-disallowed, or cancelled release invokes no dispatcher
(AR-C04/C05/C12/C13).

### SPEC-C-PARITY — one move policy for all origins

Pointer, keyboard, and public programmatic move paths call the same pure eligibility pipeline, construct
the same semantic placement shape, and enter the same operation coordinator. Origin metadata may differ;
authorization, atomicity, request validation, pending rendering, and publication reconciliation may not
(AR-C06/C10/C14/C15).

### SPEC-C-PROJECTION — bounded semantic overlays

Drag and pending overlays contain only stable identities, revisions, sanitized bounded display fragments,
semantic target/placement evidence, and finite geometry. They never retain full application card records,
tokens in observations, or authoritative numeric ranks. Projection work scales with visible/overscan
regions and the configured selected/pending limits (AR-C05/C07/C12/C14/C20).

### SPEC-C-HOST-EVIDENCE — honest transport parity

The deterministic semantic pointer trace is replayed through direct loop dispatch, browser/xterm, a real
Unix PTY, and Windows ConPTY when running on Windows. Raw bytes may differ, but threshold, target changes,
autoscroll decisions, cancellation, and final semantic proposal must agree. Pipe-backed tests remain a
lower integration layer and are not labeled PTY evidence (AR-C17).

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Capture primitive | UI-owned generation lease with synchronous focus/transport loss and permanent pre-cleanup subtree-unmount notification | AR-C03 |
| State partition | Ephemeral gesture/geometry plus board-level semantic operation coordinator | AR-C04/C16 |
| Request expansion | Closed standard union plus retained namespaced extension variant | AR-C10 |
| ID ownership | Coordinator-owned standard envelopes; validated caller-owned legacy extension envelope remains compatible | AR-C11 |
| Acceptance publication | Accepted auto-reconciles only from a validated expectation or exact operation-correlated application notice; otherwise it remains pending; undo token/builder descriptors are exact and FIFO-bounded | AR-C12 |
| Host harness | Dev-only stable `node-pty`, xterm, and workspace Web test dependencies, installed only with execution-time authorization | AR-C17 |

## Plan-local acceptance criteria

1. [x] Every RD-07 and RD-08 acceptance criterion maps to at least one immutable ST case in 07.
2. [x] SPEC-C-CAPTURE, SPEC-C-HANDOFF, SPEC-C-PARITY, SPEC-C-PROJECTION, and
   SPEC-C-HOST-EVIDENCE pass without weakening application authority.
3. [x] Every mutation producer present in Phase C invokes one validated dispatcher and no source record
   changes directly; bounded saved-view/editor/configuration/context-menu producer-contract fixtures prove
   the same public submission seam without advertising deferred UI as implemented.
4. [x] Drag and pending frames are bounded, damage-free, readable in Unicode/color and ASCII/monochrome,
   responsive after resize/maximize/restore, and reachable without pointer-only required actions.
5. [x] UI and Kanban public compatibility, package boundaries, locale/theme/docs/API/plugin parity,
   native/browser host evidence, and the exact verification matrix in AR-C18 pass.
6. [x] Roadmap criteria advance only when their complete owning evidence is verified; later RD-09–15 work
   remains open.
