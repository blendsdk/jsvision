---
title: Writing your own widget
description: Build a custom View that can measure, draw safely, handle input, react to state, and clean up owned resources.
---

# Writing your own widget

JSVision's component catalog covers common controls, containers, and workspaces. When the interface
needs a domain-specific visualization or interaction, subclassing `View` is the supported escape
hatch. A custom widget participates in the same retained tree, layout pass, clipped renderer, focus
manager, event routes, reactive ownership, and theme system as every built-in control.

This course develops one small meter from its first visible cell into a reusable, focusable,
reactive control. It then composes widgets in a responsive parent and verifies geometry, rendering,
input, capability fallback, and cleanup without a real terminal.

## Who is this course for?

This course is for developers who have completed [Layout](/guide/layout),
[Reactive state](/guide/reactive-state), [Views & focus](/guide/views-and-focus), and
[Events, commands & keymaps](/guide/events-commands-and-keymaps). You should already understand
flow layout, signals, mounted ownership, focus eligibility, and routed event envelopes.

By the end, you will be able to build a custom widget, explain its measurement and rendering
contract, diagnose invisible or stale output, and verify focus, input, clipping, capabilities, and
cleanup with deterministic tests.

The motivating problem is a compact health meter that the catalog does not provide. It must choose
its own natural size, respond to arrows and clicks, repaint from a signal, show focus without
depending on colour, fall back to ASCII, and release a subscription when removed.

## What is the custom-widget mental model?

A custom widget is one retained object with several framework callbacks:

```text
construct
   │
   ├─ measure(available) ──> natural cell size
   ├─ mount ───────────────> owned reactive scope
   ├─ draw(ctx) ───────────> clipped cells in local coordinates
   ├─ onEvent(event) ──────> state change + handled boundary
   └─ unmount ─────────────> cleanup and scope disposal
```

| Responsibility   | Public surface                             | Owner                       |
| ---------------- | ------------------------------------------ | --------------------------- |
| Natural geometry | `measure(available)`                       | Widget                      |
| Paint            | `draw(ctx)`                                | Widget, clipped by renderer |
| Parent placement | `row`, `col`, `fixed`, `grow`, `setLayout` | Immediate container         |
| Focus and input  | `focusable`, `state.focused`, `onEvent`    | Widget plus event loop      |
| Reactive repaint | `onMount(() => bind(...))`                 | Mounted view scope          |
| External release | `onCleanup(...)`                           | Same mount that acquired it |

The layout pass may call `measure()` more than once. `draw()` may run after any invalidation, theme
change, resize, or exposed-region change. Keep both deterministic and free of host I/O. Event
handlers change state; drawing projects the current state into cells.

## How do I build the first useful custom View?

Start with the smallest complete leaf: honest measurement and one local draw call.

```ts
import { View, type DrawContext, type Size2D } from '@jsvision/ui';

class Meter extends View {
  override measure(available: Size2D): Size2D {
    return {
      width: Math.min(12, available.width),
      height: Math.min(1, available.height),
    };
  }

  override draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('button'));
    ctx.text(0, 0, 'Meter: 4', ctx.color('button'));
  }
}
```

The `available` argument is the parent-provided cell budget. The returned size is an intrinsic
preference, not permission to draw outside the rectangle the parent ultimately assigns.

## Laboratory: widget anatomy

<PlayExample id="guides/widget-anatomy"
  title="Widget Anatomy Laboratory"
  blurb="Measure and draw a real custom View, then use the right arrow and the Increment button to compare reactive repaint, keyboard and mouse input, focus, clipping, and handled events."
/>

Press Right while the meter is focused, then click **Increment**. The readouts come from the real
widget counters: measurement and drawing calls, handled event count, focus state, reactive value,
and the last action source. The widget deliberately attempts one out-of-bounds write; the renderer
clips it, so `Clipped draw: pass` remains visible.

