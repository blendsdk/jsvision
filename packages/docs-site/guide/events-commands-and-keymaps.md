---
title: Events, commands & keymaps
description: Trace JSVision events through the view tree, define discoverable commands, and resolve keymap precedence safely.
---

# Events, commands & keymaps

## Who this course is for

Prerequisite: [Views & focus](/guide/views-and-focus). This course assumes you already know how a
retained view tree is mounted and how focus selects one keyboard target.

The motivating problem is a workspace whose buttons work, but whose keyboard shortcuts, paste,
mouse gestures, and menu commands disagree. By the end you will be able to trace each event, define
one command vocabulary, resolve keymap collisions, diagnose early consumption, and verify the
result in a headless render.

You will learn to:

- trace keyboard, paste, command, mouse, and wheel input through their correct routes;
- define discoverable commands with explicit ownership and cleanup;
- resolve application and framework keymap precedence without duplicate actions; and
- diagnose disabled, misspelled, prematurely handled, or scope-confined actions.

## Mental model

Input arrives as an `AppEvent`. The event loop wraps it in a mutable `DispatchEvent`, adds safe
helpers such as `emit`, and offers it to the active view scope. The route depends on the input kind:

```text
key / paste / command
  -> keymap and Tab rules
  -> pre-process: root down
  -> focused leaf, then ancestors
  -> post-process: final fallback

mouse-down
  -> hit-test
  -> target, then parents

wheel / mouse move / mouse up
  -> hit-test
  -> target only
```

`event.handled = true` is a short-circuit. It stops all remaining views and phases for that event.
A **command** is a named intent such as `save`; a **keymap** translates a physical chord such as
Ctrl+S into that intent before views see the raw key.

## Your first useful result

Define the command once, bind a chord to it, and register its owner:

```ts
import { Group, createApplication, createKeymap } from '@jsvision/ui';

const content = new Group();
declare function saveDocument(): void;
const app = createApplication({
  content,
  keymap: createKeymap({ 'ctrl+s': 'document.save' }),
});

const stopSave = app.onCommand('document.save', () => saveDocument());
// Call stopSave() when the owner of this command handler is removed.
```

The keymap turns Ctrl+S into `document.save`. `onCommand()` owns the application action, whether it
came from a key, button, menu, or status item. Use one stable, namespaced command string everywhere.

## Three-phase event routing

Keyboard, paste, and command events use three phases:

1. **Pre-process, root-down.** Views with `preProcess = true` see the event first. Use this for
   cross-cutting interceptors that genuinely outrank the focused control.
2. **Focused chain, leaf-up.** The focused leaf sees the event, then each ancestor may handle what
   its child ignored.
3. **Post-process, final fallback.** Views with `postProcess = true` see only events that survived
   the earlier phases.

The first handler to mark the envelope handled stops the remaining route:

```ts
import { View, type DispatchEvent, type DrawContext } from '@jsvision/ui';

declare function closeCurrentSurface(): void;

class EscapeBoundary extends View {
  draw(_ctx: DrawContext): void {}

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key' && event.event.key === 'escape') {
      closeCurrentSurface();
      event.handled = true; // Do not let an ancestor also close its surface.
    }
  }
}
```

Do not set `handled` merely because a view observed an event. Early handling makes a focused
control or later fallback appear broken.

Pre- and post-process are opt-in routing roles:

```ts
import { View, type DispatchEvent, type DrawContext } from '@jsvision/ui';

declare function reportUnhandledInput(event: DispatchEvent['event']): void;

class ShortcutInterceptor extends View {
  override preProcess = true;
  draw(_ctx: DrawContext): void {}
  override onEvent(event: DispatchEvent): void {
    // Inspect only shortcuts this view truly owns.
  }
}

class FinalFallback extends View {
  override postProcess = true;
  draw(_ctx: DrawContext): void {}
  override onEvent(event: DispatchEvent): void {
    if (!event.handled) reportUnhandledInput(event.event);
  }
}
```

<PlayExample id="guides/event-routing" title="Event routing laboratory" blurb="Press a raw key, send a bounded paste, emit a command, and click the mouse target to compare three-phase routing with target-up pointer bubbling." />

Try X, the paste button, Alt+C, and a click on **Mouse target**. The `guides/event-routing`
laboratory shows keyboard, mouse, paste, and command order as ASCII `>` steps.

## Mouse and wheel routing

