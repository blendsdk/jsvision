/**
 * Implementation tests — `View.derived()` scope-owned derived accessor (fix #37).
 *
 * Companion to `owned-computeds.spec.test.ts` (the widget-level oracle). These exercise the
 * primitive directly through a minimal `View` subclass: pre-mount direct evaluation (no persisted
 * computed), the post-mount owned + memoized computed, and the scope-keyed re-derive after an
 * unmount→remount (D2b — the fix's remount-safety guarantee).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { signal, createRoot, getOwner } from '../src/reactive/index.js';
import { View } from '../src/view/index.js';

/** Pattern of the reactive core's unowned-computation dev warning (would fire on a constructor leak). */
const LEAK_WARNING = /created outside any createRoot|never be auto-disposed/;

/** Run `fn` with `console.warn` captured; restore afterwards. */
function captureWarnings(fn: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]): void => void warnings.push(String(args[0]));
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return warnings;
}

/** A minimal view whose sole derived value counts its derivation runs (to observe memo vs re-run). */
class Derives extends View {
  runs = 0;
  readonly src = signal(0);
  readonly acc: () => number;
  constructor() {
    super();
    // `derived` is protected on `View`; a subclass builds its stable accessor at construction.
    this.acc = this.derived(() => {
      this.runs += 1;
      return this.src();
    });
  }
  draw(): void {
    // no-op
  }
}

test('impl: a pre-mount read evaluates fn directly — no persisted computed, no leak warning', () => {
  let d!: Derives;
  const warnings = captureWarnings(() => {
    d = new Derives();
    // scope === null: each read re-evaluates fn directly (no memo held, no unowned computed built).
    const before = d.runs;
    expect(d.acc()).toBe(0);
    expect(d.acc()).toBe(0);
    expect(d.runs).toBe(before + 2); // fn re-ran on each read → nothing was memoized
    d.src.set(7);
    expect(d.acc()).toBe(7); // reflects the latest source (a stale memo would return 0)
  });
  expect(warnings.filter((w) => LEAK_WARNING.test(w))).toEqual([]);
});

test('impl: the first post-mount read builds an owned, memoized computed (stable accessor identity)', () => {
  const d = new Derives();
  const acc = d.acc; // capture the accessor identity
  createRoot(() => {
    d.mount(null, getOwner());
    d.runs = 0;
    expect(d.acc()).toBe(0); // builds computed under d.scope; fn runs once
    expect(d.acc()).toBe(0); // no dependency change → memoized (fn does NOT re-run)
    expect(d.runs).toBe(1);
    d.src.set(2);
    expect(d.acc()).toBe(2); // dependency changed → recompute
    expect(d.runs).toBe(2);
    expect(d.acc).toBe(acc); // same stable accessor throughout
    d.unmount();
  });
});

test('impl: after unmount→remount the memo re-keys to the new scope (fresh computed, still reactive)', () => {
  const d = new Derives();
  const acc = d.acc;
  createRoot(() => {
    // --- first mount: build the computed and subscribe it to `src` ---
    d.mount(null, getOwner());
    expect(d.acc()).toBe(0);
    d.src.set(2);
    expect(d.acc()).toBe(2);

    // --- unmount (disposes the scope + the computed it owns) → remount into a fresh scope ---
    d.unmount();
    d.mount(null, getOwner());
    d.runs = 0;
    d.src.set(5); // written while the previous mount's computed is disposed (frozen, no edges)
    expect(d.acc()).toBe(5); // re-derived under the new scope → reactive (a one-time memo would read 2)
    expect(d.runs).toBe(1); // a single fresh computed ran once
    expect(d.acc).toBe(acc); // the accessor identity never changed across the remount
    d.unmount();
  });
});
