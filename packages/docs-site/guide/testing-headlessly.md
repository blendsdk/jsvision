---
title: Testing headlessly
description: Build deterministic headless JSVision tests for exact frames, routed input, modal workflows, resize, failures, and cleanup with no TTY.
---

# Testing headlessly

## Who is this course for?

This course is for developers who can already compose [The application
shell](/guide/application-shell) and route [Events, commands &
keymaps](/guide/events-commands-and-keymaps), but need fast, repeatable evidence without opening a
terminal. A headless test runs the real layout, renderer, focus manager, event loop, commands, and
view cleanup against an in-memory cell buffer.

By the end you can **build** a headless fixture, **explain** which layer it proves, **diagnose**
false or flaky evidence, and **verify** exact frames, input, modal settlement, resize, failures, and
teardown. The motivating problem is a screen whose state tests pass while its visible layout,
focus route, or cleanup is broken.

This course uses no embedded terminal laboratory. The authentic runnable artifact is a real Vitest
module and its deterministic test-runner output. An interactive browser terminal would demonstrate
the application again, not the behavior of its test harness.

## What is the headless-testing mental model?

The same retained tree can be driven at three evidence layers:

```text
createRenderRoot  → layout + draw → ScreenBuffer
createEventLoop   → focus + input + modal + resize → ScreenBuffer
createApplication → complete shell + commands → EventLoop → ScreenBuffer
```

No TTY is involved until `app.run()`. `createApplication()` mounts its shell synchronously, and a
bare event loop paints when you call `mount()`. Read `renderRoot.buffer()` to observe what a host
would receive. State counters explain causes; cells prove user-visible outcomes.

Choose the narrowest real layer that owns the behavior. Use a render root for drawing, an event loop
for routed interaction, and an application for shell or command integration. Adding a fake terminal
to a layout test only creates more failure modes.

## How do I get the first useful rendered result?

Start with direct public APIs. Extract shared construction only after this smallest path is clear:

```ts
import { resolveCapabilities } from '@jsvision/core';
import { Text, createRenderRoot } from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const render = createRenderRoot({ width: 12, height: 1 }, { caps });
render.mount(new Text('Ready'));

expect(render.buffer().get(0, 0)?.char).toBe('R');
render.unmount();
```

`mount()` performs the first layout and paint synchronously. The exact first cell proves placement
and content; “some non-space cell exists” would not distinguish `Ready` from an unrelated warning.

For a complete mounted shell, pass fixed capabilities and geometry:

```ts
import { resolveCapabilities } from '@jsvision/core';
import { Group, createApplication } from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const content = new Group();
const app = createApplication({
  caps,
  content,
  viewport: { width: 40, height: 10 },
});

expect(app.loop.renderRoot.buffer().width).toBe(40);
app.loop.dispose();
```

Do not call `run()` for this test. `run()` crosses the Node host and normally requires a TTY;
headless evidence drives `app.loop` directly.

## What is the authentic runnable artifact?

The repository contains two parts:

- `src/example-fixtures/testing-headlessly/application-fixture.ts` builds one deterministic
  application fixture from public APIs.
- `test/testing-headlessly-example.spec.test.ts` is a real Vitest module that drives the fixture,
  inspects rendered cells, resizes it, and disposes it.

Run it with:

```sh
yarn workspace @jsvision/docs-site vitest run --project unit \
  test/testing-headlessly-example.spec.test.ts
```

The expected output is a passing test module, not a copied terminal transcript. The module is kept
small enough to read as course material but remains executable so API drift cannot silently change
the lesson.

## How do I inspect exact rendered cells and frames?

A `ScreenBuffer` exposes dimensions and rows of cells. Each cell carries `char`, `fg`, `bg`,
`attrs`, and display `width`:

```ts
import { Attr, defaultTheme } from '@jsvision/core';

const buffer = app.loop.renderRoot.buffer();
const cell = buffer.get(2, 1);

expect(cell).toMatchObject({
  char: '>',
  fg: defaultTheme.buttonFocused.fg,
  bg: defaultTheme.buttonFocused.bg,
  attrs: defaultTheme.buttonFocused.attrs ?? Attr.none,
});
```

