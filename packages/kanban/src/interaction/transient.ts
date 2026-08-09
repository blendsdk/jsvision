import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';

/** Internal transient kinds available before mounted pointer and menu producers arrive. */
type KanbanTransientKind = 'synthetic';

/** One bounded cancellation owner competing for Escape first refusal. */
interface KanbanTransientRegistration {
  /** Stable payload-free owner category. */
  readonly kind: KanbanTransientKind;
  /** Non-negative priority used when a later producer competes for ownership. */
  readonly priority: number;
  /** Idempotently releases the producer's transient work. */
  readonly cancel: () => void;
}

/** Active detached owner with a package-wrapped cancellation callback. */
interface ActiveKanbanTransient {
  readonly kind: KanbanTransientKind;
  readonly priority: number;
  readonly cancel: () => void;
}

/** Raises the common bounded contract error for malformed transient registration. */
function invalidRegistration(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/**
 * Owns at most one prioritized transient and gives it the first Escape cancellation layer.
 *
 * Ownership is removed before application cancellation runs. A reentrant or repeated cancellation
 * therefore cannot invoke the same application callback more than once.
 */
export class KanbanTransientOwner {
  #active: ActiveKanbanTransient | undefined;
  #disposed = false;

  /** Registers a valid owner, replacing and cancelling an owner at the same or lower priority. */
  register(registration: KanbanTransientRegistration): boolean {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    if (
      registration.kind !== 'synthetic' ||
      !Number.isSafeInteger(registration.priority) ||
      registration.priority < 0 ||
      typeof registration.cancel !== 'function'
    ) {
      return invalidRegistration();
    }
    if (this.#active !== undefined && this.#active.priority > registration.priority) return false;
    this.cancel();
    let active = true;
    const cancel = registration.cancel;
    this.#active = Object.freeze({
      kind: registration.kind,
      priority: registration.priority,
      cancel: () => {
        if (!active) return;
        active = false;
        try {
          cancel();
        } catch {
          // Cancellation is best-effort cleanup and cannot escape the interaction boundary.
        }
      },
    });
    return true;
  }

  /** Removes and invokes the current owner once, returning whether Escape was consumed. */
  cancel(): boolean {
    const active = this.#active;
    this.#active = undefined;
    if (active === undefined) return false;
    active.cancel();
    return true;
  }

  /** Cancels the current owner and permanently rejects later registration. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel();
  }
}

/** Fixed explicit priority used only by the deterministic Phase B synthetic owner. */
export const KANBAN_SYNTHETIC_TRANSIENT_PRIORITY = 0;
