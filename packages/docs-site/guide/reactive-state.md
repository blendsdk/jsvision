---
title: Reactive state
description: A beginner-to-advanced course on JSVision signals, computed values, effects, UI bindings, batching, dependency tracking, ownership, cleanup, Show, and For.
---

# Reactive state

Reactive state lets an interface describe relationships instead of manually pushing every change
through the view tree. Store writable facts in signals, derive new facts with computed values, and
let views or effects subscribe by reading them. When a fact changes, JSVision updates only the work
that actually depended on it.

The reactive core is exported from `@jsvision/ui`, but it is independent of widgets and rendering.
You can use the same primitives to derive form state, coordinate services, or test state transitions
without a terminal.

## Who this course is for

This course is for developers who have completed [Layout](/guide/layout) and are ready to make a
retained interface respond to changing data. You should be comfortable constructing views and
placing them in rows, columns, or exact rectangles. No previous reactive-programming experience is
required.

By the end, you will be able to:

- model source facts and derived values with signals and computeds;
- explain when effects run, how batching changes propagation, and why dependencies can change;
- bind reactive state to built-in and custom views without leaking work;
- diagnose stale values, redundant reruns, feedback cycles, and missing cleanup; and
- verify that a state transition is consistent and that disposed work stays silent.

## Mental model

Think of reactive code as a directed graph:

```text
price signal ─────┐
                  ├─> total computed ─> total Text
quantity signal ──┘
```

There are three primary node types:

| Primitive  | Role                | Read/write behavior                              | Evaluation                       |
| ---------- | ------------------- | ------------------------------------------------ | -------------------------------- |
| `signal`   | Source fact         | Callable read plus `.set()` and `.update()`      | Current immediately              |
| `computed` | Derived fact        | Callable, read-only, with an untracked `.peek()` | Lazy and memoized                |
| `effect`   | Imperative boundary | Reads dependencies and returns no reactive value | Runs immediately, then on change |

Dependency tracking is automatic and runtime-based. While a computed or effect is running, every
signal or computed called by that function becomes a dependency. A later changed write marks the
dependent work stale. Dependencies are collected again on every run, so conditional branches can
change the graph.

JSVision propagation is synchronous and glitch-free. After a write returns, affected effects have
settled unless the write happened inside `batch()`. An effect that reads several derived values sees
one consistent graph state, not a mixture of old and new values.

::: tip Keep the graph directional
Prefer `signal → computed → view/effect`. Computed functions should be pure, while effects should sit
at the edges where reactive state meets logging, timers, storage, network clients, or other
imperative systems.
:::

## Your first reactive view

A reactive UI needs a source value, a view that reads it, and an event that writes it. The `Text`
getter below subscribes when mounted, so the button does not need to find or repaint the label:

```ts
import { Button, Text, col, signal } from '@jsvision/ui';

const count = signal(0);

const counter = col(
  new Text(() => `Count: ${count()}`),
  new Button('~A~dd one', {
    onClick: () => count.update((value) => value + 1),
  }),
);
```

Pressing Alt+A changes the signal synchronously. The mounted `Text` binding observes the write and
requests its own repaint. This small direction—event writes source state, view reads source
state—is the foundation for the larger graphs in this course.

## Start with signals

Create a signal with an initial value. Call it to read, use `.set()` to replace its value, and
`.update()` when the next value depends on the previous one:

```ts
import { signal } from '@jsvision/ui';

const count = signal(0);

count(); // 0
count.set(4);
count.update((previous) => previous + 1);
count(); // 5
```

TypeScript infers `Signal<number>` here. Supply a type argument when the initial value is narrower
than the intended state:

```ts
import { signal } from '@jsvision/ui';

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';
const loadState = signal<LoadState>('idle');
```

### Equal writes do nothing

Signals use `Object.is` by default. Writing a value equal to the current one stores nothing and
notifies nothing. This makes repeated primitive writes cheap, but it also means an object or array
must receive a new reference when its contents change:

