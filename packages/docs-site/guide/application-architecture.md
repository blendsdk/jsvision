---
title: Application architecture & best practices
description: Structure JSVision application architecture with durable boundaries, injected services, explicit ownership, and testable state.
---

# Application architecture & best practices

## Who is this course for?

This course is for developers whose application has grown beyond one screen and a few callbacks.
You should already know [The application shell](/guide/application-shell),
[Reactive state](/guide/reactive-state), and [Screens & routing](/guide/screens-and-routing). The
motivating problem is a workspace where a button performs host work, updates shared state, navigates,
and reports failure—but no one can tell which object owns any of it.

By the end you can **build** a layered feature, **explain** its dependency and ownership directions,
**diagnose** circular imports, stale work, hidden failures, and leaks, and **verify** that commands,
services, state, screens, and cleanup agree.

The beginner boundary is separating a view from a feature action. Intermediate work introduces
injected services, explicit results, commands, and lifetime-based state. Advanced work covers
package boundaries, failure isolation, concurrent generations, disposal, and production judgment.

## What is the application-architecture mental model?

Use four layers, ordered from the most durable policy to the most replaceable presentation:

```text
domain invariants
      ↑
injected services (ports implemented by host adapters)
      ↑
reactive state and actions
      ↑
JSVision presentation (shell, screens, views)
```

Dependencies point inward or toward the more durable policy. Domain code does not import JSVision,
terminal hosts, or concrete adapters. Presentation reads state and dispatches intent; it does not
become the domain model merely because it owns a button.

| Layer                 | Owns                                             | Must not own                                |
| --------------------- | ------------------------------------------------ | ------------------------------------------- |
| Domain invariants     | Valid transitions and framework-independent data | Views, signals, terminals, or routing       |
| Injected services     | Narrow ports for host or infrastructure work     | Screen geometry or global mutable state     |
| State and actions     | Signals, computed projections, results, policy   | Terminal drawing or concrete host discovery |
| JSVision presentation | Layout, focus, commands, screens, feedback       | Business invariants or privileged I/O       |

This direction is a design tool, not a requirement to create four packages for a tiny program.
Start with four responsibilities in one feature folder. Split packages only when the boundary has a
stable public contract and independent consumers.

## How do I build the first useful layered feature?

Start with a pure transition, a service port, and a feature model that publishes explicit state:

```ts
import { signal } from '@jsvision/ui';

type SaveResult = { ok: true } | { ok: false; code: 'unavailable' };
interface SaveService {
  save(text: string): Promise<SaveResult>;
}

export function createEditorFeature(service: SaveService) {
  const text = signal('');
  const status = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const save = async () => {
    status.set('saving');
    const result = await service.save(text());
    status.set(result.ok ? 'saved' : 'error');
  };
  return { text, status, save };
}
```

The service is injected, so a test can supply a deterministic in-memory implementation. The action
owns the asynchronous transition, and presentation only observes `status` and requests `save`.

<PlayExample id="guides/architecture-boundaries"
  title="Architecture Boundaries Laboratory"
  blurb="Compare a coupled direct mutation with the recommended command → injected service → reactive state → view flow, using Alt+C, Alt+L, or the matching buttons."
/>

## Laboratory: architecture boundaries

Run the coupled path first. It is visibly labeled **anti-pattern · not recommended**: the view
changes its own evidence while domain state and the service remain untouched. Then run the layered
path. Its independent counters prove one command, one service call, one state publication, and the
view that reads the result. The comparison exists to diagnose boundary bypass, not to offer two
equally good styles.

Both Alt-hotkeys and buttons reach the same bounded fixture. The laboratory uses no network,
filesystem, clipboard, or visitor data, and its ASCII-safe text status remains meaningful without
colour.

## What belongs in the domain layer?

Domain invariants answer questions that remain true if the terminal UI is replaced. They are pure,
framework-independent functions and types:

```ts
type Cart = Readonly<{ quantity: number; available: number }>;

export function addOne(cart: Cart): Cart {
  if (cart.quantity >= cart.available) return cart;
  return { ...cart, quantity: cart.quantity + 1 };
}
```

The domain accepts data and returns data. It does not import `View`, call `signal()`, open a file, or
emit a command. That makes invalid transitions easy to test without an application shell.

