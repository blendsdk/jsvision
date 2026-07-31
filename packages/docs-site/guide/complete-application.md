---
title: Build a complete application
description: Build a cohesive JSVision application with state, navigation, persistence, tests, and one verified release workflow.
---

# Build a complete application

## Who is this course for?

This capstone is for developers who have completed
[Application architecture](/guide/application-architecture), [Forms](/guide/forms),
[Screens & routing](/guide/screens-and-routing), [Testing headlessly](/guide/testing-headlessly),
and [In production](/guide/in-production). You already know each mechanism; here you compose them
without repeating the prerequisite courses.

We integrate each prerequisite or earlier course without duplicating or reteaching its specialist
chapters.

You will build one record workflow, explain every owner and boundary, diagnose integrated failures,
and verify a release decision. The motivating problem is continuity: a valid edit must survive
navigation, async work must not outlive its screen, persistence must be authorized, and the exact
artifact must carry current evidence.

## What is the complete-application mental model?

Follow one value through the whole system:

```text
untrusted input → validated form → action → domain state → authorized service
       ↑                                                 ↓
focused editor ← router ← reactive presentation ← persisted result
                              ↓
                  headless evidence → release evidence
```

The project boundary contains packages and configuration. The domain and service layers own rules
and ports. State and actions coordinate phases. A screen or view renders state and routes user
intent. The application owner is long-lived; each route is a screen owner that must dispose its
async work, subscriptions, and focus state.

The capstone uses a record list and editor with save. That narrow vertical slice crosses every
important boundary without becoming a kitchen-sink architecture.

## How do I build the first vertical slice?

Start with the smallest complete walking skeleton that you can build, test, and ship:

```ts
import { resolveCapabilities } from '@jsvision/core';
import { Text, createApplication } from '@jsvision/ui';

const app = createApplication({
  caps: resolveCapabilities().profile,
  content: new Text('Records ready'),
});

const exitCode = await app.run();
```

Add a list-to-editor route, one validated name, and one injected save port before adding more
features. A vertical slice is complete when its normal, invalid, cancelled, failed, and release
paths are observable.

## Laboratory: complete application workflow

Open the editor, save through the authorized in-memory seam, start and cancel a refresh, then
simulate failure and retry. Watch route, phase, pending work, and status change through the same
commands used by buttons and hotkeys.

<PlayExample id="guides/capstone-workflow" title="Run one complete record workflow" blurb="Navigate, save, cancel, fail, and recover while the lab exposes ownership and visible state transitions." />

The browser laboratory uses
`src/example-fixtures/complete-application/workflow-model.ts`. It never accesses visitor files or a
real network. Its injected memory adapter is an authentic boundary substitute, not production
persistence.

## How should I structure the project?

Use Node 22+ with ESM (`"type": "module"`). Keep `@jsvision/core`, `@jsvision/ui`, and
`@jsvision/forms` on the same version or lockstep pin, and import only public package entries.

```text
src/
  domain/records.ts
  services/record-store.ts
  state/record-workflow.ts
  screens/records.ts
  screens/editor.ts
  main.ts
```

`domain` knows no views. `services` defines injected host ports. `state` owns actions and phases.
`screens` compose controls and focus. `main` validates configuration at the environment boundary
before startup and assembles concrete adapters.

```ts
import { z } from 'zod';

const configSchema = z.object({
  dataDirectory: z.string().min(1),
  diagnosticCapacity: z.number().int().min(1).max(256),
});

type RuntimeConfig = z.infer<typeof configSchema>;

function validateConfig(input: unknown): RuntimeConfig {
  // Parse with an application schema before terminal ownership begins.
  return configSchema.parse(input);
}
```

Run build, typecheck, and test from a frozen dependency graph. Package only the verified `dist`
artifact rather than TypeScript source or an unverified workspace.

## How do state, actions, and forms become one workflow?

Signals hold source state; computed values derive presentation. Use an explicit phase rather than
several booleans that can contradict one another.

```ts
import { computed, signal } from '@jsvision/ui';

const phase = signal<'idle' | 'editing' | 'saving' | 'saved' | 'error'>('idle');
const recordName = signal('');
const canSave = computed(() => phase() === 'editing' && recordName().trim() !== '');
```

`createForm()` keeps raw editing separate from trusted typed values. Only `values()` crosses into
the save action; `null` means validation has not produced a trusted record.

```ts
import { createForm } from '@jsvision/forms';
import { z } from 'zod';

const form = createForm({
  schema: z.object({ name: z.string().trim().min(1).max(40) }),
  initial: { name: '' },
});

const values = form.values();
if (values !== null) await actions.save(values);
```

Each command uses the same single action for its menu, button, hotkey, and status affordance.
Otherwise mouse and keyboard paths acquire different validation, authorization, or feedback.

Invalid save keeps the editor open, displays a text error, and moves visible focus to the invalid
field before persistence. It never calls the save seam.

## How do navigation and focus preserve task continuity?