```ts
import { signal } from '@jsvision/ui';

const tasks = signal([{ id: 1, done: false }]);

tasks.update((current) => current.map((task) => (task.id === 1 ? { ...task, done: true } : task)));
```

Do not mutate `tasks()` in place and pass the same array back; `Object.is` considers it unchanged.
If domain equality differs from identity, provide an equality predicate. `{ equals: false }` makes
every write notify, including an equal write:

```ts
const temperature = signal(20, {
  equals: (previous, next) => Math.round(previous) === Math.round(next),
});

const redrawTick = signal(undefined, { equals: false });
```

Use custom equality deliberately. It can suppress meaningful changes when the predicate is too
broad, while `equals: false` can create unnecessary work.

## Derive state with computed

A computed describes a value that can be calculated from other reactive values:

```ts
import { computed, signal } from '@jsvision/ui';

const price = signal(10);
const quantity = signal(2);
const total = computed(() => price() * quantity());

total(); // 20
quantity.set(3);
total(); // 30
```

Computeds are:

- **lazy** — the function does not run until the first read;
- **memoized** — repeated reads return the cached value while dependencies remain unchanged;
- **read-only** — consumers cannot set derived state directly;
- **dynamically tracked** — only values read during the latest run remain dependencies.

Use a computed instead of copying derived data into another signal. A copied `total` signal needs
manual synchronization and can temporarily disagree with `price` or `quantity`. The computed makes
the invariant executable.

Like signals, computeds accept an optional `equals` policy. Observers are notified only when the
derived result actually changes. Keep the derivation pure: do not write signals, start timers, or
perform I/O inside it.

## Bind state to views

Many JSVision components accept signals or reactive getters directly. A `Text` getter subscribes
when the view mounts and repaints when the values it reads change:

```ts
import { Text, computed, signal } from '@jsvision/ui';

const first = signal('Ada');
const last = signal('Lovelace');
const fullName = computed(() => `${first()} ${last()}`);

const heading = new Text(() => `User: ${fullName()}`);
```

Editable controls usually receive a writable signal, making state shared and two-way:

```ts
import { Input, Text, signal } from '@jsvision/ui';

const query = signal('');
const input = new Input({ value: query });
const preview = new Text(() => `Searching for: ${query() || 'everything'}`);
```

The input writes the signal; the preview reads it. Neither control needs a callback that knows about
the other.

### Bind custom views after mount

A custom `View` can call `bind()` from `onMount()`. The binding is owned by the view, requests a
repaint by default, and is disposed automatically when the view unmounts:

```ts
import { View, signal, type DrawContext } from '@jsvision/ui';

const status = signal('Ready');

class StatusView extends View {
  constructor() {
    super();
    this.onMount(() => this.bind(() => status()));
  }

  draw(ctx: DrawContext): void {
    ctx.text(0, 0, status(), ctx.color('statusBar'));
  }
}
```

Pass `{ relayout: true }` when the reactive value affects measurement or geometry, not just pixels.
Do not call `bind()` in a constructor: the view has no owner scope until mount. For a stable derived
accessor that belongs to a custom view, use its protected `derived()` helper instead of creating a
bare computed in the constructor.

## Reactive signal graph lab

This lab puts two source signals, their computed total, and an observing effect on one screen.
Change one source, then run the paired sale update. The visible run counter proves that `batch()`
publishes one consistent final snapshot.

<PlayExample id="guides/reactive-graph"
  title="Reactive Signal Graph Lab"
  blurb="Use Alt+P or Alt+Q for a single source write, then Alt+B to update price and quantity together. Compare the computed total and visible effect-run count before maximizing or resizing the centered Classic-theme dialog."
/>

## Run side effects

An effect runs once immediately. Signals and computeds read during that run become dependencies, so
the effect runs again when one changes:

```ts
import { createRoot, effect, signal } from '@jsvision/ui';

const online = signal(false);

const stop = createRoot((dispose) => {
  effect(() => {
    console.log(online() ? 'connected' : 'offline');
  });
  return dispose;
});

online.set(true); // logs "connected"
stop(); // later writes no longer run the effect
```

