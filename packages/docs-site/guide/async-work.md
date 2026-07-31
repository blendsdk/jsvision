---
title: Async work, cancellation & progress
description: A beginner-to-advanced course on responsive async work, cancellation, progress, errors, cleanup, and stale-result protection in JSVision.
---

# Async work, cancellation & progress

Terminal applications still wait for searches, loads, exports, synchronization, and reports. The
difference between a responsive application and a frozen one is not whether it uses `async`; it is
whether long work yields, reports honest state, and loses permission to publish when it is
cancelled or superseded.

This course develops that workflow from one promise to production-aware ownership. The examples use
deterministic in-memory work so their timing is observable without granting network, filesystem, or
clipboard access.

## Who this course is for

This course is for developers who already know [Reactive state](/guide/reactive-state) and are
comfortable with the result and focus rules in
[Dialogs & modality](/guide/dialogs-and-modality). You should know how a signal drives a view and
how a mounted view owns cleanup. You do not need prior experience with cancellation protocols.

By the end, you will be able to:

- build a responsive search, load, export, or report workflow with truthful progress;
- explain why an async callback does not make CPU-heavy work responsive by itself;
- diagnose cancellation races, stale results, leaked timers, and unsafe diagnostics; and
- verify that cleanup runs once and that cancelled or superseded work cannot publish success.

The beginner boundary is one pending operation with explicit state. The intermediate boundary adds
progress, cancellation, errors, and retry. The advanced boundary covers overlapping generations,
deterministic seams, teardown, accessibility, and safe production diagnostics.

## Mental model

Treat an operation as an owned state machine, not as “a promise plus a spinner”:

```text
idle ──start──> running ──complete──> success
                   │  ├──fail──────> error
                   │  └──abort─────> cancelled
                   └──superseded───> stale (discarded)
```

The owner starts the operation, owns its timer or controller, accepts progress, and decides whether
a completion may publish. A promise carries eventual data; it does not carry ownership, freshness,
or a user-visible state model.

| Concern      | Owner records                        | Publication rule                       |
| ------------ | ------------------------------------ | -------------------------------------- |
| Lifecycle    | controller, timer stop, subscription | release exactly once                   |
| Feedback     | state, progress, diagnostic          | describe what is true now              |
| Cancellation | `AbortSignal` and generation         | cancelled work never publishes success |
| Freshness    | monotonically increasing generation  | only the latest generation publishes   |

Input dispatch and asynchronous completion are separate turns. Dispatch does not await an async
command or callback. The handler must start work, return promptly, and let later continuations write
reactive state.

## Your first responsive async result

Start by storing the visible state before awaiting the operation. Keep failure distinct from a
successful result:

```ts
import { signal } from '@jsvision/ui';

const state = signal('idle');
const result = signal<string | null>(null);
const error = signal<string | null>(null);

async function loadReport(): Promise<void> {
  state.set('running');
  error.set(null);
  try {
    result.set(await fetchReport());
    state.set('success');
  } catch {
    error.set('The report could not be loaded.');
    state.set('error');
  }
}
```

`fetchReport()` represents an application service. The command that calls `loadReport()` should
not await it inside input dispatch; start it with `void loadReport()` and let the state signals
drive feedback.

When a timer, Promise continuation, or async callback writes a signal outside an input tick,
JSVision schedules an automatic deferred microtask repaint. A burst of writes in the same turn is
coalesced into one paint. Routine async work therefore needs neither `renderRoot.flush()` nor a
no-op command; those are test and rendering internals, not application synchronization APIs.

## Model work state explicitly

A boolean such as `loading` cannot distinguish initial, successful, failed, and cancelled output.
Use a discriminated union so every state carries only valid data:

```ts
import { signal } from '@jsvision/ui';

type WorkState<T> =
  | { kind: 'idle' }
  | { kind: 'running'; progress: number }
  | { kind: 'success'; value: T }
  | { kind: 'error'; message: string }
  | { kind: 'cancelled' };

const work = signal<WorkState<string>>({ kind: 'idle' });
```

