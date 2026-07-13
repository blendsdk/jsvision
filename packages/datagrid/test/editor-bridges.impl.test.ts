/**
 * Implementation tests — the typed field bridges. Each bridge keeps a typed control signal and the
 * string edit field in sync in both directions without a feedback loop; the effects run inside a
 * `createRoot` so they are owned and disposed (as they are under the editor overlay). Effects flush
 * synchronously on write, so no `tick` is needed.
 */
import { test, expect } from 'vitest';
import { createRoot, effect, parseISO, signal, toISO, untrack } from '@jsvision/ui';
import { boolBridge, dateBridge, enumBridge, lookupBridge } from '../src/editor-bridges.js';
import type { LookupItem } from '../src/cell-editor.js';

// boolBridge — seeds from the field, reflects a field change, and writes the flipped string back.
test('boolBridge: round-trips field ⟷ control', () => {
  createRoot((dispose) => {
    const field = signal('false');
    const b = boolBridge(field);
    expect(b()).toEqual([false]); // seeded from the field

    field.set('true');
    expect(b()).toEqual([true]); // field → control

    b.set([false]);
    expect(field()).toBe('false'); // control → field

    b.set([true]);
    expect(field()).toBe('true');
    dispose();
  });
});

// boolBridge — any non-'true' field reads as false and is canonicalized on mount.
test('boolBridge: a non-canonical field reads false and canonicalizes to "false"', () => {
  createRoot((dispose) => {
    const field = signal('');
    const b = boolBridge(field);
    expect(b()).toEqual([false]);
    expect(field()).toBe('false'); // reverse effect canonicalized the empty field
    dispose();
  });
});

// dateBridge — seeds from the ISO field, reflects a field change, and writes ISO back.
test('dateBridge: round-trips field ⟷ control', () => {
  createRoot((dispose) => {
    const field = signal('2026-07-13');
    const d = dateBridge(field);
    expect(d()).not.toBeNull();
    expect(toISO(d()!)).toBe('2026-07-13'); // seeded from the field

    field.set('2020-01-01');
    expect(toISO(d()!)).toBe('2020-01-01'); // field → control

    d.set(parseISO('2019-12-31'));
    expect(field()).toBe('2019-12-31'); // control → field
    dispose();
  });
});

// dateBridge — an empty/unparseable field is null (no selection) and clears to ''.
test('dateBridge: an empty field is null', () => {
  createRoot((dispose) => {
    const field = signal('');
    const d = dateBridge(field);
    expect(d()).toBeNull();
    dispose();
  });
});

// dateBridge — setting the control to the same day does not spuriously rewrite the field (no loop).
test('dateBridge: a same-day reset is idempotent', () => {
  createRoot((dispose) => {
    const field = signal('2026-07-13');
    const d = dateBridge(field);
    const before = field();
    d.set(parseISO('2026-07-13')); // same day, a fresh CalendarDate object
    expect(field()).toBe(before); // no spurious rewrite
    dispose();
  });
});

// enumBridge — '' ⟷ null; a chosen value round-trips to the field.
test('enumBridge: maps "" ⟷ null and round-trips a value', () => {
  createRoot((dispose) => {
    const field = signal('');
    const s = enumBridge(field);
    expect(s()).toBeNull(); // '' → no selection

    field.set('paid');
    expect(s()).toBe('paid'); // field → control

    s.set('shipped');
    expect(field()).toBe('shipped'); // control → field

    s.set(null);
    expect(field()).toBe(''); // no selection → ''
    dispose();
  });
});

// lookupBridge — key ⟷ item, and the key re-matches its item when the rows repopulate (async load).
test('lookupBridge: key ⟷ item, and re-matches after the rows repopulate', () => {
  createRoot((dispose) => {
    const rows: LookupItem[] = [
      { key: '7', label: 'Ada' },
      { key: '9', label: 'Bo' },
    ];
    const items = signal<LookupItem[]>([]);
    const field = signal('7'); // a seeded key, rows not yet loaded
    const sel = lookupBridge(field, items);
    expect(sel()).toBeNull(); // no rows yet — no match
    expect(field()).toBe('7'); // the seeded key is NOT clobbered (PF-001)

    items.set(rows); // rows arrive (async provider resolved)
    expect(sel()?.key).toBe('7'); // the key re-matched its item
    expect(sel()?.label).toBe('Ada');
    expect(field()).toBe('7'); // re-match is a no-op on the field

    sel.set(rows[1]); // select Bo
    expect(field()).toBe('9'); // control → field writes the key
    dispose();
  });
});

/** Count how many times a reader effect runs over `read`, inside its own root. */
function runCount<T>(read: () => T): { count: () => number; dispose: () => void } {
  let n = 0;
  const dispose = createRoot((d) => {
    effect(() => {
      read();
      untrack(() => {
        n += 1;
      });
    });
    return d;
  });
  return { count: () => n, dispose };
}

// ST-9 — each bridge updates its control once per real field change and does not re-write the field
// (no feedback loop). A field-write counter stays put across a single control-driven change.
test('ST-9: the bridges converge in one pass and do not loop', () => {
  createRoot((dispose) => {
    // boolBridge: one field change → one control update; a control change does not bounce the field.
    const bf = signal('false');
    const b = boolBridge(bf);
    const bReads = runCount(() => b());
    const bFieldWrites = runCount(() => bf());
    const b0 = bReads.count();
    const bf0 = bFieldWrites.count();
    bf.set('true');
    expect(b()).toEqual([true]);
    expect(bReads.count() - b0).toBe(1); // control updated exactly once
    b.set([false]);
    expect(bf()).toBe('false');
    // the control-driven change writes the field once, and that write does not re-run back into another
    // control update beyond the direct reflection (no runaway loop).
    expect(bFieldWrites.count() - bf0).toBeLessThanOrEqual(2);
    bReads.dispose();
    bFieldWrites.dispose();

    // enumBridge: same guarantee.
    const ef = signal('');
    const s = enumBridge(ef);
    const eReads = runCount(() => s());
    const e0 = eReads.count();
    ef.set('open');
    expect(s()).toBe('open');
    expect(eReads.count() - e0).toBe(1);
    eReads.dispose();

    dispose();
  });
});
