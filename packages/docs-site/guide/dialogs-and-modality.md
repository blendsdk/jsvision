---
title: Dialogs & modality
description: Build modal dialog workflows with typed results, validation, cancellation, nested focus, and safe lifecycle cleanup.
---

# Dialogs & modality

Dialogs interrupt the normal application flow to ask for one bounded decision: confirm a
destructive action, rename an item, repair invalid input, or review a choice before committing it.
The hard part is not drawing a window. It is preserving an honest result, a reachable cancellation
path, predictable focus, and complete cleanup through every exit.

## Who this course is for

This course is for developers building task-oriented JSVision applications. It assumes you already
know the [application shell](/guide/application-shell), retained views, and the focus model from
[Views & focus](/guide/views-and-focus).

By the end you will be able to **build** modal workflows, **explain** who owns each result and focus
frame, **diagnose** validation and cleanup failures, and **verify** nested, cancelled, and disposed
paths. The motivating problem is a settings workspace where a user can rename an item, validate the
new value, confirm a destructive discard, or cancel without changing application state.

The beginner boundary is choosing and awaiting a standard helper. Everyday intermediate work
includes custom validated dialogs and explicit cleanup. Advanced work includes nested LIFO stacks,
input confinement, ineligible focus targets, quit cascades, and teardown while promises are pending.

## Mental model

A modal is a stack frame owned by the event loop:

```text
application focus
  └─ execView(outer) saves application focus
       └─ execView(inner) saves outer focus
            ├─ endModal(inner result) restores outer focus
            └─ endModal(outer result) restores application focus
```

`execView<R>(view)` activates a view that is already in the mounted tree and returns a
`Promise<R | undefined>`. Await the promise to receive its result. `endModal(result)` resolves the
top active modal only. While a modal is open, key, mouse, paste, command, and focus traversal stay
inside the top modal subtree; the outer application is inert.

Input events stay in the top modal subtree; the outer background remains inert.

Disposal is different from a user decision. Permanently disposing the event loop resolves every
pending modal promise with `undefined` and skips focus restoration into the tree being torn down.
That third state is why application code must not treat every non-OK result as an ordinary Cancel.

| Event             | Result owner                                 | Focus outcome                         |
| ----------------- | -------------------------------------------- | ------------------------------------- |
| `execView(view)`  | Pushes a modal frame and saves current focus | Focus enters the modal                |
| `endModal(value)` | Pops the top frame and resolves its promise  | Saved eligible focus is restored      |
| Nested `execView` | Pushes above the current frame               | Only the inner subtree receives input |
| Loop disposal     | Resolves all pending frames with `undefined` | No teardown focus restoration         |

## Your first modal result

Use a helper when its return type already matches the decision. `confirm()` mounts and removes its
own dialog, returns a boolean, and maps No, Escape, and the frame close box to `false`.

```ts
import { confirm } from '@jsvision/ui';

const discard = await confirm(app, 'Discard unsaved changes?');
if (discard) {
  document.reset();
}
```

Do not mutate the document before the promise resolves. The result is the commit boundary.

## Interpreting results

The standard helpers deliberately return application-shaped values:

| Helper          | Resolves to        | Use it for                                             |
| --------------- | ------------------ | ------------------------------------------------------ |
| `messageBox()`  | `'ok' \| 'cancel'` | Information or a simple OK/Cancel acknowledgement      |
| `confirm()`     | `boolean`          | A two-way decision where every dismissal means `false` |
| `inputBox()`    | `string \| null`   | One validated text value, or cancellation              |
| `execView<R>()` | `R \| undefined`   | A custom result protocol or nested workflow            |

```ts
import { messageBox } from '@jsvision/ui';

const result = await messageBox(app, {
  title: 'Delete report?',
  text: 'This cannot be undone.',
  buttons: 'okCancel',
});
if (result === 'ok') reports.remove(selectedId);
```

```ts
import { inputBox, signal } from '@jsvision/ui';

const draft = signal(currentName);
const entered = await inputBox(app, {
  title: 'Rename',
  label: '~N~ew name',
  value: draft,
});
if (entered !== null) reports.rename(selectedId, entered);
```