The everyday states are `idle`, `running`, `success`, `error`, and `cancelled`. Error is a separate
discriminant from result or success, so old data cannot accidentally look like the new operation's
answer. A cancelled state is also terminal for that attempt: it cannot later become success.

Keep the last good result only when the product deliberately supports stale-while-refresh. If you
do, label it as previous data while `running`; do not let its presence masquerade as current
success.

## Progress and responsive boundaries

Determinate progress is a bounded fraction from `0` through `1`. `ProgressBar` clamps reads outside
that range, but the producer should still calculate a meaningful ratio:

```ts
import { ProgressBar, signal } from '@jsvision/ui';

const progress = signal(0);
const bar = new ProgressBar({
  value: progress,
  caption: true,
  label: 'Exporting',
  labelPosition: 'left',
});

progress.set(completedUnits / totalUnits);
```

Use [Progress bar](/components/feedback/progress-bar) when total work is known. Use
[Spinner](/components/feedback/spinner) when duration is unknown. Neither widget makes work
asynchronous; both render state owned by the caller.

An `async` function can still freeze the application if it performs one large synchronous loop.
Split CPU work into bounded chunks and yield between them so input and render work remain
responsive:

```ts
async function processRows(rows: readonly Row[]): Promise<void> {
  const chunkSize = 200;
  for (let start = 0; start < rows.length; start += chunkSize) {
    processChunk(rows.slice(start, start + chunkSize));
    progress.set(Math.min(1, (start + chunkSize) / rows.length));
    await yieldToHost();
  }
}
```

Choose chunk size by measurement: too large feels unresponsive, while too small spends excessive
time scheduling. A host seam such as `yieldToHost` also lets a test advance boundaries
deterministically.

### Primary laboratory: responsive cancellation

<PlayExample id="guides/cancellable-work"
  title="Cancellable Work Laboratory"
  blurb="Advance bounded progress, prove input remains responsive, then cancel, fail, retry, and inspect exact cleanup."
/>

Start the job, press H between progress steps, then cancel it. Compare the cancelled and error
routes before retrying. The fixture has no clock or privileged host access, so every transition is
bounded and repeatable.

## Cooperative cancellation

JavaScript cannot safely interrupt arbitrary code. `AbortController` owns the request to cancel;
its `AbortSignal` is passed to work that cooperatively checks or observes `abort`:

```ts
import { onCleanup } from '@jsvision/ui';

const controller = new AbortController();
onCleanup(() => controller.abort());

async function run(): Promise<void> {
  const value = await service.load({ signal: controller.signal });
  if (controller.signal.aborted) return;
  result.set(value);
  state.set('success');
}
```

Check the signal before expensive chunks and again after every `await`, immediately before
publication. An abort can happen while the promise is settling. A cancelled attempt must never
publish success even when the underlying service cannot stop its physical work.

Acquire and release in the same owner. Timers, subscriptions, and controllers belong beside an
`onCleanup()` that stops, clears, unsubscribes, or aborts them:

```ts
import { onCleanup, runSpinner, signal } from '@jsvision/ui';

const frame = signal(0);
const stop = runSpinner(frame, { timer: app.runtime, intervalMs: 80 });

let stopped = false;
const stopOnce = (): void => {
  if (stopped) return;
  stopped = true;
  stop();
};
onCleanup(stopOnce);
```

Cleanup should be exactly once in effect and repeat-safe in implementation. `runSpinner` already
returns an idempotent stop function; the explicit guard illustrates the same invariant for a mixed
resource release function.

## Errors and retry

Cancellation is expected control flow; failure is a diagnostic state. Do not report an abort as a
network error, and do not preserve a previous error when a fresh attempt begins:

```ts
async function runAttempt(controller: AbortController): Promise<void> {
  try {
    const value = await service.load({ signal: controller.signal });
    if (controller.signal.aborted) return;
    work.set({ kind: 'success', value });
  } catch (cause) {
    if (controller.signal.aborted) {
      work.set({ kind: 'cancelled' });
      return;
    }
    work.set({ kind: 'error', message: safeMessage(cause) });
  }
}
```

Retry is a new attempt, not a continuation of a failed one. Create a fresh controller and fresh
generation, clear per-attempt progress and error state, then start again. Reusing an aborted signal
makes the retry cancel immediately; reusing an identity lets an older completion masquerade as the
retry.

Display diagnostics at a trust boundary:

```ts
import { sanitize } from '@jsvision/core';

function safeMessage(value: unknown): string {
  const generic = value instanceof Error ? value.message : 'Operation failed';
  return sanitize(generic).slice(0, 120);
}
```

`sanitize()` removes unsafe control characters from untrusted display text. Bound or truncate the
diagnostic so geometry remains predictable. Redact secrets, tokens, paths, and raw payload data
before this point; sanitizing terminal controls does not make sensitive content safe to reveal.

## Latest result wins

Search-as-you-type and route-driven loads can overlap. Completion order does not determine
freshness. Capture a request id or generation when work starts and compare it with the latest
generation before publishing:

```ts
let latestGeneration = 0;

async function search(query: string): Promise<void> {
  const generation = ++latestGeneration;
  const matches = await service.search(query);
  if (generation !== latestGeneration) return; // Drop stale completion.
  results.set(matches);
}
```

Cancellation saves resources when the service supports it; a generation guard preserves
correctness even when it does not. Use both. On dispose or unmount, increment or otherwise
invalidate the generation and abort every pending controller. That prevents a pending completion
from publishing into a detached view.

<PlayExample id="guides/latest-result-wins"
  title="Latest Result Wins Laboratory"
  blurb="Overlap two requests, complete them out of order, drop the stale generation, and publish only the newest result."
/>

Request a pair, complete the newest request first, then deliver the older one. Its completion is
real, but its generation has lost publication authority.

## Composition and integration

Async work crosses several JSVision concerns:

| Concern        | Integration rule                                                                  |
| -------------- | --------------------------------------------------------------------------------- |
| Reactive state | services write source signals; views derive labels and enabled states             |
| Commands       | handlers start work and return; they do not block dispatch awaiting it            |
| Dialogs        | cancellation or close invalidates pending work before resolving the modal         |
| Focus          | keep progress controls passive; leave focus on Cancel, Retry, or the working form |
| Hosts          | inject the authorized transport, scheduler, clock, or timer seam                  |
| Themes         | preserve textual state when colour or glyph capability degrades                   |

Progress feedback must be truthful without colour. Pair a bar or spinner with a label such as
“Running”, “Cancelled”, or “3 of 10”. `ProgressBar` uses `progressFill` and `progressTrack`; its
optional label uses `staticText`. `Spinner` uses `staticText` for its glyph and `label` for its
label. Ensure all four roles remain distinguishable, but never make hue the only state cue.

Unicode spinner presets fall back to an ASCII `line` animation. Design for monochrome output and
ASCII fallback cues from the start. In reduced-geometry or small-viewport layouts, keep the main
state and cancellation action visible, wrap bounded diagnostics, and let secondary detail clip or
move below rather than clipping controls.

## Advanced lifecycle behavior

Owned async work needs two gates:

```ts
import { onCleanup } from '@jsvision/ui';

let generation = 0;
const controllers = new Set<AbortController>();

onCleanup(() => {
  generation += 1;
  for (const controller of controllers) controller.abort();
  controllers.clear();
});
```

The abort gate asks cooperative services to stop. The generation gate rejects late publication
even if a service ignores abort or has already completed. Disposal must invalidate first or during
the same synchronous cleanup and leave no pending controller reachable.

