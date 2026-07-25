import { describe, expect, test, vi } from 'vitest';
import { DiagnosticStore } from '../src/diagnostics.js';
import type { I18nDiagnostic } from '../src/types.js';

function diagnostic(index: number): I18nDiagnostic {
  return {
    code: 'MISSING_TRANSLATION',
    severity: 'warning',
    key: `app.key-${index}`,
    locale: 'en',
  };
}

describe('bounded diagnostic storage', () => {
  test('should deduplicate complete identities and notify only for new records', () => {
    const sink = vi.fn();
    const store = new DiagnosticStore(sink);

    expect(store.record(diagnostic(1))).toBe(true);
    expect(store.record(diagnostic(1))).toBe(false);

    expect(store.records).toEqual([diagnostic(1)]);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(store.records)).toBe(true);
    expect(Object.isFrozen(store.records[0])).toBe(true);
  });

  test('should include source in the diagnostic identity', () => {
    const store = new DiagnosticStore();

    store.record({ ...diagnostic(1), source: 'framework' });
    store.record({ ...diagnostic(1), source: 'application' });

    expect(store.records).toHaveLength(2);
  });

  test('should evict the oldest identity after one hundred records', () => {
    const store = new DiagnosticStore();
    for (let index = 0; index <= 100; index += 1) store.record(diagnostic(index));

    expect(store.records).toHaveLength(100);
    expect(store.records[0]?.key).toBe('app.key-1');
    expect(store.records.at(-1)?.key).toBe('app.key-100');
  });

  test('should swallow sink failures after retaining the diagnostic', () => {
    const store = new DiagnosticStore(() => {
      throw new Error('observer failure');
    });

    expect(() => store.record(diagnostic(1))).not.toThrow();
    expect(store.records).toEqual([diagnostic(1)]);
  });

  test('should retain a nested diagnostic without recursively notifying the sink', () => {
    const sink = vi.fn();
    const store = new DiagnosticStore(() => {
      sink();
      store.record(diagnostic(2));
    });

    store.record(diagnostic(1));

    expect(store.records).toEqual([diagnostic(1), diagnostic(2)]);
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