Use exact cell assertions for anchors and boundaries. Convert a small region to text when a
relationship matters:

```ts
const lines = buffer.rows().map((row) => row.map((cell) => cell.char).join(''));

expect(lines[1]?.slice(2, 12)).toBe('Saved     ');
expect(lines[2]?.slice(2, 12)).toBe('Items: 3  ');
```

Avoid a self-authored status flag such as `rendered = true`; it can turn true even when the view is
clipped or behind another child. A specific row or cell must agree with the underlying state.

A snapshot can help review a bounded, deterministic region. Keep it small, name the state that
produced it, and combine it with specific semantic assertions. Large whole-screen snapshots create
noise and are easy to update without understanding a regression.

## How do I make capabilities, viewport, and scheduling deterministic?

Inject a fixed capability profile. Never let a developer's terminal environment decide test
glyphs, widths, or colour depth:

```ts
import { resolveCapabilities } from '@jsvision/core';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'narrow' },
  },
}).profile;
```

Use an explicit viewport in every geometry assertion. Test more than one meaningful size when
wrapping, clipping, or responsive placement is part of the contract.

Out-of-tick invalidation normally queues a microtask. Capture and drain it instead of sleeping:

```ts
import { createEventLoop } from '@jsvision/ui';

const pending: Array<() => void> = [];
const loop = createEventLoop({ width: 30, height: 6 }, { caps, scheduleMicrotask: (flush) => pending.push(flush) });

view.invalidate();
expect(pending).toHaveLength(1);
pending.shift()?.();
```

Avoid `setTimeout`, arbitrary sleeps, and timing tolerances. They test machine load rather than the
framework boundary. Inject a clock or scheduler when time itself is the subject.

## How do I drive input, focus, and commands?

Dispatch decoded input through the real loop. Keyboard targets the focused route; mouse input uses
one-based screen coordinates and real hit-testing:

```ts
loop.focusView(editor);
expect(loop.getFocused()).toBe(editor);

loop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 4, y: 3 });
loop.emitCommand('document.save');
```

After each action, assert the owned state and the visible frame. For example, check that a handled
counter changed exactly once, the command handler ran once, and an exact cell now contains the
saved marker. Calling `view.onEvent()` directly can unit-test a branch, but it does not prove focus,
hit-testing, bubbling, keymaps, command precedence, or the automatic trailing frame.

Use both keyboard and mouse paths when both are promised. Assert `event.local`-dependent behavior
for pointer routing instead of assigning a “mouse” label in the test fixture.

## How do I settle modal workflows?

`execView()` opens a modal scope and returns its result promise. End it through the real modal host,
then await settlement:

```ts
const before = loop.getFocused();
const result = loop.execView<string>(dialog);

expect(loop.getFocused()).toBe(dialogField);
loop.endModal('accepted');

await expect(result).resolves.toBe('accepted');
expect(loop.getFocused()).toBe(before);
```

Assert input confinement while the modal is open: the modal receives the key, the background stays
unchanged, and focus restores after the promise settles. To test validation veto, track settlement
with a synchronously controlled promise step; do not race the promise against a timer.

Disposal settles pending modal work with `undefined`. That is a separate teardown outcome, not a
user cancellation result.

## How do I verify resize and reflow?

Call the loop boundary a host would call:

```ts
loop.resize({ width: 64, height: 18 });

const buffer = loop.renderRoot.buffer();
expect(buffer.width).toBe(64);
expect(buffer.height).toBe(18);
expect(workspace.bounds.width).toBeGreaterThan(30);
```

`loop.resize()` updates the buffer, invalidates layout, reflows the complete tree, and paints one
frame. Assert new bounds plus an anchor in the resized buffer. A width assertion alone cannot prove
that children used the extra space; a child-bound assertion alone cannot prove the composed frame
matches.

Test a constrained viewport too. Verify intentional wrapping or clipping and confirm that controls
needed for recovery remain reachable.

