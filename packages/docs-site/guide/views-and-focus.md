---
title: Views & focus
description: Build retained view trees and predictable focus traversal, restoration, eligibility, and modal keyboard scopes.
---

# Views & focus

## Who this course is for

Prerequisites: [Layout](/guide/layout) and [Reactive state](/guide/reactive-state). Before you begin,
you should be comfortable with rows, columns, fixed and flexible sizing, signals, and view-owned
cleanup.

The motivating problem is a real-world form or workspace that looks correct with a mouse but becomes
unpredictable from the keyboard. By the end you will be able to build a retained view tree, explain
who owns each mounted resource, diagnose missing repaint and focus behavior, and verify traversal
and modal restoration headlessly.

You will learn to:

- explain retained view identity, parent-child ownership, mounting, invalidation, and cleanup;
- design document-order Tab and Shift+Tab traversal across nested groups;
- choose between exact `focusView()` and restorative `focusInto()` entry;
- make hidden and disabled eligibility changes safe; and
- contain focus inside modal work, then restore the exact previous target.

## Mental model

JSVision uses a **retained** tree. Each `View` is a persistent instance with identity, bounds,
state, layout intent, and an optional reactive scope. A `Group` owns an ordered list of children.
That parent-child tree simultaneously defines layout containment, paint order, lifecycle ownership,
event routes, and the default keyboard document order.

```text
Application root
└─ Desktop
   └─ Dialog
      └─ content Group
         ├─ field Group
         │  ├─ Label
         │  └─ Input  ← focused leaf
         └─ button Group
            ├─ OK
            └─ Cancel
```

Focus also lives in the tree. Along the active ancestor chain, each `Group.current` points toward
the one focused leaf. In an inactive group, the same property remembers its last focused child
instead; that restoration memory does not mean the child is currently focused. This distinction
enables restorative entry without rebuilding the interface.

## Your first focusable view tree

Use layout helpers to establish meaningful child order. Passive `Text` and `Group` objects are
skipped; controls such as `Input` and `Button` are focusable.

```ts
import { Button, Input, Label, col, row, signal } from '@jsvision/ui';

const name = signal('');
const field = new Input({ value: name });

const form = col(
  { gap: 1 },
  row({ gap: 1 }, new Label('~N~ame', field), field),
  row({ gap: 1 }, new Button('~S~ave'), new Button('~C~ancel')),
);
```

The argument order is the retained child order: Name field, Save, then Cancel. Tab moves forward in
that tree order; Shift+Tab is its exact reverse. Keep order logical in the tree instead of trying to
repair it visually with coordinates.

## Mounting, ownership, and invalidation

Adding a child records its parent immediately. Mounting the root creates a reactive scope for every
view under its parent's owner. Unmounting or removing a subtree disposes all descendant scopes and
runs their cleanup. Acquire external work and release it together:

```ts
import { View } from '@jsvision/ui';

declare const panel: View;
declare function subscribeToService(notify: () => void): () => void;

panel.onMount(() => {
  const unsubscribe = subscribeToService(() => panel.invalidate());
  panel.onCleanup(unsubscribe);
});
```

`invalidate()` requests a repaint when pixels change but geometry does not. `invalidateLayout()`
requests measurement, layout, and repaint when size, position, or participation changes:

```ts
import { View } from '@jsvision/ui';

declare const details: View;

details.state.visible = false;
details.invalidateLayout(); // Hidden views leave layout, so a repaint alone is insufficient.

details.state.disabled = true;
details.invalidate(); // Eligibility and focused styling changed; geometry did not.
```

Writing `state.visible` or `state.disabled` does not schedule work by itself. A visible-to-hidden
change needs `invalidateLayout()` because layout omits hidden views. Prefer `setLayout()` for layout
property changes because it applies the patch and schedules reflow together.

Removing a focused child also asks the event loop to heal focus toward an eligible sibling. Do not
keep a stale reference and try to focus a disposed or unmounted view later; `focusView()` will
correctly do nothing.

## Traverse in document order

Tab calls `focusNext()` and Shift+Tab calls `focusPrev()`. Traversal is depth-first tree order:

1. descend through nested groups to an eligible leaf;
2. move to the next eligible sibling;
3. climb out of an exhausted group and continue at its parent;
4. wrap only at the active scope boundary.

Shift+Tab is the exact inverse and reverse entry lands on a group's last eligible leaf. An open
modal becomes the scope boundary, so traversal cannot wrap into the application behind it.

<PlayExample id="guides/views-focus-traversal" title="Focus traversal laboratory" blurb="Use Tab and Shift+Tab to inspect tree order, then hide or disable targets and use focusInto to restore a group." />