Use typed routes and keep domain state outside disposable screens:

```ts
import { Text, createRouter } from '@jsvision/ui';

type Routes = { records: void; editor: { id: number } };
const router = createRouter<Routes>({
  initial: { name: 'records' },
  routes: {
    records: { build: () => ({ view: new Text('Records') }) },
    editor: { build: ({ params }) => ({ view: new Text(`Edit ${params.id}`) }) },
  },
});

router.push('editor', { id: 1 });
```

Store a stable record key, not a row index or view instance. On Back, replace, or retry, restore
focus to the editor field or the list item with that key. The screen owner releases screen-local
effects; the application owner retains the record and selection state.

## How do I cancel async work and ignore stale results?

Cancellation and request identity solve different races. `AbortController` asks work to stop.
Generation identity marks a late result as stale and tells the owner to ignore or suppress it even
when the dependency ignores abort.

```ts
let generation = 0;
let controller: AbortController | undefined;

async function refresh(): Promise<void> {
  const mine = ++generation;
  controller?.abort();
  controller = new AbortController();
  phase.set('loading');
  const result = await service.load(controller.signal);
  if (controller.signal.aborted || mine !== generation) return;
  records.set(result);
  phase.set('ready');
}
```

Acquire and release together: navigation, replacement, and dispose abort pending work and advance
the generation. A late or stale result must never navigate, overwrite state, announce success, or
persist. Recovery retains input, route, and state so Retry continues the task rather than restarting
the application.

## How does persistence cross an authorized seam?

Define the capability your domain needs and inject it:

```ts
interface SavedRecord {
  readonly id: number;
  readonly name: string;
}

interface RecordStore {
  load(abort: AbortSignal): Promise<readonly SavedRecord[]>;
  save(record: SavedRecord, abort: AbortSignal): Promise<{ ok: true } | { ok: false }>;
}

function createRecordActions(store: RecordStore) {
  return { save: (record: SavedRecord, abort: AbortSignal) => store.save(record, abort) };
}
```

The adapter authorizes permission at the read or write boundary, validates untrusted loaded and
persisted data with a schema, and bounds record count, text length, result bytes, and diagnostic
fields. A filesystem, database, network, virtual store, or host adapter stays outside views.

The browser lab uses an injected authorized in-memory store. It does not touch a visitor file,
clipboard, network, or real database. Production adapters require explicit host authorization.

## How do I test the complete workflow?

Build one deterministic headless fixture with fixed capabilities, viewport, clock, repository, and
scheduler. Drive the same action through keyboard and mouse, then inspect real state and rendered
cells:

```ts
import { Text, createApplication } from '@jsvision/ui';

const workflow = new Text('Records ready');
const app = createApplication({ content: workflow, viewport: { width: 80, height: 24 } });
app.loop.dispatch({ type: 'key', key: 's', ctrl: false, alt: true, shift: false });

const frame = app.loop.renderRoot.buffer().rows();
expect(
  frame
    .flat()
    .map((cell) => cell.char)
    .join(''),
).toContain('Saved');
```

Assert idle, loading, saving, saved, error, cancelled, and retry states. Verify cleanup exactly once,
zero pending work after dispose, and no late state publication. Repeat geometry at 80×24 and a
reduced 68×20 viewport.

A snapshot or self-authored flag is not enough and should be avoided: inspect cells, focus, route,
service calls, bounds, and cleanup counters that an independent observer can verify.

## Laboratory: release rehearsal

Cycle Ready, Non-TTY, Crash loop, Unsafe diagnostic, and Stale evidence. The lab makes ship/no-go
logic and safe bounded records visible, then lets you verify the recovery obligation.

<PlayExample id="guides/capstone-release-rehearsal" title="Rehearse one release decision" blurb="Cycle deterministic release failures and observe why browser evidence remains a rehearsal rather than native proof." />

The implementation is
`src/example-fixtures/complete-application/release-rehearsal.ts`. The scenario fixture includes
non-TTY, crash loop, unsafe diagnostic, and stale evidence outcomes. It is bounded and
deterministic; no payload or secret enters its six-record diagnostic surface.

## How do accessibility and security stay inside the workflow?

Keyboard and Alt-hotkey access is required for every primary workflow action as well as a pointer path. Visible focus
survives validation, route changes, modals, and Retry. Loading, error, saved, and ship/no-go states
use text labels and symbols, not color alone. Monochrome, ASCII, and reduced geometry remain usable
fallbacks with actions reachable by Tab and Enter.

Non-color text labels distinguish loading, error, saved, and release decision states.

Sanitize at the display boundary:

```ts
import { sanitize } from '@jsvision/core';
import { Text, signal } from '@jsvision/ui';

const recordName = signal('report\x1b]0;unsafe\x07');
const safeName = new Text(() => sanitize(recordName()));
```

`sanitize()` removes terminal control behavior from untrusted display text; it is different from
redaction. Redact diagnostics and logs so they never retain a typed payload, paste, secret, or user
text.

