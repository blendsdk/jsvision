/**
 * Specification oracles (immutable) — the `formDialog()` modal submit-gate surface.
 *
 * This file opens with the `form.submitting()` oracles (ST-D-SUB1…3), asserted **directly on
 * `form.submit()`** with no dialog — they lock the in-flight signal the dialog's seal + OK-disabled
 * gate depend on. The dialog-behavior oracles (ST-D1…D10) join them below once `formDialog` exists.
 *
 * Derived from the requirements only; a failing spec test means the implementation is wrong, never
 * this test. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { createForm } from '../src/index.js';

/** A manually-resolved deferred, so a test can observe `submitting()` mid-await. */
function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const SchemaD = z.object({ name: z.string().min(1, 'Required') });

// ST-D-SUB1 (RD-08 AC #1/#8) — false at rest, and cleared on the sync-invalid short-circuit path.
test('ST-D-SUB1 submitting() is false at rest and after a sync-invalid submit()', async () => {
  const form = createForm({ schema: SchemaD, initial: { name: '' } }); // name:'' → sync-invalid
  expect(form.submitting()).toBe(false); // at rest

  let onValidRan = false;
  const ok = await form.submit(() => {
    onValidRan = true;
  });

  expect(ok).toBe(false); // invalid → resolves false without calling onValid
  expect(onValidRan).toBe(false);
  expect(form.submitting()).toBe(false); // cleared on the short-circuit
  form.dispose();
});

// ST-D-SUB2 (RD-08 AC #6/#8) — true synchronously at the call, across the await, false once settled.
test('ST-D-SUB2 submitting() is true from the call, across the await, then false', async () => {
  const form = createForm({ schema: SchemaD, initial: { name: 'ok' } }); // valid → reaches onValid
  const gate = deferred();
  let onValidRan = false;

  const p = form.submit(async () => {
    onValidRan = true;
    await gate.promise; // hold the gate open so submitting() is observable mid-flight
  });

  expect(form.submitting()).toBe(true); // synchronous — set before the first await
  await Promise.resolve();
  await Promise.resolve(); // let submit() advance past runAllForced() into the (still-pending) onValid
  expect(onValidRan).toBe(true);
  expect(form.submitting()).toBe(true); // still in flight across the await

  gate.resolve();
  await expect(p).resolves.toBe(true);
  expect(form.submitting()).toBe(false); // cleared on the success path
  form.dispose();
});

// ST-D-SUB3 (RD-08 AC #7) — a rejecting onValid re-throws, and the try/finally still clears the flag.
test('ST-D-SUB3 submitting() clears even when onValid rejects (submit re-throws)', async () => {
  const form = createForm({ schema: SchemaD, initial: { name: 'ok' } }); // valid → reaches onValid
  const p = form.submit(async () => {
    throw new Error('save failed');
  });

  await expect(p).rejects.toThrow('save failed'); // submit() re-throws — onValid is not try/caught inside
  expect(form.submitting()).toBe(false); // finally cleared before the re-throw propagated
  form.dispose();
});
