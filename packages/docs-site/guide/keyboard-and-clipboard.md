---
title: Keyboard & clipboard
description: A beginner-to-advanced course on selection, clipboard commands, host adapters, authorization, async paste, and safe diagnostics in JSVision.
---

# Keyboard & clipboard

Keyboard editing feels local, but clipboard work crosses boundaries: the focused control, the
application command route, and sometimes a browser, terminal, or operating-system host. This course
builds one model for all three so an unavailable host never makes an editor unusable.

## Course introduction

This course is for developers building an editor, form, or application that must behave
consistently in a browser, native terminal, and custom host clipboard. It assumes you have completed
[Events, commands & keymaps](/guide/events-commands-and-keymaps) and are already comfortable with a
command, keymap, and focused event route.

By the end, you will be able to use the default editing and selection chords, choose a host
boundary, explain canonical-first copy and ordered paste, diagnose authorization and stale-result
failures, and verify both behavior and cleanup.

The beginner boundary is selecting, copying, cutting, and pasting inside one application. The
intermediate boundary is choosing native, browser, OSC 52, or custom integration. The advanced
boundary is production judgment: authorization, bounded untrusted text, asynchronous ordering,
lifecycle invalidation, and payload-free diagnostics.

## Mental model

JSVision has one canonical app-local clipboard value. It is the single source of truth for
application copy and paste; a host clipboard is an optional synchronization boundary, not a second
model.

```text
focused control
     │ copy/cut command
     ▼
canonical app-local value ── optional write ──> authorized host
     ▲
     │ fallback paste
external paste event <──── browser or terminal input
     ▲
     │ ordered read
optional native/custom host
```

The focused view owns editing semantics. The event loop owns command routing, canonical clipboard
state, host callbacks, ordering, size bounds, and stale-result checks. The host owns its
authorization policy and physical clipboard. Keeping those responsibilities separate explains why
local copy remains reliable when a browser denies a write or a desktop helper is missing.

| Route                  | Enters JSVision as      | Canonical effect                                          | Host effect                 |
| ---------------------- | ----------------------- | --------------------------------------------------------- | --------------------------- |
| Copy or cut            | `copy` / `cut` command  | Commits exact selected text first                         | Optional asynchronous write |
| App paste              | `paste` command         | Reads canonical value, or adopts a successful native read | Optional ordered read       |
| Terminal/browser paste | Direct paste event      | Adopts external text before delivery                      | No native read              |
| OSC 52 copy            | Encoded terminal output | Uses the already-selected text                            | Capability-gated write only |

## Your first useful result

Start with a writable value and an editable control. The global command route supplies selection
and clipboard behavior; the control only needs to own its text and selection.

```ts
import { Input, signal } from '@jsvision/ui';

const customerName = signal('Ada Lovelace');
const nameField = new Input({ value: customerName });
```

Focus the field, use Shift+arrow to extend the selection, then use Ctrl+C and Ctrl+V. For everyday
input construction and validation, continue with the [Input component](/components/controls/input).
The remainder of this course explains the cross-cutting route around that component.

## Default selection and clipboard chords

The modern bindings are Ctrl+A for select all, Ctrl+C for copy, Ctrl+Shift+C as a copy alias when
the host delivers it, Ctrl+X for cut, and Ctrl+V for paste. The classic bindings are Ctrl+Insert
for copy, Shift+Insert for paste, and Shift+Delete for cut. Shift+arrow extends the keyboard
selection, while a mouse drag extends the selection through pointer input.

Many terminals own or reserve Ctrl+Shift+C and Ctrl+Shift+V as host gestures. Do not require the
application to receive those chords. A host paste gesture normally arrives as a decoded external
paste event, while application Ctrl+V follows the command route.

Choose the default binding family with `clipboardKeys`. The allowed values are `'modern'`,
`'classic'`, `'both'`, and `'none'`; `'both'` is the default.

```ts
import { createApplication } from '@jsvision/ui';

const app = createApplication({ clipboardKeys: 'both' });
```

An application keymap has precedence: it wins over a conflicting default clipboard binding. This
lets a specialized editor claim a chord deliberately without changing the other defaults.

```ts
import { createKeymap } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';

const app = createApplication({
  keymap: createKeymap({ 'ctrl+c': 'inspectSelection' }),
  clipboardKeys: 'both',
});
```

Use `'none'` only when the application or a specialist editing mode supplies the complete command
model. Otherwise, disabling the defaults silently removes portable behavior.

