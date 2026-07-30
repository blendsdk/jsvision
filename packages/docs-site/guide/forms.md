---
title: Forms
description: Build typed JSVision forms with raw editing state, Zod validation, async validation, loading, submission, and reset workflows.
---

# Forms

Forms are where editable terminal text becomes trusted application data. This course develops that
boundary from a two-field form into production-aware validation, loading, submission, retry, and
cleanup workflows.

## Who is this course for?

This course is for developers building settings screens, record editors, connection dialogs, and
other data-entry workflows. It assumes you already know [reactive
state](/guide/reactive-state), [dialogs and modality](/guide/dialogs-and-modality), and [async
work](/guide/async-work). You do not need prior Zod experience beyond recognizing a schema as an
executable data contract.

By the end, you will be able to:

- **build** a typed form whose controls edit raw values while business code receives coerced data;
- **explain** field identity, validation, touched state, dirty state, and busy-state ownership;
- **diagnose** stale validation, hidden errors, wrong reset targets, and stuck async work; and
- **verify** submission, loading, cancellation, focus recovery, and teardown with observable
  evidence.

The motivating problem is an “Edit server” screen. A person types a name and a port as terminal
text, yet persistence needs `{ name: string; port: number }`. Availability may require an
authorized service check, loading may race, and a failed save must leave the form recoverable.

## What is the form mental model?

`createForm` returns a headless reactive store; it draws no controls. The store owns one stable raw
editing `Signal` per field, one whole-object Zod parse, interaction state, optional async
validators, and lifecycle cleanup.

```text
Input / choice control
        ⇅ shared raw Signal
field("port").value ──→ Zod object parse ──→ typed values() or null
        │                       │
        ├─ touched / dirty      └─ field ZodIssue + form-level issues
        └─ async validator ──→ separate asyncError()
```

Think in three layers:

| Layer      | Owns                                             | Use it for                                           |
| ---------- | ------------------------------------------------ | ---------------------------------------------------- |
| Editing    | `field(name).value`, `rawValues()`               | Text and domain values exactly as controls edit them |
| Validation | Zod parse, `error()`, `errors()`, `asyncError()` | Explain what blocks acceptance                       |
| Workflow   | `submit()`, `reset()`, `load()`, busy signals    | Coordinate user intent and external work             |

The store owns data and state. Controls own presentation and focus. Application code owns
authorization, persistence, safe diagnostics, retry policy, and the lifetime in which the form is
valid.

## How do I build the first useful form?

Define the trusted output with Zod, but seed `initial` with the **raw editing shape**. A numeric
terminal input still edits a string, so the schema performs the conversion.

```ts
import { createForm } from '@jsvision/forms';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  port: z.coerce.number().int().min(1).max(65535),
});

const form = createForm({
  schema,
  initial: { name: '', port: '8080' },
});
```

Keep `form` for as long as the editor lives. An application-level settings form may be long-lived.
A form created for a temporary view or dialog must be disposed with that owner.

## How do raw and coerced values stay typed?

`form.field('port').value` is the raw editing state. The handle and its `Signal` are stable: calling
`field('port')` again returns the same handle and the same `Signal`, so controls and business
logic observe one source of truth.

`rawValues()` is always available, even while invalid. `values()` is the safe boundary: it returns
the schema's coerced output only when the whole form is valid, otherwise `null`.

```ts
import { createForm } from '@jsvision/forms';
import { z } from 'zod';

const form = createForm({
  schema: z.object({ port: z.coerce.number().int().min(1) }),
  initial: { port: '8080' },
});

form.rawValues(); // { port: '8080' } — always available
form.values(); // { port: 8080 } — typed number
form.field('port').value.set('not-a-number');
form.rawValues(); // { port: 'not-a-number' }
form.values(); // null
```

This separation prevents half-parsed data from escaping. Use raw values to render and preserve
editing. Use typed values only after validation, normally inside `submit`'s callback.

## How do bindings, touched, and dirty state work?

Bind an `Input` directly to the field signal. `bindField` adds the interaction seam: when focus
leaves the view for the first time (blur), it marks the field touched. It does not copy values, and
it does not mark a field merely because it mounted or received focus.

```ts
import { bindField } from '@jsvision/forms';
import { Input } from '@jsvision/ui';

const field = form.field('name');
const input = new Input({ value: field.value });
bindField(field, input);
```

`touched` answers “may the UI reveal this error yet?” It becomes true on the first blur or when
`submit()` marks every field touched. `dirty` answers “does the raw value differ from its current
baseline?” The form is dirty when any field is dirty. Validation itself is independent:
`field.error()` is not gated by `touched`; presentation code chooses when to reveal it.

