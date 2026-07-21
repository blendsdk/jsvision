/**
 * Specification oracles (immutable) — the `formDialog()` modal submit-gate surface.
 *
 * This file opens with the `form.submitting()` oracles (ST-D-SUB1…3), asserted **directly on
 * `form.submit()`** with no dialog — they lock the in-flight signal the dialog's seal + OK-disabled
 * gate depend on. The dialog-behavior oracles (ST-D1…D10) below drive `formDialog` on a headless
 * `createEventLoop` host (the `openers.impl.test.ts` pattern): `emitCommand` / `dispatch` for input,
 * a fake `{ loop, desktop }` host, no real TTY, no network.
 *
 * Derived from the requirements only; a failing spec test means the implementation is wrong, never
 * this test. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, vi } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createEventLoop, Commands, Group, Input } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { createForm, formDialog } from '../src/index.js';
import type { Form } from '../src/index.js';

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

// ───────────────────────────────────────────────────────────────────────────────────────────────
// formDialog() behavior oracles (ST-D1…D10) — driven on a headless createEventLoop host.
// ───────────────────────────────────────────────────────────────────────────────────────────────

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** The fillable schema the behavior oracles use: a required name + a coerced-number port. */
const Schema = z.object({ name: z.string().min(1, 'Required'), port: z.coerce.number().int().min(1) });
type Init = { name: string; port: string };
const initial: Init = { name: '', port: '8080' }; // name:'' is sync-invalid until filled

/** A fake execView-capable modal host that captures added/removed windows into a mounted root. */
function makeHost(w = 60, h = 20) {
  const root = new Group();
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const added: View[] = [];
  const removed: View[] = [];
  const host = {
    loop,
    desktop: {
      addWindow: (v: View) => {
        added.push(v);
        root.add(v);
      },
      removeWindow: (v: View) => {
        removed.push(v);
        root.remove(v);
      },
      bounds: { x: 0, y: 0, width: w, height: h }, // ModalDialogHost requires it; formDialog never reads it
    },
  };
  return { loop, host, added, removed };
}

/** The dialog body: a Group holding an Input bound to the name field (absolutely placed). */
function bodyInput(form: Form<typeof Schema, Init>): View {
  const g = new Group();
  const input = new Input({ value: form.field('name').value });
  input.setLayout({ position: 'absolute', rect: { x: 2, y: 1, width: 24, height: 1 } });
  g.add(input);
  return g;
}

/** Drain the microtask queue (a real macrotask; never used under fake timers). */
const macrotask = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** The full painted screen as text, for a label/glyph scan. */
function painted(loop: ReturnType<typeof createEventLoop>): string {
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((c) => c.char).join(''))
    .join('\n');
}

// ST-D1 (RD-08 AC #2) — a valid OK resolves the coerced z.output and tears the dialog down.
test('ST-D1 valid OK resolves the coerced values and removes the dialog', async () => {
  const { loop, host, added, removed } = makeHost();
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    body: (f) => {
      form = f;
      return bodyInput(f);
    },
  });

  form.field('name').value.set('db'); // now sync-valid (port '8080' coerces to 8080)
  loop.emitCommand(Commands.ok);

  await expect(p).resolves.toEqual({ name: 'db', port: 8080 }); // coerced z.output<S>
  expect(removed).toEqual(added); // teardown ran on the same dialog
});

// ST-D2 (RD-08 AC #3) — a sync-invalid OK keeps the modal open, resolves nothing, reveals errors.
test('ST-D2 sync-invalid OK stays open and marks every field touched', async () => {
  const { loop, host, removed } = makeHost();
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial, // name:'' → invalid
    width: 44,
    height: 9,
    body: (f) => {
      form = f;
      return bodyInput(f);
    },
  });

  loop.emitCommand(Commands.ok);
  await macrotask(); // let the async OK gate run submit() and short-circuit false

  let resolved = false;
  void p.then(() => {
    resolved = true;
  });
  await macrotask();
  expect(resolved).toBe(false); // the promise is NOT resolved
  expect(removed.length).toBe(0); // still mounted / modal
  expect(form.field('name').touched()).toBe(true); // errors revealed
  expect(form.field('port').touched()).toBe(true);

  loop.emitCommand(Commands.cancel); // clean up the pending modal
  await p;
});

// ST-D3 (RD-08 AC #4) — an async validator gates OK: the gate force-runs it, stays open, sets asyncError.
test('ST-D3 an async validator that rejects the value gates OK (goes through async submit)', async () => {
  const { loop, host, removed } = makeHost();
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    asyncValidators: { name: async () => 'Taken' }, // always reports an async error
    body: (f) => {
      form = f;
      return bodyInput(f);
    },
  });

  form.field('name').value.set('db'); // sync-valid → only the async rule can now block OK
  loop.emitCommand(Commands.ok);
  await macrotask(); // the OK gate awaits submit(), which force-runs the async validator

  expect(form.field('name').asyncError()).toBe('Taken'); // OK went through the async submit(), not a sync sweep
  expect(removed.length).toBe(0); // stayed open

  loop.emitCommand(Commands.cancel);
  await p;
});