<PlayExample id="guides/clipboard-boundary" title="Clipboard boundary laboratory" blurb="Compare authorized, denied, and unavailable outcomes. Start unavailable, then cycle to denied and authorized. The deterministic virtual host never requests the visitor clipboard; try real fallback and stale delivery." />

The laboratory has one objective: observe that the canonical copy succeeds in all three
authorization states while only the virtual host outcome changes. It uses a deterministic,
in-memory host seam, so no browser permission prompt or visitor-owned clipboard can affect the
lesson.

## The canonical clipboard pipeline

Copy and cut are canonical-first:

1. The focused control contributes the exact selected raw text.
2. The event loop commits that text to the canonical app-local value.
3. The optional host writer receives the same text.
4. A denied, unavailable, or failed host never rolls back or breaks the local canonical value.

Exact means exact: Unicode, line endings, and other raw text are not normalized by the clipboard
pipeline. A later application paste can therefore reproduce the same value.

An external paste event works in the other direction. Text decoded by a terminal or browser paste
is adopted as canonical before the focused control receives it. A later Ctrl+V can repeat that
external text.

Controls use the dispatch event rather than reaching into a host:

```ts
import type { DispatchEvent } from '@jsvision/ui';

function copySelection(event: DispatchEvent, selectedText: string): void {
  event.setClipboard?.(selectedText);
  event.handled = true;
}
```

This boundary is important for reusable controls: the control describes the copy result, and the
application decides whether a physical host is involved.

### Bracketed paste is a direct route

A decoded bracketed paste is a direct paste event. It never calls `readClipboardText`, because the
terminal has already delivered the content. The decoder's truncated flag is retained as metadata
so the focused control or surrounding workflow can show that the input was incomplete.

Native/custom reads are separately bounded to a 1 MiB UTF-8 byte prefix. Truncation never splits a
code point, and the truncation indicator remains evidence that the source was larger. Treat all
pasted content as untrusted input. Before placing paste content in logs, terminal escape-aware
diagnostics, generated markup, shell commands, or other interpreted destinations, validate or
sanitize the display text at that destination's boundary.

## Choose a host boundary

Choose the narrowest boundary that matches the actual runtime.

| Host choice                        | Reads            | Writes                    | Authorization owner          | Use when                                   |
| ---------------------------------- | ---------------- | ------------------------- | ---------------------------- | ------------------------------------------ |
| App-local only                     | Canonical only   | Canonical only            | Application                  | Isolation, tests, or no physical clipboard |
| `Application.run()` native default | Yes              | Yes                       | Desktop/runtime environment  | A normal Node terminal application         |
| Browser mount                      | No native reader | Outbound-only `writeText` | Browser and user             | An xterm-based browser application         |
| OSC 52                             | No               | Capability-gated outbound | Terminal policy              | A supporting terminal explicitly allows it |
| Custom callbacks                   | Optional         | Optional                  | Host/application integration | An embedding host provides a trusted seam  |

### Native terminal default

`Application.run()` installs the native operating-system clipboard lazily by default, but only
when custom callbacks were not supplied. The optional adapter is loaded on the first relevant
gesture rather than during application construction.

Use `systemClipboard: false` to opt out of the automatic operating-system adapter:

```ts
import { createApplication } from '@jsvision/ui';

const noSystemAdapter = createApplication({ systemClipboard: false });
```

This is not strict clipboard isolation. It keeps canonical copy/paste and direct terminal paste,
and `Application.run()` still installs the capability-gated OSC 52 writer when no raw-text writer
exists.

For strict app-local behavior, also supply an explicit no-op raw-text writer. Its presence consumes
the outbound host seam, so `run()` does not install either the native adapter or OSC 52 fallback:

```ts
import { createApplication } from '@jsvision/ui';

const appLocalOnly = createApplication({
  systemClipboard: false,
  writeClipboardText: () => undefined,
});
```

An explicit capability profile with OSC 52 disabled is another valid host-level boundary, but the
no-op writer makes the application intent visible beside the native opt-out.

### Browser boundary

The browser bridge is outbound-only: it calls `writeText` and installs no native reader. Browser
policy can require focus, a secure context, a user gesture, and permission; a browser may deny,
reject, or expose no adapter. Inbound browser paste already arrives through terminal input.

```ts
import type { CapabilityProfile } from '@jsvision/core';
import { setClipboard } from '@jsvision/web';

function browserClipboardWriter(caps: CapabilityProfile) {
  return (text: string): Promise<void> => setClipboard(text, caps);
}
```