Mouse and wheel input use hit-testing. They bypass the pre-process and three-phase focused route. A
mouse-down first finds the top-most hit view, moves focus when appropriate, and bubbles from the
target toward each parent or ancestor until one marks it handled. Mouse move, mouse up, and wheel
input go only to the hit-tested target unless pointer capture redirects them.

```ts
import { View, type DispatchEvent, type DrawContext } from '@jsvision/ui';

declare function activateCell(x: number, y: number): void;

class ClickRegion extends View {
  draw(_ctx: DrawContext): void {}

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'mouse' && event.event.kind === 'down') {
      const local = event.local; // Coordinates are relative to this view.
      if (local !== undefined) activateCell(local.x, local.y);
      event.handled = true; // Stop target-up mouse bubbling.
    }
  }
}
```

Pointer capture deliberately bypasses later hit tests during a drag. Acquire it on mouse-down and
release it on mouse-up; opening or closing a modal and unmounting the target release it
automatically.

## Commands and discoverability

A command is the shared language between interaction surfaces. A menu item, status item, button,
keymap, and test can all emit `document.save`, while one owner performs the save.

`onCommand()` handlers run as a pre-process command sink, before the focused view. Every handler
registered for that name runs in registration order, and the command is then consumed. The returned
unsubscribe function is idempotent; keep registration and cleanup together:

```ts
import { type Application, type View } from '@jsvision/ui';

declare const app: Application;
declare const screen: View;
declare function saveDocument(): void;

screen.onMount(() => {
  const unsubscribe = app.onCommand('document.save', () => saveDocument());
  screen.onCleanup(unsubscribe);
});
```

Commands are enabled by default, even when they were not seeded. Disable an unavailable action at
the command owner:

```ts
import { type EventLoop } from '@jsvision/ui';

declare const loop: EventLoop;

loop.enableCommand('document.save', false);
loop.emitCommand('document.save'); // Dropped silently; it does not route.
console.log(loop.isCommandEnabled('document.save')); // false
```

Menu, status, and button affordances can observe command enablement and grey themselves. An
unmatched or misspelled command that survives every view produces a development warning naming the
command; do not parse that warning in application logic.

A modal changes the active scope. While it is open, commands are confined to the modal subtree, so
a general application `onCommand()` handler behind it does not fire. The modal may handle or end
the command; ordinary application ownership resumes after the modal closes.

## Keymaps and precedence

`createKeymap()` compiles chord bindings into command intents:

```ts
import { createKeymap } from '@jsvision/ui';

const keymap = createKeymap({
  'ctrl+s': 'document.save',
  'alt+enter': 'document.properties',
  escape: 'surface.cancel',
});
```

A matched binding is resolved before any routing phase or view. The mapped command is emitted and
the raw key is swallowed, so one physical gesture cannot trigger both paths. An unbound key routes
normally. Unbound Tab and Shift+Tab are special: the event loop moves focus and does not deliver the
raw Tab to views.

Chord text is case-insensitive and uses `ctrl`, `alt`, and `shift` plus one character or named key.
An invalid chord—such as an unknown modifier or missing key—throws during keymap construction, so
configuration fails fast.

Applications created with the normal shell also receive default clipboard bindings. The
application keymap has higher precedence and wins over a conflicting default clipboard chord; all
untouched defaults remain. That makes a Ctrl+C override intentional rather than a collision whose
winner depends on view order.

<PlayExample id="guides/command-precedence" title="Command and keymap precedence laboratory" blurb="Use Ctrl+S and a deliberate Ctrl+C collision, inspect the winning app handler, then disable Save and observe mapped commands being dropped." />

In `guides/command-precedence`, Ctrl+S proves command ownership and raw-key swallowing. Ctrl+C proves
that the app binding wins the default collision. Alt+D toggles command enablement so the same
gesture can be compared while enabled and disabled.

Audit a collision by listing each chord, its winning layer, its command, and its owner. Prefer one
unique mnemonic per scope. Override a framework default only when the new action is more important
in that application and the UI makes the winner discoverable.

## Composition and integration

Focus chooses the keyboard route; commands decouple input from behavior; layout determines pointer
hit regions; reactive state paints enabled and disabled affordances. Coordinate them deliberately:

- Build logical focus order before assigning shortcuts.
- Emit the same command from menus, buttons, status items, and keymaps.
- Register application handlers at the lifetime that owns the action.
- Keep text editing and clipboard policy with the owning
  [Keyboard & clipboard](/guide/keyboard-and-clipboard) course.
- Let [Dialogs & modality](/guide/dialogs-and-modality) own modal results and validation.
- Request invalidation when a custom visual cue changes outside a dispatch tick.