Try Tab twice, then Shift+Tab. Use Alt+H and Alt+D to remove one hidden and one disabled target from
eligibility. Alt+I invokes `focusInto()` and reports whether group memory was restored or the first
eligible child was entered.

## Focus entry and restoration

Use the event loop's public focus methods. `focusView()` targets one exact mounted, visible, enabled,
focusable leaf. A composite `Group`, list, tree, data grid, or tab view is often not itself the
keyboard target.

`focusInto()` accepts a leaf or container. For a container it restores the last eligible child
remembered by `Group.current`; without valid memory it enters the first focusable descendant.

```ts
import { Group, Input, type EventLoop } from '@jsvision/ui';

declare const loop: EventLoop;
declare const form: Group;
declare const nameInput: Input;

loop.focusView(nameInput); // Exact leaf.
loop.focusInto(form); // Restore the form's last child, or enter its first eligible leaf.
```

Container memory is for **non-Tab entry**: a click, a programmatic call, a window activation, or
modal restoration. Continuous Tab traversal remains document order. This distinction prevents an
old group memory from making forward traversal jump backward unexpectedly.

Labels provide a user-facing entry route. A `Label` linked to a control is passive in Tab order, but
a click or its Alt accelerator focuses the target. Prefer that connection to custom shortcut code.

## Focus eligibility

A view can receive focus only when all of these are true:

| Requirement                           | Consequence when false                                     |
| ------------------------------------- | ---------------------------------------------------------- |
| The view is mounted                   | Detached and not-yet-mounted references are ignored.       |
| `focusable` is `true`                 | Passive text, decoration, and ordinary groups are skipped. |
| `state.visible` is `true`             | A hidden target does not participate in layout or focus.   |
| `state.disabled` is `false`           | A disabled target is inert and skipped.                    |
| Every ancestor is visible and enabled | Hiding or disabling a container blocks its whole subtree.  |

When the focused view becomes hidden, disabled, or removed, move focus to a sensible eligible
neighbor as part of the same action. Removal through `Group.remove()` heals its focused child.
Direct state changes should explicitly choose a new target when the current one becomes ineligible.

## Modal focus

`execView()` saves current focus, makes the modal subtree the active dispatch and traversal scope,
and calls `focusInto()` on it. Input outside the modal is inert: keyboard events and pointer hits
behind it are ignored. End the operation through the modal host—normally a `Dialog` command—not by
removing the window directly.

```ts
import { Dialog, type EventLoop } from '@jsvision/ui';

declare const loop: EventLoop;
declare const dialog: Dialog;

const result = await loop.execView(dialog);
// Dialog OK, Cancel, Esc, or its close box calls endModal() through the attached host.
console.log(result ?? 'host disposed');
```

At completion, `endModal()` restores the previous saved focus if it is still eligible. Nested
modals use LIFO (last-in, first-out) order: closing the inner modal restores focus inside the outer
modal; closing the outer modal restores the application target.

<PlayExample id="guides/views-focus-modality" title="Modal focus and restoration laboratory" blurb="Open the nested dialog, traverse its confined keyboard scope, then press Esc and observe the exact restored target." />

Focus either main-window button, then use Alt+M. Tab and Shift+Tab remain contained in the nested
dialog. Press Esc: the visible `Restored focus:` readout names the exact control saved before the
modal opened.

## Composition and integration

Layout determines child order and clipping; reactive state determines when view state changes;
focus determines where keyboard input goes. Coordinate them deliberately:

- Build groups in the same order users should traverse them.
- When a signal changes visibility, request layout and re-home focus in the same transaction.
- Let controls expose commands while the event loop owns focus and dispatch.
- Let dialogs own modal completion; do not simulate modality with a disabled background.
- For screens and windows, save stable focus intent only when the owning surface documents it.

The next course, [Events, commands & keymaps](/guide/events-commands-and-keymaps), explains the
dispatch phases after focus chooses a target. [Dialogs & modality](/guide/dialogs-and-modality)
owns validation, cancellation, nested decisions, and result workflows beyond the focus model.

## Advanced behavior

### Observe focus without polling

`focusSignal()` ticks whenever a view gains or loses focus. Read it inside a view binding or effect
when another region must repaint a caption or status line. The value is intentionally `void`; read
`state.focused` or `loop.getFocused()` after the tick for the current fact.

### Dynamic trees

`Group.addDynamic()` mounts produced children under the group scope and disposes removed children.
Stable identity matters: keyed dynamic views retain local state and focus memory; replacement views
start with new identity. If reconciliation removes the focused child, focus healing runs after the
old scope is disposed.

