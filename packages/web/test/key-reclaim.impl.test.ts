/**
 * Implementation tests — `attachKeyReclaim` internals/edges (beyond the ST-5 oracle): Alt+<letter> and
 * Shift+Tab matching, a non-default chord ignored unless added via `also`, the `['*']` wildcard, plain
 * text left alone, and unsubscribe stopping reclaim. `.js` per NodeNext.
 */
import { test, expect, vi } from 'vitest';
import { attachKeyReclaim } from '@jsvision/web';

const noopTerm = {
  write: () => {},
  onData: () => ({ dispose: () => {} }),
  onResize: () => ({ dispose: () => {} }),
};

interface FakeKeydown {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
}
function keydown(over: Partial<FakeKeydown> = {}): FakeKeydown {
  return { key: 'a', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, preventDefault: vi.fn(), ...over };
}
function fakeTarget() {
  let handler: ((ev: FakeKeydown) => void) | undefined;
  return {
    target: {
      addEventListener: (_type: string, h: (ev: FakeKeydown) => void) => {
        handler = h;
      },
      removeEventListener: () => {
        handler = undefined;
      },
    },
    dispatch: (ev: FakeKeydown) => handler?.(ev),
  };
}

/** Attach reclaim (always "focused") and dispatch `ev`; return whether it was reclaimed. */
function reclaimed(ev: FakeKeydown, also?: readonly string[]): boolean {
  const ft = fakeTarget();
  attachKeyReclaim(noopTerm, { target: ft.target, isFocused: () => true, also });
  ft.dispatch(ev);
  return (ev.preventDefault as ReturnType<typeof vi.fn>).mock.calls.length > 0;
}

test('Alt+<letter> and Shift+Tab and plain Tab are reclaimed by default', () => {
  expect(reclaimed(keydown({ key: 'x', altKey: true }))).toBe(true);
  expect(reclaimed(keydown({ key: 'Tab', shiftKey: true }))).toBe(true);
  expect(reclaimed(keydown({ key: 'Tab' }))).toBe(true);
});

test('a non-default chord is ignored unless added via `also`', () => {
  expect(reclaimed(keydown({ key: 'x', ctrlKey: true }))).toBe(false); // Ctrl+X not default
  expect(reclaimed(keydown({ key: 'x', ctrlKey: true }), ['Ctrl+X'])).toBe(true);
});

test("the ['*'] wildcard reclaims any modified chord", () => {
  expect(reclaimed(keydown({ key: 'x', ctrlKey: true }), ['*'])).toBe(true);
  expect(reclaimed(keydown({ key: 'j', metaKey: true }), ['*'])).toBe(true);
});

test('plain text (no modifiers) is never reclaimed', () => {
  expect(reclaimed(keydown({ key: 'a' }))).toBe(false);
  expect(reclaimed(keydown({ key: 'a' }), ['*'])).toBe(false); // even under wildcard, plain text stays text
});

test('unsubscribe stops reclaiming', () => {
  const ft = fakeTarget();
  const unsub = attachKeyReclaim(noopTerm, { target: ft.target, isFocused: () => true });
  unsub();
  const ev = keydown({ key: 'F1' });
  ft.dispatch(ev); // no listener anymore
  expect(ev.preventDefault).not.toHaveBeenCalled();
});
