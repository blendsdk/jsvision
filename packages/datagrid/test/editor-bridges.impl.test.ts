/**
 * Implementation tests — the typed field bridges. Each bridge keeps a typed control signal and the
 * string edit field in sync in both directions without a feedback loop; the effects run inside a
 * `createRoot` so they are owned and disposed (as they are under the editor overlay). Effects flush
 * synchronously on write, so no `tick` is needed.
 */
import { test, expect } from 'vitest';
import { createRoot, parseISO, signal, toISO } from '@jsvision/ui';
import { boolBridge, dateBridge } from '../src/editor-bridges.js';

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