For a custom `Dialog`, branch on the terminating command explicitly. `Commands.ok`,
`Commands.cancel`, `Commands.yes`, and `Commands.no` are the standard vocabulary.

```ts
import { Commands } from '@jsvision/ui';

const result = await app.loop.execView<string>(dialog);
if (result === Commands.ok) {
  saveDraft();
} else if (result === Commands.cancel) {
  leaveStateUnchanged();
} else if (result === undefined) {
  releasePendingWork();
}
```

### Primary live laboratory

<PlayExample id="guides/dialog-results" title="Validate and interpret real dialog results" blurb="Try an invalid OK, repair the value with Alt+F, accept it, then reset and prove that Cancel bypasses validation without committing a value." />

The laboratory starts with an invalid value. Press Alt+O to send a real OK command, observe the
validation veto and focused field, press Alt+F to correct it, then Alt+O again. Alt+R opens the
invalid case without submitting; Alt+C takes the real cancellation path. The command result, value
result, validation state, focus destination, and action source remain visible as non-colour text.

## Validation and cancellation

`Dialog` does not own field rules. On OK, Yes, or No it walks descendants depth-first and calls each
control's zero-argument `valid()` method. The first invalid control keeps the dialog open and
receives focus. Inputs therefore own validation; the dialog only aggregates the answer.

```ts
import { Commands, Dialog, Input, range, signal } from '@jsvision/ui';

const age = signal('150');
const input = new Input({ value: age, validator: range(0, 120) });
const dialog = new Dialog({ title: 'Age', width: 34, height: 8 });
dialog.add(input);

dialog.valid(Commands.ok); // false; the invalid input vetoes OK
```

Cancel must never trap the user. `Commands.cancel` bypasses the validation sweep. Escape and the
modal frame close box resolve through `Commands.cancel` as well. A required field may block OK, Yes,
or No, but it cannot block Cancel.

```ts
import { Commands } from '@jsvision/ui';

if (!dialog.valid(Commands.ok)) {
  showCorrectionHint();
}
dialog.valid(Commands.cancel); // true, even while a child is invalid
```

Keep preview state separate from committed state. Apply it only after OK; restore or discard it on
Cancel and on `undefined`. This prevents a visually cancelled dialog from leaking partial edits.

## Nested modal workflows

Nested modals are last-in, first-out (LIFO). The inner or top modal must resolve before the outer
workflow continues. This is useful when an outer editor needs a focused confirmation, but it should
remain exceptional: too many layers hide context and make cancellation harder to reason about.

```ts
import { Commands, confirm } from '@jsvision/ui';

const outerResult = await app.loop.execView<string>(editorDialog);
if (outerResult === Commands.ok) {
  const approved = await confirm(app, 'Apply these settings?');
  if (approved) settings.commit();
}
```

The sequential form above opens confirmation after the outer dialog closes. When confirmation must
appear _inside_ an open workflow, start it from a non-terminating outer action, await the inner
result, then leave the outer dialog active. Never end the outer frame while the inner frame is still
on top.

```ts
import { confirm } from '@jsvision/ui';

async function reviewFromOuterDialog(): Promise<void> {
  const approved = await confirm(app, 'Use the preview?');
  outerStatus.set(approved ? 'Preview approved' : 'Still editing');
  app.loop.focusView(reviewButton);
}
```

<PlayExample id="guides/modal-workflows" title="Trace a nested modal stack and its cleanup" blurb="Open an outer workflow and inner confirmation, prove input confinement, resolve in LIFO order, cancel the outer frame, then run a disposal probe that resolves pending work as undefined." />

Press Alt+N. Type X while the inner confirmation is open and observe that the outer event count
stays zero. Alt+Y resolves the inner frame and restores the outer action; Alt+C then cancels the
outer frame and restores the launcher. Alt+D runs a separate two-frame event loop and disposes it,
showing `undefined` results and zero mounted modal roots without closing the lesson.

## Input confinement and focus restoration

The event loop clamps all dispatch phases to the top modal subtree. An outside click is ignored, a
background command handler does not run, and Tab wraps within the modal scope. This is an interaction
boundary, not an authorization boundary: a modal cannot grant filesystem, clipboard, or network
authority.