For tests, inject the scheduler, clock, timer, or transport seam so the workflow is deterministic.
Advance it explicitly and assert state before and after each completion. Never make correctness
depend on a sleep or wall-clock race.

Production code should also decide:

- whether progress is units completed, bytes acknowledged, or phases finished;
- whether cancellation waits for service acknowledgement or updates the UI immediately;
- whether retry uses backoff and who authorizes another host request; and
- how much diagnostic detail is safe for the current audience.

Those are application policies. The framework supplies reactive ownership and feedback controls,
but it cannot decide them.

## Failure modes and diagnosis

Use observable evidence to distinguish failures that can look similar:

| Symptom                                               | Likely cause                                     | Correction                                                 | Distinguishing evidence                                    |
| ----------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| UI is frozen or unresponsive                          | CPU loop is blocking without a yield             | process bounded chunks and await a host yield              | heartbeat/input resumes only at the final completion       |
| Cancelled work published success                      | publication omitted an abort or generation check | gate immediately after each await                          | success appears after the cancel transition                |
| Percent is below 0 or above 100                       | producer emitted progress out of range           | calculate a bounded ratio; rely on bar clamping as defense | source signal differs from the clamped display             |
| Older result overwrites a newer result                | completion time was treated as freshness         | capture generation and ignore stale completion             | request ids show the older generation published last       |
| Timer, subscription, or controller runs after unmount | resource was not owned by cleanup                | stop or abort in `onCleanup` exactly once                  | callbacks or handles remain after disposal                 |
| Error leaks a secret, payload, or unsafe text         | raw host failure was displayed                   | redact, sanitize, and bound diagnostic text                | captured output contains control bytes or sensitive fields |

If progress stops but input still works, inspect the producer or transport rather than the event
loop. If both stop, inspect synchronous chunks. If cancellation changes the label but not resource
counts, the UI state moved without releasing its owned controller.

## Best practices

- Model state with a discriminated union. Independent booleans permit impossible combinations such
  as “success” and “cancelled” at once.
- Start work from a command and return promptly. Awaiting long application work in dispatch delays
  subsequent input.
- Yield CPU-heavy work in measured chunks. A promise around one blocking loop is still blocking.
- Own every timer, subscription, controller, and spinner stop function. Missing cleanup leaks work
  into later screens; double cleanup often hides confused ownership.
- Combine cooperative abort with a generation guard. Abort saves resources; generation identity
  protects publication.
- Give retry a fresh controller, generation, and diagnostic state. Reusing attempt state preserves
  cancellation and stale authority.
- Sanitize, redact, and bound diagnostics before display. Terminal safety, confidentiality, and
  geometry are separate obligations.
- Test through injected deterministic seams. Wall-clock sleeps make cancellation and stale-result
  races slow and unreliable.

## Practice and next steps

1. Extend the cancellation laboratory so four progress advances produce success, then prove Cancel
   can no longer change that completed attempt.
2. Add a retryable error category and verify that retry clears the old error while creating a fresh
   controller.
3. Request three generations, complete them in reverse order, and verify that two stale results are
   discarded while only the latest publishes.
4. Resize each laboratory to a small viewport and identify which status, action, and diagnostic
   information must remain visible.

Continue with Forms or Files when you need full workflows that consume async state. The Data Grid
and Code Editor specialist courses own their component-specific loading, virtualization, and
editing behavior; this course owns the cross-cutting cancellation and publication model.

Related documentation:

- [Reactive state](/guide/reactive-state)
- [Dialogs & modality](/guide/dialogs-and-modality)
- [Progress bar](/components/feedback/progress-bar) and
  [Spinner](/components/feedback/spinner)
- [`ProgressBar` API](/api/ui/classes/ProgressBar) and
  [`Spinner` API](/api/ui/classes/Spinner)
- [`runSpinner`](/api/ui/functions/runSpinner)
- [`createRoot`](/api/ui/functions/createRoot)
- [`sanitize`](/api/core/functions/sanitize)
