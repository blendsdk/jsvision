# Native Clipboard Plan Ambiguity Register

> **Status**: ✅ GATE PASSED — all 15 items resolved
> **Last Updated**: 2026-07-28 15:55
> **Auto-design**: Active
> **Root Invocation ID**: `AD-191-20260728T133457Z`
> **Policy Version**: 1
> **CodeOps Artifact Schema**: 1

## Register

| # | Category | Ambiguity / Gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-01 | Target | Which approved requirements this plan implements | One planning group and plan implement `clipboard-native/RD-01`, `RD-02`, and `RD-03`. | Requirements AR-18 | ✅ Resolved |
| AR-02 | Modification set | Which production surfaces may change | Core paste utility; UI application/run/event-loop, automatic adapter, package manifest, and editable widgets; tests, consumer docs, canonical skill, generated plugin, lockfile, and CodeOps evidence. | AI — delegated by `--auto-design`; amended by user | ✅ Resolved |
| AR-03 | Public API | Concrete adapter types and configuration path | Export raw-text callback types; add optional reader/writer to `ApplicationOptions` and direct `EventLoopOptions`; preserve the existing event-loop writer methods for runtime hosts. | Requirements AR-03 | ✅ Resolved |
| AR-04 | Command routing | Where native reads intercept paste commands | Let the existing application command sink handle first; otherwise the event loop captures an eligible `Commands.paste` and schedules the reader. Modal scope remains authoritative. | AI — delegated by `--auto-design` | ✅ Resolved |
| AR-05 | Command enablement | How paste remains reachable with an empty local clipboard | The event loop's command-emission boundary treats paste as enabled while a reader exists; with no reader, existing registry enablement remains unchanged. | AI — delegated by `--auto-design` | ✅ Resolved |
| AR-06 | Ordering | Concrete async scheduler | Maintain a tail promise; append one read job per gesture; normalize rejection inside each job so one failure cannot poison later work. Do not await from input dispatch. | Requirements AR-07 | ✅ Resolved |
| AR-07 | Destination continuity | Concrete stale-target proof | Capture scope, route, focus/modal generation, lifecycle generation, and per-view mount incarnations; revalidate atomically immediately before dispatch. | Requirements AR-06, AR-08 | ✅ Resolved |
| AR-08 | Bounds | Utility signature and algorithm | Export `boundPasteText(text, capBytes = PASTE_CAP_BYTES): { text; truncated }` from core; use a fixed buffer and `TextEncoder.encodeInto`. | Requirements AR-09 | ✅ Resolved |
| AR-09 | Empty text | Widget implementation boundary | Add explicit empty-paste no-op guards to every editable widget reached by `PasteEvent`; canonical adoption remains loop-owned and occurs first. | Requirements AR-19 | ✅ Resolved |
| AR-10 | Native adapter | How `clipboardy` remains testable and isolated | `Application.run()` installs a lazy UI-owned adapter by default; `systemClipboard: false` opts out, explicit callbacks override it, and tests inject or mock async read/write methods. This supersedes the initial `tvedit`-only factory. | User amendment, 2026-07-28 | ✅ Resolved |
| AR-11 | Timeout / cancellation | Whether reads time out or receive abort signals | Add neither: the public callback stays parameterless, serialization bounds concurrency, and lifecycle tokens make late completion inert. | Requirements AR-07, AR-08 | ✅ Resolved |
| AR-12 | Diagnostics | Where failures are reported | Use the existing event-loop warning sink with stable payload-free read/write messages; do not forward thrown values. | Requirements AR-13, AR-20 | ✅ Resolved |
| AR-13 | Tests | File and oracle split | Requirements-derived behavior goes in clipboard `.spec.test.ts` files; scheduler/token/adapter mechanics go in `.impl.test.ts`; machine clipboard access is forbidden. | RD-03 | ✅ Resolved |
| AR-14 | Documentation/plugin | Which generated surfaces close the feature | Update public API/keyboard/clipboard guidance and canonical skill references identified by the impact map, then run `yarn plugin:update` and `yarn plugin:check`. | Project guidance, RD-03 | ✅ Resolved |
| AR-15 | Execution | Phase and verification policy | Four specification-first phases; focused package gates during iteration; authoritative `yarn verify` before each phase commit and final completion. | Project guidance, CodeOps standards | ✅ Resolved |

