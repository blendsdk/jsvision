import type { KanbanEditorSessionSnapshot } from './types.js';

/**
 * Delivers complete editor snapshots in transition order and contains listener failures.
 *
 * Reentrant mutations request another pass instead of recursively notifying. That guarantees an
 * observer never receives a newer snapshot followed by the older snapshot that triggered it.
 */
export class KanbanEditorSessionNotifier {
  readonly #listeners = new Set<(snapshot: KanbanEditorSessionSnapshot) => void>();
  #notifying = false;
  #notificationPending = false;

  /** Registers one listener and returns an idempotent release callback. */
  subscribe(listener: (snapshot: KanbanEditorSessionSnapshot) => void): () => void {
    this.#listeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.#listeners.delete(listener);
    };
  }

  /** Drops all presentation listeners when their owning session is disposed. */
  clear(): void {
    this.#listeners.clear();
  }

  /** Publishes the latest complete snapshot after every queued reentrant transition. */
  publish(snapshot: () => KanbanEditorSessionSnapshot, disposed: () => boolean): void {
    if (disposed()) return;
    this.#notificationPending = true;
    if (this.#notifying) return;
    this.#notifying = true;
    try {
      while (this.#notificationPending && !disposed()) {
        this.#notificationPending = false;
        const current = snapshot();
        for (const listener of [...this.#listeners]) {
          if (disposed()) break;
          if (!this.#listeners.has(listener)) continue;
          try {
            listener(current);
          } catch {
            // A presentation subscriber cannot interrupt session ownership or later subscribers.
          }
        }
      }
    } finally {
      this.#notifying = false;
    }
  }
}