Each modal frame saves the exact focused view present when it opens. On resolution, restoration
occurs only if that saved focus is still mounted, visible, enabled, and otherwise eligible. A stale
or removed focus target is skipped rather than resurrected. If your post-modal cleanup removes or
reactivates desktop windows, explicitly focus a stable surviving target afterward.

```ts
import { Dialog } from '@jsvision/ui';

const restore = app.loop.getFocused();
const dialog = new Dialog({ title: 'Task', width: 36, height: 9 });
app.desktop.addWindow(dialog);
try {
  await app.loop.execView(dialog);
} finally {
  app.desktop.removeWindow(dialog);
  if (restore?.mounted) app.loop.focusView(restore);
}
```

That `try/finally` is required for a custom desktop modal. `execView()` does not mount or remove the
view. In contrast, `messageBox`, `confirm`, and `inputBox` add their dialog before execution and
remove it in `finally`, so callers await only the application result.

## Composition and integration

Choose the smallest owner that matches the work:

| Need                                 | Preferred owner                                                         | Why                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Acknowledgement or one decision      | Standard helper                                                         | Typed result and cleanup are already defined           |
| One validated text value             | `inputBox()`                                                            | Field validation gates OK and returns `string \| null` |
| Custom bounded task                  | `Dialog` plus `execView()`                                              | The application defines result and cleanup             |
| Reusable multi-field schema workflow | [Forms](/guide/forms) / [Form Dialog](/components/controls/form-dialog) | Forms owns typed state, field binding, and submission  |
| Ongoing work beside the application  | Modeless `Dialog` or `Window`                                           | Interaction behind the window must remain available    |

A modeless dialog is an ordinary non-blocking desktop window. It has no modal result and its
terminating commands do not call `endModal`; the application owns its lifetime and button behavior.
Use it only when users genuinely need to interact with work behind it. The
[Dialog component page](/components/containers/dialog) owns constructor options, sizing, chrome,
and widget-level validation details; this course owns application workflows.

Dialog chrome uses the `dialog` theme role. Children retain their own roles:

| Region or state            | Theme role                                       |
| -------------------------- | ------------------------------------------------ |
| Frame and interior         | `dialog`                                         |
| Normal and focused actions | `button`, `buttonFocused`                        |
| Input field and selection  | `inputNormal`, `inputSelected`, `inputSelection` |
| Empty-field hint           | `inputPlaceholder`                               |
| Labels and accelerators    | `label`, `labelSelected`, `labelShortcut`        |

Do not paint a custom background over `dialog`; it can break contrast for focused buttons, fields,
and validation cues. Keep text labels such as “invalid”, “cancelled”, and “restored” so meaning does
not depend on colour.

## Advanced lifecycle behavior

### Quit and disabled commands

An application quit command cascades from the top modal downward. A validating modal may veto the
quit; otherwise each frame resolves with the quit command before the application handler runs.
Disabled terminating commands are ignored, so a disabled OK does not close the dialog.

### Disposal and pending results

Treat `undefined` as host teardown, not user cancellation:

```ts
import { Dialog } from '@jsvision/ui';

const dialog = new Dialog({ title: 'Pending', width: 30, height: 8 });
app.desktop.addWindow(dialog);
const pending = app.loop.execView<string>(dialog);
app.loop.dispose();
const result = await pending;
if (result === undefined) releaseOwnedResources();
```

Acquire and clean up timers, subscriptions, reactive roots, modal views, and host resources in the
same workflow. Never leave a detached modal promise pending.

### Untrusted text and host authority

Dialog text is terminal output. Sanitize untrusted titles, messages, filenames, and network text at
the documented boundary before display; use the public `sanitize` helper from `@jsvision/core` when
the input may contain control characters. Redact sensitive values from diagnostics.

A confirmation does not authorize clipboard, filesystem, or network access. Request host authority
explicitly through the owning adapter, handle denial as a normal result, and keep browser examples
on bounded virtual data rather than visitor resources.

### Reduced geometry

Standard helpers measure their text and button bands, expand within available cells, wrap actions
when needed, and clamp to desktop bounds. Custom dialogs must do the same work. At a reduced or
small viewport, preserve the frame and actions, wrap instructions, and clip only an intentional
workspace. Verify keyboard reachability after resize: keep Tab, Enter, and Escape reachable, and do
not rely on a mouse-only close box.

