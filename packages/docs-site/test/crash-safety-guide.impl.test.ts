/**
 * Implementation hardening for the Crash safety course's authentic lifecycle artifact.
 *
 * These checks extend the immutable oracle with repeated runs, exact trace bounds, safe failure
 * metadata, every terminating category, partial setup, and secondary restore failure tolerance.
 */
import { describe, expect, test } from 'vitest';
import { runLifecycleTrace } from '../src/example-fixtures/crash-safety/lifecycle-trace.js';

/** Locate one trace category so ordering assertions stay readable. */
function indexOf(trace: readonly string[], prefix: string): number {
  const index = trace.findIndex((entry) => entry.startsWith(prefix));
  if (index < 0) throw new Error(`missing lifecycle category: ${prefix}`);
  return index;
}

describe('Crash safety lifecycle hardening', () => {
  test('should repeat normal ownership without growing handlers or trace state', async () => {
    for (let cycle = 0; cycle < 8; cycle += 1) {
      const result = await runLifecycleTrace('normal');
      expect(result.trace.length).toBeLessThanOrEqual(32);
      expect(result.trace.filter((entry) => entry === 'backstop:armed')).toHaveLength(1);
      expect(result.trace.filter((entry) => entry === 'backstop:removed')).toHaveLength(1);
      expect(result.trace.filter((entry) => entry === 'raw:on')).toHaveLength(1);
      expect(result.trace.filter((entry) => entry === 'raw:off')).toHaveLength(1);
      expect(result.remainingHandlers).toBe(1);
      expect(result.existingHandlerRuns).toBe(1);
      expect(result.trace.some((entry) => entry.startsWith('screen:unexpected'))).toBe(false);
    }
  });

  test.each([
    ['interrupt', 130],
    ['terminate', 143],
    ['hangup', 129],
  ] as const)('should keep %s restoration ahead of callback and exit %i', async (scenario, code) => {
    const result = await runLifecycleTrace(scenario);
    expect(indexOf(result.trace, 'screen:restore:')).toBeLessThan(indexOf(result.trace, 'raw:off'));
    expect(indexOf(result.trace, 'raw:off')).toBeLessThan(indexOf(result.trace, `before-exit:${code}`));
    expect(indexOf(result.trace, `before-exit:${code}`)).toBeLessThan(indexOf(result.trace, `exit:${code}`));
  });

  test.each(['exception', 'rejection'] as const)(
    'should keep %s diagnostics bounded and discard the fixture secret',
    async (scenario) => {
      const result = await runLifecycleTrace(scenario);
      const serialized = JSON.stringify(result.trace);
      expect(serialized).not.toContain('fixture-secret-payload');
      expect(result.trace.some((entry) => /^diagnostic:safe:length-\d+$/u.test(entry))).toBe(true);
      expect(result.trace.length).toBeLessThanOrEqual(32);
      expect(result.exitCodes).toEqual([1]);
    },
  );

  test('should restore a partial start synchronously before later cleanup', async () => {
    const result = await runLifecycleTrace('partial-start');
    expect(result.startupFailed).toBe(true);
    expect(indexOf(result.trace, 'backstop:armed')).toBeLessThan(indexOf(result.trace, 'raw:on'));
    expect(indexOf(result.trace, 'raw:on')).toBeLessThan(indexOf(result.trace, 'screen:enter-failed'));
    expect(indexOf(result.trace, 'process:exit-backstop')).toBeLessThan(indexOf(result.trace, 'screen:restore-sync:'));
    expect(result.trace).toContain('backstop:removed');
    expect(result.remainingHandlers).toBe(1);
  });

  test('should make repeated stop an exact no-op after the first restoration', async () => {
    const result = await runLifecycleTrace('double-stop');
    expect(result.trace.filter((entry) => entry.startsWith('screen:restore:'))).toHaveLength(1);
    expect(result.trace.filter((entry) => entry === 'raw:off')).toHaveLength(1);
    expect(result.trace.filter((entry) => entry === 'backstop:removed')).toHaveLength(1);
    expect(result.exitCodes).toEqual([]);
  });

  test('should continue teardown after a secondary raw-off failure', async () => {
    const result = await runLifecycleTrace('restore-failure');
    expect(indexOf(result.trace, 'screen:restore:')).toBeLessThan(indexOf(result.trace, 'raw:off-failed'));
    expect(indexOf(result.trace, 'raw:off-failed')).toBeLessThan(indexOf(result.trace, 'backstop:removed'));
    expect(result.existingHandlerRuns).toBe(1);
    expect(result.remainingHandlers).toBe(1);
    expect(result.exitCodes).toEqual([]);
  });

  test('should preserve the primary fatal path when raw-off restoration also fails', async () => {
    const result = await runLifecycleTrace('exception-restore-failure');
    expect(indexOf(result.trace, 'screen:restore:')).toBeLessThan(indexOf(result.trace, 'raw:off-failed'));
    expect(indexOf(result.trace, 'raw:off-failed')).toBeLessThan(indexOf(result.trace, 'diagnostic:safe:'));
    expect(indexOf(result.trace, 'diagnostic:safe:')).toBeLessThan(indexOf(result.trace, 'before-exit:1'));
    expect(indexOf(result.trace, 'before-exit:1')).toBeLessThan(indexOf(result.trace, 'exit:1'));
    expect(result.trace.filter((entry) => entry.startsWith('diagnostic:safe:'))).toHaveLength(1);
    expect(result.exitCodes).toEqual([1]);
    expect(JSON.stringify(result.trace)).not.toContain('fixture-secret-payload');
  });
});
