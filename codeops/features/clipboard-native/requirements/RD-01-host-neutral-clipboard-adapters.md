# RD-01: Host-Neutral Native Clipboard Adapters

> **Document**: RD-01-host-neutral-clipboard-adapters.md
> **Status**: Approved
> **Created**: 2026-07-28
> **Project**: JSVision Native Clipboard
> **Depends On**: —
> **Complexity**: M
> **CodeOps Artifact Schema**: 1

## Feature overview

Add optional symmetric raw-text clipboard callbacks at the application host boundary. Copy/cut
continues to commit locally before an optional write. An explicit paste command may perform one
asynchronous read, but completion is accepted only for the same continuously active destination.
All existing no-adapter and bracketed-paste behavior remains compatible. *(AR-03–AR-09, AR-12)*

## Functional requirements

### Must have

- **R1.1 — Optional public callbacks.** `ApplicationOptions` shall accept optional host-neutral
  callbacks equivalent to `writeClipboardText?: (text: string) => void | Promise<void>` and
  `readClipboardText?: () => string | Promise<string>`. Direct event-loop hosts shall have a
  documented configuration seam with the same raw-text contract. No SDK signature shall expose an
  OS package type. *(AR-03)*
- **R1.2 — Canonical-first write.** Copy/cut shall commit exact raw text to the canonical clipboard
  before calling the configured writer once. A synchronous throw or rejected promise shall not roll
  back that value and shall emit only `clipboard:host clipboard write failed`. *(AR-04, AR-05,
  AR-13)*
- **R1.3 — No-adapter compatibility.** Without a configured writer, the native run host shall retain
  capability-gated OSC 52 output. Without a configured reader, `Commands.paste` shall synchronously
  use the canonical app-local clipboard exactly as it does on the baseline. *(AR-04)*
- **R1.4 — Explicit command boundary.** A configured reader shall be invoked once only after an
  unconsumed explicit `Commands.paste` command. `Ctrl+V`, classic aliases, menu items, status items,
  and application emissions resolving to that command shall converge. A decoded `PasteEvent` shall
  never invoke the reader. Existing application-level command handlers retain their earlier
  interception precedence. *(AR-03, AR-12)*
- **R1.5 — Successful read.** A successful string result shall be bounded, then—only after
  destination validation—adopted as canonical and dispatched once as an ordinary `PasteEvent`.
  Unicode, multiline text, CRLF, combining sequences, and astral code points shall remain exact
  within the byte cap. *(AR-05, AR-09)*
- **R1.6 — Successful empty read.** A successful `""` shall clear the canonical value and deliver an
  empty insertion no-op. It shall never paste stale local text, delete a selection, or create an undo
  revision. *(AR-05, AR-19)*
- **R1.7 — Failed read fallback.** A synchronous throw, rejection, or non-string result shall emit
  only `clipboard:host clipboard read failed` and, after destination validation, deliver the
  then-canonical app-local value exactly once. Earlier ordered success may therefore become a later
  failure's fallback. *(AR-05, AR-07, AR-20)*
- **R1.8 — Continuous destination identity.** Each request shall capture the active scope, focused
  leaf-to-scope route, destination generation, lifecycle generation, and mount incarnations.
  Delivery shall occur only if all identities and tokens still match and the route remains mounted,
  visible, enabled, focusable, and active. Any focus transition, modal transition, unmount/remount,
  or teardown invalidates the request even if object identities later return. *(AR-06, AR-08)*
- **R1.9 — Ordered scheduling.** Native reads shall execute one at a time in gesture order without
  blocking rendering or input dispatch. Each accepted request produces at most one insertion.
  A failed or invalid earlier request shall not reorder a later request. *(AR-07, AR-17)*
- **R1.10 — Teardown.** `stop()`/dispose shall invalidate queued and in-flight reads before detaching
  adapters. Late settlements shall not adopt text, warn, route, repaint, or touch a stopped host.
  Pending writer rejections shall likewise produce no post-stop warning. *(AR-08, AR-13)*
- **R1.11 — Byte boundary.** Direct host results shall be limited to `PASTE_CAP_BYTES` UTF-8 bytes by
  a reusable core helper. It shall never retain a partial UTF-8 scalar and shall set `truncated`
  exactly when input exceeds the cap. The bounded value—not the discarded suffix—becomes canonical.
  *(AR-09)*
- **R1.12 — Widget parity.** Accepted results shall use the existing paste path for `Input`,
  `Editor`/`Memo`, and `CodeEditorView`, preserving validators, read-only behavior, selection
  replacement, revision tracking, line-ending policy, and one undo step. Empty paste is a no-op in
  every widget. *(AR-12, AR-19)*

### Should have

- **R1.13 — Minimal public surface.** Reuse existing `Commands.paste`, `PasteEvent`, focus manager,
  modal scope, and loop lifecycle concepts rather than introducing a second insertion API.
  *(AR-03, AR-06)*
- **R1.14 — Direct-host usability.** Public JSDoc shall show a practical injected reader/writer
  example and state request-only reads, optional failure, ordering/focus guarantees, fallback, raw
  text, and byte truncation. *(AR-03, AR-16)*

### Won't have

