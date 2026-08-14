/** Outcome of awaiting application work through a package-owned cancellation signal. */
export type AbortableEditorAwaitResult<TValue> =
  { readonly kind: 'value'; readonly value: TValue } | { readonly kind: 'aborted' } | { readonly kind: 'failed' };

/** Settles package ownership promptly even when an application promise ignores cancellation. */
export function awaitEditorWork<TValue>(
  work: Promise<TValue>,
  signal: AbortSignal,
): Promise<AbortableEditorAwaitResult<TValue>> {
  if (signal.aborted) return Promise.resolve(Object.freeze({ kind: 'aborted' }));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: AbortableEditorAwaitResult<TValue>): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      resolve(Object.freeze(result));
    };
    const abort = (): void => finish({ kind: 'aborted' });
    signal.addEventListener('abort', abort, { once: true });
    void work.then(
      (value) => finish({ kind: 'value', value }),
      () => finish({ kind: 'failed' }),
    );
  });
}