## Failure modes and diagnosis

| Symptom                                                 | Cause                                                                                          | Correction                                                                      | Distinguishing evidence                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Await stays hung or pending after the window disappears | `Window.close()` removed a modal view but does not call `endModal` or resolve it               | Resolve through OK, Cancel, Escape, the close box, or a custom modal host       | View is gone while the `execView` promise remains pending                       |
| Invalid OK appears to do nothing                        | A descendant vetoed OK                                                                         | Show an explicit invalid cue and let the dialog focus the first invalid control | Dialog stays open and focus lands on that control                               |
| Cancel is blocked by an invalid field                   | Custom logic ran validation for every command                                                  | Route Cancel through `Commands.cancel`, which bypasses validation               | Cancel resolves even with the same invalid value                                |
| Focus does not return                                   | Saved focus became stale, removed, hidden, or disabled; later window cleanup moved focus again | Restore a stable surviving target after cleanup                                 | Modal result is correct, but the old target is ineligible or no longer focused  |
| Nested result order is wrong                            | The outer frame was ended while the inner frame was still active                               | Resolve the top inner frame first and test LIFO order                           | Result trace is outer-before-inner instead of inner-before-outer                |
| Teardown is mistaken for Cancel                         | `undefined` was collapsed into a normal cancellation value                                     | Branch explicitly and release owned resources                                   | Loop disposal resolves pending work as `undefined` and leaves no teardown focus |
| Background action fires during a modal                  | Work bypassed the event loop's modal scope                                                     | Route interaction through the normal event loop                                 | Outer event count changes while the inner modal is topmost                      |
| Dialog clips in a small viewport                        | Fixed geometry ignored frame, buttons, or translations                                         | Measure, clamp, wrap, and test resize/restore                                   | Frame or keyboard instructions disappear at reduced geometry                    |

## Best practices

- Prefer `messageBox`, `confirm`, or `inputBox` when their return type fits. Rebuilding their
  mounting and cleanup adds failure paths without adding product value.
- Treat the awaited result as the only commit boundary. Mutating before OK makes Cancel dishonest.
- Pair `addWindow()` and `removeWindow()` in `try/finally` for custom desktop modals. Otherwise
  rejection or teardown leaves a stale window.
- Always provide Escape or an equivalent keyboard cancellation path. A pointer-only close box is
  unreachable for keyboard users.
- Keep nesting shallow and resolve LIFO. Deep stacks hide context and multiply focus restoration
  states.
- Preserve visible focus and non-colour status text. Theme alone cannot communicate validation,
  cancellation, or restoration.
- Distinguish `undefined` teardown from a user choice. Production shutdown must release resources,
  not silently run Cancel business logic.
- Sanitize untrusted display text and request host capabilities explicitly. A modal is an
  interaction boundary, not a security grant.

## Practice and next steps

1. Branch on every result from `messageBox`, `confirm`, and `inputBox`; verify that dismissal never
   commits state.
2. Add an invalid field to a custom dialog. Prove OK is vetoed, focus moves to the field, and Cancel
   still resolves without changing the model.
3. Open a nested confirmation from a non-terminating outer action. Record inner then outer result
   order and verify exact focus restoration at both levels.
4. Dispose a test event loop with two pending modals. Verify both results are `undefined`, no modal
   remains mounted, and teardown does not focus the removed tree.
5. Resize both workflows to a small viewport and confirm that Tab, Shift+Tab, Enter, accelerators,
   and Escape remain reachable without colour.

Continue with:

- [Application shell](/guide/application-shell) for app ownership and quit behavior;
- [Views & focus](/guide/views-and-focus) for the complete focus eligibility model;
- [Forms](/guide/forms) and [Form Dialog](/components/controls/form-dialog) for multi-field typed
  workflows;
- [Dialog component](/components/containers/dialog) for constructor, geometry, and chrome;
- [`Dialog`](/api/ui/classes/Dialog) and [`EventLoop`](/api/ui/interfaces/EventLoop);
- [`messageBox`](/api/ui/functions/messageBox), [`confirm`](/api/ui/functions/confirm), and
  [`inputBox`](/api/ui/functions/inputBox).