```ts
const name = form.field('name');

const visibleMessage = () => (name.touched() ? (name.error()?.message ?? name.asyncError()) : null);

const leaveWarning = () => (form.dirty() ? 'Unsaved edits' : 'No unsaved edits');
```

Choice controls edit indices or flag arrays, while a schema should validate domain values.
`bindRadio` is a stateless domain-value-to-index lens. `bindCheck` is a selected-domain-values to
flags lens.

```ts
import { bindCheck, bindRadio } from '@jsvision/forms';
import { CheckGroup, RadioGroup } from '@jsvision/ui';

const alignment = ['left', 'right'] as const;
const styles = ['bold', 'italic'] as const;

const radio = new RadioGroup({
  labels: ['Left', 'Right'],
  value: bindRadio(form.field('align'), alignment),
});
const checks = new CheckGroup({
  labels: ['Bold', 'Italic'],
  value: bindCheck(form.field('styles'), styles),
});
```

Keep each options array equal to the schema domain. A radio domain value missing from its options
reads as index `-1`; an out-of-range widget write has no guard. A check write retains only selected
members present in its options.

## How do synchronous and cross-field errors work?

Each field's `error()` returns the first synchronous `ZodIssue` whose path starts at that field, or
`null`. Preserve the `ZodIssue` identity when richer presentation needs its code or path; do not
flatten every issue prematurely into an unstructured string.

`form.errors()` contains path-less issues, usually from an object-level cross-field rule. Attach a
path in `refine` or `superRefine` when one field should own the correction; omit it when the
relationship belongs to the form as a whole.

```ts
import { z } from 'zod';

const schema = z
  .object({
    role: z.enum(['admin', 'reader']),
    port: z.coerce.number().int(),
  })
  .refine((value) => value.role !== 'admin' || value.port === 443, {
    message: 'Admin requires port 443',
  });

form.errors(); // path-less, cross-field ZodIssue entries
```

An error may exist before a field is touched. That independence supports accurate validity while
letting the UI wait until blur or submit before showing noise.

Requesting an unknown name with `field()` throws `FormFieldError`. This usually means schema,
initial values, and view code drifted, or a foreign field handle was passed to `bindField`.

```ts
import { FormFieldError } from '@jsvision/forms';

try {
  form.field('missing' as never);
} catch (error) {
  if (error instanceof FormFieldError) {
    // Fix the schema/view mismatch; do not treat it as user input.
  }
}
```

Zod async refinement and `safeParseAsync` are unsupported by this synchronous form parse. Do not
hide remote work inside the schema. Keep Zod synchronous and put remote or delayed checks in
`asyncValidators`, where cancellation and pending state are explicit.

## How do submit, reset, and load change state?

`submit(onValid)` marks every field touched, then validates. A synchronously invalid form
short-circuits and does not run async validators or `onValid`. A valid form force-runs and awaits
async checks, then awaits `onValid` with coerced, typed values.
The `onValid` callback receives those coerced, typed values, and its returned Promise is awaited
before submission succeeds.

`submitting()` becomes true synchronously, immediately when `submit()` is called. A `finally`
boundary clears it on all paths: invalid, accepted, or thrown persistence work.

```ts
import { Button } from '@jsvision/ui';

const saveButton = new Button('~S~ave', {
  disabled: () => form.submitting(),
  onClick: () => {
    void form.submit(async (values) => {
      await serverStore.save(values); // values.port is a number
    });
  },
});
```

`reset()` restores the current baseline and clears touched and dirty state. Initially that
baseline is `initial`; after a successful load, it is the loaded raw record.

```ts
form.field('name').value.set('edited');
form.dirty(); // true

form.reset();
form.dirty(); // false
form.field('name').touched(); // false
```

`load(loader)` fetches one whole raw record. Success applies it atomically, rebases the baseline,
clears touched state, and leaves the form pristine. A rejected load resolves `false` and leaves the
current record untouched.

```ts
const loaded = await form.load(async ({ signal }) => {
  const record = await repository.readServer('server-42', { signal });
  return { name: record.name, port: String(record.port) };
});

if (!loaded) loadMessage.set('Could not load; existing edits kept');
// reset() now returns to the loaded raw record.
```

Every newer `load()` supersedes the older generation, aborts its `AbortSignal`, and drops a stale
late result. Do not call load during submit; the operations are independent, so the application
must gate that policy.