## How does intrinsic measurement work?

`measure(available)` returns a `Size2D` in terminal cells. An auto-sized leaf without a measurement
has zero natural size and can disappear as a `0×0` rectangle. A widget placed in an explicit fixed
or growing track may not need intrinsic size, but implementing an honest measure makes the leaf
reusable in auto layout and non-stretch alignment.

```ts
import { View, type DrawContext, type Size2D } from '@jsvision/ui';

class Badge extends View {
  constructor(private readonly label: string) {
    super();
  }

  override measure(available: Size2D): Size2D {
    const naturalWidth = this.label.length + 2;
    return {
      width: Math.min(naturalWidth, available.width),
      height: Math.min(1, available.height),
    };
  }

  override draw(ctx: DrawContext): void {
    ctx.text(0, 0, `[${this.label}]`, ctx.color('staticText'));
  }
}
```

For user-facing Unicode text, use the same display-cell measurement helper as the owning component
instead of JavaScript code-unit length. Measurement must stay bounded by feasible available
geometry, must never return negative cells, and should return a stable result for the same inputs.

If a reactive label changes the natural size, its binding needs `{ relayout: true }`; a repaint
alone cannot ask the parent to measure again.

## How do I draw safely inside local clipped bounds?

`DrawContext` uses view-local coordinates: `(0, 0)` is the widget's top-left cell, regardless of
where ancestors sit on screen. `ctx.size` is the assigned drawable size. The context translates to
the absolute buffer and clips every write to the widget and ancestor rectangles.

```ts
import { View, type DrawContext } from '@jsvision/ui';

class CapabilityMark extends View {
  override draw(ctx: DrawContext): void {
    const style = ctx.color('staticText'); // semantic theme role
    const glyph = ctx.caps.glyphs.halfBlocks ? '█' : '#';

    ctx.fill(' ', style);
    if (ctx.size.width > 0 && ctx.size.height > 0) {
      ctx.text(0, 0, `${glyph} ready`, style);
    }
  }
}
```

`ctx.color(role)` resolves the active theme every frame. `ctx.caps` exposes the capability profile
used by the renderer, so Unicode and ASCII choices agree with the host. Do not calculate absolute
screen coordinates or draw against absolute bounds; use `ctx.size` and local positions. Writes
beyond the local rectangle are dropped rather than corrupting neighboring views.

Drawing text is sanitized by the rendering boundary, but a widget still owns semantic truncation,
redaction, and safe diagnostic content. Never normalize raw terminal control sequences as ordinary
application text.

## How do focus and input become widget behavior?

A keyboard control opts in with `focusable = true`. Draw a visible focus state from
`state.focused`, using a border, glyph, label, or text attribute as a non-colour cue. Theme colour
may reinforce that cue, but colour alone is insufficient.

```ts
import { View, type DrawContext } from '@jsvision/ui';

class FocusFrame extends View {
  override focusable = true;

  override draw(ctx: DrawContext): void {
    const role = this.state.focused ? 'buttonFocused' : 'button';
    const marker = this.state.focused ? '>' : ' ';
    ctx.fill(' ', ctx.color(role));
    ctx.text(0, 0, `${marker} Meter`, ctx.color(role));
  }
}
```

Keyboard events reach the focused leaf. Mouse-down is hit-tested and carries view-local
`event.local` coordinates. Handle only gestures the widget owns:

```ts
import { View, type DispatchEvent, type DrawContext } from '@jsvision/ui';

class Stepper extends View {
  override focusable = true;
  override draw(_ctx: DrawContext): void {}

  override onEvent(event: DispatchEvent): void {
    const input = event.event;
    const keyboard = input.type === 'key' && input.key === 'right';
    const mouse = input.type === 'mouse' && input.kind === 'down' && event.local !== undefined;

    if (keyboard || mouse) {
      this.increment();
      event.handled = true; // consume the owned action and stop bubbling
    }
  }

  private increment(): void {}
}
```

