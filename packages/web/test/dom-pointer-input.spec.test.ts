/** Specification oracle for pre-xterm DOM key/pointer normalization and matching-SGR deduplication. */
import { describe, expect, it, vi } from 'vitest';

import { createBrowserDomInputAdapter } from '../src/index.js';
import type { InputEvent } from '@jsvision/core';

/** Minimal DOM-free pointer surface harness used by the browser adapter. */
function surface() {
  const listeners = new Map<string, (event: unknown) => void>();
  const value = {
    addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 480 }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  };
  return {
    value,
    emit(type: string, event: unknown): void {
      listeners.get(type)?.(event);
    },
  };
}

/** Creates one structural browser pointer event. */
function pointer(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    type: 'pointerdown',
    pointerId: 7,
    button: 0,
    buttons: 1,
    clientX: 410,
    clientY: 260,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe('browser DOM input adapter', () => {
  it('normalizes a macOS Command key before xterm encoding without claiming Alt', () => {
    const target = surface();
    const events: InputEvent[] = [];
    createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'darwin',
      onInput: (event) => events.push(event),
    });
    const preventDefault = vi.fn();
    target.emit('keydown', {
      type: 'keydown',
      key: 'f',
      code: 'KeyF',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: true,
      preventDefault,
    });

    expect(events).toEqual([
      { type: 'key', key: 'f', ctrl: false, alt: false, shift: false, meta: true, primary: true },
    ]);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('maps a macOS Command-click to one-based terminal cells and captures the pointer', () => {
    const target = surface();
    const events: InputEvent[] = [];
    const adapter = createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'darwin',
      onInput: (event) => events.push(event),
    });

    target.emit('pointerdown', pointer({ metaKey: true }));
    expect(events).toEqual([
      {
        type: 'mouse',
        kind: 'down',
        button: 0,
        x: 41,
        y: 13,
        ctrl: false,
        alt: false,
        shift: false,
        meta: true,
        primary: true,
      },
    ]);
    expect(target.value.setPointerCapture).toHaveBeenCalledWith(7);
    expect(adapter.available).toBe(true);
  });

  it('maps browser drag/up, preserves captured button and Meta, and releases pointer capture', () => {
    const target = surface();
    const events: InputEvent[] = [];
    const adapter = createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput: (event) => events.push(event),
    });
    target.emit('pointerdown', pointer({ clientX: -500, clientY: -500, ctrlKey: true }));
    target.emit(
      'pointermove',
      pointer({ type: 'pointermove', button: -1, clientX: 9000, clientY: 9000, metaKey: true }),
    );
    expect(adapter.acceptTerminalInput({ type: 'mouse', kind: 'drag', button: 0, x: 80, y: 24 })).toBe(false);
    target.emit('pointerup', pointer({ type: 'pointerup', buttons: 0 }));

    expect(events).toMatchObject([
      { type: 'mouse', kind: 'down', x: 1, y: 1, ctrl: true, primary: true },
      { type: 'mouse', kind: 'drag', button: 0, x: 80, y: 24, meta: true },
      { type: 'mouse', kind: 'up', x: 41, y: 13 },
    ]);
    expect(target.value.releasePointerCapture).toHaveBeenCalledWith(7);
    adapter.dispose();
    expect(target.value.removeEventListener).toHaveBeenCalled();
  });

  it('suppresses exactly one matching SGR event while preserving mismatches and later repeats', () => {
    const target = surface();
    const events: InputEvent[] = [];
    const adapter = createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'darwin',
      onInput: (event) => events.push(event),
    });
    target.emit('pointerdown', pointer({ metaKey: true }));
    const matching = { type: 'mouse' as const, kind: 'down' as const, button: 0, x: 41, y: 13 };

    expect(adapter.acceptTerminalInput(matching)).toBe(false);
    expect(adapter.acceptTerminalInput({ ...matching, x: 42 })).toBe(true);
    expect(adapter.acceptTerminalInput(matching)).toBe(true);
    expect(events).toHaveLength(1);
  });

  it('expires a pending DOM duplicate after its event-loop turn', async () => {
    const target = surface();
    const adapter = createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput: () => undefined,
    });
    target.emit('pointerdown', pointer());
    const matching = { type: 'mouse' as const, kind: 'down' as const, button: 0, x: 41, y: 13 };

    await Promise.resolve();

    expect(adapter.acceptTerminalInput(matching)).toBe(true);
  });

  it('normalizes no-button hover to the Core SGR value and suppresses its exact duplicate', () => {
    const target = surface();
    const events: InputEvent[] = [];
    const adapter = createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput: (event) => events.push(event),
    });

    target.emit('pointermove', pointer({ type: 'pointermove', button: -1, buttons: 0 }));

    expect(events).toMatchObject([{ type: 'mouse', kind: 'move', button: 3, x: 41, y: 13 }]);
    expect(adapter.acceptTerminalInput({ type: 'mouse', kind: 'move', button: 3, x: 41, y: 13 })).toBe(false);
  });

  it('fails over to ordinary terminal input when no DOM pointer surface is available', () => {
    const onInput = vi.fn();
    const adapter = createBrowserDomInputAdapter({
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput,
    });
    const sgr = { type: 'mouse' as const, kind: 'down' as const, button: 0, x: 4, y: 5 };

    expect(adapter.available).toBe(false);
    expect(adapter.acceptTerminalInput(sgr)).toBe(true);
    expect(onInput).not.toHaveBeenCalled();
    adapter.dispose();
  });
});
