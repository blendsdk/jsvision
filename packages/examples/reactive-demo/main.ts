/**
 * Reactive core walkthrough (RD-01) — a narrated console demo of `@jsvision/ui`'s
 * fine-grained reactivity.
 *
 * Run it (works anywhere, no TTY needed — the reactive core is UI-independent):
 *
 *   yarn workspace @jsvision/examples demo:reactive
 *
 * It steps through signals, effects, computeds, batching, glitch-free diamonds,
 * `Show`, `For`, and owner-scoped disposal — printing what the graph does at each
 * step so you can see "a value change re-runs exactly what read it" in action.
 *
 * Dev-only example — not part of the published package. The package is imported by
 * name (`@jsvision/ui`), exactly as a consumer would.
 */
import { signal, computed, effect, batch, createRoot, onCleanup, Show, For } from '@jsvision/ui';

/** Print a numbered section header. */
function section(title: string): void {
  console.log(`\n${'─'.repeat(64)}\n  ${title}\n${'─'.repeat(64)}`);
}

// Everything runs inside one root owner scope so the final dispose() tears it all down.
createRoot((disposeAll) => {
  // 1 — Signals + effects ----------------------------------------------------
  section('1. Signals + effects — a change re-runs only what read it');
  const count = signal(0);
  effect(() => console.log(`   effect: count = ${count()}`));
  console.log('   > count.set(1)');
  count.set(1);
  console.log('   > count.set(1)        (equal value → no re-run)');
  count.set(1);
  console.log('   > count.update(n => n + 10)');
  count.update((n) => n + 10);

  // 2 — Computeds: lazy + memoized ------------------------------------------
  section('2. computed — lazy (runs on first read) + memoized');
  const price = signal(2);
  let bodyRuns = 0;
  const withTax = computed(() => {
    bodyRuns += 1;
    return price() * 1.2;
  });
  console.log(`   created computed — body run count = ${bodyRuns} (lazy, not run yet)`);
  console.log(`   read withTax() = ${withTax()}  → body runs (count = ${bodyRuns})`);
  console.log(`   read withTax() = ${withTax()}  → memoized (count = ${bodyRuns})`);
  price.set(10);
  console.log(`   after price.set(10): withTax() = ${withTax()}  → recomputed (count = ${bodyRuns})`);

  // 3 — batch: coalesce writes ----------------------------------------------
  section('3. batch — many writes collapse into one re-run (final values)');
  const first = signal('Ada');
  const last = signal('Lovelace');
  effect(() => console.log(`   effect: name = ${first()} ${last()}`));
  console.log('   > batch(() => { first.set("Grace"); last.set("Hopper") })');
  batch(() => {
    first.set('Grace');
    last.set('Hopper');
  });

  // 4 — Glitch-free diamond --------------------------------------------------
  section('4. glitch-free — a diamond re-runs its effect once, never a mixed pair');
  const base = signal(1);
  const tens = computed(() => base() * 10);
  const hundreds = computed(() => base() * 100);
  effect(() => console.log(`   effect: tens + hundreds = ${tens() + hundreds()}`));
  console.log('   > base.set(2)   (both computeds change; effect runs exactly once)');
  base.set(2);

  // 5 — Show: reactive conditional ------------------------------------------
  section('5. Show — mounts one branch, disposes the other (onCleanup fires)');
  const loggedIn = signal(false);
  const screen = Show(
    () => loggedIn(),
    () => {
      onCleanup(() => console.log('   (dashboard scope disposed)'));
      return 'Dashboard';
    },
    () => {
      onCleanup(() => console.log('   (login scope disposed)'));
      return 'Login';
    },
  );
  effect(() => console.log(`   effect: screen = ${screen()}`));
  console.log('   > loggedIn.set(true)');
  loggedIn.set(true);
  console.log('   > loggedIn.set(false)');
  loggedIn.set(false);

  // 6 — For: keyed list with reactive index ---------------------------------
  section('6. For — keyed list; reorder reuses nodes; index() is reactive');
  type Task = { id: number; title: string };
  const tasks = signal<Task[]>([
    { id: 1, title: 'write' },
    { id: 2, title: 'test' },
    { id: 3, title: 'ship' },
  ]);
  let renders = 0;
  const rows = For(
    () => tasks(),
    (task) => task.id,
    (task, index) => {
      renders += 1;
      effect(() => console.log(`   row id=${task.id} "${task.title}" → position ${index()}`));
      return { id: task.id };
    },
  );
  console.log(
    `   rendered ${renders} rows; output ids = [${rows()
      .map((n) => n.id)
      .join(', ')}]`,
  );
  console.log('   > reorder to [3, 1, 2]  (no re-render — only positions update)');
  tasks.set([
    { id: 3, title: 'ship' },
    { id: 1, title: 'write' },
    { id: 2, title: 'test' },
  ]);
  console.log(
    `   render count still ${renders}; output ids = [${rows()
      .map((n) => n.id)
      .join(', ')}]`,
  );
  console.log('   > remove id 2');
  tasks.set([
    { id: 3, title: 'ship' },
    { id: 1, title: 'write' },
  ]);
  console.log(
    `   render count still ${renders}; output ids = [${rows()
      .map((n) => n.id)
      .join(', ')}]`,
  );

  // 7 — Disposal -------------------------------------------------------------
  section('7. disposal — tearing down the scope stops all reactivity');
  console.log('   > disposeAll()   (disposes every effect / Show / For above)');
  disposeAll();
  console.log('   > count.set(999) and tasks.set([])   (nothing re-runs)');
  count.set(999);
  tasks.set([]);
  console.log('   …silence — the graph is disposed.\n');
});