Do not leave a recognized, owned event unhandled after performing its action; an ancestor could
perform a second action. Do not mark unrelated events handled merely because the widget observed
them. Support both keyboard and mouse when pointer interaction materially belongs to the control,
and keep an equivalent keyboard path reachable.

## How does reactive state request repaint or reflow?

`draw()` can read a signal, but the view must subscribe so external writes schedule another frame.
Call `bind()` inside `onMount()`, when the view's reactive owner exists:

```ts
import { View, signal, type DrawContext } from '@jsvision/ui';

const value = signal(0);

class ReactiveMeter extends View {
  constructor() {
    super();
    this.onMount(() => this.bind(() => value()));
  }

  override draw(ctx: DrawContext): void {
    ctx.text(0, 0, `Value: ${value()}`, ctx.color('staticText'));
  }
}
```

Calling `bind()` in the constructor or before mount throws because no view scope exists yet. A
normal binding calls `invalidate()` and requests a paint. Use reflow only when measurement or
geometry changes:

```ts
import { View, signal, type DrawContext } from '@jsvision/ui';

const label = signal('Short');

class GrowingLabel extends View {
  constructor() {
    super();
    this.onMount(() => this.bind(() => label(), undefined, { relayout: true }));
  }

  override draw(ctx: DrawContext): void {
    ctx.text(0, 0, label(), ctx.color('staticText'));
  }
}
```

`invalidate()` means paint or repaint this subtree with the existing rectangles.
`invalidateLayout()` means measure, reflow, then repaint. Overusing layout invalidation makes
siblings redraw needlessly; underusing it leaves stale bounds.

```ts
import { View } from '@jsvision/ui';

declare const widget: View;
widget.invalidate(); // Visual state changed; keep the current rectangle.
widget.invalidateLayout(); // Natural size or layout participation changed.
```

The `layout` field is read-only. Never assign it or mutate `layout.rect` directly. Change layout
through `setLayout()`, which preserves omitted properties and requests reflow:

```ts
import { View } from '@jsvision/ui';

declare const widget: View;

widget.setLayout({
  size: { kind: 'fr', weight: 1 },
  padding: 1,
});

// Later, change only the size; the padding remains.
widget.setLayout({ size: { kind: 'fixed', cells: 16 } });
```

## How do semantic themes and capabilities shape drawing?

Choose roles by meaning and state, not literal colours. A focusable meter can reuse `button` and
`buttonFocused`; passive explanatory text can use `staticText`. If the widget establishes a new
semantic state that existing roles cannot express, add a documented theme role through the owning
package instead of hard-coding a palette.

Capability fallback must preserve meaning:

| Capability   | Preferred cue        | ASCII-safe cue              | Meaning  |
| ------------ | -------------------- | --------------------------- | -------- |
| Half blocks  | `█` fill             | `#` fill                    | Amount   |
| Box drawing  | `┌─┐`                | `+-+`                       | Boundary |
| Colour depth | Semantic role colour | Label, marker, or attribute | State    |

Unicode and ASCII paths must carry the same meaning and remain bounded by `ctx.size`. Focus,
selection, failure, and disabled states need a structural or textual cue that survives monochrome.

## Laboratory: widget composition and evidence

<PlayExample id="guides/widget-composition"
  title="Widget Composition Laboratory"
  blurb="Compare local repaint with full reflow, prove bounded clipping and Unicode-to-ASCII meaning, then run a deterministic headless check and observe exact mounted cleanup."
/>

Use Alt+P for a local repaint, Alt+R for a geometry-changing reflow, Alt+C for the clipping probe,
and Alt+A for capability fallback. Click **Headless check** to run the same widget through a
bounded render root and event loop. Resize, maximize, and restore the dialog to verify that the
parent keeps ownership and the widgets stay clipped to their assigned cells.

