import type { InputEvent } from '@jsvision/core';
import { describe, expect, it, vi } from 'vitest';

import { createBrowserDomInputAdapter } from '../src/index.js';

/** Builds one controllable DOM-free event surface. */
function surface(options: { readonly captureThrows?: boolean; readonly invalidGeometry?: boolean } = {}) {
  const listeners = new Map<string, (event: unknown) => void>();
  const value = {
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    getBoundingClientRect: () =>
      options.invalidGeometry ? { left: 0, top: 0, width: 0, height: 0 } : { left: 0, top: 0, width: 800, height: 480 },
    setPointerCapture: vi.fn(() => {
      if (options.captureThrows) throw new Error('capture failed');
    }),
    releasePointerCapture: vi.fn(() => {
      if (options.captureThrows) throw new Error('release failed');
    }),
  };
  return {
    value,
    emit(type: string, event: unknown): void {
      listeners.get(type)?.(event);
    },
    listeners,
  };
}

/** Creates one ordinary structural pointer event. */
function pointer(type: string, overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    type,
    pointerId: 3,
    button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: 400,
    clientY: 240,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe('browser DOM pointer input implementation', () => {
  it('contains invalid geometry and optional capture failures without retaining pointer state', () => {
    const invalid = surface({ invalidGeometry: true });
    const invalidInput = vi.fn();
    createBrowserDomInputAdapter({
      surface: invalid.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput: invalidInput,
    });
    invalid.emit('pointerdown', pointer('pointerdown'));
    expect(invalidInput).not.toHaveBeenCalled();

    const throwing = surface({ captureThrows: true });
    const events: InputEvent[] = [];
    createBrowserDomInputAdapter({
      surface: throwing.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput: (event) => events.push(event),
    });
    throwing.emit('pointerdown', pointer('pointerdown'));
    throwing.emit('pointercancel', pointer('pointercancel'));
    expect(events.map((event) => (event.type === 'mouse' ? event.kind : event.type))).toEqual(['down', 'up']);
  });

  it('tracks independent pointer buttons and clears all listeners and dedupe state on disposal', () => {
    const target = surface();
    const events: InputEvent[] = [];
    const adapter = createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'darwin',
      onInput: (event) => events.push(event),
    });
    target.emit('pointerdown', pointer('pointerdown', { pointerId: 1, button: 0, metaKey: true }));
    target.emit('pointerdown', pointer('pointerdown', { pointerId: 2, button: 2, metaKey: true }));
    target.emit('pointermove', pointer('pointermove', { pointerId: 1, button: 2, metaKey: true }));
    expect(events).toMatchObject([
      { type: 'mouse', kind: 'down', button: 0 },
      { type: 'mouse', kind: 'down', button: 2 },
      { type: 'mouse', kind: 'drag', button: 0 },
    ]);

    const last = events.at(-1);
    if (last?.type !== 'mouse') throw new Error('Expected a DOM mouse event.');
    adapter.dispose();
    expect(adapter.acceptTerminalInput(last)).toBe(true);
    expect(target.listeners.size).toBe(0);
    expect(target.value.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(target.value.releasePointerCapture).toHaveBeenCalledWith(2);
    target.emit('pointerup', pointer('pointerup', { pointerId: 1 }));
    expect(events).toHaveLength(3);
  });

  it('never invokes hostile event accessors more than the guarded property read', () => {
    const target = surface();
    const onInput = vi.fn();
    createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput,
    });
    const clientX = vi.fn(() => {
      throw new Error('coordinate secret');
    });
    const hostile = pointer('pointerdown');
    Object.defineProperty(hostile, 'clientX', { enumerable: true, get: clientX });
    target.emit('pointerdown', hostile);
    expect(clientX).toHaveBeenCalledOnce();
    expect(onInput).not.toHaveBeenCalled();
  });

  it('derives a standard drag button when a move arrives without retained pointerdown state', () => {
    const target = surface();
    const events: InputEvent[] = [];
    createBrowserDomInputAdapter({
      surface: target.value,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'linux',
      onInput: (event) => events.push(event),
    });

    target.emit('pointermove', pointer('pointermove', { button: -1, buttons: 1 }));

    expect(events).toMatchObject([{ type: 'mouse', kind: 'drag', button: 0 }]);
  });
});