Keep source facts in the domain shape and derive display facts elsewhere. A `canAdd` computed is a
projection of the invariant; it is not a second authority that may drift from it.

## How do injected services cross host boundaries?

A service interface—or port—describes the capability a feature needs. A host adapter implements it:

```ts
interface Clock {
  now(): number;
}

interface Records {
  load(signal: AbortSignal): Promise<readonly string[]>;
}

export function createRecordActions(clock: Clock, records: Records) {
  return { refreshedAt: () => clock.now(), load: (signal: AbortSignal) => records.load(signal) };
}
```

Inject the narrow interface rather than importing a Node filesystem, browser API, process, or
network client inside a view. Production supplies an authorized adapter; tests supply a bounded
fake. The feature still validates results because injection changes replaceability, not trust.

Do not create services inside `draw()` or a screen constructor. Constructors should remain cheap;
acquire an adapter at the application boundary, then pass only the capability a feature needs.

## How do reactive state and actions coordinate work?

State stores source facts and explicit workflow results. Actions validate intent, call a service,
and publish one coherent outcome:

```ts
import { batch, computed, signal } from '@jsvision/ui';

const items = signal<readonly string[]>([]);
const phase = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
const count = computed(() => items().length);

function publishLoaded(next: readonly string[]): void {
  batch(() => {
    items.set(next);
    phase.set('ready');
  });
}
```

Model both success or `ok` and error or failure as a result union or explicit state. Avoid returning
`undefined` for every failure: the action cannot distinguish unavailable work, invalid input, and
cancellation, and the view cannot offer honest retry feedback.

```ts
type LoadResult = { ok: true; records: readonly string[] } | { ok: false; code: 'denied' | 'unavailable' | 'invalid' };

function messageFor(result: LoadResult): string {
  return result.ok ? `${result.records.length} records` : `Load failed: ${result.code}`;
}
```

Computeds derive display-ready facts. Effects belong only at imperative edges and need an owner.
Keep the command or action as the single write surface instead of exporting every signal setter.

## What belongs in JSVision presentation?

Presentation composes a `View`, screen, layout, focus targets, and user-visible feedback. It reads
feature accessors and dispatches a command:

```ts
import { Button, Text, col } from '@jsvision/ui';

declare const status: () => string;
declare const emitSave: () => void;

const body = col(new Text(() => `Status: ${status()}`), new Button('~S~ave', { onClick: emitSave }));
```

The button does not know which service saves, how state is stored, or whether the current host is
Node or a browser. A view may own ephemeral cursor, selection, open/closed, or focus state. It must
not silently become the owner of shared domain or application state.

Show loading, empty, ready, error, disabled, and compact states where they occur. Keep every action
keyboard reachable, preserve visible focus, and use text or symbols—not colour alone—to convey the
result.

## How does one command vocabulary connect the layers?

Use one command vocabulary across menu, status, button, keymap, and screen contributions. Register
the action once; every surface emits the same intent:

```ts
import { Button, createApplication, createKeymap } from '@jsvision/ui';

const app = createApplication({
  keymap: createKeymap({ 'ctrl+s': 'document.save' }),
});
const stopSave = app.onCommand('document.save', () => {
  void feature.save();
});

const saveButton = new Button('~S~ave', {
  onClick: () => app.loop.emitCommand('document.save'),
});
```

`onCommand()` returns an idempotent unregister function. If the handler belongs to one screen,
register and release it with that screen; an application-wide handler may live until application
disposal.

The flow is command or action → service → state/result → view. Do not let the menu call one service,
the button mutate a signal directly, and the keymap navigate. Those paths will disagree on
validation, failure feedback, and cleanup.

## How do I choose state ownership by lifetime?

Name the three normal lifetimes explicitly:

| Lifetime             | Typical owner                                    | Ends when                            |
| -------------------- | ------------------------------------------------ | ------------------------------------ |
| Application lifetime | Session, shared service, durable feature store   | The application or mounted host ends |
| Screen lifetime      | Route state, screen command, pending screen work | Navigation disposes the screen       |
| Widget lifetime      | Input cursor, popup choice, transient selection  | The widget unmounts                  |

Application lifetime state belongs above routing when it must survive every screen. Screen lifetime
state belongs to the route or screen and should normally clean up when users leave. Widget lifetime
state lives in the mounted scope of the individual control.

