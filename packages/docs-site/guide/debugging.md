---
title: Debugging
description: Diagnose JSVision layout, focus, rendering, command, capability, and host failures with safe bounded evidence.
---

# Debugging

## Who is this course for?

This course is for developers who can build [The application shell](/guide/application-shell) and
use [Testing headlessly](/guide/testing-headlessly), but need a reliable way to explain why a real
application looks wrong, ignores input, or fails only in one host. The motivating problem is a blank
or unresponsive screen where changing several things at once makes the symptom disappear without
revealing its cause.

By the end you can **build** a bounded diagnostic fixture, **explain** which subsystem owns each
fact, **diagnose** layout, focus, command, rendering, capability, and lifecycle failures, and
**verify** a correction with state and visible-frame evidence.

The beginner boundary is separating a symptom from a cause. Intermediate work correlates geometry,
focus, events, commands, reactive state, and frames. Advanced work covers safe live diagnostics,
host-specific evidence, failure isolation, late work, and production judgment.

## What is the debugging mental model?

Debugging is an observation ladder. Climb it in order:

1. **Reproduce** the failure with deterministic input.
2. **Minimize** the reproduction while keeping the same symptom.
3. **Classify** the boundary that could own it.
4. Inspect **geometry and layout** before changing sizes.
5. Inspect **focus** before changing key bindings.
6. Trace the **event and command** path before calling handlers directly.
7. Correlate **reactive state and render** work with the composed frame.
8. Compare the resolved **capability** profile with the expected fallback.
9. Inspect the **host lifecycle** and resource ownership.
10. **Correct** one cause at its owning boundary.
11. **Verify** the same reproduction and add a regression assertion.

```text
input → focus scope → event/keymap → command → state/invalidation → layout/draw → frame → host
```

Evidence narrows a hypothesis; a guess merely changes the application. Keep the same input and
fixture, change one variable, and repeat the observation. A “fix” that changes the reproduction is
not yet evidence that the original cause is gone.

## How do I get the first useful diagnosis?

Capture a bounded, screen-safe record before adding subsystem-specific instrumentation:

```ts
import { createLogger } from '@jsvision/core';

const log = createLogger({ sink: 'ring', size: 50 });
log.info('startup', 'workspace mounted', {
  viewport: { width: 80, height: 24 },
});

const recent = log.entries();
log.close();
```

The ring retains only the newest 50 records. Record stable categories and harmless structural facts,
not raw user values. The first useful result is a repeatable symptom plus one bounded observation at
the boundary most likely to own it.

<PlayExample id="guides/debugging-evidence"
  title="Debugging Evidence Laboratory"
  blurb="Inspect layout, focus, command, render, capability, and lifecycle evidence through one reproduce → classify → correct → verify ladder."
/>

## Laboratory: debugging evidence

Use Alt+L, Alt+F, Alt+C, Alt+R, Alt+P, and Alt+H to inspect each boundary. Every action keeps the
same synthetic fixture, reports **Symptom**, **Cause**, **Evidence**, and **Correction**, and appends
one stable code to a bounded diagnostic ring. Alt+V applies the selected correction and reports
verification against the same evidence.

The laboratory uses real mounted geometry, focus identity, command availability, reactive
publication, capability fields, and an application-owned resource. The unsafe fixture payload is
discarded; **Redaction: PASS** and **Payloads leaked: 0** remain visible. Try **Inspect layout** with
the mouse, then resize, maximize, and restore. No visitor files, clipboard, network, or terminal
stream are used.

## How do I reproduce and minimize a failure?

Write the reproduction as input, environment, expected outcome, and observed outcome. Fix the
viewport and capabilities, seed data locally, and remove unrelated timers, network calls, and
screens one at a time. Stop minimizing when the symptom changes.

```ts
import { resolveCapabilities } from '@jsvision/core';
import { Group, createEventLoop } from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const loop = createEventLoop({ width: 40, height: 8 }, { caps });
loop.mount(new Group());

// Drive the same decoded input on every run.
loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
loop.dispose();
```

A minimal reproduction is not the fewest lines at any cost. It must retain the real boundary under
investigation: use a real render root for layout, a real event loop for focus and routing, and the
real application shell for command or host integration.

## How do I classify the failing boundary?

Classify before instrumenting:

| Symptom                             | First boundary to inspect | Distinguishing evidence                            |
| ----------------------------------- | ------------------------- | -------------------------------------------------- |
| Missing or clipped content          | Layout                    | Solved bounds, parent content box, clip, viewport  |
| Keystroke reaches the wrong control | Focus                     | `getFocused()`, eligible ancestry, modal scope     |
| Visible action does nothing         | Event/command             | handled state, keymap result, command availability |
| State changes but cells stay old    | Reactive/render           | dependency, invalidation, draw count, exact cells  |
| Glyph, colour, or mouse differs     | Capability                | resolved profile and reason layer                  |
| Works headlessly but fails live     | Host lifecycle            | TTY facts, modes, input arrival, restore/cleanup   |

Start at the earliest boundary whose evidence disagrees. A blank frame with correct state is not
automatically reactive; zero-sized bounds prove layout owns the earlier failure.

## How do I inspect layout and clipping evidence?

Read solved rectangles after layout. Compare a view's `bounds` with its parent, the viewport, and any
absolute or clipping boundary:

```ts
import type { View } from '@jsvision/ui';

function geometry(view: View) {
  return {
    rect: view.bounds,
    parentRect: view.parent?.bounds ?? null,
    mounted: view.mounted,
    visible: view.state.visible,
  };
}
```

If either dimension is zero, inspect whether an auto-sized view implements `measure()`, whether the
parent has remaining space, and whether all children were placed out of flow. If bounds are positive
but the frame is blank, inspect clipping and paint order next.

Correlate layout with a bounded frame region:

```ts
import type { View } from '@jsvision/ui';

function rootOrigin(view: View) {
  let { x, y } = view.bounds;
  for (let parent = view.parent; parent !== null; parent = parent.parent) {
    x += parent.bounds.x;
    y += parent.bounds.y;
  }
  return { x, y };
}

const { x, y } = rootOrigin(view);
const buffer = app.loop.renderRoot.buffer();
const topLeft = buffer.get(x, y);
const row = buffer.rows()[y]?.slice(x, x + view.bounds.width);
```

Measure and layout decide rectangles; draw writes into those rectangles; the buffer proves what was
actually composed. A view's `bounds` are parent-relative, so add every ancestor offset before
indexing the root buffer. Preserve those root-relative coordinates with the diagnostic so a later
resize does not make the evidence ambiguous.

## How do I inspect focus and input routing?

Ask the loop for the current fact rather than trusting a highlight:

```ts
import type { EventLoop, View } from '@jsvision/ui';

function focusEvidence(loop: EventLoop, expected: View) {
  return {
    actual: loop.getFocused()?.constructor.name ?? 'none',
    expected: expected.constructor.name,
    focusable: expected.focusable,
    mounted: expected.mounted,
    disabled: expected.state.disabled,
  };
}
```

`getFocused()` identifies the leaf that receives keyboard input. Inspect whether it is mounted,
visible, enabled, focusable, inside an eligible ancestor chain, and inside the active modal scope.
Use `focusInto()` for a container; use `focusView()` for an exact eligible leaf.

Dispatch the same event through the mounted loop. Calling `onEvent()` directly skips focus,
hit-testing, modal confinement, bubbling, and the trailing frame.

## How do I inspect commands and reactive rendering?

Track handled input separately from command delivery:

```ts
let commandRuns = 0;
const stop = app.onCommand('workspace.refresh', () => {
  commandRuns += 1;
});

app.loop.emitCommand('workspace.refresh');
const evidence = {
  enabled: app.loop.isCommandEnabled('workspace.refresh'),
  commandRuns,
};
stop();
```

An event can be handled before a command is emitted, a command can be disabled, or a modal can
confine it. Inspect `event.handled`, the mapped command, `isCommandEnabled()`, and the registered
handler count in that order.

For reactive rendering, correlate source publication with invalidation, drawing, and cells:

```ts
import { Text, at, signal } from '@jsvision/ui';

const version = signal(0);
const readout = new Text(() => `version:${version()}`);
panel.add(at(readout, 0, 2, 20, 1));

const before = app.loop.renderRoot
  .buffer()
  .rows()[2]
  ?.map((cell) => cell.char)
  .join('');
version.set(version() + 1);
app.loop.renderRoot.flush();
const after = app.loop.renderRoot
  .buffer()
  .rows()[2]
  ?.map((cell) => cell.char)
  .join('');
```