## How do I compose a reusable widget?

The parent or container owns placement and child lifetime. The widget owns natural size, drawing,
input, and resources. Compose the leaf with ordinary flow helpers:

```ts
import { Text, col, fixed, grow, row } from '@jsvision/ui';

declare const meter: import('@jsvision/ui').View;
declare const history: import('@jsvision/ui').View;

const dashboard = col(
  { gap: 1, padding: 1 },
  fixed(new Text('Service health'), 1),
  fixed(row({ gap: 1 }, fixed(meter, 16), grow(new Text('Live'))), 1),
  grow(history),
);
```

When the parent removes a mounted child, the child's scope is disposed before detachment. Do not
reuse one live widget instance under two parents. Pass signals and bounded action functions into
the widget; avoid giving a leaf unrestricted access to the application shell.

For a small or reduced-viewport geometry, decide what truncates, wraps, or moves. `DrawContext`
prevents overflow, but automatic clipping is only a safety boundary—it cannot decide which
information is most important.

## How do I test a widget headlessly?

Use `createRenderRoot()` for measurement, drawing, clipping, theme, and capability evidence:

```ts
import { Group, createRenderRoot, fixed } from '@jsvision/ui';

declare const caps: import('@jsvision/ui').CapabilityProfile;
declare const meter: import('@jsvision/ui').View;

const root = new Group();
root.setLayout({ direction: 'row' });
root.add(fixed(meter, 8));

const render = createRenderRoot({ width: 8, height: 1 }, { caps });
render.mount(root);
render.flush();

const cells = render.buffer().rows()[0];
// Assert measured bounds, visible cells, clipping, and fallback glyphs.
```

Use `createEventLoop()` when focus, key, mouse, handled state, resize, or cleanup is part of the
contract:

```ts
import { createEventLoop } from '@jsvision/ui';

declare const caps: import('@jsvision/ui').CapabilityProfile;
declare const meter: import('@jsvision/ui').View;

const loop = createEventLoop({ width: 12, height: 1 }, { caps });
loop.mount(meter);
loop.focusView(meter);
loop.dispatch({ type: 'key', key: 'right', ctrl: false, alt: false, shift: false });

// Assert value, handled evidence, bounds, buffer cells, then cleanup.
loop.dispose();
```

Test observable outcomes rather than internal method order: measured bounds, final buffer cells,
handled events, focus identity, sibling redraw count, and cleanup count. A mock that calls methods
directly cannot prove routing, clipping, or mounted ownership.

## What belongs in advanced widget ownership?

Acquire host resources only after mount and release them in the same lifetime:

```ts
import { View, type DrawContext } from '@jsvision/ui';

declare function subscribe(notify: () => void): () => void;

class ServiceBadge extends View {
  constructor() {
    super();
    this.onMount(() => {
      const unsubscribe = subscribe(() => this.invalidate());
      this.onCleanup(unsubscribe);
    });
  }

  override draw(_ctx: DrawContext): void {}
}
```

Cleanup must run exactly once; loop and render-root disposal are idempotent. Pair timers,
subscriptions, listeners, pointer capture, and modal work with their documented release seam.
After unmount, callbacks must not mutate the disposed widget or request frames.

Advanced controls may expose commands, a caret, pointer capture, or dynamic children. Add those
only when the interaction requires them. Preserve the event loop as the focus, routing, and
clipboard authority instead of building a second control runtime inside the widget.

## How do I diagnose widget failures?