## Delegated decision record

### AR-02 — modification set

- **Objective:** Bound execution tightly enough to protect unrelated work while covering every
  acceptance surface.
- **Evidence:** The reusable byte cap lives in core, adapter routing lives in UI, `tvedit` lives in
  examples, and the project impact map governs canonical/generated plugin updates.
- **Decision:** The expected paths are those listed in AR-02. Any newly discovered production path
  requires an execution-plan update before editing.
- **Counterargument:** A path-level set can become stale as tests reveal a nearby owner.
- **Confidence:** High. The execution plan records paths by responsibility, not exact filenames
  where discovery may legitimately split a module.
- **Reopen trigger:** A required behavior cannot be expressed through a public package boundary or
  an impact-map result identifies an additional canonical source.

### AR-04 and AR-05 — command ownership and enablement

- **Objective:** Make native paste work from every existing paste command source without bypassing
  application overrides or requiring widget opt-in.
- **Evidence:** `event-loop.ts` already routes commands through the application sink and the command
  registry can suppress paste while its local value is empty.
- **Decision:** Intercept only an unhandled paste command at the loop boundary. The same emission
  boundary considers paste available while a reader is configured; removal/no-reader restores
  registry behavior.
- **Alternatives rejected:** Widget-level async hooks fragment ownership and miss custom controls.
  Reading before the application command sink changes handler precedence. Permanently enabling
  paste changes no-adapter behavior.
- **Counterargument:** A reader-aware emission rule couples command availability to host
  configuration.
- **Confidence:** High. The coupling is the observable capability and is confined to one boundary.
- **Hardening:** An independent challenger proposed a widget hook. Its focus-continuity concerns
  were adopted under AR-07; the hook was rejected because it creates a second public contract.
- **Reopen trigger:** Repository tests prove application handlers receive only post-registry
  events, making the boundary unable to preserve current precedence.

### AR-06 and AR-07 — scheduler and continuity

- **Objective:** Preserve gesture order and prevent delayed text from reaching a changed target.
- **Evidence:** Host reads are arbitrary promises; focus, modal scope, mounting, and application
  stop can all change while they settle.
- **Decision:** A non-blocking serialized promise chain owns read order. Each job captures and later
  validates all continuity tokens synchronously before adopting or dispatching text.
- **Alternatives rejected:** Concurrent reads plus buffering can launch unbounded helpers.
  Endpoint identity alone accepts focus-away-and-back and remount races. Cancellation cannot be
  guaranteed by the callback signature.
- **Counterargument:** Serialization observes the OS clipboard when a queued read starts rather
  than exactly at the gesture.
- **Confidence:** High. The issue prioritizes deterministic gesture order and safe bounded
  concurrency. The challenger independently converged on serialization.
- **Reopen trigger:** Measured helper latency makes key-repeat queues unusable or a cancellable
  adapter contract is approved.

### AR-10 — automatic application adapter

- **Objective:** Exercise the exact native wiring without touching the developer or CI clipboard.
- **Evidence:** Every native example already converges on `Application.run()`. Example-only wiring
  made `tvedit` work while leaving the kitchen sink and consumer applications unconfigured.
- **Decision:** Publish `clipboardy` as an optional UI runtime dependency, load it on the first
  clipboard operation, and install the ordered pair automatically only when no explicit callback
  owns the boundary.
- **Counterargument:** This expands the published UI dependency closure and changes default
  `Application.run()` behavior.
- **Confidence:** High. UI, package-policy, headless, plugin, and browser production builds verify
  the boundary; explicit opt-out preserves isolated/OSC-only hosts.
- **Reopen trigger:** A supported bundler cannot preserve the lazy import or optional dependency
  installation proves unreliable on a supported package manager.

## Zero-Ambiguity Gate

- [x] Every requirement is assigned to a component and test layer.
- [x] Public API ownership, compatibility, and failure behavior are explicit.
- [x] Ordering, focus/modal continuity, remount, and teardown invariants are explicit.
- [x] Dependency ownership, version recheck, and headless behavior are explicit.
- [x] Documentation, plugin synchronization, verification, and commit boundaries are explicit.
- [x] No product decision was delegated beyond `--auto-design`.