Here `readout` is a direct child of the root-mounted `panel`, so row 2 is intentionally
root-relative; use the ancestor-offset helper from the layout lesson for nested panels. Assert that
`before` and `after` differ and that `after` contains `version:1`. If a signal changed but its view
did not draw, confirm that the mounted view read that signal inside an owned binding. If drawing ran
but cells stayed old, inspect clipping, z-order, and the exact frame. When size or position changes,
request layout invalidation rather than only repainting.

## How do capabilities explain degraded behavior?

Resolve a profile and keep its reason layers with the reproduction:

```ts
import { dumpCaps, resolveCapabilities } from '@jsvision/core';

const resolution = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: '16' },
});

const evidence = dumpCaps(resolution);
```

A degraded fallback is not necessarily a defect. Unicode, colour, mouse, alternate-screen, and
keyboard behavior follow the resolved capability profile. Compare the profile and reason with the
documented fallback, then test an explicit override. Do not infer support from a terminal name
alone.

Keep textual states such as `PASS`, `WARN`, `FAIL`, and `fallback: ASCII`; colour or a Unicode glyph
must not be the only diagnostic cue.

## How do I collect screen-safe logs and frame evidence?

An active TUI owns its output stream. `console.log` writes into that same terminal and can scribble
over or corrupt the composed screen. Use `createLogger()` with a bounded ring, a file, or stderr only
when the logger proves stderr is a different device:

```ts
import { createLogger } from '@jsvision/core';

const log = createLogger({
  sink: 'ring',
  size: 100,
  level: 'debug',
});
```

JSVision refuses an explicitly unsafe file or stderr sink. Development warnings detected while a
native screen session is active are withheld until terminal restoration and may be mirrored into
the configured screen-safe logger. That behavior is runtime plumbing; do not import internal
warning helpers.

Redact input before logging:

```ts
import { redactEvent } from '@jsvision/core';

const safe = redactEvent({
  type: 'paste',
  text: 'fixture-secret',
  truncated: false,
});
log.debug('input', 'paste received', { event: safe });
```

`redactEvent()` retains paste length, not paste text, and marks printable keys without retaining the
character. Never log raw input, paste text, tokens, secrets, clipboard contents, or visitor paths.
Sanitize or redact every diagnostic and minimal reproduction before sharing it.

Frame evidence should also be bounded. Record a small cell region with its coordinates, viewport,
capability profile, and expected semantic anchor. Whole-screen dumps are noisy and may include
private application data.

## How do I investigate host lifecycle and cleanup?

Acquire and release a resource in one owner:

```ts
import { onCleanup } from '@jsvision/ui';

const stop = subscribeToHost(() => refresh());
onCleanup(() => stop());
```

Use `onCleanup()` or the owning view's cleanup to release every timer, subscription, listener,
controller, file handle, or other resource. Call application or loop `dispose()` when a reusable
host detaches the app and verify idempotence:

```ts
app.loop.dispose();
app.loop.dispose();
```

For a late or stale callback, retain it deliberately, dispose its owner, invoke it, and prove the
disposed generation is ignored or suppressed. Cleanup counts alone are insufficient if a detached
model can still mutate or schedule a frame.

Native terminal symptoms require host evidence: TTY facts, raw mode, alternate screen, cursor state,
input arrival, and restoration. Use the application `run()` lifecycle; do not insert console writes
while the terminal is owned.

## How do I choose headless, terminal, or browser evidence?

Choose the narrowest environment that owns the symptom:

| Environment | Use it for                                                              | Do not require it for  |
| ----------- | ----------------------------------------------------------------------- | ---------------------- |
| Headless    | Deterministic cells, geometry, focus, commands, state, cleanup          | Native TTY modes       |
| Terminal    | TTY detection, raw mode, escape handling, input bytes, host restoration | Host-neutral layout    |
| Browser     | xterm/DOM wiring, web-host focus, resize, clipboard authorization       | Native signal behavior |

Start with the smallest headless reproduction. Move to a real terminal only when TTY, raw mode,
escape sequences, or restoration owns the symptom. Move to browser integration only when DOM,
xterm, authorization, or the web host differs. Keep the same application fixture where possible.

The prerequisite headless course owns detailed fixture construction, input routing, modal
settlement, and snapshot technique; this course uses those tools to choose and distinguish failure
boundaries.

## What belongs in advanced failure isolation?