The application must never request a visitor clipboard implicitly merely because a docs page,
preview, or control mounted. Obtain permission before a read or write effect, and keep denial an
ordinary capability state.

### OSC 52 boundary

OSC 52 is a capability-gated outbound write and provides no read path. The public helper returns an
empty string when the resolved terminal profile does not permit clipboard output.

```ts
import { resolveCapabilities, setClipboard } from '@jsvision/core';

const caps = resolveCapabilities().profile;
const sequence = setClipboard('copied text', caps);
```

Write the returned sequence only through the host's normal terminal output path. Do not infer
support from the terminal name or bypass the capability profile.

### Custom adapter boundary

Use `readClipboardText` and `writeClipboardText` when an embedding host owns the physical
clipboard. A custom adapter does not grant permission: the host or application still owns
authorization and must establish its policy before invoking a read or write.

```ts
import { createApplication } from '@jsvision/ui';

interface AuthorizedClipboard {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

function createHostedApp(clipboard: AuthorizedClipboard) {
  return createApplication({
    readClipboardText: () => clipboard.readText(),
    writeClipboardText: (text) => clipboard.writeText(text),
  });
}
```

Model at least three capability states: authorized, denied, and unavailable. Denied means the
adapter exists but policy rejected the effect; unavailable means no usable adapter exists. In both
cases canonical fallback continues to keep the application usable.

## Composition and integration

Clipboard commands compose with focus and application routing:

1. The application keymap converts a chord into a command.
2. The focused route gets the first opportunity to handle that command.
3. A copy/cut handler commits canonical state; a paste handler reads it.
4. Only an otherwise-unhandled paste command starts a configured native read.

Menu items and buttons should emit the same commands instead of duplicating editing logic. Bind
enabled state to a control's public selection state when available. For example, `Input` exposes
selection behavior for everyday forms, while the
[Code Editor editing, navigation & clipboard course](/components/code-editor/editing-navigation-clipboard)
owns specialist editor workflows. This Guide owns the cross-host command and authorization model,
not each widget's editing algorithms.

Acquisition and cleanup belong together. If a custom adapter owns subscriptions, handles, or
cancellable work, install it inside an owner and release it on cleanup:

```ts
import { createApplication, createRoot, onCleanup } from '@jsvision/ui';

interface ClipboardSession {
  read(signal: AbortSignal): Promise<string>;
  write(text: string, signal: AbortSignal): Promise<void>;
}

function ownClipboardSession(session: ClipboardSession) {
  return createRoot((disposeOwner) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());

    const app = createApplication({
      readClipboardText: () => session.read(controller.signal),
      writeClipboardText: (text) => session.write(text, controller.signal),
    });

    let disposed = false;
    return {
      app,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        app.loop.dispose();
        disposeOwner();
      },
    };
  });
}
```

Call the returned `dispose()` when the embedding lifetime ends. It explicitly disposes the event
loop before releasing the surrounding owner; the registered cleanup then aborts adapter work.
Application stop/dispose and view unmount are route boundaries, so do not retain a focused view or
clipboard payload beyond them.

## Advanced behavior

### Ordered asynchronous reads

Native reads run one at a time in FIFO gesture order. Command dispatch does not await the adapter,
so pending asynchronous work is non-blocking for input and render. The adapter itself must also use
non-blocking I/O; a synchronous filesystem or process call still blocks the JavaScript thread.

A hung or permanently pending adapter operation holds every later native read in queue order.
Input, rendering, and application stop remain responsive, but later paste results cannot overtake
the hung operation. Put timeout or cancellation policy in the host adapter when that runtime
requires one.

### Stale-result protection

A native result is delivered only if its original focus route remains continuously valid. The
result becomes stale and is discarded after a focus or modal change, an unmount/remount, or
application dispose or stop. This prevents text requested for one field from appearing later in a
different field.

Staleness is stricter than “the same view is focused again.” Moving away and back breaks
continuous validity. That invariant makes delayed delivery predictable during dialogs, navigation,
and window changes.

### Empty reads, failures, and diagnostics

A successful empty read clears the canonical value to empty and is a no-op for editing the focused
control. It is different from failure. A read fail emits one payload-free warning and uses the
current app-local canonical value as the ordered fallback.