## Advanced behavior

### Nested emission

Calling `event.emit?.('document.save')` or `loop.emitCommand()` inside a handler queues the command
on the current tick. It does not recurse through a second independent render cycle; invalidations
coalesce into the tick's frame.

### Handler errors and cleanup

A throwing `onCommand()` handler is isolated so sibling handlers still run, but the command remains
consumed. Log only nonsensitive context. Unsubscribe when a screen or integration owner ends, even
though complete event-loop disposal also clears application command closures.

### Pointer capture

Capture keeps a drag routed to one view after the pointer leaves its bounds. Check live capture
during the gesture and release it on completion. Modal transitions and unmounting cancel stale
capture so a disposed view cannot continue receiving motion.

### Production verification

Verify raw keys and mapped commands separately. Exercise keyboard-only paths, mouse hit boundaries,
paste as bounded untrusted text, reduced geometry, monochrome, and ASCII-safe feedback. A rendered
status trace is stronger evidence than colour alone.

## Failure modes and diagnosis

| Symptom                                                   | Cause                                                                        | Correction                                                                     | Evidence                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| A focused control never receives a key                    | An early handler consumes it, so it never reaches the focused view           | Consume only the exact shortcut the early handler owns                         | The trace reaches the focused phase after unrelated keys |
| One gesture runs two actions                              | Raw-key logic duplicates a mapped command or the same chord has a collision  | Keep behavior behind one command and document the precedence winner            | One command count changes; raw-key count stays zero      |
| Ctrl+C performs the wrong action                          | The application keymap intentionally overrides the default clipboard binding | Keep the app binding only when its winner is visible, or choose a unique chord | The keymap audit names one winner                        |
| A disabled command does nothing                           | Disabled commands are silently dropped before routing                        | Query `isCommandEnabled()` and keep the affordance visibly disabled            | No handler or focused view receives the command          |
| A button appears dead and a dev warning names its command | The emitted command is unmatched, misspelled, or no owner is mounted         | Align the stable command name and register its owner                           | The development warning disappears and one owner runs    |
| A command works until a modal opens                       | The modal scope confines command routing and hides the app-level sink        | Handle the decision inside the modal or wait until it closes                   | The background handler remains inert during the modal    |
| A drag jumps between views                                | Pointer capture was not acquired or was lost                                 | Capture on press, verify ownership, and release on completion                  | Motion remains on one target or cancels cleanly          |
| Order is unclear in monochrome                            | Feedback relies only on colour                                               | Render non-colour, plain text or ASCII-safe phase and winner labels            | `pre > focused > post` remains readable                  |

## Best practices

- Define commands as stable, namespaced intents. Reusing ad-hoc strings makes collisions and typos
  harder to audit.
- Put business behavior behind commands rather than physical keys. Host and accessibility input can
  then invoke the same action.
- Use pre-process only for true precedence. Overuse steals ordinary input from the focused control.
- Mark an event handled only after completing the owned action. Observation alone is not ownership.
- Keep command registration and unsubscribe in one lifetime. Otherwise replaced screens keep acting.
- Make disabled state visible and queryable. Silent command drops are correct only when the UI
  already explains that the action is unavailable.
- Test the winning chord and prove the raw key did not also arrive.
- Keep pointer, keyboard, and command evidence textual as well as coloured.

## Practice and next steps

Exercise 1: in the routing laboratory, predict the order for a key, paste, command, and mouse click,
then compare each `>` trace. Experiment by clicking outside the mouse target and explain why no
focused route runs.

Exercise 2: in the precedence laboratory, trigger Ctrl+S and Ctrl+C, then disable Save. Predict which
handler wins each collision, whether the raw key arrives, and why the disabled command is dropped.
Choose a unique replacement chord and write its command audit row.

Continue with:

- [Views & focus](/guide/views-and-focus) to revisit the route selected by focus;
- [Keyboard & clipboard](/guide/keyboard-and-clipboard) for editing chords, paste, and host
  authorization;
- [Dialogs & modality](/guide/dialogs-and-modality) for command scope during modal workflows;
- [Button](/components/controls/button) for command-emitting controls; and
- [Writing your own widget](/guide/writing-your-own-widget) for custom `onEvent()` behavior.

Public API:

- [`EventLoop`](/api/ui/interfaces/EventLoop)
- [`View`](/api/ui/classes/View)
- [`DispatchEvent`](/api/ui/interfaces/DispatchEvent)
- [`CommandEvent`](/api/ui/interfaces/CommandEvent)