### Focusable custom views

A custom widget opts in with `focusable = true`, draws a visible focused state, and handles keyboard
events through `onEvent()`. Use theme roles and a non-colour cue. Do not make a passive container
focusable merely to intercept its children's keys.

### Cleanup and teardown

Unmounting disposes view-owned reactive work, but external resources still need an `onCleanup()`
release. Modal promises resolve to `undefined` if the complete event loop is disposed while they are
pending. Treat that as host teardown, not as a user confirmation.

## Theming and resilient focus cues

`buttonFocused` paints a focused button. For linked captions, `label` paints ordinary text,
`labelSelected` signals that the target has focus, and `labelShortcut` highlights its accelerator.
Inputs, lists, trees, and specialist controls use their documented focused roles.

Do not rely on colour alone. Keep a caret, selected frame or border, `Focused:` status text, or
another non-colour cue. Verify the same interaction in monochrome, reduced colour depth, and ASCII
fallbacks, and keep focus instructions visible in a small viewport.

## Failure modes and diagnosis

| Symptom                                        | Cause                                                                    | Correction                                                              | Evidence                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `focusView(panel)` does nothing                | `panel` is a passive composite rather than its focusable leaf            | Target the child or use `focusInto(panel)`                              | `getFocused()` names the descendant after entry                 |
| A hidden control still occupies cells          | `state.visible` changed without layout invalidation                      | Call `invalidateLayout()` after the visibility write                    | The next frame reflows siblings into the released cells         |
| Tab skips a control                            | The view or an ancestor is hidden, disabled, unmounted, or not focusable | Inspect the whole ancestry and restore eligibility at the correct owner | Forward and reverse traversal both include the target           |
| Focus styling looks stale                      | State changed without repaint invalidation                               | Call `invalidate()` when geometry is unchanged                          | Old and new focus cues repaint in one frame                     |
| A removed child still receives service updates | The subscription was not owned by its mounted scope                      | Acquire on mount and release with `onCleanup()`                         | Removing the subtree stops later callbacks                      |
| A modal lets focus escape                      | Work was displayed modelessly or closed outside its modal host           | Use `execView()` and a terminating Dialog command                       | Tab wraps inside the modal and outside input stays inert        |
| Focus does not restore after a modal           | The saved target was removed or made ineligible                          | Keep it mounted and eligible, or choose an explicit fallback            | Closing reports the expected `Restored focus:` target           |
| Instructions clip in a small viewport          | Fixed geometry was authored without responsive resize behavior           | Preserve instruction rows and let the principal workspace grow          | Compact, resize, maximize, and restore evidence stays unclipped |

Development builds also explain common focus no-ops, including attempts to target an unmounted,
hidden, disabled, or passive composite view. Use the warning as diagnosis, then verify through the
public focus result rather than matching warning prose in application logic.

## Best practices

- Make retained child order match reading and keyboard order; visual rearrangement alone creates an
  inaccessible mental model.
- Focus the actual interactive leaf. Use `focusInto()` when restoration is part of the requirement.
- Treat visibility and eligibility as one state transition; otherwise focus can point at content the
  user cannot see.
- Keep acquisition and cleanup together in the mounted owner; otherwise removed screens continue
  doing work.
- Use real modal execution for blocking decisions; a painted overlay without a modal scope leaves
  the background interactive.
- Provide visible, textual or structural focus evidence in addition to colour.
- Test forward and reverse traversal, constrained geometry, modal containment, and restoration.

## Practice and next steps

Exercise 1: traverse the first laboratory forward with Tab and backward with Shift+Tab; write down
the tree order before looking at the status line. Exercise 2: make Beta hidden and Gamma disabled,
then predict the next eligible target in both directions. Exercise 3: focus each main-window
control, open the modal, traverse it, and verify that Esc restores the correct one. Finally, resize
and maximize both laboratories and repeat the keyboard path.

Continue with:

- [Label](/components/controls/label) for linked focus targets and accelerators;
- [Dialog](/components/containers/dialog) for modal commands and validation;
- [Events, commands & keymaps](/guide/events-commands-and-keymaps) for dispatch and precedence;
- [Dialogs & modality](/guide/dialogs-and-modality) for complete modal workflows; and
- [Writing your own widget](/guide/writing-your-own-widget) for custom focusable controls.

Public API:

- [`View`](/api/ui/classes/View)
- [`Group`](/api/ui/classes/Group)
- [`EventLoop`](/api/ui/interfaces/EventLoop)
- [`Dialog`](/api/ui/classes/Dialog)
