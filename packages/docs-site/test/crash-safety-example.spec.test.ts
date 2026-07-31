/**
 * Authentic native-lifecycle artifact for the Crash safety course.
 *
 * The fixture drives the real public host through an injected runtime. These tests assert effect
 * order without sending signals, changing terminal modes, or retaining failure payloads.
 */
import { describe, expect, test } from 'vitest';
import { runLifecycleTrace } from '../src/example-fixtures/crash-safety/lifecycle-trace.js';

/** Find one required trace step and fail with a useful category when it is absent. */
function step(trace: readonly string[], prefix: string): number {
  const index = trace.findIndex((entry) => entry.startsWith(prefix));
  if (index < 0) throw new Error(`missing lifecycle trace step: ${prefix}`);
  return index;
}

describe('normal, exception, rejection, and signal restoration', () => {
  test('normal stop restores once, removes owned handlers, and preserves an existing observer', async () => {
    const result = await runLifecycleTrace('normal');
    expect(result.trace.filter((entry) => entry.startsWith('screen:restore:'))).toHaveLength(1);
    expect(result.trace.filter((entry) => entry === 'raw:off')).toHaveLength(1);
    expect(result.trace).toContain('backstop:removed');
    expect(result.existingHandlerRuns).toBe(1);
    expect(result.remainingHandlers).toBe(1);
    expect(result.exitCodes).toEqual([]);
    expect(result.trace.some((entry) => entry.startsWith('screen:unexpected'))).toBe(false);
  });

  test.each(['exception', 'rejection'] as const)(
    '%s restores before its safe diagnostic and exit code 1',
    async (scenario) => {
      const result = await runLifecycleTrace(scenario);
      const restoreAt = step(result.trace, 'screen:restore:');
      const rawOffAt = step(result.trace, 'raw:off');
      const diagnosticAt = step(result.trace, 'diagnostic:safe:');
      const hookAt = step(result.trace, 'before-exit:1');
      const exitAt = step(result.trace, 'exit:1');
      expect(restoreAt).toBeLessThan(rawOffAt);
      expect(rawOffAt).toBeLessThan(diagnosticAt);
      expect(diagnosticAt).toBeLessThan(hookAt);
      expect(hookAt).toBeLessThan(exitAt);
      expect(result.exitCodes).toEqual([1]);
      expect(JSON.stringify(result.trace)).not.toContain('fixture-secret-payload');
    },
  );

  test.each([
    ['interrupt', 130],
    ['terminate', 143],
    ['hangup', 129],
  ] as const)('%s signal restores before its hook and conventional exit %i', async (signal, code) => {
    const result = await runLifecycleTrace(signal);
    const restoreAt = step(result.trace, 'screen:restore:');
    const rawOffAt = step(result.trace, 'raw:off');
    const hookAt = step(result.trace, `before-exit:${code}`);
    const exitAt = step(result.trace, `exit:${code}`);
    expect(restoreAt).toBeLessThan(rawOffAt);
    expect(rawOffAt).toBeLessThan(hookAt);
    expect(hookAt).toBeLessThan(exitAt);
    expect(result.beforeExitCodes).toEqual([code]);
    expect(result.exitCodes).toEqual([code]);
  });
});

describe('partial-start backstop and idempotent teardown', () => {
  test('partial-start failure uses the synchronous backstop and remains stoppable', async () => {
    const result = await runLifecycleTrace('partial-start');
    expect(result.startupFailed).toBe(true);
    const armedAt = step(result.trace, 'backstop:armed');
    const rawOnAt = step(result.trace, 'raw:on');
    const failedAt = step(result.trace, 'screen:enter-failed');
    const backstopAt = step(result.trace, 'process:exit-backstop');
    const syncRestoreAt = step(result.trace, 'screen:restore-sync:');
    const rawOffAt = step(result.trace, 'raw:off');
    expect(armedAt).toBeLessThan(rawOnAt);
    expect(rawOnAt).toBeLessThan(failedAt);
    expect(failedAt).toBeLessThan(backstopAt);
    expect(backstopAt).toBeLessThan(syncRestoreAt);
    expect(syncRestoreAt).toBeLessThan(rawOffAt);
    expect(result.trace).toContain('backstop:removed');
    expect(result.remainingHandlers).toBe(1);
    expect(result.trace.some((entry) => entry.startsWith('screen:unexpected'))).toBe(false);
  });

  test('double stop is idempotent and removes only host-owned handlers', async () => {
    const result = await runLifecycleTrace('double-stop');
    expect(result.trace.filter((entry) => entry.startsWith('screen:restore:'))).toHaveLength(1);
    expect(result.trace.filter((entry) => entry === 'raw:off')).toHaveLength(1);
    expect(result.trace.filter((entry) => entry === 'backstop:removed')).toHaveLength(1);
    expect(result.existingHandlerRuns).toBe(1);
    expect(result.remainingHandlers).toBe(1);
    expect(result.trace.length).toBeLessThanOrEqual(32);
  });

  test('a secondary raw-off failure does not skip later teardown', async () => {
    const result = await runLifecycleTrace('restore-failure');
    expect(step(result.trace, 'screen:restore:')).toBeLessThan(step(result.trace, 'raw:off-failed'));
    expect(step(result.trace, 'raw:off-failed')).toBeLessThan(step(result.trace, 'backstop:removed'));
    expect(result.existingHandlerRuns).toBe(1);
    expect(result.remainingHandlers).toBe(1);
    expect(result.exitCodes).toEqual([]);
  });

  test('a secondary restore failure preserves the original fatal diagnosis and exit', async () => {
    const result = await runLifecycleTrace('exception-restore-failure');
    const restoreAt = step(result.trace, 'screen:restore:');
    const rawFailureAt = step(result.trace, 'raw:off-failed');
    const diagnosticAt = step(result.trace, 'diagnostic:safe:');
    const hookAt = step(result.trace, 'before-exit:1');
    const exitAt = step(result.trace, 'exit:1');
    expect(restoreAt).toBeLessThan(rawFailureAt);
    expect(rawFailureAt).toBeLessThan(diagnosticAt);
    expect(diagnosticAt).toBeLessThan(hookAt);
    expect(hookAt).toBeLessThan(exitAt);
    expect(result.trace.filter((entry) => entry.startsWith('diagnostic:safe:'))).toHaveLength(1);
    expect(result.exitCodes).toEqual([1]);
    expect(JSON.stringify(result.trace)).not.toContain('fixture-secret-payload');
  });
});