## How do I prove cleanup and suppress late work?

Acquire and release the resource in the same mounted owner:

```ts
owner.onMount(() => {
  const stop = subscribeToModel(() => owner.invalidate());
  owner.onCleanup(stop);
});

loop.dispose();
loop.dispose(); // idempotent: cleanup still ran exactly once
expect(cleanups).toBe(1);
```

`dispose()` stops deferred painting, settles modal work, unmounts the tree, clears routed ownership,
and releases application handlers. Calling it twice must be harmless.

For a timer, subscription, listener, promise continuation, or other late source, expose a
deterministic callback. Invoke it after disposal and assert that no state is published, no frame is
scheduled, and no sensitive payload enters diagnostics. A stale callback that silently mutates a
detached model is still a leak even if the old frame is no longer visible.

## How do I test failure paths?

Inject a bounded logger and make the owning draw, handler, or fixture dependency throw or reject.
When a draw throws, verify that the failure is logged and isolated while an unaffected sibling
remains unchanged.
The renderer records `String(error)` in a structured `error` field, so an application that may
process sensitive values must sanitize fields before they reach the sink:

```ts
import { createLogger, type Logger } from '@jsvision/core';
import { createRenderRoot } from '@jsvision/ui';

const ring = createLogger({ sink: 'ring', size: 10 });
const logger: Logger = {
  ...ring,
  error: (component, message, fields) =>
    ring.error(component, message, fields && Object.fromEntries(Object.keys(fields).map((key) => [key, '[redacted]']))),
};
const render = createRenderRoot({ width: 20, height: 2 }, { caps, logger, schedule: (flush) => flush() });
render.mount(treeWithThrowingChild);
```

Assert the failure is logged once, the diagnostic is redacted and bounded, and an unaffected sibling
still paints its exact cells. A test that expects only “no throw” can hide a blank frame. A test that
expects the raw exception message can normalize leaking user data into logs.

The compact wrapper above makes every structured value opaque. In production, use an explicit
allowlist for harmless diagnostic fields and redact everything else; do not forward an error string
merely because it arrived in a structured field.

Also test invalid input at its real boundary: malformed keymap construction, denied host
capability, rejected async work, or an impossible viewport. Keep true host externals behind narrow
stubs; keep layout, views, render roots, event loops, and applications real.

## How do specification, implementation, and browser evidence differ?

| Layer               | Owns evidence for                                               | Should not become                                  |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| Specification test  | Public behavior, user outcome, compatibility contract           | An assertion copied from private fields            |
| Implementation test | Internal edge, hardening path, algorithm or lifecycle invariant | A replacement for the public outcome               |
| Browser integration | xterm/DOM host wiring, browser keys, resize, clipboard policy   | The default home for host-neutral layout and state |

Specification evidence survives refactoring because it observes public behavior. Implementation
evidence explains an edge or internal invariant. Browser evidence proves the host boundary after
the same host-neutral application has passed headlessly.

Prefer real objects at all three layers. Use a mock or stub only for a true host external such as a
clock, filesystem, clipboard, terminal, or network adapter. A mocked view tree cannot prove
rendering or focus, and a DOM test is not required for a host-neutral frame.

## How do I compose a reusable headless fixture?

Extract repeated construction only after one direct test is clear. A fixture owns creation and
cleanup but keeps evidence visible:

```ts
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

export function createTestFixture() {
  const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
  const app = createApplication({
    caps,
    content: buildContent(),
    viewport: { width: 40, height: 10 },
  });
  return { app, dispose: () => app.loop.dispose() };
}
```

Return meaningful views or state that a test must drive; do not return a `passed` flag. Keep fixture
data local to each test. Mutable global applications leak focus, commands, modal stacks, and
reactive owners between cases.

Use `try/finally` when an assertion may throw:

```ts
const fixture = createTestFixture();
try {
  expect(fixture.app.loop.renderRoot.buffer().get(0, 0)?.char).toBe('R');
} finally {
  fixture.dispose();
}
```

## What belongs in advanced headless testing?