## How does the application recover and produce safe diagnostics?

Keep the error inside its owner, preserve valid input and route, show a visible Retry, and classify
the failure before changing state. Use a bounded ring or guarded file logger:

```ts
import { createLogger, redactEvent } from '@jsvision/core';

const logger = createLogger({ sink: 'ring', size: 64 });
logger.warn('workflow', 'save failed', { category: 'authorization' });
logger.debug('input', 'event', redactEvent(event));
```

Do not write diagnostics to the active UI stdout. Allowlist stable categories, release IDs, and
counts; omit payloads, paths, tokens, and environment values. Close the logger with its owner.

## How do I package and verify one release?

Install from a frozen lockfile or immutable install, run build and tests, then bind artifact digest,
version, and commit to current evidence. `Application.run()` owns raw mode, alternate screen,
cursor, and restore:

```ts
import process from 'node:process';
import { createApplication } from '@jsvision/ui';

const app = createApplication({ requireTty: true });
process.exitCode = await app.run();
```

Collect bounded capabilities with their profile reason for a support incident. A release-readiness
or production-readiness result records pass, fail, or warn and yields ship or no-go:

```ts
const result = assessProductionReadiness(releaseId, evidence, {
  assessedAt: releaseClock,
  maxAgeMs: evidenceAgeLimit,
});
if (result.decision === 'no-go') blockRelease(result.checks);
```

Fresh, current evidence must name the same release identifier and artifact before ship. Missing,
failed, or stale evidence blocks with no-go. Evidence age and freshness use an injected clock or
timestamp; rerun the owning check after its maximum age.

The embedded browser cannot prove process supervision, a real TTY, deployment, signal delivery, or
native restoration. Run the native test matrix, packaged artifact, PTY restore, and supervisor
checks in CI or the target environment before release.

## What belongs in advanced application evolution?

After the vertical slice is stable, add migrations, offline conflict policy, richer authorization,
observability budgets, and multiple feature packages one boundary at a time. Prefer specialist
component hubs for Data Grid and Code Editor behavior rather than embedding their courses here.

## How do I diagnose complete-application failures?

| Symptom                             | Likely owner           | Correction                                    | Distinguishing evidence                      |
| ----------------------------------- | ---------------------- | --------------------------------------------- | -------------------------------------------- |
| invalid save reaches storage        | Form/action boundary   | Require schema `values()` before persistence  | validation state and zero store calls        |
| stale completion changes the screen | Async state owner      | Abort and compare generation/request identity | cancellation trace and unchanged route       |
| lost focus after Back               | Router/screen owner    | Restore by stable key after route mount       | focused view and route history               |
| unauthorized persistence            | Host adapter           | Authorize before the injected save call       | denied result and zero writes                |
| diagnostic leak contains user text  | Logging boundary       | Redact and allowlist bounded fields           | serialized ring contains no payload          |
| release no-go appears unexpectedly  | Release evidence owner | Rerun failed, missing, or stale evidence      | release ID, age, reason, and artifact digest |

## What are the best practices?

- Build one vertical slice first because it exposes integration gaps before breadth hides them.
- Keep domain state outside screens so that navigation does not destroy task continuity.
- Use one action per intent because split mouse and keyboard paths drift.
- Validate form output before persistence; otherwise raw editing crosses a trusted boundary.
- Inject host capabilities so authorization remains testable and explicit.
- Bound stored text, result size, and diagnostics to prevent unbounded resource use.
- Pair abort with generation identity because dependencies may finish after cancellation.
- Restore focus by stable identity so list reordering cannot target the wrong record.
- Assert rendered cells and observable calls; otherwise self-authored flags can prove themselves.
- Preserve non-color status text so monochrome users can distinguish failure from success.
- Keep cleanup idempotent because navigation and shutdown can converge on the same owner.
- Bind evidence to artifact identity and freshness so an old green result cannot ship new code.

## What should I practice next?

1. Add an invalid-name case and prove that the authorized store receives zero calls.
2. Resolve a cancelled refresh late and prove it cannot navigate or overwrite state.
3. Restore list focus by record ID after Back and after a reordered result.
4. Replace the memory store with a permission-denied fake and preserve editor input on Retry.
5. Render the labs at 80×24, 68×20, monochrome, and ASCII-safe capability profiles.
6. Build a support bundle whose bounded records contain no user payload.
7. Bind release evidence to a version, commit, digest, deterministic clock, and maximum age.
8. Rehearse native TTY restore and supervisor behavior outside the browser before shipping.

Browse the [component catalog](/components/) for normal controls, or continue in the
[Data Grid](/components/data-grid/) and [Code Editor](/components/code-editor/) specialist hubs.
For exact construction APIs, see
[`createApplication()`](/api/ui/functions/createApplication),
[`createRouter()`](/api/ui/functions/createRouter), and
[`createForm()`](/api/forms/functions/createForm).