Make one boundary fail while an unaffected sibling remains observable. A thrown draw, rejected host
operation, or failing command handler should produce a bounded diagnostic without turning every
feature blank.

```ts
type LoadResult = { ok: true; value: readonly string[] } | { ok: false; code: 'UNAVAILABLE' };

function publish(result: LoadResult): void {
  phase.set(result.ok ? 'ready' : 'error');
}
```

Prefer typed results at recoverable boundaries. For exceptions the framework isolates, record a
stable category and verify the sibling frame. Do not normalize raw exception strings as safe data.

For concurrent work, identify generations and abort superseded work. A late completion after a
newer result or disposal must publish nothing. Stress the diagnostic path itself: bound its queue,
discard unsafe values before entry, and close owned sinks.

## How do I diagnose debugging failures?

| Symptom                          | Cause                                             | Correction                                        | Evidence                                    |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| View never appears               | Zero bounds, exhausted parent, or clipping        | Fix measure/track/parent ownership                | Positive rect and expected cells            |
| Key reaches nothing              | Ineligible or wrong focused leaf                  | Focus the eligible leaf or repair ancestry        | `getFocused()` and handled event agree      |
| Button and key disagree          | Different command paths or disabled command       | Emit one command vocabulary                       | One handler and one visible result per path |
| State changes but frame is stale | Missing dependency or wrong invalidation          | Bind the source and invalidate layout when needed | Publication, draw, and exact cell agree     |
| Glyphs or mouse degrade          | Capability profile selected a fallback            | Honor fallback or correct detection/override      | Profile, reason, and non-colour cue agree   |
| Live host ignores input          | Not a TTY, raw mode failed, or bytes never arrive | Inspect bounded host diagnostics                  | TTY/raw/input facts distinguish the cause   |
| Terminal remains altered         | Lifecycle or restoration was bypassed             | Run through the owned host cleanup path           | Normal and failure exits restore modes      |
| Logs expose fixture data         | Raw payload entered diagnostics                   | Redact at entry and bound the sink                | No secret appears after ring eviction       |
| Old work mutates detached state  | Resource outlived its owner                       | Abort/release and guard generation                | Post-disposal callback is inert             |

## What are the best practices?

- Keep the same reproduction while testing one boundary; otherwise the symptom change cannot prove
  the cause.
- Prefer observable state plus exact frame evidence; either one alone can agree with a broken UI.
- Start with the narrowest real layer because extra hosts add unrelated variables.
- Bound every diagnostic sink; otherwise repeated failures become a memory or disk failure.
- Redact before a value enters a logger; filtering only when displaying leaves unsafe data retained.
- Use stable codes and structural facts; raw messages, inputs, and tokens make diagnostics unsafe.
- Keep correction and verification beside the failing boundary; otherwise regression tests assert
  a different workflow.
- Acquire and release resources in the same owner; missing cleanup creates intermittent late work.
- Preserve keyboard reachability, visible focus, ASCII fallbacks, and non-colour states while
  debugging; an inaccessible diagnostic cannot help reproduce the failure.

## What should I practice next?

Treat each exercise as an observable experiment:

1. **Layout:** force a zero-width child, inspect its rect and parent, correct the track, and assert an
   exact cell.
2. **Focus:** disable the expected target, dispatch one key, repair eligibility, and verify
   `getFocused()`.
3. **Command:** disable a shared command, compare button and key paths, enable it, and prove one
   handler run.
4. **Render:** publish a signal without the expected dependency, then correlate invalidation, draw,
   and frame evidence.
5. **Capability:** compare explicit Unicode and ASCII profiles while preserving the same meaning.
6. **Lifecycle:** dispose twice, invoke one retained callback, and verify cleanup plus frame inertia.

Next, use [Crash safety & terminal restore](/guide/crash-safety) for process-level restoration and
[Displaying untrusted text safely](/guide/untrusted-text) for the complete terminal-injection
boundary.

Public API:

- [`createLogger()`](/api/core/functions/createLogger)
- [`redactEvent()`](/api/core/functions/redactEvent)
- [`dumpCaps()`](/api/core/functions/dumpCaps)
- [`resolveCapabilities()`](/api/core/functions/resolveCapabilities)
- [`createEventLoop()`](/api/ui/functions/createEventLoop)
- [`createApplication()`](/api/ui/functions/createApplication)