- Inject `scheduleMicrotask` or a clock to prove coalescing and multi-click timing exactly.
- Compare Unicode/ASCII and colour-depth profiles only when fallback meaning is part of the feature.
- Assert damage or draw counts only for a documented performance or invalidation contract.
- Drive overlapping async generations with controlled promises; publish only the newest owner.
- Test browser integration separately with a headless xterm implementation when `@jsvision/web`
  behavior is the subject.
- Keep security fixtures bounded and synthetic. Never read visitor files, clipboard, network, or
  environment secrets implicitly.

Measurements from a development machine are informational evidence, not performance guarantees.
Name the viewport, capability profile, fixture size, and code revision when reporting them.

## How do I diagnose false or flaky evidence?

| Symptom                                     | Cause                                                      | Correction                                                           | Evidence                                                |
| ------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| Test passes while the screen is blank       | It asserts a self-reported state flag                      | Assert exact visible cells and one owning state transition           | Expected glyphs occupy their intended coordinates       |
| Snapshot changes on another machine         | Capabilities or viewport came from the environment         | Inject both explicitly                                               | The same bounded frame is produced locally and in CI    |
| Test sometimes passes after a delay         | It sleeps instead of controlling scheduling                | Capture the scheduler, clock, or promise settlement                  | One explicit drain produces one expected frame          |
| Key test passes but users cannot trigger it | The test called `onEvent()` or a handler directly          | Dispatch through the mounted loop with real focus                    | Handled count and visible frame change once             |
| Modal test hangs                            | No real `endModal()` or disposal path settles `execView()` | Drive the closing command and await its result                       | Result, input confinement, and restored focus all agree |
| Resize assertion misses clipped content     | It checks buffer dimensions only                           | Assert child bounds and exact post-resize anchors                    | Geometry and composed cells agree at both viewports     |
| Cleanup count passes but late state changes | The callback was counted, not invoked after disposal       | Fire the retained callback and assert complete post-teardown inertia | No publish, scheduled frame, or extra diagnostic occurs |
| Failure test exposes payload text           | It expects a raw error message in diagnostics              | Assert category/count and redaction instead                          | Bounded logs contain no fixture secret                  |

## What are the best practices?

- Assert user-visible cells and owning state together so neither can lie about the other.
- Fix capabilities, viewport, scheduling, clocks, and asynchronous settlement at the test boundary.
- Dispatch through real focus, hit-testing, keymap, command, and modal routes.
- Keep one fixture per test and always dispose it, preferably in `finally`.
- Use exact assertions for stable anchors and bounded snapshots only for small relationships.
- Separate public specification, internal implementation, and browser-host evidence.
- Prefer real framework objects; stub only true host externals.
- Exercise failure and teardown paths, including callbacks that arrive after disposal.

## What should I practice next?

Treat each exercise as an observable experiment:

1. **Frame:** mount a two-line view and assert exact characters, styles, and a bounded snapshot.
2. **Input:** focus one leaf, dispatch keyboard and mouse input, and prove handled state plus cells.
3. **Modal:** open a dialog, verify background input confinement, settle it, and assert restored focus.
4. **Resize:** compare bounds and exact anchors at wide and constrained viewports.
5. **Cleanup:** dispose twice, fire a retained callback, and prove exact cleanup plus late-work inertia.
6. **Failure:** make one child throw, verify bounded redacted diagnostics, and prove its sibling frame.

Return to [Running in the browser](/guide/running-in-the-browser) when the host boundary itself needs
browser evidence. Use [Writing your own widget](/guide/writing-your-own-widget) when measurement,
drawing, or clipping behavior belongs to a custom `View`.

Public API:

- [`createApplication()`](/api/ui/functions/createApplication)
- [`createEventLoop()`](/api/ui/functions/createEventLoop)
- [`createRenderRoot()`](/api/ui/functions/createRenderRoot)
- [`EventLoop`](/api/ui/interfaces/EventLoop)
- [`RenderRoot`](/api/ui/interfaces/RenderRoot)
- [`resolveCapabilities()`](/api/core/functions/resolveCapabilities)
