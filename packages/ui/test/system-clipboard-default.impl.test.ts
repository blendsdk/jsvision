/**
 * Implementation tests for the lazy, ordered system clipboard adapter.
 *
 * Platform clipboard processes are true external dependencies, so these tests inject inert
 * asynchronous methods and verify the queue without reading or mutating the developer clipboard.
 */
import { expect, test, vi } from 'vitest';

import { createSystemClipboardAdapter } from '../src/app/system-clipboard.js';

/** A promise whose settlement remains under test control. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: Error): void;
}

/** Create a manually settled promise for deterministic ordering tests. */
function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: Error) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

/** Advance promise continuations without adding a timer. */
async function drainMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

test('adapter loads lazily once and preserves exact raw text', async () => {
  const writes: string[] = [];
  const load = vi.fn(async () => ({
    read: async () => 'café\r\n第二行😀',
    write: async (text: string) => {
      writes.push(text);
    },
  }));
  const adapter = createSystemClipboardAdapter(load);

  expect(load).not.toHaveBeenCalled();
  await adapter.writeClipboardText('first\rline');
  await adapter.writeClipboardText('second\n😀');
  const text = await adapter.readClipboardText();

  expect(load).toHaveBeenCalledOnce();
  expect(writes).toEqual(['first\rline', 'second\n😀']);
  expect(text).toBe('café\r\n第二行😀');
});

test('adapter serializes write and read operations in gesture order', async () => {
  const firstWrite = deferred<void>();
  const calls: string[] = [];
  const adapter = createSystemClipboardAdapter(async () => ({
    write: vi.fn((text: string) => {
      calls.push(`write:${text}`);
      return firstWrite.promise;
    }),
    read: vi.fn(async () => {
      calls.push('read');
      return 'after write';
    }),
  }));

  const write = adapter.writeClipboardText('queued');
  const read = adapter.readClipboardText();
  await drainMicrotasks();
  expect(calls).toEqual(['write:queued']);

  firstWrite.resolve();
  await expect(write).resolves.toBeUndefined();
  await expect(read).resolves.toBe('after write');
  expect(calls).toEqual(['write:queued', 'read']);
});

test('a rejected operation does not poison later clipboard gestures', async () => {
  const calls: string[] = [];
  const adapter = createSystemClipboardAdapter(async () => ({
    write: vi.fn(async () => {
      calls.push('write');
      throw new Error('host detail');
    }),
    read: vi.fn(async () => {
      calls.push('read');
      return 'recovered';
    }),
  }));

  await expect(adapter.writeClipboardText('private payload')).rejects.toThrow('host detail');
  await expect(adapter.readClipboardText()).resolves.toBe('recovered');
  expect(calls).toEqual(['write', 'read']);
});

test('stop prevents queued operations from starting after teardown', async () => {
  const firstWrite = deferred<void>();
  const read = vi.fn(async () => 'too late');
  const adapter = createSystemClipboardAdapter(async () => ({
    write: vi.fn(() => firstWrite.promise),
    read,
  }));

  const write = adapter.writeClipboardText('in flight');
  const queuedRead = adapter.readClipboardText();
  await drainMicrotasks();
  adapter.stop();
  firstWrite.resolve();

  await expect(write).resolves.toBeUndefined();
  await expect(queuedRead).rejects.toThrow('system clipboard adapter stopped');
  expect(read).not.toHaveBeenCalled();
});

test('stop prevents the first operation from starting after a pending lazy load', async () => {
  const loading = deferred<{
    read(): Promise<string>;
    write(text: string): Promise<void>;
  }>();
  const write = vi.fn(async (_text: string) => undefined);
  const adapter = createSystemClipboardAdapter(() => loading.promise);

  const pendingWrite = adapter.writeClipboardText('too late');
  await drainMicrotasks();
  adapter.stop();
  loading.resolve({
    read: vi.fn(async () => ''),
    write,
  });

  await expect(pendingWrite).rejects.toThrow('system clipboard adapter stopped');
  expect(write).not.toHaveBeenCalled();
});