Acquire or start a resource and release or clean it up in the same owner and same lifetime:

```ts
import { Group } from '@jsvision/ui';

declare function subscribe(refresh: () => void): () => void;

const screen = new Group();
screen.onMount(() => {
  const unsubscribe = subscribe(() => screen.invalidate());
  screen.onCleanup(unsubscribe);
});
```

Make `dispose()` idempotent and verify cleanup exactly once. A count alone is insufficient when late
work can still publish; invoke a retained callback after disposal and prove complete inertia.

<PlayExample id="guides/architecture-ownership"
  title="Architecture Ownership Laboratory"
  blurb="Inspect application, screen, and widget lifetimes while navigation, isolated failure, stale-result suppression, and exact cleanup remain visible through Alt-hotkeys and buttons."
/>

## Laboratory: architecture ownership

Use Alt+N to replace the current mounted screen. The screen and its widget clean up while the
application resource stays alive. Alt+F converts a deterministic service failure into explicit
user-visible error state; failure isolation keeps the rest of app unchanged, stores only a bounded
stable diagnostic code, and discards the fixture's unsafe detail. Alt+S retains a completion that
could publish, replaces its screen generation, then invokes it and reports **Stale result:
suppressed** without replacing the accepted result.

The laboratory reports exact ownership counters and action source. Try the same Navigate action by
mouse, then resize, maximize, and restore. The bounded in-memory fixture performs no external I/O.

## How should dependencies point across packages and features?

Import supported public package entry points such as `@jsvision/ui`; never reach into another
package's `src/` directory or an undocumented internal module. A feature or package boundary should
export a small facade: domain types, service ports, state readers, and actions needed by consumers.

```ts
export type FeatureCommand = 'document.save';

export interface EditorFeature {
  readonly status: () => 'idle' | 'saving' | 'saved' | 'error';
  save(): Promise<void>;
  dispose(): void;
}
```

Within an application, a useful direction is:

```text
app composition → feature facade → domain
              ↘ host adapter implements feature port
```

A circular dependency usually means two modules own the same decision. Extract a shared domain type,
invert the call behind an interface, or move composition to the package boundary. Do not fix the
cycle by importing an internal file through a longer relative path.

Cross-feature communication should use an application action or shared domain contract, not one
screen importing another screen's view instance. Package splitting adds versioning and public API
cost, so require a stable dependency reason before creating it.

## How do screens and widgets compose without owning the domain?

Screens choose which feature projections and actions to present. They can own route parameters,
focus restoration, and work whose cancellation should follow navigation. Widgets own only their
ephemeral interaction:

```ts
import { Button, Input, Text, col, signal } from '@jsvision/ui';

export function buildSearchScreen(runSearch: (query: string) => void) {
  const query = signal('');
  return col(
    new Input({ value: query }),
    new Text(() => `Query: ${query() || 'all'}`),
    new Button('~S~earch', { onClick: () => runSearch(query()) }),
  );
}
```

The screen can pass `query()` into an action when the user submits; it should not give an input
permission to replace the application store. If navigation should preserve a value, lift it to an
application owner or reconstruct it from validated route parameters. Do not keep every screen alive
to hide a mistaken owner.

Use [Router](/components/application/router) for screen lifecycle, not as a domain event bus.
[Data Grid](/components/data-grid/) and [Code Editor](/components/code-editor/) are specialist
courses whose controllers, services, and host policies fit inside these same boundaries.

## What belongs in advanced application architecture?

### Concurrent work and stale results

Give asynchronous work an abort signal and a generation identity. Cancel the previous request when
possible; still reject a late result because cancellation can race with completion:

```ts
let generation = 0;
let active: AbortController | undefined;

async function reload(): Promise<void> {
  const mine = ++generation;
  active?.abort();
  active = new AbortController();
  const result = await records.load(active.signal);
  if (mine !== generation || active.signal.aborted) return;
  publishLoaded(result);
}
```

A disposed or inactive owner must not publish or mutate state. Disposal increments the generation,
aborts current work, unregisters commands, and releases subscriptions. Test both an older result
arriving after a newer one and any late result after disposal.

### Error isolation and diagnostics

