/**
 * Specification tests (immutable oracles) — reactive core hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-03 + AC-1, plan docs 03-04-reactive-core.md and
 * 07-testing-strategy.md (ST-1.z, ST-1.z2). Disposal is **final**: a computation disposed while a
 * write that dirtied it is still queued must never run again — no resurrection, no re-subscription.
 * Expectations derive from the AC, never from reading the implementation.
 *
 * Later hardening phases append their reactive oracles (ST-3.d, ST-6.a–c) to this file.
 */
import { test, expect } from 'vitest';
import { signal, effect, createRoot, batch, Show } from '../src/reactive/index.js';

// ST-1.z — dispose during a batch that also wrote a tracked source: the effect never re-runs.
test('ST-1.z: an effect disposed mid-batch is not resurrected by the closing flush', () => {
  const s = signal(0);
  let runs = 0;

  const dispose = createRoot((disposeScope) => {
    effect(() => {
      s();
      runs += 1;
    });
    return disposeScope;
  });
  expect(runs).toBe(1); // ran once on creation

  // Same batch: dirty the effect, then dispose its scope. The closing flush must skip the
  // disposed-but-queued effect — not run it (which would also re-subscribe it forever).
  batch(() => {
    s.set(1);
    dispose();
  });
  expect(runs).toBe(1); // disposed effect not resurrected in the closing flush

  s.set(2);
  expect(runs).toBe(1); // and never again — it never re-subscribed
});

// ST-1.z2 — a `Show` branch torn down in the same flush that dirtied its inner effect: the inner
// effect is not resurrected, and later writes to the source it read reach it zero times (it is
// absent from that source's observer set).
test('ST-1.z2: a Show branch effect torn down mid-flush is not resurrected', () => {
  const visible = signal(true);
  const s = signal(0);
  let innerRuns = 0;

  const dispose = createRoot((disposeScope) => {
    const branch = Show(
      () => visible(),
      () => {
        effect(() => {
          s();
          innerRuns += 1;
        });
        return 'shown';
      },
      () => 'hidden',
    );
    // A consumer effect reads the accessor so the branch memo is driven and re-evaluates on a flip.
    effect(() => {
      branch();
    });
    return disposeScope;
  });
  expect(innerRuns).toBe(1); // the inner branch effect ran once when the branch mounted

  // Same flush: flip the branch away (queues the teardown driver first) AND dirty the inner effect.
  // The teardown disposes the inner effect while it is still queued DIRTY — it must be skipped.
  batch(() => {
    visible.set(false);
    s.set(1);
  });
  expect(innerRuns).toBe(1); // torn-down inner effect not resurrected

  s.set(2);
  expect(innerRuns).toBe(1); // removed from s's observers — later writes reach it zero times

  dispose();
});
