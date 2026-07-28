# Current State Analysis

> **Baseline**: `develop` at `440485496`
> **Reviewed**: 2026-07-28
> **CodeOps Artifact Schema**: 1

## Existing behavior

| Surface | Current state | Consequence |
|---|---|---|
| Canonical clipboard | `EventLoop` stores raw `clipboardText`; all `PasteEvent` values are adopted before routing. | Native success can reuse one source of truth and the ordinary event path. |
| Outbound write | Copy/cut commit locally first, then invoke an optional raw writer; failure is non-fatal. | Extend configuration, do not replace canonical ownership. |
| Run integration | `run.ts` installs the OSC 52 writer and clears it after stop. | Application-owned writers need precedence with OSC as the unconfigured fallback. |
| Paste command | Widgets/menus emit `Commands.paste`; local command enablement may disable it when canonical text is empty. | A configured reader must make the gesture reachable without changing no-reader behavior. |
| Bracketed paste | Decoder creates a bounded `PasteEvent`; CodeEditor handling from merged PR #190 exists. | Native reads must be command-only and must not duplicate issue #188. |
| Byte cap | `PASTE_CAP_BYTES = 1_048_576`; terminal bytes are capped before decoding. | Direct JavaScript strings need a reusable UTF-8-safe equivalent in core. |
| Focus/modal route | Loop resolves an active scope and focused leaf at dispatch time. | Async work needs captured continuity, not a fresh destination lookup. |
| Lifecycle | `stop()` disposes views and run teardown detaches sinks. | Arbitrary late promises require an explicit generation guard. |
| Editable empty paste | `Input.pasteText("")` may replace a selection; editor variants differ. | All editable widgets need explicit empty-event parity. |
| Native dependency | No SDK package imports OS clipboard tooling. | Keep `clipboardy` isolated to the private examples workspace. |

## Grounded code map

| Responsibility | Current owner | Planned delta |
|---|---|---|
| Paste event and byte cap | `packages/core/src/engine/input/events.ts`, `decoder.ts` | Add/export bounded-string result and helper; share the cap. |
| Canonical state and routing | `packages/ui/src/event/event-loop.ts`, `dispatch.ts` | Add reader configuration, queue, capture/validation tokens, command interception, teardown. |
| Callback contracts | `packages/ui/src/event/types.ts` | Document raw reader/writer types and stable warning behavior. |
| App construction | `packages/ui/src/app/application.ts`, `run.ts` | Thread callbacks; retain OSC 52 fallback and clear runtime seams. |
| Commands | UI command registry and loop emission paths | Reader-aware paste availability with app-handler-first routing. |
| Editable widgets | Input, Editor, CodeEditor paste handlers | Empty `PasteEvent` insertion no-op with regression coverage. |
| Native executable | `packages/examples` `tvedit` entry | Inject async `clipboardy` methods through a testable factory. |
| Consumer support | docs site, canonical skill, impact map/generated plugin | Explain host neutrality, async focus safety, failure modes, platform limitations. |

## Constraints and hazards

- Promise completion order is not gesture order unless explicitly serialized.
- Route endpoint equality is insufficient: focus-away-and-back, modal churn, and remount can reuse
  the same object identities.
- The synchronous validation-to-dispatch segment must not yield.
- A rejected job must settle the queue tail so future paste gestures still execute.
- A successful empty read and a failed read are different states.
- Bounding must be by UTF-8 bytes and cannot append a replacement character.
- Tests must not import or invoke real platform helpers.
- The pre-existing `yarn.lock` working-tree edit is user-owned; execution must isolate and review the
  dependency mutation rather than overwrite it.

## Compatibility baseline

The merged PR #190 implementation is the regression baseline. Issue #188 remains open as an
independent bracketed-paste concern even though its current CodeEditor handler is present on this
branch. No implementation task may remove, relocate, or claim that behavior without a separately
approved scope change.
