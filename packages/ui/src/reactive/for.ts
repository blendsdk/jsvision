/**
 * `For` (RD-01, 03-03; AR-04, AR-17) — a keyed list combinator.
 *
 * UI-independent: generic over item type `T` and rendered child type `N`, returning a reactive
 * accessor yielding the current node array. Items are reconciled **by key** so a reorder reuses
 * existing node instances (no re-render) and a removed key disposes its scope. Each item carries
 * its own reactive `index`, so `render`'s `index()` re-runs an item effect when the item moves.
 *
 * It is driven by an internal **effect** (not a pure computed): reconciliation writes the
 * per-item index signals and the output signal, and this scheduler requires computeds to be
 * side-effect-free. The whole diff runs in a single `batch` so one list change coalesces to one
 * flush and no item effect observes an intermediate index.
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
 * Render a keyed, reconciled list (AR-04).
 *
 * @param each Reactive source of the item array.
 * @param key Stable identity per item (used directly as a `Map` key); keys should be unique
 *   among live items — duplicates dev-warn and resolve last-writer-wins (AR-17).
 * @param render Builds a node for an item; receives a reactive `index` accessor (AC-19). Called
 *   once per distinct key — never again for a surviving key on reorder (AC-13).
 * @returns A reactive accessor yielding the node array, always in `each()` order and of the same
 *   length as `each()`.
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

    // Duplicate-key guard (AR-17, PA-1): warn once per reconcile if a key repeats among items.
    const liveKeys = new Set<unknown>();
    let warned = false;
    for (const k of keys) {
      if (liveKeys.has(k) && !warned) {
        devWarn('For received duplicate keys; keeping the last item per key (last-writer-wins).');
        warned = true;
      }
      liveKeys.add(k);
    }

    // Remove entries whose key is absent now (dispose scope → its onCleanups fire — AC-13).
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
        existing.setIndex(i); // reactive index update (AC-19); render is not re-called (AC-13)
      }
    }

    // Output in item order: each position resolves to its (deduped) entry node, so the length
    // always equals items.length and a duplicate key repeats its node (PA-6).
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