Diagnostics must be content-free. Clipboard payload and clipboard text must never be logged in a
diagnostic; redact host error detail rather than copying it into a warning. A stable message such
as “host clipboard read failed” is enough to identify the boundary without exposing user content,
helper paths, or permission internals.

## Failure modes and diagnosis

Use observable route evidence to separate similar symptoms.

| Symptom                                         | Cause                                                 | Correction or fix                                                                  | Evidence                                                                 |
| ----------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Copy works locally and the host rejected it     | Host write was denied or failed                       | Keep canonical fallback; request authorization only from an explicit user action   | Local paste succeeds and a payload-free host-write diagnostic appears    |
| Copy stays local because no bridge exists       | Browser/host adapter is unavailable                   | Continue app-local; offer an explicit setup or authorization action if appropriate | No bridge call occurs and no host-failure warning is promised            |
| Paste uses the app-local value                  | Native read failed                                    | Repair or authorize the adapter; do not clear canonical state on failure           | One read-fail warning followed by canonical fallback                     |
| Paste appears in no field after focus changed   | Async result became stale                             | Keep focus stable or ask the user to paste again                                   | Focus/modal/lifecycle revision changed before delivery                   |
| Paste would target the wrong field or old focus | Route changed while the read was pending              | Discard the stale result; never redirect it to current focus                       | Original continuous focus route no longer matches                        |
| Paste is empty but no warning appears           | Host successfully returned an empty string            | Treat empty read as canonical clear and editing no-op                              | Successful completion with no read-failure diagnostic                    |
| Paste is truncated                              | Native text exceeded the 1 MiB UTF-8 bound            | Show a non-color truncation indicator and let the user retry with a smaller source | Truncation metadata is true; the text ends at a complete code point      |
| Later native pastes never resolve               | An earlier adapter operation is hung                  | Cancel or time-bound the host operation, then retry                                | First pending operation remains at the head of the ordered queue         |
| Ctrl+C runs an application action               | The application keymap intentionally won the conflict | Move the action or choose another `clipboardKeys` policy                           | Keymap lookup resolves the application command before clipboard defaults |

Do not diagnose authorization from clipboard content. Record only state, route, bounded size, and
generic outcome; redact payload and host-specific error details.

## Best practices

- Keep canonical state useful without a host. Otherwise permission denial turns a portable editing
  feature into a platform-dependent failure.
- Prefer the default `'both'` chord set. Change it only for an intentional editing mode, because
  users expect both modern and classic terminal conventions.
- Route buttons, menus, and keys through commands. Parallel copy implementations drift on
  selection, authorization, and failure behavior.
- Authorize before the adapter effect. Mounting a view is not user consent to inspect or modify a
  visitor clipboard.
- Preserve exact raw text in the canonical pipeline. Normalize only in a domain-specific consumer,
  or copied Unicode and line endings will change unexpectedly.
- Treat paste as untrusted and bounded. Sanitize at interpreted output boundaries and preserve
  truncation metadata so incomplete input is visible without relying on color.
- Acquire and clean up host resources in the same owner. Leaked callbacks can deliver stale or
  sensitive work after navigation.
- Keep diagnostics payload-free and redact host errors. Clipboard text and environment details can
  contain secrets even when a failure looks harmless.

## Practice and next steps

Try these experiments:

1. **Modern, classic, and selection:** switch `clipboardKeys` among `'modern'`, `'classic'`,
   `'both'`, and `'none'`; verify Ctrl+C, Ctrl+Insert, Shift+arrow selection, and a mouse drag
   against the expected family.
2. **Denied and unavailable adapter:** use the laboratory to cycle authorized, denied, and
   unavailable states. Verify that canonical paste still succeeds and that diagnostics reveal no
   payload.
3. **Stale pending read:** start the pending operation, change focus, then resolve it. Verify the
   stale result is discarded; repeat without the focus change and compare the outcome.
4. **Bounded input:** feed a custom adapter more than 1 MiB with a multibyte character at the
   boundary. Verify the truncation indicator is set and no code point is split.

Continue with:

- [Events, commands & keymaps](/guide/events-commands-and-keymaps) for command routing and conflict
  design.
- [Running in the browser](/guide/running-in-the-browser) for browser host setup and lifecycle.
- [Input](/components/controls/input) for everyday editable fields.
- [Code Editor: editing, navigation & clipboard](/components/code-editor/editing-navigation-clipboard)
  for specialist editor workflows.
- [`EventLoop` API](/api/ui/interfaces/EventLoop) for generated signatures and exact public types.