| Symptom                             | Likely cause                                            | Correction                                                           | Evidence                                               |
| ----------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Auto-sized widget is invisible      | Missing or zero natural `measure()`                     | Return a bounded non-zero intrinsic size or assign a justified track | Bounds are positive after reflow                       |
| Paint appears in the wrong place    | Drawing uses screen or absolute coordinates             | Use local coordinates and `ctx.size`                                 | Same widget paints correctly under a translated parent |
| Signal changes but cells stay stale | Signal was read without a mounted binding               | Bind inside `onMount()`                                              | A write increments this widget's draw count            |
| Siblings keep old geometry          | Size changed after `invalidate()` only                  | Use `invalidateLayout()` or a relayout binding                       | Sibling bounds and draw evidence change                |
| One key performs two actions        | Widget acted but left owned input unhandled             | Set `handled = true` after the recognized action                     | Ancestor action count remains unchanged                |
| Click lands on the wrong cell       | Handler reads host coordinates instead of `event.local` | Use the translated local point                                       | Edge-cell clicks map to expected value                 |
| Focus vanishes in monochrome        | Cue relies only on role colour                          | Add a marker, border, label, or attribute                            | Focus remains visible in text-only evidence            |
| Resource survives removal           | Acquisition has no paired `onCleanup()`                 | Register release in the mounted owner                                | Cleanup count is one and later callbacks are inert     |
| Wide glyph clips a neighbor         | Drawing ignored capability or assigned width            | Use `ctx.caps`, `ctx.size`, and a same-meaning ASCII fallback        | Buffer width stays fixed with no overflow              |

Development warnings can identify a zero-measure custom leaf and several invalid layout/focus
operations. Treat warnings as diagnosis, then assert public bounds, buffers, focus, handled state,
and cleanup rather than parsing warning prose in application logic.

## What are the best practices?

- Keep `measure()` pure, bounded, and consistent with the content `draw()` will show.
- Draw only through `DrawContext`, in local coordinates, against `ctx.size`.
- Use semantic theme roles and capability-driven glyphs; provide non-colour and ASCII-safe cues.
- Handle only owned input, but always consume a recognized action after performing it.
- Bind reactive sources inside `onMount()` and choose repaint or reflow by whether geometry changes.
- Change layout with helpers or `setLayout()`; never mutate read-only layout state.
- Let the immediate parent own placement, mounting, removal, and responsive policy.
- Acquire and clean up external work in one mounted lifetime.
- Test real measurement, buffers, focus, dispatch, clipping, resize, and disposal with public APIs.
- Keep the custom surface narrow. Prefer a built-in component when it already owns the behavior.

## What should I practice next?

Treat each exercise as a small observable experiment: measure, clip, drive input, verify cleanup,
and repeat with ASCII capabilities where it applies.

1. **Measure:** remove `measure()` from an auto leaf, observe the zero rectangle, restore a bounded
   natural size, and assert the corrected bounds.
2. **Clip:** deliberately write beyond `ctx.size`; verify the neighbor's cells remain unchanged in a
   constrained viewport.
3. **Input:** support Right, Enter, and a mouse-down through one action; assert each owned event is
   handled exactly once.
4. **Repaint and reflow:** change a pixel-only value, then a natural-size value; compare sibling draw
   counts and bounds.
5. **Cleanup:** acquire a fake listener on mount, remove the widget, dispose twice, and verify exact
   cleanup plus inert later notifications.
6. **ASCII:** render the same state with Unicode capability enabled and disabled; assert the glyph
   changes while meaning, width, and non-colour status stay the same.

Continue with [Testing headlessly](/guide/testing-headlessly) for complete specification,
implementation, and browser-integration test layers. Review [Theming & colour
depth](/guide/theming-and-colour-depth) when a widget needs a new semantic role, and return to
[Accessibility & resilient interaction](/guide/accessibility) for project-wide keyboard and
fallback decisions.

Public API:

- [`View`](/api/ui/classes/View)
- [`DrawContext`](/api/ui/interfaces/DrawContext)
- [`DispatchEvent`](/api/ui/interfaces/DispatchEvent)
- [`Size2D`](/api/ui/interfaces/Size2D)
- [`createRenderRoot()`](/api/ui/functions/createRenderRoot)
- [`createEventLoop()`](/api/ui/functions/createEventLoop)
