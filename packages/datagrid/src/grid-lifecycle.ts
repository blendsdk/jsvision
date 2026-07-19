/**
 * The grid's lifecycle states — a caller-driven `status` (loading / ready / error) plus an auto-derived
 * empty state. This module owns the {@link GridStatus} shape, the classification of a raw status into the
 * swap-relevant effective state, the empty-message resolution (filter-aware), and the placeholder view
 * factories (spinner / error). The container swaps the body region between the grid and a placeholder
 * from the {@link LifecycleController}; the empty state is rendered by the body itself (it draws the
 * resolved empty message at zero rows), so `ready` here covers both a populated and an empty grid.
 */
import { Group, Spinner, Text, Button, signal, col, grow, fixed } from '@jsvision/ui';
import type { View, Signal } from '@jsvision/ui';

/**
 * The grid's lifecycle status, driven by the caller's reactive `status` getter. String shorthands
 * normalize to their object form; `error` carries a message and an optional `retry` the grid invokes
 * from the error view's Retry button.
 */
export type GridStatus =
  | 'loading'
  | 'ready'
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; retry?: () => void };

/**
 * The swap-relevant effective state. `ready` covers a populated grid **and** an empty one — the empty
 * message is drawn by the body at zero rows, not by a placeholder — so only `loading`/`error` swap the
 * body region out for a placeholder.
 */
export type LifecycleState = 'loading' | 'ready' | 'error';

interface Classified {
  state: LifecycleState;
  message?: string;
  retry?: () => void;
}

/** Normalize a raw status (string shorthand or object) into the effective state + any error payload. */
function classify(raw: GridStatus): Classified {
  if (raw === 'loading' || (typeof raw === 'object' && raw.kind === 'loading')) return { state: 'loading' };
  if (typeof raw === 'object' && raw.kind === 'error')
    return { state: 'error', message: raw.message, retry: raw.retry };
  return { state: 'ready' }; // 'ready' string or object, or an unrecognized value → ready
}

/** Read the caller's status defensively — a throwing getter is treated as `ready`, never a crash. */
function safeStatus(status: (() => GridStatus) | undefined): GridStatus {
  if (status === undefined) return 'ready';
  try {
    return status();
  } catch {
    return 'ready';
  }
}

/**
 * Resolve the message shown for an empty (zero-row) grid. When the source has rows but a filter reduced
 * the display to zero (`filteredCount < totalCount`), the built-in `'No matching rows'` is used; otherwise
 * the caller's `emptyText` (default `'No rows'`).
 *
 * @param emptyText The caller's empty message, or `undefined` for the default.
 * @param filteredCount The current displayed row count.
 * @param totalCount The pre-filter row count.
 * @returns The empty message to draw.
 * @example
 * emptyMessage('No lines', 0, 5); // 'No matching rows' — a filter hid all 5
 * emptyMessage('No lines', 0, 0); // 'No lines' — a truly empty source
 */
export function emptyMessage(emptyText: string | undefined, filteredCount: number, totalCount: number): string {
  if (filteredCount < totalCount) return 'No matching rows';
  return emptyText ?? 'No rows';
}

/** A full-region column of centered content — the shell every placeholder view shares. */
function placeholderShell(children: View[]): Group {
  // A leading flexible spacer + a trailing one would center vertically; v1 keeps the content near the top
  // (a fixed one-row lead) so it always paints even in a very short body region.
  const lead = fixed(new Group(), 1);
  // An explicit `col`, not a bare `grow`: a tagger writes only the size, and the shell stacks its
  // content vertically — left to the engine default the children would flow side by side.
  return grow(col(lead, ...children));
}

/** The loading placeholder — a spinner with a `Loading…` label. Static first frame paints without a clock. */
function spinnerView(frame: Signal<number>): View {
  const spinner = new Spinner({ frame, label: 'Loading…' });
  fixed(spinner, 1);
  return placeholderShell([spinner]);
}

/** The error placeholder — the message in the error severity, plus a Retry button when `retry` is provided. */
function errorView(message: string, retry?: () => void): View {
  const text = new Text(message, { severity: 'error' });
  fixed(text, 1);
  const children: View[] = [text];
  if (retry !== undefined) {
    const button = new Button('Retry', { onClick: retry });
    fixed(button, 2); // a button needs a content row + a shadow row
    children.push(button);
  }
  return placeholderShell(children);
}

/** The lifecycle controller — computes the effective state and builds the current placeholder on demand. */
export interface LifecycleController {
  /** The effective state (reactive read of the caller's `status`). */
  state(): LifecycleState;
  /** The placeholder view for the current state, or `null` when `ready` (show the grid body). */
  placeholder(): View | null;
}

/**
 * Show the grid body region or a lifecycle placeholder in the swap host, matching the effective state.
 * `ready` shows the assembled grid region (the empty state is drawn by the body itself); `loading`/`error`
 * (re)build and show the spinner/error placeholder. Idempotent for `ready` (no churn when the grid is
 * already shown). The container calls this from a reactive effect and after a body rebuild.
 *
 * @param swap The swap host + the grid region it toggles.
 * @param state The current effective lifecycle state.
 * @param placeholder Builds the placeholder view for a non-`ready` state (a fresh view each call).
 * @example
 * ```ts
 * applyLifecycleSwap({ host, gridRegion }, lifecycle.state(), () => lifecycle.placeholder());
 * ```
 */
export function applyLifecycleSwap(
  swap: { host: Group; gridRegion: Group },
  state: LifecycleState,
  placeholder: () => View | null,
): void {
  const current = swap.host.children[0];
  if (state === 'ready') {
    if (current === swap.gridRegion) return; // already showing the grid — no churn
    if (current !== undefined) swap.host.remove(current);
    swap.host.add(swap.gridRegion);
    return;
  }
  // loading / error → (re)build the placeholder (its message/spinner may have changed).
  const view = placeholder();
  if (view === null) return;
  if (current !== undefined) swap.host.remove(current);
  swap.host.add(view);
}

/**
 * Build the lifecycle controller. It owns only a spinner frame signal (no other reactive state) and reads
 * the caller's `status` on demand, matching the package's controller convention. `state()` drives the
 * body-region swap; `placeholder()` builds the spinner/error view when not `ready`.
 *
 * @param deps The caller's reactive `status` getter (omit for an always-`ready` grid).
 * @returns A {@link LifecycleController}.
 * @example
 * ```ts
 * const lifecycle = createLifecycleController({ status: () => loadState() });
 * lifecycle.state();       // 'loading' | 'ready' | 'error'
 * lifecycle.placeholder(); // the spinner/error view, or null when ready
 * ```
 */
export function createLifecycleController(deps: { status?: () => GridStatus }): LifecycleController {
  const frame = signal(0);
  return {
    state(): LifecycleState {
      return classify(safeStatus(deps.status)).state;
    },
    placeholder(): View | null {
      const c = classify(safeStatus(deps.status));
      if (c.state === 'loading') return spinnerView(frame);
      if (c.state === 'error') return errorView(c.message ?? '', c.retry);
      return null; // ready → the grid body shows
    },
  };
}
