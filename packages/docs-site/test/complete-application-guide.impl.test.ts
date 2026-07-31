/**
 * Implementation hardening for the complete-application workflow and release rehearsal.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import {
  CapstoneWorkflowPanel,
  createAuthorizedMemoryStore,
  type AuthorizedRecordStore,
} from '../src/example-fixtures/complete-application/workflow-model.js';
import { ReleaseRehearsalPanel } from '../src/example-fixtures/complete-application/release-rehearsal.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Mount one panel through the real application owner. */
function mount<T extends CapstoneWorkflowPanel | ReleaseRehearsalPanel>(panel: T) {
  const app = createApplication({ caps, content: panel, viewport: { width: 68, height: 20 } });
  return { app, panel };
}

/** Create a manually settled promise for stale-completion tests. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('Complete application workflow hardening', () => {
  test('should reject invalid form input before the authorized store', async () => {
    const fixture = mount(new CapstoneWorkflowPanel(createAuthorizedMemoryStore()));
    fixture.panel.openEditor();
    fixture.panel.setRecordName('   ');
    await fixture.panel.saveRecord();
    expect(fixture.panel.validationFailures).toBe(1);
    expect(fixture.panel.authorizedSeamCalls).toBe(0);
    expect(fixture.panel.persistenceWrites).toBe(0);
    expect(fixture.panel.phase).toBe('error');
    fixture.app.loop.dispose();
  });

  test('should preserve editor state when authorization denies persistence', async () => {
    const denied: AuthorizedRecordStore = {
      authorize: () => false,
      save: async () => {
        throw new Error('a denied adapter must not write');
      },
    };
    const fixture = mount(new CapstoneWorkflowPanel(denied));
    fixture.panel.openEditor();
    await fixture.panel.saveRecord();
    expect(fixture.panel.routeName).toBe('editor');
    expect(fixture.panel.phase).toBe('error');
    expect(fixture.panel.feedback).toMatch(/denied/iu);
    fixture.panel.retry();
    expect(fixture.panel.phase).toBe('editing');
    fixture.app.loop.dispose();
  });

  test('should suppress a completion that arrives after cleanup', async () => {
    const pending = deferred<{ ok: true }>();
    const fixture = mount(new CapstoneWorkflowPanel({ authorize: () => true, save: () => pending.promise }));
    fixture.panel.openEditor();
    const saving = fixture.panel.saveRecord();
    fixture.app.loop.dispose();
    pending.resolve({ ok: true });
    await saving;
    expect(fixture.panel.persistenceWrites).toBe(0);
    expect(fixture.panel.staleResultsSuppressed).toBe(1);
    expect(fixture.panel.cleanupCount).toBe(1);
  });

  test('should observe and suppress the real refresh completion after cancellation', async () => {
    const fixture = mount(new CapstoneWorkflowPanel(createAuthorizedMemoryStore()));
    fixture.panel.startRefresh();
    fixture.panel.cancelWork();
    fixture.panel.cancelWork();
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.panel.cancellations).toBe(1);
    expect(fixture.panel.pendingWork).toBe(0);
    expect(fixture.panel.phase).toBe('cancelled');
    expect(fixture.panel.staleResultsSuppressed).toBe(1);
    fixture.app.loop.dispose();
  });

  test('should reject workflow actions after owner disposal', () => {
    const fixture = mount(new CapstoneWorkflowPanel(createAuthorizedMemoryStore()));
    fixture.app.loop.dispose();
    fixture.panel.openEditor();
    fixture.panel.startRefresh();
    fixture.panel.simulateFailure();
    expect(fixture.panel.routeName).toBe('records');
    expect(fixture.panel.phase).toBe('idle');
    expect(fixture.panel.cleanupCount).toBe(1);
  });
});

describe('Complete application release-rehearsal hardening', () => {
  test('should cycle every no-go fixture and return to a fresh Ready decision', () => {
    const fixture = mount(new ReleaseRehearsalPanel());
    const observed = new Set([fixture.panel.scenarioName]);
    const expected = [
      { scenario: 'Non-TTY', concern: 'tty', supervisor: 'stopped-manual', fresh: true },
      { scenario: 'Crash loop', concern: 'runtime', supervisor: 'breaker-open', fresh: true },
      { scenario: 'Unsafe diagnostic', concern: 'diagnostics', supervisor: 'stopped-manual', fresh: true },
      { scenario: 'Stale evidence', concern: 'package', supervisor: 'stopped-manual', fresh: false },
      { scenario: 'Ready', concern: 'none', supervisor: 'stopped-clean', fresh: true },
    ] as const;
    for (let index = 0; index < 5; index += 1) {
      fixture.panel.nextScenario();
      observed.add(fixture.panel.scenarioName);
      const scenario = expected[index];
      expect(fixture.panel.scenarioName).toBe(scenario?.scenario);
      expect(fixture.panel.blockingConcern).toBe(scenario?.concern);
      expect(fixture.panel.supervisorAction).toBe(scenario?.supervisor);
      expect(fixture.panel.evidenceFresh).toBe(scenario?.fresh);
      expect(fixture.panel.diagnosticLeaks).toBe(0);
      expect(fixture.panel.diagnosticRecords).toBeLessThanOrEqual(6);
      expect(fixture.panel.diagnosticSnapshot).not.toContain('fixture-secret-payload');
    }
    expect(observed).toEqual(new Set(['Ready', 'Non-TTY', 'Crash loop', 'Unsafe diagnostic', 'Stale evidence']));
    expect(fixture.panel.scenarioName).toBe('Ready');
    expect(fixture.panel.decision).toBe('ship');
    expect(fixture.panel.evidenceFresh).toBe(true);
    fixture.app.loop.dispose();
  });

  test('should keep stale evidence no-go while recovery remains a rehearsal', () => {
    const fixture = mount(new ReleaseRehearsalPanel());
    for (let index = 0; index < 4; index += 1) fixture.panel.nextScenario();
    expect(fixture.panel.scenarioName).toBe('Stale evidence');
    expect(fixture.panel.decision).toBe('no-go');
    expect(fixture.panel.evidenceFresh).toBe(false);
    fixture.panel.verifyRecovery();
    expect(fixture.panel.recoveries).toBe(1);
    expect(fixture.panel.decision).toBe('no-go');
    expect(fixture.panel.feedback).toMatch(/native proof still required/iu);
    fixture.app.loop.dispose();
  });

  test('should stop release transitions after exact cleanup', () => {
    const fixture = mount(new ReleaseRehearsalPanel());
    fixture.app.loop.dispose();
    fixture.panel.nextScenario();
    fixture.panel.verifyRecovery();
    expect(fixture.panel.scenarioName).toBe('Ready');
    expect(fixture.panel.scenarioChanges).toBe(0);
    expect(fixture.panel.recoveries).toBe(0);
    expect(fixture.panel.cleanupCount).toBe(1);
  });
});
