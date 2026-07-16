import { computed, effect, onCleanup, signal, untrack } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import type { AsyncValidator } from './types.js';

/**
 * What the store hands the async layer: the field names, the opt-in validator map, the debounce, and
 * two seams back into the store — the raw value signal getter and the synchronous-clean predicate.
 * `fieldSyncClean` MUST be safe to read untracked (the trigger subscribes only its own value).
 */
export interface AsyncConfig {
  /** All field names (schema keys). */
  names: string[];
  /** The opt-in validators, keyed by field name (may be empty). */
  asyncValidators: Partial<Record<string, AsyncValidator<unknown>>>;
  /** Debounce before a validator runs after a change, in ms. */
  debounceMs: number;
  /** The store's raw value signal getter for a field. */
  valueSignal(name: string): Signal<unknown>;
  /** Whether the field currently has no synchronous issue (read untracked by the trigger). */
  fieldSyncClean(name: string): boolean;
}

/** The async-validation handle the store reads to expose `validating()` / `asyncError()` and gate submit. */
export interface AsyncValidation {
  /** Whether the named field is running an async validation (constant `false` for a non-async field). */
  fieldValidating(name: string): boolean;
  /** The named field's latest non-superseded async message (constant `null` for a non-async field). */
  fieldAsyncError(name: string): string | null;
  /** Whether any async field is currently validating. */
  anyValidating(): boolean;
  /** Whether every async field is free of an async error. */
  allAsyncClean(): boolean;
  /** Clear every pending debounce timer (used before a submit force-run). */
  cancelPendingDebounces(): void;
  /** Force-run every async validator now, bypassing the debounce, and await them all. */
  runAllForced(): Promise<void>;
}

/** The per-field async state the layer owns. Only fields with a validator get an entry. */
interface FieldAsyncState {
  /** This field's validator. */
  validator: AsyncValidator<unknown>;
  /** `field.validating()` — true only while the validator is actually running. */
  validating: Signal<boolean>;
  /** `field.asyncError()` — the latest non-superseded message, or null. */
  asyncError: Signal<string | null>;
  /** Monotonic generation counter; a run whose generation is stale drops its result. */
  gen: number;
  /** The pending debounce timer id, if any. */
  timer: ReturnType<typeof setTimeout> | undefined;
  /** The in-flight run's abort controller, if any. */
  controller: AbortController | undefined;
  /** True until the effect's mount run has been skipped (so no check fires for the initial value). */
  firstRun: boolean;
}

/**
 * Build the opt-in per-field async-validation layer that sits beside the synchronous parse.
 *
 * Each field with a validator gets eager `validating` / `asyncError` signals (so form-level
 * aggregates never depend on `field()` having been called) and one standing trigger effect
 * subscribed to its own value. A change debounces a run only while the field is sync-clean; a
 * monotonic generation counter drops a superseded run's result even if its validator ignores the
 * `AbortSignal`, which is the best-effort cancel layered on top. A field with no validator has no
 * entry — its accessors return the constants `false` / `null`. Every effect is owned by the caller's
 * reactive scope, so the store's `dispose()` tears them all down.
 *
 * @param config - the field names, validator map, debounce, and store seams (see {@link AsyncConfig}).
 * @returns the {@link AsyncValidation} handle the store reads.
 */
export function createAsyncValidation(config: AsyncConfig): AsyncValidation {
  const { names, asyncValidators, debounceMs, valueSignal, fieldSyncClean } = config;

  const state = new Map<string, FieldAsyncState>();
  for (const name of names) {
    const validator = asyncValidators[name];
    if (validator === undefined) continue;
    state.set(name, {
      validator,
      validating: signal(false),
      asyncError: signal<string | null>(null),
      gen: 0,
      timer: undefined,
      controller: undefined,
      firstRun: true,
    });
  }

  // Per-field run, shared by the debounced and force paths. Claims a generation, aborts any run it
  // supersedes (a submit force-run has no effect-cleanup between it and the in-flight run to do this),
  // marks validating, awaits the validator (a rejection is treated as no error), then commits the
  // verdict only if it is still the latest generation.
  const run = async (name: string, s: FieldAsyncState): Promise<void> => {
    const g = ++s.gen;
    s.controller?.abort();
    s.controller = new AbortController();
    s.validating.set(true);
    let msg: string | null = null;
    try {
      msg = await s.validator(valueSignal(name)(), { signal: s.controller.signal });
    } catch {
      msg = null; // a rejected validator is treated as "no async error"
    }
    if (g !== s.gen) return; // superseded — drop this result, leave the newer run's state
    s.asyncError.set(msg);
    s.validating.set(false);
  };

  // One standing trigger effect per async field, subscribed to its own value only.
  for (const [name, s] of state) {
    effect(() => {
      valueSignal(name)(); // SUBSCRIBE to this field's value (tracked)

      if (s.firstRun) {
        s.firstRun = false;
        return; // skip the mount run — only user changes validate (a pre-filled value is not a change)
      }

      // Supersede the previous value's async work as a TOTAL no-op, independent of whether the
      // validator honours its AbortSignal. Bumping the generation HERE (not only at run-start) is the
      // load-bearing step: an in-flight run for the OLD value that resolves during THIS value's
      // debounce window sees g !== s.gen and is dropped, so it can never write a stale verdict.
      // abort() is the best-effort cancel on top; validating→false because no run is in flight for the
      // new value yet; asyncError→null because a changed value invalidates the prior verdict.
      s.gen += 1;
      s.controller?.abort();
      s.validating.set(false);
      s.asyncError.set(null);

      // Read the sync-clean gate untracked so an unrelated field's parse never re-subscribes this
      // effect — that isolation is what lets one field validate while another is mid-flight.
      if (!untrack(() => fieldSyncClean(name))) return; // don't validate a malformed value

      s.timer = setTimeout(() => {
        void run(name, s);
      }, debounceMs);

      onCleanup(() => {
        // Fires before the next run (a new keystroke) and once at dispose(): tear down this run's
        // pending debounce + in-flight request. Coalescing and supersession both fall out of this.
        if (s.timer !== undefined) clearTimeout(s.timer);
        s.controller?.abort();
      });
    });
  }

  const anyValidating = computed(() => [...state.values()].some((s) => s.validating()));

  return {
    fieldValidating: (name) => state.get(name)?.validating() ?? false,
    fieldAsyncError: (name) => state.get(name)?.asyncError() ?? null,
    anyValidating: () => anyValidating(),
    allAsyncClean: () => [...state.values()].every((s) => s.asyncError() === null),
    cancelPendingDebounces: () => {
      for (const s of state.values()) {
        if (s.timer !== undefined) {
          clearTimeout(s.timer);
          s.timer = undefined;
        }
      }
    },
    runAllForced: async () => {
      await Promise.all([...state.entries()].map(([name, s]) => run(name, s)));
    },
  };
}