// ST-D4 (RD-08 AC #5) — Cancel and Esc each resolve null, tear down, and never call onSubmit.
test('ST-D4a Cancel resolves null, tears down, and skips onSubmit', async () => {
  const { loop, host, added, removed } = makeHost();
  let onSubmitCalls = 0;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    onSubmit: () => {
      onSubmitCalls += 1;
    },
    body: (f) => bodyInput(f),
  });

  loop.emitCommand(Commands.cancel);
  await expect(p).resolves.toBeNull();
  expect(removed).toEqual(added);
  expect(onSubmitCalls).toBe(0);
});

test('ST-D4b Esc resolves null and tears down', async () => {
  const { loop, host, added, removed } = makeHost();
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    body: (f) => bodyInput(f),
  });

  loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
  await expect(p).resolves.toBeNull();
  expect(removed).toEqual(added);
});

// ST-D5 (RD-08 AC #6) — an in-modal onSubmit runs inside the gate, exactly once, with the coerced values.
test('ST-D5 onSubmit runs inside the gate once, submitting() spans the await, then values resolve', async () => {
  const { loop, host, removed } = makeHost();
  const gate = deferred();
  const calls: unknown[] = [];
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    onSubmit: async (v) => {
      calls.push(v);
      await gate.promise;
    },
    body: (f) => {
      form = f;
      return bodyInput(f);
    },
  });

  form.field('name').value.set('db');
  loop.emitCommand(Commands.ok);
  await Promise.resolve();
  await Promise.resolve();

  expect(form.submitting()).toBe(true); // spans the onSubmit await
  expect(removed.length).toBe(0); // not closed while the gate is pending

  gate.resolve();
  await expect(p).resolves.toEqual({ name: 'db', port: 8080 });
  expect(calls).toEqual([{ name: 'db', port: 8080 }]); // called exactly once, with the coerced values
  expect(form.submitting()).toBe(false);
});

// ST-D6 (RD-08 AC #7) — a rejecting onSubmit keeps the dialog open; a later successful OK still resolves.
test('ST-D6 a rejecting onSubmit stays open and re-enables OK; a later OK resolves', async () => {
  const { loop, host, removed } = makeHost();
  let reject = true;
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    onSubmit: async () => {
      if (reject) throw new Error('save failed');
    },
    body: (f) => {
      form = f;
      return bodyInput(f);
    },
  });

  form.field('name').value.set('db');
  loop.emitCommand(Commands.ok);
  await macrotask();

  expect(removed.length).toBe(0); // rejection kept it open
  expect(form.submitting()).toBe(false); // OK re-enabled (seal lifted)
  let resolved = false;
  void p.then(() => {
    resolved = true;
  });
  await macrotask();
  expect(resolved).toBe(false); // the promise is NOT resolved by the failed attempt

  reject = false; // fix the save
  loop.emitCommand(Commands.ok);
  await expect(p).resolves.toEqual({ name: 'db', port: 8080 }); // a subsequent OK still resolves
});

// ST-D7 (RD-08 AC #8) — the dialog is sealed while submitting(): OK/Cancel/Esc are all inert.
test('ST-D7 the dialog is sealed during the gate (re-OK / Cancel / Esc inert, onSubmit once)', async () => {
  const { loop, host, removed } = makeHost();
  const gate = deferred();
  let calls = 0;
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    onSubmit: async () => {
      calls += 1;
      await gate.promise;
    },
    body: (f) => {
      form = f;
      return bodyInput(f);
    },
  });

  form.field('name').value.set('db');
  loop.emitCommand(Commands.ok); // start the gate
  await Promise.resolve();
  await Promise.resolve();
  expect(form.submitting()).toBe(true);

  // Sealed: a second OK, a Cancel, and an Esc are each inert while the gate is in flight.
  loop.emitCommand(Commands.ok);
  loop.emitCommand(Commands.cancel);
  loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
  await Promise.resolve();
  await Promise.resolve();
  expect(removed.length).toBe(0); // did not close
  expect(form.submitting()).toBe(true); // still sealed

  gate.resolve();
  await expect(p).resolves.toEqual({ name: 'db', port: 8080 });
  expect(calls).toBe(1); // the gate ran exactly once
});