Effects have no individual disposer. Their lifetime belongs to the owner active when they are
created. A mounted view supplies an owner; standalone reactive work should use `createRoot()`.
Creating an effect or computed without an owner still works, but development builds warn because it
cannot be automatically disposed.

Use effects for imperative work:

- synchronizing a browser or host API;
- starting and stopping a timer or subscription;
- recording analytics or diagnostic output;
- adapting reactive state to a non-reactive library.

Do not use an effect merely to calculate another value. That is what `computed()` is for.

## Coordinate updates

Each changed signal write normally propagates synchronously. Wrap related writes in `batch()` when
consumers should observe them as one transaction:

```ts
import { batch, signal } from '@jsvision/ui';

const first = signal('Ada');
const last = signal('Lovelace');

batch(() => {
  first.set('Grace');
  last.set('Hopper');
}); // dependents run once and see "Grace Hopper"
```

Nested batches join their outer batch. Only the outermost completion flushes pending effects, and
`batch()` returns its callback's result. Signals hold their new values during the callback; batching
delays propagation, not assignment.

You do not need to batch every button handler. Use it when one user action changes several facts
that form one logical state transition, or when repeated writes would otherwise redo expensive
dependent work.

## Control dependencies

### Conditional reads are dynamic

An effect or computed subscribes only to values it read on its latest run:

```ts
import { computed, signal } from '@jsvision/ui';

const useMetric = signal(true);
const celsius = signal(20);
const fahrenheit = signal(68);

const temperature = computed(() => (useMetric() ? `${celsius()} °C` : `${fahrenheit()} °F`));
```

While `useMetric()` is true, changing `fahrenheit` does not invalidate `temperature`. Flipping the
mode reruns the computed, drops the old branch dependency, and subscribes to `fahrenheit`.

### Read without subscribing

Use `untrack()` when a tracked function needs a current value for context but that value should not
trigger it:

```ts
import { effect, signal, untrack } from '@jsvision/ui';

const count = signal(0);
const label = signal('items');

effect(() => {
  console.log(
    untrack(() => label()),
    count(),
  );
});
```

This effect reacts to `count`, not `label`. A signal's `.peek()` is the concise form for one
untracked signal read. A computed also has `.peek()`; it updates the computed if stale but does not
subscribe the surrounding computation.

Use untracked reads sparingly. If a UI value should refresh when the data changes, a tracked read is
correct. Hiding a real dependency with `untrack()` creates stale output.

### Avoid feedback loops

An effect that writes a signal it also reads can repeatedly trigger itself:

```ts
effect(() => {
  count.set(count() + 1); // never converges
});
```

JSVision bounds runaway propagation and throws `ReactiveCycleError` instead of hanging. The better
fix is almost always to model the next value in an event handler or derive it with a computed—not
to catch the cycle error.

## Own and clean up reactive work

`createRoot()` opens an owner scope. Effects, computeds, child roots, `Show` branches, and `For`
items created inside attach to that scope. Calling its `dispose` callback tears the tree down
depth-first and is safe to repeat.

Use `onCleanup()` to release whatever the current run acquired:

```ts
import { createRoot, effect, onCleanup, signal } from '@jsvision/ui';

const intervalMs = signal(1000);

const stop = createRoot((dispose) => {
  effect(() => {
    const timer = setInterval(refresh, intervalMs());
    onCleanup(() => clearInterval(timer));
  });
  return dispose;
});
```

The cleanup runs:

1. before the effect reruns, so the previous timer is cleared before a new one starts;
2. when the owner is disposed;
3. when an effect run throws after registering cleanup.

Several cleanups run in last-registered-first order. Called directly inside an owner rather than an
effect, `onCleanup()` registers one scope-level teardown.

Use `getOwner()` and `runWithOwner()` only when reactive work must be created later but owned by an
existing lifetime. They preserve ownership; `runWithOwner()` does not create a new scope and does
not itself track reads.