`loading()`, `validating()`, and `submitting()` represent different work and remain distinct.
Render the right label and disable only conflicting actions. A single undifferentiated “busy”
flag makes failure diagnosis and retry policy ambiguous.

## Laboratory: form state and validation

Start by submitting the empty name. Observe that every field becomes touched and focus returns to
the first invalid input. Fill a valid raw record, submit it, edit it, and reset it. The readout
keeps raw strings, coerced output, dirty state, and the submission result visible together.

<PlayExample id="guides/form-state-validation"
  title="Form State and Validation Laboratory"
  blurb="Compare raw and coerced values, reveal touched and dirty state, then submit and reset the typed record." />

## How does asynchronous validation stay current?

An `AsyncValidator<T>` receives the raw editing value and an `AbortSignal`. It returns a message or
`null`. Normal changes wait for `asyncDebounceMs`, whose default is `300` milliseconds; this
debounce coalesces rapid edits before external work begins.

```ts
import type { AsyncValidator } from '@jsvision/forms';

const availability: AsyncValidator<string> = async (rawUsername, { signal }: { signal: AbortSignal }) => {
  const available = await accountPort.isAvailable(rawUsername, { signal });
  return available ? null : 'Already in use';
};
```

Each run has a generation. A newer edit supersedes the older run, aborts its signal, and ignores a
stale result even if the underlying operation completes anyway. Thread the signal through the
authorized host seam whenever it supports cancellation.

`asyncError()` is separate and distinct from the synchronous `error()` `ZodIssue`. Changing the
value clears the old async verdict immediately. `isValid()` is deliberately optimistic while async
work is pending or in flight; only a resolved async error makes it false. Therefore, do not use
`isValid()` alone as the final save gate.

```ts
const form = createForm({
  schema,
  initial: { username: '' },
  asyncValidators: { username: availability },
  asyncDebounceMs: 300,
});

const field = form.field('username');
field.validating();
field.asyncError(); // string | null, separate from field.error()
```

`submit()` is the authoritative gate. After synchronous validation succeeds, submit force-runs
every async validator, awaits those checks, and accepts only a clean result.

Validator rejection has a surprising but intentional safety contract: a rejected
`AsyncValidator` is treated as no async error, or clean. Catch transport failure inside the
validator and return a safe failure message such as “Could not verify” when unverified data must
not pass.

```ts
const safeAvailability: AsyncValidator<string> = async (value, { signal }) => {
  try {
    const result = await accountPort.isAvailable(value, { signal });
    return result ? null : 'Already in use';
  } catch {
    return 'Could not verify availability';
  }
};
```

## How do async submission, failure, and retry work?

`onValid` may return a Promise. The form awaits it inside the submit gate. If `onValid` throws or
rejects, `submit()` propagates and rethrows that failure after its `finally` clears
`submitting()`. The application owns bounded feedback and retry.

```ts
const save = async (): Promise<void> => {
  try {
    await form.submit(async (values) => {
      await repository.save(values);
    });
    status.set('Saved');
  } catch {
    status.set('Save failed; retry is available');
  }
};
```

Disable duplicate submit while `submitting()` is true, but keep focus and feedback visible. On
failure, preserve raw edits and expose an explicit retry command. Retrying should execute a fresh
forced validation because availability may have changed since the failed persistence attempt.

## Laboratory: async form submission

Start an older validation, supersede it, then settle old and new results out of order. Next,
configure persistence failure and drive forced validation through failure and retry. Every
transition is deterministic and in memory, so cancellation, stale suppression, submission state,
and cleanup remain directly observable.

<PlayExample id="guides/form-async-submit"
  title="Async Form Submission Laboratory"
  blurb="Supersede and abort validation, then take submission through persistence failure, retry, and owned cleanup." />

## How do forms compose with Form Dialog?

Use `formDialog` when a modal editor needs the standard OK/Cancel workflow. It creates and disposes
the store, gives it to `body`, seals termination while submit is pending, and resolves typed values
or `null`.

```ts
import { formDialog } from '@jsvision/forms';
import { Group, Input, at } from '@jsvision/ui';

const result = await formDialog(app, {
  schema,
  initial: { name: '', port: '8080' },
  title: ' Edit server ',
  width: 48,
  height: 10,
  body: (form) => {
    const body = new Group();
    body.add(at(new Input({ value: form.field('name').value }), 2, 1, 30, 1));
    return body;
  },
});
```

