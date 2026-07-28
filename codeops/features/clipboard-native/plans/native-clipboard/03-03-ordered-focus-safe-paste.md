# Component: Ordered Focus-safe Native Paste

> **Implements**: RD-01 R1.6–R1.9, R1.12, R1.14
> **Status**: Ready for execution
> **CodeOps Artifact Schema**: 1

## Responsibility

Translate an eligible unhandled `Commands.paste` gesture into one asynchronous native read while
preserving gesture order and proving the original paste destination stayed continuously valid.

## Command flow

```text
paste command emitted
  ├─ existing application command sink handles → stop
  ├─ no reader configured → existing local command behavior
  └─ reader configured
       capture destination
       append read job to queue
       return to input/render loop immediately
```

Paste is considered command-available while a reader is installed even when canonical local text is
empty. All other commands and the no-reader path retain current registry enablement. Direct
`PasteEvent` input never invokes the reader.

## Captured request

Each request records:

- lifecycle generation;
- current modal scope root or application root;
- focused leaf and the exact leaf-to-scope route;
- focus/modal destination generation;
- mount-incarnation token for every route member.

Capture fails without scheduling a read if no eligible paste destination exists.

## Serialized scheduler

- Store a resolved queue-tail promise.
- Append one job per eligible gesture with both fulfillment and rejection normalization.
- Start job N only after N−1 fully settles, including its delivery/fallback decision.
- Never await the tail from the input dispatch tick.
- A rejection emits one stable payload-free warning and uses the canonical clipboard value read when
  that job reaches ordered delivery.
- No timeout, retry, coalescing, polling, or concurrent helper launch is added.

## Atomic delivery guard

Immediately before adoption/dispatch, synchronously require:

1. loop not stopped and lifecycle generation unchanged;
2. active modal/application scope is the captured scope;
3. destination generation unchanged;
4. every route object and mount-incarnation matches;
5. leaf remains mounted, visible, enabled, focusable, and focused in the captured scope.

If any check fails, discard the result without adoption, warning detail, event dispatch, or repaint.
If all pass, bound the successful native value or select the canonical fallback, construct the
ordinary `PasteEvent`, and dispatch without yielding between validation and dispatch.

## State transitions

| Outcome | Canonical adoption | Widget delivery | Warning |
|---|---:|---:|---:|
| Non-empty success, target valid | Bounded result | Once | No |
| Empty success, target valid | `""` | Once; edit no-op | No |
| Failure, target valid | Existing fallback via normal event adoption | Once | One stable message |
| Any settlement, target stale | None | None | No host detail |
| Settlement after stop | None | None | None |

An earlier successful request can update canonical state before a later failed request reaches
delivery; the later fallback therefore repeats the earlier adopted text as issue #191 requires.

## Generation mechanics

Increment the destination generation on focus or modal-scope transitions, including leave-and-return
cycles. Increment/replace a view's mount incarnation at every mount. Increment lifecycle generation
before disposal in `stop()`. Tokens are internal monotonic values and never serialized or logged.

## Verification

Use deferred fake readers to deterministically prove ordering, queue recovery, focus-away/back,
modal-open/close, remount, hidden/disabled/unfocusable targets, stop, empty success, fallback timing,
and absence of post-stop paint.