## Reactive lifetime lab

The watcher below conditionally reads one of two sources, reads a note with `untrack()`, and
registers cleanup for each run. Update the inactive source and note to see that the watcher does not
rerun; then switch branches, update the active source, and dispose its nested owner.

<PlayExample id="guides/reactive-lifetimes"
  title="Reactive Lifetime Lab"
  blurb="Use Alt+I and Alt+N to change values the watcher does not currently track, Alt+S to recollect its conditional branch, Alt+A to rerun it, and Alt+D to dispose its owner and subscriptions."
/>

## Render conditional and keyed structures

Reactive text changes content inside an existing view. Sometimes state must change which views
exist. `Show` and `For` are generic structural combinators, and `Group.addDynamic()` connects their
accessors to the retained view tree.

### Show one branch

```ts
import { Group, Show } from '@jsvision/ui';

const body = new Group();
body.addDynamic(() =>
  Show(
    () => loggedIn(),
    () => new Dashboard(),
    () => new LoginForm(),
  ),
);
```

`Show` builds only the active branch. When truthiness changes, it disposes the previous branch's
scope before building the next. Omit the else builder when the false state should produce no child.
Construct `Show` inside the `addDynamic()` factory so the group owns its reactive nodes.

### Reconcile a keyed list

```ts
import { For, Group } from '@jsvision/ui';

const list = new Group();
list.addDynamic(() =>
  For(
    () => tasks(),
    (task) => task.id,
    (task, index) => new TaskRow(task, index),
  ),
);
```

`For` uses the key as stable identity. Reordering surviving keys reuses their view instances and
updates each item's reactive `index`; removing a key disposes that item's scope. Keys must be unique
among live items. In development, duplicates warn and resolve last-writer-wins.

Use `Show`/`For` when absence should unmount and release a view. When the same instance and its
internal state should remain alive while hidden, change its plain visibility state and request
layout invalidation so geometry and painted cells update immediately:

```ts
details.state.visible = false;
details.invalidateLayout();
```

When changing several siblings together, update all visibility fields first and invalidate their
shared layout container once.

## Composition and integration

Keep the reactive graph at the boundary that owns the state. A screen can create short-lived state
in its mounted scope; an application service can open an explicit root and expose a `dispose`
operation. Pass accessors or small action functions to child views instead of giving every control
permission to rewrite every signal.

The following state module owns its derived value, groups one logical action, and exposes a bounded
write surface:

```ts
import { batch, computed, createRoot, signal } from '@jsvision/ui';

const cart = createRoot((dispose) => {
  const quantity = signal(1);
  const unitPrice = signal(12);
  const total = computed(() => quantity() * unitPrice());

  const applyOffer = () =>
    batch(() => {
      quantity.set(2);
      unitPrice.set(10);
    });

  return { quantity, unitPrice, total, applyOffer, dispose };
});
```

Construct view-owned state during mount so unmounting releases its computeds and effects. For a
longer-lived service, call its explicit disposer when the application or route owner ends. Keep
host I/O, timers, persistence, and network work in effects with matching `onCleanup()` callbacks;
keep domain calculations in computeds. `Show` and `For` then compose state with the retained view
tree without turning view construction into an imperative synchronization loop.

## Common failure modes