The specialist [Form Dialog component](/components/controls/form-dialog) owns modal sealing,
button layout, result semantics, and detailed interaction behavior. This course links to that
component rather than duplicating it. Use `createForm` directly for embedded or multi-pane editors.

## What changes across advanced lifecycle boundaries?

Acquisition and cleanup belong together:

```ts
const form = createForm({
  schema,
  initial,
  asyncValidators,
});

view.onMount(() => {
  view.onCleanup(() => form.dispose());
});
```

`dispose()` is idempotent and safe to call more than once. It cancels debounces, aborts active
validators and loads, and releases the owned reactive scope. This matters most for dialog-owned
async forms: closing a dialog must not allow a late result to update dead UI.

At production boundaries:

- Keep Zod parsing synchronous and bounded. Expensive domain checks belong in cancellable async
  validators or in the final persistence service.
- Load full raw records, not partial patches. Convert domain types back into their editing form
  explicitly because coercion has no automatic inverse.
- Treat `loading`, `validating`, and `submitting` as observable state, not permission. Host access
  still requires explicit authorization.
- Preserve focus on the active field during routine validation. After invalid submit, focus the
  first invalid field and keep keyboard users near the error.

## How do I diagnose form failures?

Use observable state before changing code:

| Symptom                                                | Likely cause                                                          | Correction                                                                 | Distinguishing evidence                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `values()` stays `null`                                | A raw value fails Zod                                                 | Inspect `rawValues()`, each field `error()`, and `form.errors()`           | The raw record remains available and a sync issue identifies the boundary |
| No error is visible                                    | Presentation gated on `touched`, but no blur or submit occurred       | Move focus away or submit; keep validation independent                     | `error()` exists while `touched()` is false                               |
| A stale or wrong verdict appears                       | The host seam ignored its generation or `AbortSignal`                 | Supersede, abort, and drop late generations                                | The old signal is aborted and only the newest result publishes            |
| Reset returns to the wrong baseline                    | Loaded data bypassed `load()` or failed to rebase                     | Apply the full record with `load()`                                        | After successful load, dirty is false and reset returns to that record    |
| UI is stuck forever validating, submitting, or loading | Work never settled, a `finally` path is missing, or cleanup never ran | Settle the controlled operation, preserve `finally`, and dispose the owner | Busy state clears on success, failure, cancellation, and teardown         |

Also check focus explicitly. An invalid keyboard submit should focus the first invalid field,
announce the error with a text label, and leave every action keyboard-reachable.

## What are the best practices?

- Keep raw editing and typed output separate. Persist only values accepted by `submit`; otherwise a
  partially coerced record can cross the trust boundary.
- Reveal field errors after blur or submit, but do not make `touched` control actual validity.
  Hidden invalidity must still block submission.
- Show error, invalid, and busy states with non-color text labels. Use ASCII-safe wording as a
  monochrome fallback; colour may reinforce meaning but cannot own it.
- Design for reduced or small-geometry viewports: wrap instructions, preserve field labels, and
  resize the main workspace so controls do not clip.
- Run `sanitize(untrustedHostText)` at the documented display boundary before rendering untrusted
  host text. Validation does not make terminal output safe.
- Bound or truncate validation and submit diagnostics. Redact secrets, tokens, and sensitive
  payload data; never leak them into status text or logs.
- Treat network, filesystem, and clipboard access as explicit, authorized host capabilities. A
  form grants no implicit permission to use any of them.
- Catch validator transport failures and return a conservative message when “unverified” must not
  mean “accepted.” Catch persistence failures around submit and offer retry without erasing edits.
- Dispose temporary async forms with their view. Otherwise late work can retain resources and
  publish after the screen is gone.

## What should I practice next?

Try these exercises:

1. Add a TLS check and a cross-field rule requiring port 443 for an admin role. Verify both field
   and form-level invalid states.
2. Add radio and check groups, then inspect the domain values rather than their presentation
   indices and flags.
3. Create two controlled async validator generations and complete them in reverse order. Verify
   that the older result cannot publish.
4. Load two records with deferred Promises, settle the older load last, then reset. Verify the
   latest loaded record owns the baseline.
5. Dispose a form while validation and load are pending. Verify both signals abort and no
   post-teardown state changes.

Continue with the [Reactive state course](/guide/reactive-state), [Dialogs and modality
course](/guide/dialogs-and-modality), and [Async work course](/guide/async-work) when you need to
revisit their owning mental models. For modal presentation, use the [Form Dialog
component](/components/controls/form-dialog). For exact generic signatures, see the generated
[`createForm` API reference](/api/forms/functions/createForm).