Catch a service failure at the feature boundary, preserve valid domain state, and publish explicit
error state and retry availability. One failed feature should leave another screen or the rest of
the app unchanged.

```ts
interface DiagnosticSink {
  error(code: 'LOAD_FAILED'): void;
}

function reportLoadFailure(log: DiagnosticSink): void {
  log.error('LOAD_FAILED');
  phase.set('error');
}
```

Use a bounded or limited diagnostic sink. Emit stable value-free codes and redact secret, token, or
payload fields before they reach it. Screen-safe logging protects terminal drawing; it does not
automatically make application data safe. Keep recovery visible with an explicit error state,
failure feedback, and reachable retry action.

### Production decisions

Measure before keeping screens, caches, or queues alive. State the terminal sizes and capability
profiles used by tests. Put host authorization at the adapter boundary. Treat performance and
compatibility measurements as scoped evidence, not guarantees.

## How do I diagnose architectural failures?

| Symptom                              | Cause                                             | Correction                                       | Evidence                                          |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| A circular dependency appears        | Two features own one decision or import internals | Extract a domain contract or invert an interface | Dependencies point inward through public facades  |
| A screen or widget owns domain state | Durable state was created in a disposable view    | Lift it to the application feature owner         | Navigation preserves state without keep-alive     |
| A stale or late result overwrites UI | Work has no generation, abort, or inactive guard  | Cancel and reject results from ended owners      | Old and post-disposal completions publish nothing |
| A timer or command leaks             | Acquisition and cleanup have different owners     | Register cleanup beside acquisition              | Dispose twice; cleanup runs exactly once          |
| An error or failure is hidden        | Action swallowed failure or returned `undefined`  | Publish an explicit result and retry state       | Valid domain state remains; error is visible      |
| Menu and button behave differently   | Each surface implements its own workflow          | Emit one command vocabulary into one action      | Every surface produces the same state/result      |
| A test needs a real host             | Feature imported a concrete adapter directly      | Inject the narrow service port                   | In-memory service proves the workflow             |

Distinguish symptom from cause. A stale screen can come from wrong state ownership, leaked commands,
or a late service result; build counts, handler counts, generations, and cleanup evidence tell those
causes apart.

## What are the best practices?

- Keep domain invariants pure; importing views there makes every test and adapter depend on the UI.
- Inject narrow service ports; constructing host adapters inside views hides authorization and
  prevents deterministic tests.
- Expose state readers and actions, not unrestricted setters; otherwise every widget can violate the
  same invariant differently.
- Use one command vocabulary across every interaction surface; divergent callbacks produce
  divergent validation and feedback.
- Put state at the shortest owner that meets its lifetime; overly long owners retain work, while
  overly short owners lose user state.
- Acquire and release resources together; cleanup added later is easy to miss and hard to prove.
- Model success, error, cancellation, and retry explicitly; hidden failures leave users and tests
  guessing.
- Cancel stale work and retain a generation guard; cancellation alone does not prevent races.
- Export feature facades and import public APIs only; internal imports turn refactoring into a
  cross-package breaking change.
- Verify domain transitions, feature actions, mounted presentation, and disposal at their real
  boundaries instead of mocking the complete application.

## What should I practice next?

Treat each exercise as an observable experiment:

1. **Boundary:** extract one domain invariant from a screen callback and test it without JSVision.
2. **Command:** make a menu, button, and keymap emit one command; prove one service call and one state
   publication for every source.
3. **Lifetime:** move a value among widget, screen, and application owners; navigate and predict which
   value and resource survive.
4. **Failure:** return a typed service error, preserve valid data, show retry feedback, and verify a
   sibling feature remains unchanged.
5. **Cleanup:** invoke older and post-disposal completions; prove no state, frame, or diagnostic is
   published after ownership ends.

Next, use [Testing headlessly](/guide/testing-headlessly) to turn these boundaries into
specification and implementation evidence, or [Async work](/guide/async-work) for complete
cancellation and progress workflows.

Public API:

- [`createApplication()`](/api/ui/functions/createApplication)
- [`createRouter()`](/api/ui/functions/createRouter)
- [`signal()`](/api/ui/functions/signal)
- [`computed()`](/api/ui/functions/computed)
- [`createRoot()`](/api/ui/functions/createRoot)
