/**
 * `For` — a reactive keyed list: map a reactive array of items to a reactive array of nodes.
 *
 * Generic over the item type `T` and produced node type `N`. It returns a reactive accessor
 * yielding the current node array (view trees, or any value). Items are reconciled **by key**, so
 * reordering the list reuses the existing node instances (no rebuild) and only removed keys have
 * their scope disposed. Each item is given its own reactive `index`, so an item that reads
 * `index()` re-runs just that item's effect when it moves — the rest of the list is untouched.
 */
import { signal } from './signal.js';
import { effect } from './effect.js';
import { createRoot } from './owner.js';
import { batch, untrack } from './scheduler.js';
import { devWarn } from './warnings.js';

/** Internal per-item reconciliation record. */
interface ForEntry<T, N> {
  /** The rendered node (built once per distinct key over the list's life). */
  node: N;
  /** Disposes this item's owner scope (firing its `onCleanup`s). */
  dispose: () => void;
  /** Updates this item's reactive index, driving any effect that reads `index()`. */
  setIndex: (index: number) => void;
  /** The item currently bound to this key (refreshed on a same-key change / last-writer-wins). */
  item: T;
}

/**
 * Map a reactive list of items to a reconciled, keyed list of nodes.
 *
 * @param each Reactive source of the item array.
 * @param key Returns a stable identity for an item (used directly as a map key). Keys must be unique
 *   among the live items — a duplicate dev-warns and resolves last-writer-wins.
 * @param render Builds a node for an item, receiving a reactive `index` accessor. Called once per
 *   distinct key — never again for a surviving key when the list reorders.
 * @returns A reactive accessor yielding the node array, always in `each()` order and the same length
 *   as `each()`.
 * @example
 * import { signal, For } from '@jsvision/ui';
 *
 * type Task = { id: number; title: string };
 * const tasks = signal<Task[]>([{ id: 1, title: 'write' }, { id: 2, title: 'ship' }]);
 * const rows = For(
 *   () => tasks(),
 *   (task) => task.id,               // stable key → reorder reuses nodes
 *   (task, index) => ({ label: `${index()}: ${task.title}` }),
 * );
 * rows(); // [{ label: '0: write' }, { label: '1: ship' }]
 */
export function For<T, N>(
  each: () => readonly T[],
  key: (item: T, index: number) => unknown,
  render: (item: T, index: () => number) => N,
): () => N[] {
  const entries = new Map<unknown, ForEntry<T, N>>();
  const output = signal<N[]>([]);

  /** Create a fresh entry: its own scope, index signal, and a one-time `render` call. */
  function createEntry(item: T, index: number): ForEntry<T, N> {
    const indexSignal = signal(index);
    // `render` runs under its item scope (createRoot) but untracked, so its own direct reads
    // do not subscribe the driving effect; effects it creates still track normally.
    const created = createRoot((dispose) => ({
      node: untrack(() => render(item, () => indexSignal())),
      dispose,
    }));
    return {
      node: created.node,
      dispose: created.dispose,
      setIndex: (next: number) => indexSignal.set(next),
      item,
    };
  }

  /** Diff the new item list against {@link entries}; returns the node array in item order. */
  function reconcile(items: readonly T[]): N[] {
    const keys = items.map((item, index) => key(item, index));

    // Duplicate-key guard: warn once per reconcile if a key repeats among items.
    const liveKeys = new Set<unknown>();
    let warned = false;
    for (const k of keys) {
      if (liveKeys.has(k) && !warned) {
        devWarn('For received duplicate keys; keeping the last item per key (last-writer-wins).');
        warned = true;
      }
      liveKeys.add(k);
    }

    // Remove entries whose key is gone now (dispose scope → its onCleanups fire).
    for (const [k, entry] of entries) {
      if (!liveKeys.has(k)) {
        entry.dispose();
        entries.delete(k);
      }
    }

    // Create new entries; reuse + refresh surviving ones (no re-render). For a duplicate key the
    // later item wins, claiming the entry.
    for (let i = 0; i < items.length; i += 1) {
      const k = keys[i];
      const existing = entries.get(k);
      if (existing === undefined) {
        entries.set(k, createEntry(items[i], i));
      } else {
        existing.item = items[i]; // refresh item under the stable key (last-writer-wins)
        existing.setIndex(i); // reactive index update; render is NOT re-called for a surviving key
      }
    }

    // Output in item order: each position resolves to its (deduped) entry node, so the length
    // always equals items.length and a duplicate key repeats its node.
    const nodes: N[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const entry = entries.get(keys[i]);
      if (entry === undefined) {
        // Unreachable: every key was inserted above. Guarded to avoid a non-null assertion.
        throw new Error('For: internal invariant violated — missing entry for a live key.');
      }
      nodes.push(entry.node);
    }
    return nodes;
  }

  // Reconcile whenever the list changes; coalesce all index/output writes into one flush.
  effect(() => {
    const items = each();
    batch(() => {
      output.set(reconcile(items));
    });
  });

  return () => output();
}