// ST-D8 (RD-08 AC #9) — the sync valid('quit') veto reflects isValid() and the seal.
test('ST-D8 valid(quit) vetoes on invalid / while sealed, and a valid quit closes to null', async () => {
  // Part A — the veto reflects sync validity, and a non-veto quit closes → null (quit !== ok).
  {
    const { loop, host, added } = makeHost();
    let form!: Form<typeof Schema, Init>;
    const p = formDialog(host, {
      schema: Schema,
      initial,
      width: 44,
      height: 9,
      body: (f) => {
        form = f;
        return bodyInput(f);
      },
    });
    const dlg = added[0] as unknown as { valid(command: string): boolean };

    expect(dlg.valid(Commands.quit)).toBe(false); // name:'' invalid → veto app-quit
    form.field('name').value.set('db');
    expect(dlg.valid(Commands.quit)).toBe(true); // valid → no veto

    loop.emitCommand(Commands.quit);
    await expect(p).resolves.toBeNull(); // a non-vetoed quit closed it; 'quit' !== 'ok' → null
  }

  // Part B — while submitting(), the veto holds even on a valid form (the seal).
  {
    const { loop, host, added } = makeHost();
    const gate = deferred();
    let form!: Form<typeof Schema, Init>;
    const p = formDialog(host, {
      schema: Schema,
      initial,
      width: 44,
      height: 9,
      onSubmit: async () => {
        await gate.promise;
      },
      body: (f) => {
        form = f;
        return bodyInput(f);
      },
    });
    const dlg = added[0] as unknown as { valid(command: string): boolean };

    form.field('name').value.set('db');
    loop.emitCommand(Commands.ok);
    await Promise.resolve();
    await Promise.resolve();
    expect(form.submitting()).toBe(true);
    expect(dlg.valid(Commands.quit)).toBe(false); // sealed → veto even though the form is valid

    gate.resolve();
    await expect(p).resolves.toEqual({ name: 'db', port: 8080 });
  }
});

// ST-D9 (RD-08 AC #10) — the form is disposed on every close path (OK, Cancel, body-throw).
test('ST-D9 the owned form is disposed on OK, Cancel, and a body throw', async () => {
  vi.useFakeTimers();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    // A live async validator whose per-field effect is torn down by dispose(): after close, a fresh
    // sync-clean value change must schedule NO debounced run — the decisive "dispose() ran" probe.
    const makeCounting = (): { validators: { name: () => Promise<string | null> }; calls: { n: number } } => {
      const calls = { n: 0 };
      return {
        calls,
        validators: {
          name: async () => {
            calls.n += 1;
            return null;
          },
        },
      };
    };
    const expectDisposed = async (form: Form<typeof Schema, Init>, calls: { n: number }): Promise<void> => {
      const before = calls.n;
      form.field('name').value.set('post-close-probe'); // sync-clean → would schedule a debounce if live
      await vi.advanceTimersByTimeAsync(600);
      expect(calls.n).toBe(before); // no run → the async effect was torn down → dispose() executed
    };

    // OK path.
    {
      const { loop, host, added, removed } = makeHost();
      const { validators, calls } = makeCounting();
      let form!: Form<typeof Schema, Init>;
      const p = formDialog(host, {
        schema: Schema,
        initial,
        width: 44,
        height: 9,
        asyncValidators: validators,
        body: (f) => {
          form = f;
          return bodyInput(f);
        },
      });
      form.field('name').value.set('db');
      loop.emitCommand(Commands.ok);
      await vi.advanceTimersByTimeAsync(0);
      await expect(p).resolves.toEqual({ name: 'db', port: 8080 });
      expect(removed).toEqual(added); // teardown ran
      await expectDisposed(form, calls);
    }

    // Cancel path.
    {
      const { loop, host, added, removed } = makeHost();
      const { validators, calls } = makeCounting();
      let form!: Form<typeof Schema, Init>;
      const p = formDialog(host, {
        schema: Schema,
        initial,
        width: 44,
        height: 9,
        asyncValidators: validators,
        body: (f) => {
          form = f;
          return bodyInput(f);
        },
      });
      loop.emitCommand(Commands.cancel);
      await expect(p).resolves.toBeNull();
      expect(removed).toEqual(added);
      await expectDisposed(form, calls);
    }

    // Body-throw path — never mounted (mounted-guard), but still disposed.
    {
      const { host, removed } = makeHost();
      const { validators, calls } = makeCounting();
      let form!: Form<typeof Schema, Init>;
      const p = formDialog(host, {
        schema: Schema,
        initial,
        width: 44,
        height: 9,
        asyncValidators: validators,
        body: (f) => {
          form = f;
          throw new Error('boom');
        },
      });
      await expect(p).rejects.toThrow('boom');
      expect(removed.length).toBe(0); // a pre-addWindow throw never mounted → removeWindow skipped
      await expectDisposed(form, calls);
    }

    // The owner guard: no unowned-computation ("auto-disposed") warning across any path.
    expect(warn.mock.calls.flat().filter((m) => String(m).includes('auto-disposed'))).toEqual([]);
  } finally {
    warn.mockRestore();
    vi.useRealTimers();
  }
});

// ST-D10 (RD-08 AC #11) — okText renames the OK button; the default OK activates on Enter and gates.
test('ST-D10 okText labels the default OK button, which Enter activates through the same gate', async () => {
  const { loop, host } = makeHost();
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    okText: '~S~ave',
    width: 44,
    height: 9,
    body: (f) => {
      form = f;
      return bodyInput(f);
    },
  });

  form.field('name').value.set('db');
  expect(painted(loop)).toContain('Save'); // the OK button carries the custom label

  // Enter (unconsumed) activates the default OK button, driving the same async gate as emitCommand(ok).
  loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
  await expect(p).resolves.toEqual({ name: 'db', port: 8080 });
});