| Symptom                               | Cause                                                                     | Correction                                                                   | Evidence to verify the fix                                     |
| ------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| An object update does not repaint     | The object or array was mutated and written back with the same reference. | Return a new reference from `.update()`, or use a justified equality policy. | The bound view changes once after the immutable write.         |
| Derived values drift apart            | An effect copies one signal into another.                                 | Express the invariant as a `computed()`.                                     | Change each source alone and assert the invariant immediately. |
| A computation leaks after navigation  | It was created without a view or `createRoot()` owner.                    | Create it in the mounted lifetime or an explicit disposable root.            | After disposal, source writes leave the run counter unchanged. |
| A timer or listener duplicates        | An effect reruns without releasing the previous resource.                 | Register `onCleanup()` in the same run that acquires it.                     | Active-resource count stays at one, then reaches zero.         |
| Output stays stale                    | A real dependency was read with `.peek()` or `untrack()`.                 | Use a normal tracked call.                                                   | Changing that dependency now refreshes the visible output.     |
| An effect runs once per field write   | Related writes were published separately.                                 | Group the logical transaction in `batch()`.                                  | One action increments the effect-run counter exactly once.     |
| An effect loops until an error        | It writes a value that it also tracks without converging.                 | Move the write to an event or replace copied state with a computed.          | The event settles without a `ReactiveCycleError`.              |
| Dynamic children survive their parent | `Show` or `For` was built outside `addDynamic()` and passed indirectly.   | Build the combinator inside the factory supplied to `addDynamic()`.          | Branch or item cleanup runs once when its owner unmounts.      |

## Best practices

- Keep signals minimal: store source facts, not every value the screen can display.
- Prefer computed values for pure derivations so invariants cannot drift.
- Keep computed functions pure and deterministic; put imperative work in effects.
- Give every effect and computed a clear owner lifetime.
- Acquire and release resources in the same effect body with `onCleanup()`.
- Batch writes that represent one domain transition, not unrelated changes that happen nearby.
- Use normal tracked reads by default; document why an untracked snapshot is intentionally stale.
- Update objects and arrays immutably under the default identity equality.
- Use stable, unique domain keys with `For`; never use a changing array index as identity.
- Bind reactive values at the narrowest view that needs them instead of invalidating an entire
  application manually.

## Practice

Work through these exercises in order. Use a visible value or counter as evidence rather than
assuming that the graph behaved correctly.

1. **Batch one domain transition.** Create `subtotal`, `discount`, and a computed `total`. Add one
   action that changes both sources inside `batch()`. Verify with an observing effect counter that
   the action publishes one final total and causes exactly one rerun.
2. **Recollect a dynamic dependency.** Derive a displayed temperature from a unit selector plus
   Celsius and Fahrenheit sources. Change the inactive source and verify there is no recomputation;
   switch units, then verify the old source is ignored and the new source is tracked.
3. **Dispose owned work.** Put an effect with `onCleanup()` inside `createRoot()`. Trigger two
   reruns, dispose the root twice, and then change its source again. Verify cleanup ran before each
   rerun and once at disposal, while the final write produces no new run.
4. **Own a structural branch.** Mount a `Show` or keyed `For` through `Group.addDynamic()`. Remove a
   branch or item and verify its view is unmounted and its cleanup runs exactly once.
5. **Stress the real interface.** Repeat the two laboratories with buttons and Alt-hotkeys, then
   resize, maximize, and restore them. Verify state, run counters, instructions, and controls remain
   visible and consistent at every size.

## API reference

- [`signal()`](/api/ui/functions/signal) and [`Signal`](/api/ui/interfaces/Signal)
- [`computed()`](/api/ui/functions/computed) and [`Computed`](/api/ui/interfaces/Computed)
- [`effect()`](/api/ui/functions/effect)
- [`batch()`](/api/ui/functions/batch) and [`untrack()`](/api/ui/functions/untrack)
- [`createRoot()`](/api/ui/functions/createRoot), [`onCleanup()`](/api/ui/functions/onCleanup),
  [`getOwner()`](/api/ui/functions/getOwner), and [`runWithOwner()`](/api/ui/functions/runWithOwner)
- [`Show()`](/api/ui/functions/Show) and [`For()`](/api/ui/functions/For)
- [`ReactiveCycleError`](/api/ui/classes/ReactiveCycleError)

Continue with [Views and focus](/guide/views-and-focus) to connect reactive state to retained view
lifecycles and input routing, or [Forms](/guide/forms) for validation and submission state. When
reactive collections become a specialized workspace, continue with the
[Data Grid course](/components/data-grid/) for typed tabular state or the
[Code Editor course](/components/code-editor/) for document and language-service state.
