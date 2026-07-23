# Reactivity

jsvision uses fine-grained, Solid-style reactivity. You create `signal`s, derive `computed`s, and
the views bound to them repaint automatically when they change.

## Primitives

```ts
import { signal, computed, effect, batch, untrack, createRoot, Show, For } from '@jsvision/ui';

const count = signal(0); // read: count()  write: count.set(3) or count.set((n) => n + 1)
const doubled = computed(() => count() * 2); // lazy, memoized; read: doubled()
effect(() => console.log('count is', count())); // re-runs when count changes

batch(() => {
  count.set(1);
  count.set(2);
}); // one notification, not two

untrack(() => count()); // read without subscribing
```

- **`signal(initial)`** → a getter you call (`count()`) with `.set(value | updater)` and `.peek()`
  (read without subscribing).
- **`computed(fn)`** → a derived, memoized getter; recomputes lazily when its dependencies change.
- **`effect(fn)`** → runs immediately and re-runs when tracked reads change. Own it (see below).
- **`batch(fn)`** → coalesce multiple writes into one propagation.
- **`untrack(fn)`** → read signals without creating a dependency.

## Control flow: `Show` / `For`

Inside a `Group`, add reactive children with `addDynamic` and the `Show`/`For` combinators (see
`layout.md`/`component-catalog.md` for the group API) — `Show` mounts/unmounts a subtree on a
boolean; `For` keyed-reconciles a list. Prefer these over manually adding/removing views.

## The view ↔ reactivity bridge: `view.bind`

`view.bind(reader, apply?, opts?)` subscribes a view to a signal and repaints (or reflows) on
change:

```ts
class Clock extends View {
  constructor(private time: Signal<string>) {
    super();
    // ALWAYS in onMount — the reactive scope does not exist in the constructor.
    this.onMount(() =>
      this.bind(
        () => this.time(),
        () => undefined,
      ),
    );
  }
  override measure() {
    return { width: 8, height: 1 };
  }
  override draw(ctx: DrawContext) {
    ctx.text(0, 0, this.time());
  }
}
```

- The `reader` subscribes; `draw()` re-reads the signal, so `apply` is often a no-op.
- Pass `{ relayout: true }` when the change affects size/position (reflow, not just repaint).
- **`bind()` in the constructor throws** — the view's reactive scope is created at mount.

## Ownership: `createRoot`

Any reactive graph you create outside a view's own scope must be owned, or it leaks across swaps:

```ts
createRoot((dispose) => {
  const s = signal(0);
  effect(() => {
    /* ... */
  });
  // call dispose() to tear the whole graph down
});
```

Views manage their own scope automatically (via `onMount`/`onCleanup`); use `createRoot` for
app-level graphs you build by hand.