- Any excluded behavior listed in the requirements index. *(AR-14)*
- Continuous monitoring, automatic retry, a framework timeout, or cancellation added to the public
  callback signatures. A never-settling adapter may stall later queued native requests without
  blocking the rest of the UI. *(AR-07, AR-14, AR-17)*

## Technical requirements

### Public and package boundaries

- `@jsvision/ui` may import only public `@jsvision/core` APIs.
- The bounded helper shall live with core input/paste safety and be exported with complete JSDoc and
  an `@example`.
- Event-loop adapter ownership shall be cleared during run teardown without changing browser
  outbound clipboard behavior.

### Concurrency invariant

For request `n`, delivery is allowed only when:

```text
running(n)
AND lifecycleGeneration(n) == currentLifecycleGeneration
AND destinationGeneration(n) == currentDestinationGeneration
AND scope(n) == currentScope
AND focusedLeaf(n) == currentFocusedLeaf
AND captured route and mount incarnations are unchanged
AND every route node remains mounted, visible, and enabled
AND the focused leaf remains focusable
```

The check and the subsequent synchronous `PasteEvent` dispatch form one JavaScript turn with no
`await` between them. *(AR-06, AR-08)*

### UTF-8 boundary

The core helper shall:

1. validate a finite non-negative integer byte limit;
2. allocate no byte buffer larger than that limit;
3. use `TextEncoder.encodeInto` so no partial scalar is written;
4. return the original string unchanged when fully encoded;
5. decode only the completed byte prefix when truncated; and
6. report `{ text, truncated }` without retaining the discarded suffix. *(AR-09)*

## Integration points

| Integration | Contract |
|---|---|
| `@jsvision/core` input safety | Owns cap constant, bounded-text helper, and `PasteEvent.truncated`. |
| UI event loop | Owns canonical state, request queue, generations, target guard, fallback, and warnings. |
| Application/run host | Installs optional callbacks or the existing OSC 52 writer, then clears them on teardown. |
| Editable widgets | Continue consuming commands and `PasteEvent` through current insertion paths. |
| Browser host | Existing outbound Clipboard API bridge remains unchanged; no browser read is added. |

## Scope decisions

| Decision | Options considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Reader scheduling | Concurrent ordered drain / serialized queue | Serialized queue | One helper at a time, deterministic, no reorder buffer | AR-07 |
| Target proof | Endpoint identity / continuity tokens / widget hook | Continuity tokens with loop routing | Reject leave-return/remount races without a second widget contract | AR-06 |
| String bound | UI-local / encode-all / bounded core helper | Bounded core helper | One safety owner and bounded allocation | AR-09 |
| Failure fallback timing | Gesture snapshot / ordered canonical value | Ordered canonical value | Later failure repeats earlier adopted success | AR-05, AR-07 |

## Security considerations

- **Data sensitivity:** Clipboard text may contain secrets or personal data; it remains in memory and
  is never logged, serialized, previewed, or placed in error metadata.
- **Input validation:** Host return type and byte limit are validated. Text remains raw data and is
  never interpreted as terminal sequences, shell commands, HTML, paths, or code.
- **Authentication/authorization:** Not applicable to this local callback API; the host environment
  owns clipboard permission. JSVision invokes reads only for explicit paste commands.
- **Injection:** UI never shells out. Host text is delivered only to established widget insertion
  paths. OSC output continues to use the existing sanitized core encoder.
- **Encryption:** No persistence or network transport is added; encryption at rest/in transit is not
  applicable.
- **Rate limiting/backpressure:** Only one native read is active. No polling or retry loop exists.
- **Secrets:** No credentials or configuration secrets are introduced.
- **Diagnostics:** Only stable payload-free warnings are allowed.

## Acceptance criteria

1. [ ] Given selected Unicode text and a configured writer, one copy command commits the exact text
   locally and invokes the writer exactly once with the same raw string.
2. [ ] A synchronous writer throw and rejected writer promise leave canonical text available and
   produce exactly `clipboard:host clipboard write failed`, with no payload or error details.
3. [ ] With no adapters, outbound OSC 52 capability behavior and synchronous local paste match the
   baseline.
4. [ ] A configured reader is invoked once for an unconsumed `Commands.paste` and never for a
   decoded bracketed `PasteEvent`.
5. [ ] A successful read delivers and adopts exactly one bounded result; a later local paste repeats
   it.
6. [ ] A successful empty read clears canonical state without insertion, selection deletion, stale
   fallback, or undo revision.
7. [ ] Sync throw, rejection, and non-string read result each warn generically and deliver the
   ordered canonical fallback once.
8. [ ] Two reads whose adapter would otherwise settle differently are started and delivered in
   gesture order with no more than one adapter call active.
9. [ ] Focus away/back, modal open/close, target unmount/remount, hidden/disabled ancestry, and loop
   teardown each discard the pending result with no adoption, insertion, warning after stop, or
   repaint.
10. [ ] Exactly-cap text is unchanged; over-cap ASCII and multibyte text is an exact UTF-8 prefix no
    larger than 1,048,576 bytes with `truncated: true` and no split scalar.
11. [ ] `Input`, `Editor`/`Memo`, and `CodeEditorView` retain validator/read-only/selection/undo and
    line-ending behavior when receiving native results.
12. [ ] Public APIs have junior-readable JSDoc and practical examples with no OS-package types.
